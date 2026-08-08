export type Page = 'home' | 'taxi' | 'hotels' | 'places' | 'auth' | 'admin' | 'profile';
export type AuthMode = 'login' | 'register';
export type PaymentMode = 'saved' | 'new';

export type AuthForm = {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
};

export type ProfileForm = {
  name: string;
  phoneNumber: string;
};

export type PaymentForm = {
  savedPaymentCardId: string;
  cardNumber: string;
  cardHolderName: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  saveCard: boolean;
};

export type PaymentCardForm = {
  cardNumber: string;
  cardHolderName: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
};

export type DeleteTarget = {
  kind: 'hotel' | 'room';
  id: number;
  name: string;
};

export type UserRole = 'User' | 'Admin' | 'SuperAdmin';
export type BookingStatus = 'PendingPayment' | 'Paid' | 'Cancelled';

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

export type HotelUpdateInput = {
  name: string;
  city: string;
  description: string;
  imageUrl?: string | null;
};

export type Hotel = HotelUpdateInput & {
  id: number;
  roomTypesCount: number;
  totalRoomsCount: number;
  totalGuestPlaces: number;
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
  imageUrls: string[];
  isAvailable: boolean;
};

export type HotelRoomInput = Omit<HotelRoom, 'id'>;

export type HotelCreateRoomInput = Omit<HotelRoomInput, 'hotelId' | 'imageUrl'>;

export type HotelInput = HotelUpdateInput & {
  rooms: HotelCreateRoomInput[];
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

export type SavedPaymentCard = {
  id: number;
  cardHolderName: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
};

export type PaymentCardCreate = {
  cardNumber: string;
  cardHolderName: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
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
  status: BookingStatus;
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
};

export type BookingPayment = {
  cardNumber?: string | null;
  cardHolderName?: string | null;
  expiryMonth?: number;
  expiryYear?: number;
  cvv?: string | null;
  savedPaymentCardId?: number | null;
  saveCard: boolean;
};

export type TaxiBooking = {
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
  pickupX: number;
  pickupY: number;
  dropoffX: number;
  dropoffY: number;
  distanceKm: number;
  pricePerKm: number;
  totalPrice: number;
  status: BookingStatus;
  paidAt?: string | null;
  cancelledAt?: string | null;
  savedCardLast4?: string | null;
};

export type TaxiBookingCreate = {
  taxiServiceId: number;
  carClassName: string;
  customerName: string;
  phoneNumber: string;
  email: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupX: number;
  pickupY: number;
  dropoffX: number;
  dropoffY: number;
};
