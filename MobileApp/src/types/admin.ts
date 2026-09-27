export type AdminRide = {
  id: number;
  userId: number;
  taxiServiceId: number;
  taxiServiceName: string;
  carClassName: string;
  customerName: string;
  phoneNumber: string;
  email: string;
  pickupAddress: string;
  dropoffAddress: string;
  distanceKm: number;
  totalPrice: number;
  status: string;
  driverId?: number | null;
  driverName?: string | null;
  driverPhoneNumber?: string | null;
  acceptedAt?: string | null;
  arrivedAt?: string | null;
  completedAt?: string | null;
  paidAt?: string | null;
  cancelledAt?: string | null;
  savedCardLast4?: string | null;
  rating?: number | null;
  reviewComment?: string | null;
  reviewedAt?: string | null;
};

export type TaxiFleet = {
  id: number;
  companyName: string;
  city: string;
  phoneNumber: string;
  ownerId?: number | null;
};

export type PagedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};
