import { describe, expect, it } from 'vitest';
import { splitTaxiCities } from './taxi';

describe('taxi utilities', () => {
  it('splits and trims taxi cities', () => {
    expect(splitTaxiCities(' Baku,  Ganja ,, ')).toEqual(['Baku', 'Ganja']);
    expect(splitTaxiCities('')).toEqual(['']);
  });
});
