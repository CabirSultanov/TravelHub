import type { UserRole } from '@/types/auth';

const allowedRoles: ReadonlySet<UserRole> = new Set(['TaxiDriver', 'Admin', 'SuperAdmin']);

export function canAccessMobileApp(role: UserRole) {
  return allowedRoles.has(role);
}

export function canAccessControl(role?: UserRole) {
  return role === 'Admin' || role === 'SuperAdmin';
}

export function getMobileHome(role?: UserRole) {
  if (canAccessControl(role)) return '/admin/overview' as const;
  return role === 'TaxiDriver' ? '/(driver)/available' as const : '/login' as const;
}
