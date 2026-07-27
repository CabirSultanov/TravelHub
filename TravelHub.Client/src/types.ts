export type UserRole = 'User' | 'Admin' | 'SuperAdmin';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  isBlocked: boolean;
};

export type RegisterRequest = {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type UpdateProfileRequest = {
  name: string;
  phoneNumber: string;
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

export type TaxiCarClass = {
  id: number;
  name: string;
  pricePerKm: number;
};

export type TaxiCarClassInput = Omit<TaxiCarClass, 'id'>;

export type TaxiService = {
  id: number;
  companyName: string;
  city: string;
  phoneNumber: string;
  description: string;
  imageUrl?: string | null;
  carClasses: TaxiCarClass[];
};

export type TaxiServiceInput = Omit<TaxiService, 'id' | 'carClasses'> & {
  carClasses: TaxiCarClassInput[];
};

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
  hotelName: string;
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
