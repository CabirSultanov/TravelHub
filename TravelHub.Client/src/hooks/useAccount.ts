import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import type { AuthForm, AuthMode, AuthUser, ProfileForm } from '../types';
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
  const [editingProfile, setEditingProfile] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api.refresh().then((session) => session && setCurrentUser(session.user)).catch((error) => setMessage(getErrorMessage(error))).finally(() => setLoading(false));
  }, []);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage('');
    const validationMessage = authMode === 'register' ? getRegistrationValidationMessage(authForm) : '';
    if (validationMessage) return setMessage(validationMessage);
    setSubmitting(true);
    try {
      const response = authMode === 'register' ? await api.register({ ...authForm, phoneNumber: toAzerbaijanPhoneNumber(authForm.phoneNumber) }) : await api.login({ email: authForm.email, password: authForm.password });
      setCurrentUser(response.user); setAuthForm(emptyAuthForm); setMessage(authMode === 'register' ? 'Registration completed.' : 'Logged in.'); onAuthenticated();
    } catch (error) { setMessage(getErrorMessage(error)); } finally { setSubmitting(false); }
  }

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

  return { currentUser, setCurrentUser, authMode, setAuthMode, authForm, setAuthForm, profileForm, setProfileForm, editingProfile, setEditingProfile, loading, submitAuth, logout: () => signOut(false), deleteProfile: () => signOut(true), openProfileEditor, submitProfile };
}
