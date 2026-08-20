import { describe, expect, it } from 'vitest';
import { getRegistrationValidationMessage, normalizeAzerbaijanPhoneNumber } from './account';

describe('account helpers', () => {
  it('normalizes accepted Azerbaijan phone formats', () => {
    expect(normalizeAzerbaijanPhoneNumber('050 123 45 67')).toBe('+994501234567');
    expect(normalizeAzerbaijanPhoneNumber('+994 50 123 45 67')).toBe('+994501234567');
  });

  it('rejects invalid registration data', () => {
    expect(getRegistrationValidationMessage({ name: 'A', email: 'person@gmail.com', phoneNumber: '0501234567', password: 'Travel123!' })).toBe('Name must be at least 2 characters.');
  });
});
