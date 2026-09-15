import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AuthPage from './AuthPage';
import PasswordRecoveryForm, { validateRecoveryPassword } from './PasswordRecoveryForm';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.resetModules(); });

describe('password recovery', () => {
  it('offers recovery on sign in, without changing registration or requiring a password', () => {
    const props = { authForm: { name: '', email: '', phoneNumber: '', password: '' }, emailConfirmation: null, verificationCode: '', resendSeconds: 0, submitting: false, message: '', accountPhonePrefix: '+994', accountPhonePattern: '', onSubmit: vi.fn(), onAuthFormChange: vi.fn(), onToggleMode: vi.fn(), onVerificationCodeChange: vi.fn(), onVerifyEmail: vi.fn(), onResendEmail: vi.fn(), onReturnToLogin: vi.fn() };
    expect(renderToStaticMarkup(<AuthPage {...props} authMode="login" />)).toContain('Forgot password?');
    expect(renderToStaticMarkup(<AuthPage {...props} authMode="register" />)).not.toContain('Forgot password?');
    const recovery = renderToStaticMarkup(<PasswordRecoveryForm initialEmail="person@gmail.com" onClose={vi.fn()} />);
    expect(recovery).toContain('value="person@gmail.com"');
    expect(recovery).toContain('Send recovery code');
    expect(recovery).toContain('Back to Sign in');
    expect(recovery).not.toContain('type="password"');
  });

  it('enforces the existing password rules and matching confirmation', () => {
    expect(validateRecoveryPassword('Travel123!', 'Travel123!')).toBe('');
    expect(validateRecoveryPassword('Travel123!', 'different')).toBe('Passwords do not match.');
    for (const password of ['short', 'lowercase1!', 'UPPERCASE1!', 'NoNumbers!', 'NoSpecial1', 'A1!' + 'a'.repeat(126)])
      expect(validateRecoveryPassword(password, password)).not.toBe('');
  });

  it('uses public recovery endpoints without attaching a session or trying refresh', async () => {
    const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ accessToken: 'test-session' }))
      .mockResolvedValueOnce(response({ message: 'Check email', resendAfterSeconds: 60 }))
      .mockResolvedValueOnce(response({ resetToken: 'test-grant', expiresAt: '2026-09-15T12:10:00Z' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const { api } = await import('../../api');
    await api.login({ email: 'person@gmail.com', password: 'Travel123!' });
    const controller = new AbortController();
    await api.requestPasswordCode('person@gmail.com', controller.signal);
    await api.verifyPasswordCode('person@gmail.com', '123456', controller.signal);
    await api.resetPassword({ email: 'person@gmail.com', resetToken: 'test-grant', newPassword: 'Changed123!', confirmNewPassword: 'Changed123!' }, controller.signal);
    const calls = fetchMock.mock.calls as [string, RequestInit][];
    expect(calls.slice(1).map(call => call[0])).toEqual(['/api/auth/forgot-password', '/api/auth/verify-password-code', '/api/auth/reset-password']);
    for (const [, init] of calls.slice(1)) {
      expect(new Headers(init.headers).has('Authorization')).toBe(false);
      expect(init.method).toBe('POST');
      expect(init.signal).toBe(controller.signal);
    }
    fetchMock.mockResolvedValueOnce(response('Recovery expired', 401));
    await expect(api.verifyPasswordCode('person@gmail.com', '123456')).rejects.toThrow('Recovery expired');
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
