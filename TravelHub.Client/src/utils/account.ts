import { isStrongPassword } from './authValidation';
import type { AuthForm, ProfileForm } from '../types';

export const accountPhonePrefix = '+994';

export function toAzerbaijanPhoneNumber(phoneNumber: string) {
  return normalizeAzerbaijanPhoneNumber(phoneNumber) ?? `${accountPhonePrefix} ${stripAzerbaijanPhonePrefix(phoneNumber)}`.trim();
}

export function stripAzerbaijanPhonePrefix(phoneNumber: string) {
  const trimmed = phoneNumber.trim();
  return trimmed.startsWith(accountPhonePrefix) ? trimmed.slice(accountPhonePrefix.length).trim() : trimmed;
}

export function getRegistrationValidationMessage(form: AuthForm) {
  const name = form.name.trim();
  const email = form.email.trim();
  const password = form.password;

  if (name.length < 2) return 'Name must be at least 2 characters.';
  if (!/^[\p{L}\s'-]+$/u.test(name) || !/\p{L}/u.test(name)) return 'Name must contain letters and may include spaces, hyphens, or apostrophes.';
  if (email.length > 150 || /\s/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address.';
  if (!email.toLowerCase().endsWith('@gmail.com')) return 'Only Gmail addresses (@gmail.com) are allowed.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 128) return 'Password must be at most 128 characters.';
  if (!/\p{Lu}/u.test(password)) return 'Password must contain an uppercase letter.';
  if (!/\p{Ll}/u.test(password)) return 'Password must contain a lowercase letter.';
  if (!/\p{Nd}/u.test(password)) return 'Password must contain a number.';
  if (!/[^\p{L}\p{N}]/u.test(password)) return 'Password must contain a special character.';
  if (!normalizeAzerbaijanPhoneNumber(form.phoneNumber)) return 'Please enter a valid Azerbaijan phone number.';

  return '';
}

export function getProfileValidationMessage(form: ProfileForm) {
  const name = form.name.trim();
  const email = form.email.trim();
  const passwordChangeRequested = form.changePassword || Boolean(form.newPassword) || Boolean(form.confirmNewPassword);

  if (name.length < 2) return 'Name must be at least 2 characters.';
  if (!/^[\p{L}\s'-]+$/u.test(name) || !/\p{L}/u.test(name)) return 'Name must contain letters and may include spaces, hyphens, or apostrophes.';
  if (email.length > 150 || /\s/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address.';
  if (!email.toLowerCase().endsWith('@gmail.com')) return 'Only Gmail addresses (@gmail.com) are allowed.';
  if (!normalizeAzerbaijanPhoneNumber(form.phoneNumber)) return 'Please enter a valid Azerbaijan phone number.';
  if (!passwordChangeRequested) return '';
  if (!isStrongPassword(form.newPassword)) return 'New password does not meet the password requirements.';
  if (form.newPassword !== form.confirmNewPassword) return 'Passwords do not match.';

  return '';
}

export function normalizeAzerbaijanPhoneNumber(phoneNumber: string) {
  const trimmed = phoneNumber.trim();
  if (!trimmed || /[^0-9\s()+-]/.test(trimmed)) return null;

  const plusIndex = trimmed.indexOf('+');
  if (plusIndex > 0 || plusIndex !== trimmed.lastIndexOf('+')) return null;

  const digits = trimmed.replace(/\D/g, '');
  let localDigits = digits;
  if (trimmed.startsWith(accountPhonePrefix) && digits.startsWith('994')) localDigits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('994')) localDigits = digits.slice(3);
  else if (digits.length === 10 && digits.startsWith('0')) localDigits = digits.slice(1);
  if (localDigits.length === 10 && localDigits.startsWith('0')) localDigits = localDigits.slice(1);

  return localDigits.length === 9 ? `${accountPhonePrefix}${localDigits}` : null;
}
