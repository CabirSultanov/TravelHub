import { describe, expect, it } from 'vitest';
import { clamp, splitTaxiCities, toLegacyTaxiPoint } from './taxi';

describe('taxi utilities', () => {
  it('normalizes geographic coordinates for the existing booking payload', () => {
    expect(toLegacyTaxiPoint({ latitude: 0, longitude: 0 })).toEqual({ x: 50, y: 50 });
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
