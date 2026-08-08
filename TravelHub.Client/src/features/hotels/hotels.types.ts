import type { FormEvent } from 'react';
import type {
  AuthUser,
  Booking,
  BookingCreate,
  BookingGuestMode,
  DeleteTarget,
  Hotel,
  HotelRoom,
} from '../../types';

export type BookingForm = Omit<BookingCreate, 'hotelRoomId'>;

export type HotelRoomForm = {
  roomType: string;
  capacity: string;
  totalRooms: string;
  pricePerNight: string;
  description: string;
  imageUrls: string[];
  isAvailable: boolean;
};

export type HotelForm = {
  name: string;
  city: string;
  description: string;
  imageUrl: string;
  rooms: HotelRoomForm[];
};

export type HotelFormActions = {
  setForm: (form: HotelForm) => void;
  edit: (hotel: Hotel) => void;
  updateRoom: (index: number, update: Partial<HotelRoomForm>) => void;
  addRoom: () => void;
  removeRoom: (index: number) => void;
  updateRoomImageUrl: (roomIndex: number, imageIndex: number, imageUrl: string) => void;
  addRoomImageUrl: (roomIndex: number) => void;
  removeRoomImageUrl: (roomIndex: number, imageIndex: number) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  cancel: () => void;
};

export type RoomFormActions = {
  setForm: (form: HotelRoomForm) => void;
  startCreate: () => void;
  edit: (room: HotelRoom) => void;
  updateImageUrl: (index: number, imageUrl: string) => void;
  addImageUrl: () => void;
  removeImageUrl: (index: number) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  cancel: () => void;
};

export type HotelBookingFormActions = {
  setForm: (form: BookingForm) => void;
  selectGuestMode: (mode: BookingGuestMode) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  reset: () => void;
};

export type HotelsFeatureModel = {
  hotels: Hotel[];
  visibleHotels: Hotel[];
  cities: string[];
  rooms: HotelRoom[];
  selectedHotel: Hotel | null;
  selectedRoom: HotelRoom | null;
  booking: Booking | null;
  hotelForm: HotelForm;
  roomForm: HotelRoomForm;
  bookingForm: BookingForm;
  cityFilter: string;
  editingHotelId: number | null;
  editingRoomId: number | null;
  showHotelForm: boolean;
  showRoomForm: boolean;
  roomsLoading: boolean;
  canManageHotels: boolean;
  bookingGuestMode: BookingGuestMode;
  deleteTarget: DeleteTarget | null;
  loading: boolean;
};

export type HotelsFeatureActions = {
  hotelList: {
    startCreate: () => void;
    select: (hotel: Hotel) => void;
    setCityFilter: (city: string) => void;
    requestDelete: (target: DeleteTarget) => void;
  };
  hotelForm: HotelFormActions;
  roomList: {
    select: (room: HotelRoom) => void;
    edit: (room: HotelRoom) => void;
    requestDelete: (target: DeleteTarget) => void;
  };
  roomForm: RoomFormActions;
  booking: HotelBookingFormActions & {
    setBooking: (booking: Booking | null) => void;
  };
  delete: {
    cancel: () => void;
    confirm: () => void | Promise<void>;
  };
};

export type HotelsFeature = {
  model: HotelsFeatureModel;
  actions: HotelsFeatureActions;
};

export type HotelsFeatureOptions = {
  currentUser: AuthUser | null;
  setMessage: (message: string) => void;
  setSubmitting: (submitting: boolean) => void;
  onRequireAuth: (message: string) => void;
  onBookingCreated: (booking: Booking) => void;
  onResetPayment: () => void;
  onResetBookingFlow: () => void;
};
