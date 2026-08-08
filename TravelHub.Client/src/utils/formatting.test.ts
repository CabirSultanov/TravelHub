import { describe, expect, it } from 'vitest';
import { formatTaxiCarClassName } from './formatting';

describe('formatting utilities', () => {
  it('formats supported taxi car classes', () => {
    expect(formatTaxiCarClassName('Comfort')).toBe('Comfort');
  });

  it('keeps unknown taxi car classes unchanged', () => {
    expect(formatTaxiCarClassName('Custom')).toBe('Custom');
  });
});
