export function getPasswordRequirements(password: string) {
  return [
    { label: 'At least 8 characters', valid: password.length >= 8 },
    { label: 'One uppercase letter', valid: /\p{Lu}/u.test(password) },
    { label: 'One lowercase letter', valid: /\p{Ll}/u.test(password) },
    { label: 'One number', valid: /\p{Nd}/u.test(password) },
    { label: 'One special character', valid: /[^\p{L}\p{N}]/u.test(password) },
  ];
}

export function isStrongPassword(password: string) {
  return getPasswordRequirements(password).every((requirement) => requirement.valid);
}
