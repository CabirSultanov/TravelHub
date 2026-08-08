import type { TaxiCarClassOption } from '../types';

export const taxiCarClassOptions: TaxiCarClassOption[] = [
  { value: 'Standard', label: 'Standard' },
  { value: 'Priority', label: 'Priority' },
  { value: 'Comfort', label: 'Comfort' },
  { value: 'Business', label: 'Business' },
  { value: 'Green', label: 'Green' },
  { value: 'XL', label: 'XL' },
];

export function calculateTaxiDistanceKm(pickupX: number, pickupY: number, dropoffX: number, dropoffY: number) {
  return Math.round(Math.hypot(dropoffX - pickupX, dropoffY - pickupY) * 100) / 100;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function splitTaxiCities(city: string) {
  const cities = city
    .split(',')
    .map((currentCity) => currentCity.trim())
    .filter(Boolean);

  return cities.length === 0 ? [''] : cities;
}
