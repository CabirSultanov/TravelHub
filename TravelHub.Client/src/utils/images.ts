import type { HotelRoom } from '../types';

export function cleanImageUrls(imageUrls: string[]) {
  return Array.from(new Set(imageUrls.map((imageUrl) => imageUrl.trim()).filter(Boolean)));
}

export function fallbackImage(seed: string, topic = 'travel') {
  return `https://source.unsplash.com/640x420/?${encodeURIComponent(topic)}&sig=${encodeURIComponent(seed)}`;
}

export function roomImageUrls(room: HotelRoom) {
  const imageUrls = room.imageUrls ?? [];
  return cleanImageUrls(imageUrls.length > 0 ? imageUrls : room.imageUrl ? [room.imageUrl] : []);
}

export function roomMainImage(room: HotelRoom) {
  return roomImageUrls(room)[0] || fallbackImage(room.roomType, 'room');
}
