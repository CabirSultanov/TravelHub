import { describe, expect, it } from 'vitest';
import { getPasswordRequirements, isStrongPassword } from './authValidation';

describe('auth validation', () => {
  it('checks password requirements independently', () => {
    const requirements = getPasswordRequirements('Travel123!');

    expect(requirements.map((requirement) => requirement.valid)).toEqual([true, true, true, true, true]);
    expect(isStrongPassword('Travel123!')).toBe(true);
    expect(isStrongPassword('Password1')).toBe(false);
  });
});
