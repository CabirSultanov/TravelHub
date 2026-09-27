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

export type DriverRideStatus = 'AwaitingDriver' | 'DriverAssigned' | 'DriverArrived' | 'Completed';

export type DriverRide = {
  id: number;
  taxiServiceName: string;
  carClassName: string;
  customerName: string;
  phoneNumber: string;
  pickupAddress: string;
  dropoffAddress: string;
  distanceKm: number;
  totalPrice: number;
  status: DriverRideStatus;
  acceptedAt?: string | null;
  arrivedAt?: string | null;
  completedAt?: string | null;
};

export type LoginRequest = {
  email: string;
  password: string;
};
