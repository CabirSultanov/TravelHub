export type UserRole = 'User' | 'Admin' | 'SuperAdmin';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isBlocked: boolean;
};

export type RegisterRequest = {
  name: string;
  email: string;
  password: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type Hotel = {
  id: number;
  name: string;
  city: string;
  address: string;
  pricePerNight: number;
  description: string;
  imageUrl?: string | null;
};

export type HotelRoom = {
  id: number;
  hotelId: number;
  roomType: string;
  capacity: number;
  totalRooms: number;
  pricePerNight: number;
  description: string;
  imageUrl?: string | null;
  isAvailable: boolean;
};

export type TaxiService = {
  id: number;
  companyName: string;
  city: string;
  phoneNumber: string;
  pricePerKm: number;
  description: string;
  imageUrl?: string | null;
};

export type TaxiServiceInput = Omit<TaxiService, 'id'>;

export type Place = {
  id: number;
  name: string;
  city: string;
  description: string;
  imageUrl?: string | null;
};

export type Booking = {
  id: number;
  userId?: number | null;
  hotelRoomId: number;
  hotelId: number;
  roomType: string;
  customerName: string;
  phoneNumber: string;
  email: string;
  checkInDate: string;
  checkOutDate: string;
  guestsCount: number;
  status: 'PendingPayment' | 'Paid' | 'Cancelled';
  paidAt?: string | null;
  cancelledAt?: string | null;
  savedCardLast4?: string | null;
  totalPrice: number;
};

export type BookingCreate = {
  hotelRoomId: number;
  customerName: string;
  phoneNumber: string;
  email: string;
  checkInDate: string;
  checkOutDate: string;
  guestsCount: number;
};

export type BookingPayment = {
  cardNumber: string;
  cardHolderName: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
  saveCard: boolean;
};
