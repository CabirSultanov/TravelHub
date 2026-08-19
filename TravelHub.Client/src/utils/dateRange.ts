export const hotelDateRangeErrorMessage = 'Check-out date must be after check-in date.';

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function todayDateInputValue() {
  return toDateInputValue(new Date());
}

export function isDateInputValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function addDateInputDays(dateValue: string, days: number) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  return toDateInputValue(date);
}

export function minHotelCheckOutDate(checkInDate: string) {
  return addDateInputDays(checkInDate || todayDateInputValue(), 1);
}

export function isHotelDateRangeValid(checkInDate: string, checkOutDate: string) {
  return (
    isDateInputValue(checkInDate) &&
    isDateInputValue(checkOutDate) &&
    checkOutDate > checkInDate
  );
}

export function clearInvalidHotelCheckOut(checkInDate: string, checkOutDate: string) {
  return !checkInDate || (checkOutDate && checkOutDate <= checkInDate) ? '' : checkOutDate;
}

export function normalizeHotelDateRange(
  checkInDate: string,
  checkOutDate: string,
  options: { minCheckInDate?: string } = {},
) {
  const checkIn = isDateInputValue(checkInDate) && (!options.minCheckInDate || checkInDate >= options.minCheckInDate)
    ? checkInDate
    : '';
  const checkOut = checkOutDate && checkIn && isDateInputValue(checkOutDate) && checkOutDate > checkIn ? checkOutDate : '';

  return { checkIn, checkOut };
}
