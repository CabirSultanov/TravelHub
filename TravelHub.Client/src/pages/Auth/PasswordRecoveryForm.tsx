import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../../api';
import type { PasswordCodeVerified } from '../../types';
import { getPasswordRequirements } from '../../utils/authValidation';
import './passwordRecovery.css';

type Stage = 'email' | 'code' | 'password' | 'done';

export function validateRecoveryPassword(password: string, confirmation: string) {
  if (password.length > 128 || !getPasswordRequirements(password).every(item => item.valid))
    return 'Please meet all password requirements (maximum 128 characters).';
  return password === confirmation ? '' : 'Passwords do not match.';
}

export default function PasswordRecoveryForm({ initialEmail, onClose }: { initialEmail: string; onClose: (email: string) => void }) {
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [grant, setGrant] = useState<PasswordCodeVerified | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const request = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const resendSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const expired = grant !== null && Date.parse(grant.expiresAt) <= now;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(timer);
      request.current?.abort();
      request.current = null;
    };
  }, []);
  useEffect(() => { heading.current?.focus(); }, [stage]);

  async function run<T>(operation: (signal: AbortSignal) => Promise<T>, success: (value: T) => void) {
    if (request.current) return; // Guard synchronous double clicks as well as disabled buttons.
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    setNotice('');
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const result = await operation(controller.signal);
      if (request.current === controller) success(result);
    } catch (failure) {
      if (request.current !== controller) return;
      setError(controller.signal.aborted
        ? stage === 'password'
          ? 'The response timed out. Your password may have changed. Try signing in with the new password before requesting another code.'
          : 'The request timed out. Please check your connection and try again.'
        : failure instanceof TypeError ? 'Connection lost. Please check your connection and try again.'
          : failure instanceof Error ? failure.message : 'Something went wrong. Please try again.');
    } finally {
      window.clearTimeout(timer);
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  function sendCode() {
    const normalized = email.trim().toLowerCase();
    void run(signal => api.requestPasswordCode(normalized, signal), result => {
      setEmail(normalized);
      setCode('');
      setGrant(null);
      setPassword('');
      setConfirmation('');
      setPasswordVisible(false);
      setConfirmationVisible(false);
      setStage('code');
      setNotice(result.message);
      setNow(Date.now());
      setResendAt(Date.now() + result.resendAfterSeconds * 1000);
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stage === 'email') return sendCode();
    if (stage === 'code') {
      if (!/^[0-9]{6}$/.test(code)) return;
      void run(signal => api.verifyPasswordCode(email, code, signal), result => {
        setGrant(result);
        setCode('');
        setStage('password');
      });
    } else if (stage === 'password' && grant && !expired) {
      const validation = validateRecoveryPassword(password, confirmation);
      if (validation) { setError(validation); return; }
      void run(signal => api.resetPassword({ email, resetToken: grant.resetToken, newPassword: password, confirmNewPassword: confirmation }, signal), () => {
        setGrant(null);
        setPassword('');
        setConfirmation('');
        setStage('done');
      });
    }
  }

  const titles = { email: 'Forgot your password?', code: 'Check your email', password: 'Set a new password', done: 'Password updated' };
  const step = { email: 1, code: 2, password: 3, done: 3 }[stage];

  return (
    <section className="password-recovery" aria-labelledby="recovery-heading" aria-busy={busy}>
      <p className="eyebrow">Account recovery · Step {step} of 3</p>
      <h2 id="recovery-heading" ref={heading} tabIndex={-1}>{titles[stage]}</h2>
      <ol className="recovery-steps" aria-label="Password recovery steps">
        {['Email', 'Verify code', 'New password'].map((label, index) => <li key={label} className={index + 1 <= step ? 'is-current' : ''} aria-current={index + 1 === step ? 'step' : undefined}>{label}</li>)}
      </ol>

      {stage === 'done' ? (
        <p role="status">Your password has been changed. Sign in with your new password to continue.</p>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          {stage === 'email' && <>
            <p>Enter your account email. We'll send a 6-digit code to help you set a new password.</p>
            <label className="field-box"><span>Email</span>
              <input type="email" autoComplete="email" maxLength={150} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@gmail.com" required disabled={busy} />
            </label>
          </>}
          {stage === 'code' && <>
            <p>Enter the recovery code for <strong className="recovery-email">{email}</strong>. It expires in 10 minutes. Check Spam if the email hasn't arrived.</p>
            <label className="field-box"><span>Recovery code</span>
              <input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" required disabled={busy} />
            </label>
          </>}
          {stage === 'password' && <>
            <p>Email verified. Choose a strong password you haven't used elsewhere.</p>
            <div className="field-box">
              <label htmlFor="recovery-password">New password</label>
              <div className="password-field">
                <input id="recovery-password" autoComplete="new-password" type={passwordVisible ? 'text' : 'password'} minLength={8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} required disabled={busy || expired} aria-describedby="recovery-password-rules" />
                <button className="password-toggle" type="button" disabled={busy || expired} aria-label={passwordVisible ? 'Hide new password' : 'Show new password'} aria-pressed={passwordVisible} onClick={() => setPasswordVisible(value => !value)}>
                  <span className={`auth-password-eye ${passwordVisible ? 'is-open' : ''}`} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="password-requirements" id="recovery-password-rules"><ul>
              {getPasswordRequirements(password).map(item => <li className={item.valid ? 'is-valid' : 'is-invalid'} key={item.label}><span aria-hidden="true">{item.valid ? '✓' : '○'}</span>{item.label}</li>)}
            </ul></div>
            <div className="field-box">
              <label htmlFor="recovery-confirmation">Confirm new password</label>
              <div className="password-field">
                <input id="recovery-confirmation" autoComplete="new-password" type={confirmationVisible ? 'text' : 'password'} minLength={8} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} required disabled={busy || expired} />
                <button className="password-toggle" type="button" disabled={busy || expired} aria-label={confirmationVisible ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={confirmationVisible} onClick={() => setConfirmationVisible(value => !value)}>
                  <span className={`auth-password-eye ${confirmationVisible ? 'is-open' : ''}`} aria-hidden="true" />
                </button>
              </div>
            </div>
            {expired && <p role="alert">This recovery session has expired. Request a new code below.</p>}
          </>}
          {notice && <p className="recovery-notice" role="status">{notice}</p>}
          {error && <p className="auth-message" role="alert">{error}</p>}
          <button className="btn btn-primary btn-wide" type="submit" disabled={busy || (stage === 'code' && code.length !== 6) || (stage === 'password' && (expired || !password || !confirmation))}>
            {busy ? 'Please wait…' : stage === 'email' ? 'Send recovery code' : stage === 'code' ? 'Verify code' : 'Save new password'}
          </button>
        </form>
      )}

      {(stage === 'code' || stage === 'password') && <button className="btn btn-secondary btn-wide" type="button" disabled={busy || resendSeconds > 0} onClick={sendCode}>
        {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : 'Send a new code'}
      </button>}
      <button className={stage === 'done' ? 'btn btn-primary btn-wide' : 'link-button'} type="button" disabled={busy} onClick={() => onClose(email)}>Back to Sign in</button>
    </section>
  );
}
