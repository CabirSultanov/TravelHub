export type UserRole = 'User' | 'Admin' | 'SuperAdmin' | 'HotelOwner' | 'TaxiOwner' | 'TaxiDriver';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  isBlocked: boolean;
  taxiServiceId?: number | null;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  accessTokenExpiresAt: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};
