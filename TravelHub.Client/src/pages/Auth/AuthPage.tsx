import { useState, type FormEvent } from 'react';
import type { AuthForm, AuthMode, EmailConfirmationRequired } from '../../types';
import { getPasswordRequirements } from '../../utils/authValidation';

type AuthPageProps = {
  authMode: AuthMode;
  authForm: AuthForm;
  emailConfirmation: EmailConfirmationRequired | null;
  verificationCode: string;
  resendSeconds: number;
  submitting: boolean;
  message: string;
  accountPhonePrefix: string;
  accountPhonePattern: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onAuthFormChange: (form: AuthForm) => void;
  onToggleMode: () => void;
  onVerificationCodeChange: (code: string) => void;
  onVerifyEmail: (event: FormEvent<HTMLFormElement>) => void;
  onResendEmail: () => void;
  onReturnToLogin: () => void;
};

export default function AuthPage({
  authMode,
  authForm,
  emailConfirmation,
  verificationCode,
  resendSeconds,
  submitting,
  message,
  accountPhonePrefix,
  accountPhonePattern,
  onSubmit,
  onAuthFormChange,
  onToggleMode,
  onVerificationCodeChange,
  onVerifyEmail,
  onResendEmail,
  onReturnToLogin,
}: AuthPageProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const passwordRequirements = getPasswordRequirements(authForm.password);

  return (
    <section className="auth-page od-auth-page">
      <main className="auth-wrap">
        <section className="auth-shell">
          <div className="auth-media">
            <p className="eyebrow">TravelHub account</p>
            <h1>Keep every Azerbaijan trip close.</h1>
            <p>Sign in to manage hotel bookings, taxi rides, saved routes, payments, and profile preferences.</p>
          </div>

          <div className="auth-panel">
            <p className="eyebrow">Account</p>
            {emailConfirmation ? (
              <section className="email-verification" aria-labelledby="email-verification-title">
                <h2 id="email-verification-title">Verify your email</h2>
                <p>We sent a 6-digit verification code to:</p>
                <strong>{maskEmail(emailConfirmation.email)}</strong>
                <form className="auth-form" onSubmit={onVerifyEmail}>
                  <label className="field-box">
                    <span>Verification code</span>
                    <input
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      maxLength={6}
                      pattern="[0-9]{6}"
                      placeholder="6-digit code"
                      value={verificationCode}
                      onChange={(event) => onVerificationCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                    />
                  </label>
                  {message && <p className="auth-message">{message}</p>}
                  <button className="btn btn-primary btn-wide" disabled={submitting || verificationCode.length !== 6} type="submit">Verify</button>
                </form>
                <p className="email-verification-resend">Didn't receive the code?</p>
                <button className="btn btn-secondary btn-wide" disabled={submitting || resendSeconds > 0} onClick={onResendEmail} type="button">
                  {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : 'Resend code'}
                </button>
                <button className="link-button" disabled={submitting} onClick={onReturnToLogin} type="button">Return to Sign in</button>
              </section>
            ) : (
              <>
            <h2>{authMode === 'register' ? 'Create account' : 'Sign in to TravelHub'}</h2>
            <div className="auth-tabs" role="tablist">
              <button className={authMode === 'login' ? 'is-active' : ''} onClick={authMode === 'register' ? onToggleMode : undefined} type="button">
                Sign in
              </button>
              <button className={authMode === 'register' ? 'is-active' : ''} onClick={authMode === 'login' ? onToggleMode : undefined} type="button">
                Create account
              </button>
            </div>

            <form className="auth-form" onSubmit={onSubmit}>
              {authMode === 'register' && (
                <>
                  <label className="field-box">
                    <span>Name</span>
                    <input
                      placeholder="Name"
                      value={authForm.name}
                      onChange={(event) => onAuthFormChange({ ...authForm, name: event.target.value })}
                      required
                    />
                  </label>
                  <label className="field-box">
                    <span>Phone</span>
                    <div className="phone-field">
                      <span>{accountPhonePrefix}</span>
                      <input
                        pattern={accountPhonePattern}
                        placeholder="Phone number"
                        type="tel"
                        value={authForm.phoneNumber}
                        onChange={(event) => onAuthFormChange({ ...authForm, phoneNumber: event.target.value })}
                        required
                      />
                    </div>
                  </label>
                </>
              )}
              <label className="field-box">
                <span>Email</span>
                <input
                  placeholder="Email"
                  type="email"
                  value={authForm.email}
                  onChange={(event) => onAuthFormChange({ ...authForm, email: event.target.value })}
                  required
                />
              </label>
              <div className="field-box">
                <span>Password</span>
                <div className="password-field">
                  <input
                    id="auth-password"
                    maxLength={128}
                    minLength={authMode === 'register' ? 8 : undefined}
                    placeholder="Password"
                    type={passwordVisible ? 'text' : 'password'}
                    value={authForm.password}
                    onChange={(event) => onAuthFormChange({ ...authForm, password: event.target.value })}
                    required
                  />
                  <button
                    aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                    className="password-toggle"
                    onClick={() => setPasswordVisible((visible) => !visible)}
                    title={passwordVisible ? 'Hide password' : 'Show password'}
                    type="button"
                  >
                    <span className={`auth-password-eye ${passwordVisible ? 'is-open' : ''}`} aria-hidden="true" />
                  </button>
                </div>
                {authMode === 'register' && (
                  <div className="password-requirements">
                    <strong>Password requirements</strong>
                    <ul>
                      {passwordRequirements.map((requirement) => (
                        <li className={requirement.valid ? 'is-valid' : 'is-invalid'} key={requirement.label}>
                          <span aria-hidden="true">{requirement.valid ? '✓' : '✗'}</span>
                          {requirement.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {message && <p className="auth-message">{message}</p>}
              <button className="btn btn-primary btn-wide" disabled={submitting} type="submit">
                {authMode === 'register' ? 'Create account' : 'Sign in'}
              </button>
            </form>
              </>
            )}
          </div>
        </section>
      </main>
    </section>
  );
}

function maskEmail(email: string) {
  const [localPart, domain] = email.split('@');
  return `${localPart?.slice(0, 1) ?? ''}***@${domain ?? ''}`;
}
