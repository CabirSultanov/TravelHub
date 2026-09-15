import type { UserRole } from '@/types/auth';

const allowedRoles: ReadonlySet<UserRole> = new Set(['TaxiDriver', 'Admin', 'SuperAdmin']);

export function canAccessMobileApp(role: UserRole) {
  return allowedRoles.has(role);
}
