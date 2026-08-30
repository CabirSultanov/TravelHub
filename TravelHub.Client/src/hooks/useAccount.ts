import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import type { AuthForm, AuthMode, AuthUser, EmailConfirmationRequired, ProfileForm } from '../types';
import { getErrorMessage } from '../utils/errors';
import { getProfileValidationMessage, getRegistrationValidationMessage, stripAzerbaijanPhonePrefix, toAzerbaijanPhoneNumber } from '../utils/account';

const emptyAuthForm: AuthForm = { name: '', email: '', phoneNumber: '', password: '' };
const emptyProfileForm: ProfileForm = { name: '', email: '', phoneNumber: '', changePassword: false, newPassword: '', confirmNewPassword: '' };

type Options = {
  initialAuthMode: AuthMode;
  setMessage: (message: string) => void;
  setSubmitting: (submitting: boolean) => void;
  onAuthenticated: () => void;
  onSignedOut: () => void;
};

export function useAccount({ initialAuthMode, setMessage, setSubmitting, onAuthenticated, onSignedOut }: Options) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>(initialAuthMode);
  const [authForm, setAuthForm] = useState<AuthForm>(emptyAuthForm);
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm);
  const [emailConfirmation, setEmailConfirmation] = useState<EmailConfirmationRequired | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [now, setNow] = useState(Date.now());
  const [editingProfile, setEditingProfile] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api.refresh().then((session) => session && setCurrentUser(session.user)).catch((error) => setMessage(getErrorMessage(error))).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!emailConfirmation?.resendAvailableAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [emailConfirmation?.resendAvailableAt]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage('');
    const validationMessage = authMode === 'register' ? getRegistrationValidationMessage(authForm) : '';
    if (validationMessage) return setMessage(validationMessage);
    setSubmitting(true);
    try {
      const response = authMode === 'register'
        ? await api.register({ ...authForm, phoneNumber: toAzerbaijanPhoneNumber(authForm.phoneNumber) })
        : await api.login({ email: authForm.email, password: authForm.password });

      if ('emailConfirmationRequired' in response) {
        openEmailConfirmation(response);
        setMessage('Enter the verification code sent to your Gmail address.');
        return;
      }

      setCurrentUser(response.user); setAuthForm(emptyAuthForm); setMessage('Logged in.'); onAuthenticated();
    } catch (error) { setMessage(getErrorMessage(error)); } finally { setSubmitting(false); }
  }

  async function submitEmailVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailConfirmation || verificationCode.length !== 6) return;
    setMessage(''); setSubmitting(true);
    try {
      const response = await api.verifyEmail({ email: emailConfirmation.email, code: verificationCode });
      setCurrentUser(response.user); setAuthForm(emptyAuthForm); setEmailConfirmation(null); setVerificationCode(''); setMessage('Email verified. Welcome to TravelHub!'); onAuthenticated();
    } catch (error) { setMessage(getErrorMessage(error)); } finally { setSubmitting(false); }
  }

  async function resendEmailVerification() {
    if (!emailConfirmation || resendSeconds > 0) return;
    setMessage(''); setSubmitting(true);
    try {
      const response = await api.resendEmailConfirmation(emailConfirmation.email);
      openEmailConfirmation(response);
      setMessage('A new verification code has been sent.');
    } catch (error) { setMessage(getErrorMessage(error)); } finally { setSubmitting(false); }
  }

  function openEmailConfirmation(confirmation: EmailConfirmationRequired) {
    setEmailConfirmation(confirmation);
    setVerificationCode('');
    setAuthForm({ ...emptyAuthForm, email: confirmation.email });
  }

  function returnToLogin() {
    const email = emailConfirmation?.email ?? authForm.email;
    setEmailConfirmation(null); setVerificationCode(''); setAuthMode('login'); setAuthForm({ ...emptyAuthForm, email }); setMessage('');
  }

  const resendSeconds = emailConfirmation?.resendAvailableAt
    ? Math.max(0, Math.ceil((Date.parse(emailConfirmation.resendAvailableAt) - now) / 1000))
    : 0;

  async function signOut(removeProfile: boolean) {
    if (removeProfile && !window.confirm('Delete your profile? This cannot be undone.')) return;
    setSubmitting(true); setMessage('');
    try {
      if (removeProfile) await api.deleteProfile(); else await api.logout();
      setCurrentUser(null); setProfileForm(emptyProfileForm); setEditingProfile(false); onSignedOut(); setMessage(removeProfile ? 'Profile deleted.' : 'Logged out.');
    } catch (error) { setMessage(getErrorMessage(error)); } finally { setSubmitting(false); }
  }

  function openProfileEditor() {
    if (!currentUser) return;
    setProfileForm({ name: currentUser.name, email: currentUser.email, phoneNumber: stripAzerbaijanPhonePrefix(currentUser.phoneNumber), changePassword: false, newPassword: '', confirmNewPassword: '' });
    setEditingProfile(true); setMessage('');
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage('');
    const validationMessage = getProfileValidationMessage(profileForm);
    if (validationMessage) return setMessage(validationMessage);
    setSubmitting(true);
    try {
      const user = await api.updateProfile({ ...profileForm, name: profileForm.name.trim(), email: profileForm.email.trim(), phoneNumber: toAzerbaijanPhoneNumber(profileForm.phoneNumber) });
      setCurrentUser(user); setProfileForm(emptyProfileForm); setEditingProfile(false); setMessage('Profile updated successfully.');
    } catch (error) { setMessage(getErrorMessage(error)); } finally { setSubmitting(false); }
  }

  return { currentUser, setCurrentUser, authMode, setAuthMode, authForm, setAuthForm, profileForm, setProfileForm, editingProfile, setEditingProfile, loading, emailConfirmation, verificationCode, setVerificationCode, resendSeconds, submitAuth, submitEmailVerification, resendEmailVerification, returnToLogin, logout: () => signOut(false), deleteProfile: () => signOut(true), openProfileEditor, submitProfile };
}
