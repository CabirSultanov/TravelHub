const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function formatRelativeTime(value: string | Date, now = new Date()) {
  const date = new Date(value);
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];

  if (Math.abs(seconds) < 60) {
    return 'just now';
  }

  const [unit, size] = units.find(([, currentSize]) => Math.abs(seconds) >= currentSize) ?? ['minute', 60];
  return relativeTime.format(Math.round(seconds / size), unit);
}

export function formatReviewTimestamp(value: string | Date) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
}
