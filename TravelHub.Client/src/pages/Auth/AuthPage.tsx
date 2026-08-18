import { useState, type FormEvent } from 'react';
import type { AuthForm, AuthMode } from '../../types';
import { getPasswordRequirements } from '../../utils/authValidation';

type AuthPageProps = {
  authMode: AuthMode;
  authForm: AuthForm;
  submitting: boolean;
  message: string;
  accountPhonePrefix: string;
  accountPhonePattern: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onAuthFormChange: (form: AuthForm) => void;
  onToggleMode: () => void;
};

export default function AuthPage({
  authMode,
  authForm,
  submitting,
  message,
  accountPhonePrefix,
  accountPhonePattern,
  onSubmit,
  onAuthFormChange,
  onToggleMode,
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
          </div>
        </section>
      </main>
    </section>
  );
}
