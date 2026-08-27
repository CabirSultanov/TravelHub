import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './relativeTime';

describe('relative review time', () => {
  const now = new Date('2026-08-27T12:00:00Z');

  it('formats recent and older review dates', () => {
    expect(formatRelativeTime('2026-08-27T11:59:40Z', now)).toBe('just now');
    expect(formatRelativeTime('2026-08-27T11:55:00Z', now)).toBe('5 minutes ago');
    expect(formatRelativeTime('2026-08-25T12:00:00Z', now)).toBe('2 days ago');
    expect(formatRelativeTime('2026-06-27T12:00:00Z', now)).toBe('2 months ago');
  });
});
