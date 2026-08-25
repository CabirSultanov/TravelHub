import type { Hotel, HotelRoom } from '../../types';
import { hotelImageUrls, roomImageUrls } from '../../utils/images';
import type { BookingForm, HotelForm, HotelRoomForm } from './hotels.types';

const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const emptyBookingForm: BookingForm = {
  customerName: '',
  phoneNumber: '',
  email: '',
  checkInDate: today,
  checkOutDate: tomorrow,
};

export function createEmptyRoomForm(): HotelRoomForm {
  return {
    roomType: '',
    capacity: '1',
    totalRooms: '1',
    pricePerNight: '1',
    description: '',
    imageUrls: [''],
    isAvailable: true,
  };
}

export function createEmptyHotelForm(): HotelForm {
  return {
    name: '',
    city: '',
    description: '',
    imageUrls: [''],
    rooms: [
      { ...createEmptyRoomForm(), roomType: 'Standard Double', capacity: '2', totalRooms: '30' },
      { ...createEmptyRoomForm(), roomType: 'Family Suite', capacity: '4', totalRooms: '10' },
    ],
  };
}

export function hotelToForm(hotel: Hotel): HotelForm {
  const imageUrls = hotelImageUrls(hotel);

  return {
    name: hotel.name,
    city: hotel.city,
    description: hotel.description,
    imageUrls: imageUrls.length > 0 ? imageUrls : [''],
    rooms: createEmptyHotelForm().rooms,
  };
}

export function roomToForm(room: HotelRoom): HotelRoomForm {
  const imageUrls = roomImageUrls(room);

  return {
    roomType: room.roomType,
    capacity: String(room.capacity),
    totalRooms: String(room.totalRooms),
    pricePerNight: String(room.pricePerNight),
    description: room.description,
    imageUrls: imageUrls.length > 0 ? imageUrls : [''],
    isAvailable: room.isAvailable,
  };
}

export function withHotelRoomStats(hotel: Hotel, hotelRooms: HotelRoom[]): Hotel {
  return {
    ...hotel,
    roomTypesCount: hotelRooms.length,
    totalRoomsCount: hotelRooms.reduce((total, room) => total + room.totalRooms, 0),
    totalGuestPlaces: hotelRooms.reduce((total, room) => total + room.capacity * room.totalRooms, 0),
  };
}
