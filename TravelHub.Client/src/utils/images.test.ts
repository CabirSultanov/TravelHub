import { describe, expect, it } from 'vitest';
import type { Hotel, HotelRoom } from '../types';
import { cleanImageUrls, hotelImageUrls, hotelMainImage, roomImageUrls, roomMainImage } from './images';

const hotel: Hotel = {
  id: 1,
  name: 'Baku Stay',
  city: 'Baku',
  description: '',
  imageUrl: 'https://example.com/hotel.jpg',
  imageUrls: [],
  roomTypesCount: 2,
  totalRoomsCount: 40,
  totalGuestPlaces: 100,
  averageRating: null,
  reviewCount: 0,
};

const room: HotelRoom = {
  id: 1,
  hotelId: 1,
  roomType: 'Deluxe Room',
  capacity: 2,
  totalRooms: 3,
  pricePerNight: 100,
  description: '',
  imageUrl: 'https://example.com/fallback.jpg',
  imageUrls: [],
  isAvailable: true,
};

describe('image utilities', () => {
  it('trims and deduplicates image URLs', () => {
    expect(cleanImageUrls([' https://example.com/a ', 'https://example.com/a', ''])).toEqual([
      'https://example.com/a',
    ]);
  });

  it('uses the legacy image URL when the image list is empty', () => {
    expect(roomImageUrls(room)).toEqual(['https://example.com/fallback.jpg']);
    expect(hotelImageUrls(hotel)).toEqual(['https://example.com/hotel.jpg']);
  });

  it('returns a deterministic room fallback image', () => {
    expect(roomMainImage({ ...room, imageUrl: null })).toBe(
      'https://source.unsplash.com/640x420/?room&sig=Deluxe%20Room',
    );
    expect(hotelMainImage({ ...hotel, imageUrl: null })).toBe(
      'https://source.unsplash.com/640x420/?hotel&sig=Baku%20Stay',
    );
  });
});
