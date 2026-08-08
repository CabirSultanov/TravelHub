import type { Coordinates } from '../features/taxi/taxi.types';

type TaxiCarClassOption = {
  value: string;
  label: string;
};

export const taxiCarClassOptions: TaxiCarClassOption[] = [
  { value: 'Standard', label: 'Standard' },
  { value: 'Priority', label: 'Priority' },
  { value: 'Comfort', label: 'Comfort' },
  { value: 'Business', label: 'Business' },
  { value: 'Green', label: 'Green' },
  { value: 'XL', label: 'XL' },
];

// ponytail: Keep the existing 0-100 booking DTO intact; the ceiling is frontend-only until the backend stores geographic coordinates.
export function toLegacyTaxiPoint({ latitude, longitude }: Coordinates) {
  const maxLatitude = 85.05112878;
  const normalizedLatitude = clamp(latitude, -maxLatitude, maxLatitude);

  return {
    x: Number(clamp(((longitude + 180) / 360) * 100, 0, 100).toFixed(2)),
    y: Number(clamp(((maxLatitude - normalizedLatitude) / (maxLatitude * 2)) * 100, 0, 100).toFixed(2)),
  };
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
