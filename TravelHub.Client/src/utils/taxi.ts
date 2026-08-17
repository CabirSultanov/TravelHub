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

export function splitTaxiCities(city: string) {
  const cities = city
    .split(',')
    .map((currentCity) => currentCity.trim())
    .filter(Boolean);

  return cities.length === 0 ? [''] : cities;
}
