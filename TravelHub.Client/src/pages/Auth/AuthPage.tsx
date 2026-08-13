import type { FormEvent } from 'react';
import type { AuthForm, AuthMode } from '../../types';

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
              <label className="field-box">
                <span>Password</span>
                <input
                  minLength={6}
                  placeholder="Password"
                  type="password"
                  value={authForm.password}
                  onChange={(event) => onAuthFormChange({ ...authForm, password: event.target.value })}
                  required
                />
              </label>
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
