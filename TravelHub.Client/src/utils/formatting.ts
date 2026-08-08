import { taxiCarClassOptions } from './taxi';

export function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatTaxiCarClassName(name: string) {
  return taxiCarClassOptions.find((option) => option.value === name)?.label ?? name;
}
