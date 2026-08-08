import { describe, expect, it } from 'vitest';
import { calculateTaxiDistanceKm, clamp, splitTaxiCities } from './taxi';

describe('taxi utilities', () => {
  it('calculates a rounded map distance', () => {
    expect(calculateTaxiDistanceKm(0, 0, 1, 1)).toBe(1.41);
  });

  it('clamps values to map bounds', () => {
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(45, 0, 100)).toBe(45);
    expect(clamp(105, 0, 100)).toBe(100);
  });

  it('splits and trims taxi cities', () => {
    expect(splitTaxiCities(' Baku,  Ganja ,, ')).toEqual(['Baku', 'Ganja']);
    expect(splitTaxiCities('')).toEqual(['']);
  });
});
