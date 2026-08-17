import type { FormEvent } from 'react';
import type { AuthUser, Booking, BookingGuestMode, HotelRoom } from '../../../types';
import type { BookingForm, HotelBookingFormActions } from '../hotels.types';

type HotelBookingFormProps = {
  selectedRoom: HotelRoom | null;
  booking: Booking | null;
  currentUser: AuthUser | null;
  bookingForm: BookingForm;
  bookingGuestMode: BookingGuestMode;
  phoneNumberPattern: string;
  submitting: boolean;
  actions: HotelBookingFormActions;
  onOpenAuth: () => void;
};

export default function HotelBookingForm({
  selectedRoom,
  booking,
  currentUser,
  bookingForm,
  bookingGuestMode,
  phoneNumberPattern,
  submitting,
  actions,
  onOpenAuth,
}: HotelBookingFormProps) {
  if (!selectedRoom) {
    return null;
  }

  const bookingCreated = Boolean(booking);
  const phoneNumberIsValid = new RegExp(`^(?:${phoneNumberPattern})$`).test(bookingForm.phoneNumber);
  const datesAreValid =
    Boolean(bookingForm.checkInDate) &&
    Boolean(bookingForm.checkOutDate) &&
    bookingForm.checkOutDate > bookingForm.checkInDate;
  const bookingFormIsReady =
    bookingForm.customerName.trim().length > 0 &&
    bookingForm.email.trim().length > 0 &&
    phoneNumberIsValid &&
    datesAreValid;
  const formLocked = submitting || bookingCreated;
  const canCreateBooking = bookingFormIsReady && !formLocked;

  if (!currentUser) {
    return (
      <div className="form-grid hotel-booking-card">
        <h3>{selectedRoom.roomType} booking</h3>
        <p className="empty">Please register or sign in to create a booking.</p>
        <button className="primary" onClick={onOpenAuth} type="button">
          Register to book
        </button>
      </div>
    );
  }

  return (
    <form
      className={`form-grid hotel-booking-card${bookingCreated ? ' is-created' : ''}`}
      onSubmit={(event: FormEvent<HTMLFormElement>) => void actions.submit(event)}
    >
      <h3>{selectedRoom.roomType} booking</h3>
      <div className="booking-mode">
        <button
          className={bookingGuestMode === 'self' ? 'active' : ''}
          disabled={formLocked}
          onClick={() => actions.selectGuestMode('self')}
          type="button"
        >
          Book for myself
        </button>
        <button
          className={bookingGuestMode === 'other' ? 'active' : ''}
          disabled={formLocked}
          onClick={() => actions.selectGuestMode('other')}
          type="button"
        >
          Book for someone else
        </button>
      </div>
      <input
        disabled={formLocked}
        placeholder="Customer name"
        value={bookingForm.customerName}
        onChange={(event) => actions.setForm({ ...bookingForm, customerName: event.target.value })}
        required
      />
      <input
        disabled={formLocked}
        pattern={phoneNumberPattern}
        placeholder="Phone number"
        type="tel"
        value={bookingForm.phoneNumber}
        onChange={(event) => actions.setForm({ ...bookingForm, phoneNumber: event.target.value })}
        required
      />
      <input
        disabled={formLocked}
        placeholder="Email"
        type="email"
        value={bookingForm.email}
        onChange={(event) => actions.setForm({ ...bookingForm, email: event.target.value })}
        required
      />
      <input
        disabled={formLocked}
        type="date"
        value={bookingForm.checkInDate}
        onChange={(event) => actions.setForm({ ...bookingForm, checkInDate: event.target.value })}
        required
      />
      <input
        disabled={formLocked}
        type="date"
        value={bookingForm.checkOutDate}
        onChange={(event) => actions.setForm({ ...bookingForm, checkOutDate: event.target.value })}
        required
      />
      <button className="primary" disabled={!canCreateBooking} type="submit">
        {submitting ? 'Creating...' : bookingCreated ? 'Booking created' : 'Create booking'}
      </button>
    </form>
  );
}
