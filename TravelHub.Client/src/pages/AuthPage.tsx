import type { FormEvent } from 'react';
import type { AuthForm, AuthMode } from '../types';

type AuthPageProps = {
  authMode: AuthMode;
  authForm: AuthForm;
  submitting: boolean;
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
  accountPhonePrefix,
  accountPhonePattern,
  onSubmit,
  onAuthFormChange,
  onToggleMode,
}: AuthPageProps) {
  return (
    <section className="auth-page">
      <div className="auth-panel">
        <p className="eyebrow">Account</p>
        <h2>{authMode === 'register' ? 'Register' : 'Login'}</h2>

        <form className="auth-form" onSubmit={onSubmit}>
          {authMode === 'register' && (
            <>
              <input
                placeholder="Name"
                value={authForm.name}
                onChange={(event) => onAuthFormChange({ ...authForm, name: event.target.value })}
                required
              />
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
            </>
          )}
          <input
            placeholder="Email"
            type="email"
            value={authForm.email}
            onChange={(event) => onAuthFormChange({ ...authForm, email: event.target.value })}
            required
          />
          <input
            minLength={6}
            placeholder="Password"
            type="password"
            value={authForm.password}
            onChange={(event) => onAuthFormChange({ ...authForm, password: event.target.value })}
            required
          />
          <button className="primary" disabled={submitting} type="submit">
            {authMode === 'register' ? 'Register' : 'Login'}
          </button>
          <button className="link-button" type="button" onClick={onToggleMode}>
            {authMode === 'register' ? 'Use existing account' : 'Create account'}
          </button>
        </form>
      </div>
    </section>
  );
}
