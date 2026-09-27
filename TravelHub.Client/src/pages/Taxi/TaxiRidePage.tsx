import { useEffect, useState } from 'react';
import SiteFooter from '../../components/common/SiteFooter';
import StarRating from '../../features/hotels/components/StarRating';
import type { Page, TaxiBooking } from '../../types';
import { formatMoney, formatTaxiCarClassName } from '../../utils/formatting';
import { canReviewTaxiRide, getTaxiRideStatusLabel } from '../../utils/taxiRide';
import TaxiRideMap from './TaxiRideMap';
import './TaxiRidePage.css';

type TaxiRidePageProps = {
  booking: TaxiBooking | null;
  loading: boolean;
  error: string;
  unavailable: boolean;
  submitting: boolean;
  currentUserId: number | null;
  onCancel: () => void | Promise<void>;
  onSubmitReview: (rating: number, comment: string) => void | Promise<void>;
  onRetry: () => void;
  onNavigate: (page: Page) => void;
  onOpenAuth: () => void;
  onShowDestinations: () => void;
};

const rideSteps = ['AwaitingDriver', 'DriverAssigned', 'DriverArrived', 'Completed'] as const;
const stepLabels = ['Finding driver', 'Driver on the way', 'Driver arrived', 'Completed'];
const statusMessages: Partial<Record<TaxiBooking['status'], [string, string]>> = {
  AwaitingDriver: ['Finding your driver', 'Your request is being shown to drivers from your selected taxi service. You can stay here while we look.'],
  DriverAssigned: ['Your driver is on the way', 'Your ride has been accepted. Your driver is heading to the pickup point.'],
  DriverArrived: ['Your driver has arrived', 'Head to your pickup point. You can call your driver if you need help finding each other.'],
  Completed: ['Ride completed', 'You have reached the end of your ride. Thank you for travelling with TravelHub.'],
};

function RideTime({ value }: { value?: string | null }) {
  if (!value || Number.isNaN(new Date(value).getTime())) return null;
  return <time dateTime={value}>{new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>;
}

function RideSymbol({ completed }: { completed: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {completed ? <path d="m8 16 5 5 11-11" /> : <><path d="m7 13 3-7h12l3 7M6 13h20v11H6zM10 24v3M22 24v3M10 17h2M20 17h2M12 21h8" /><path d="M4 12h3M25 12h3" /></>}
    </svg>
  );
}

function RideProgress({ booking }: { booking: TaxiBooking }) {
  const currentStep = rideSteps.findIndex((step) => step === booking.status);
  const timestamps = [null, booking.acceptedAt, booking.arrivedAt, booking.completedAt];
  if (currentStep < 0) return null;

  return (
    <ol className="ride-progress" aria-label="Ride progress">
      {rideSteps.map((step, index) => (
        <li key={step} className={index < currentStep ? 'is-done' : index === currentStep ? 'is-current' : ''} aria-current={index === currentStep ? 'step' : undefined}>
          <span className="ride-step-dot" aria-hidden="true">{index < currentStep ? '✓' : index + 1}</span>
          <span className="ride-step-label">{stepLabels[index]}</span>
          <RideTime value={timestamps[index]} />
        </li>
      ))}
    </ol>
  );
}

function TripDetails({ booking }: { booking: TaxiBooking }) {
  return (
    <div className="ride-trip-details">
      <div className="ride-service-heading"><strong>{booking.taxiServiceName}</strong><span>{formatTaxiCarClassName(booking.carClassName)}</span></div>
      <ol className="ride-addresses" aria-label="Your route">
        <li><span className="ride-address-marker" aria-hidden="true">A</span><div><span className="ride-eyebrow">Pickup</span><p>{booking.pickupAddress}</p></div></li>
        <li><span className="ride-address-marker is-dropoff" aria-hidden="true">B</span><div><span className="ride-eyebrow">Dropoff</span><p>{booking.dropoffAddress}</p></div></li>
      </ol>
      <TaxiRideMap {...booking} />
      <dl className="ride-summary">
        <div><dt>Booked for</dt><dd>{booking.customerName}</dd></div>
        <div><dt>Distance</dt><dd>{booking.distanceKm.toFixed(2)} km</dd></div>
        <div className="ride-total"><dt>Trip total</dt><dd>{formatMoney(booking.totalPrice)}</dd></div>
        {booking.savedCardLast4 && <div><dt>Payment method</dt><dd>Card •••• {booking.savedCardLast4}</dd></div>}
      </dl>
      <div className={`ride-payment${booking.paidAt ? ' is-paid' : ''}`}>
        <strong>{booking.paidAt ? 'Demo payment complete' : 'No payment collected yet'}</strong>
        <p>{booking.paidAt ? 'This is a demo payment. No real bank charge was made.' : 'Demo payment is completed only when a driver accepts your request. No real bank charge is made.'}</p>
        <RideTime value={booking.paidAt} />
      </div>
    </div>
  );
}

export default function TaxiRidePage({ booking, loading, error, unavailable, submitting, currentUserId, onCancel, onSubmitReview, onRetry, onNavigate, onOpenAuth, onShowDestinations }: TaxiRidePageProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    setRating(0);
    setComment('');
    setDetailsOpen(false);
  }, [booking?.id]);

  const completed = booking?.status === 'Completed';
  const cancelled = booking?.status === 'Cancelled';
  const [title, description] = booking ? statusMessages[booking.status] ?? [getTaxiRideStatusLabel(booking.status), 'View the saved details of your booking below.'] : ['', ''];
  const canReview = booking ? canReviewTaxiRide(booking, currentUserId) : false;

  return (
    <>
      <main className="taxi-ride-page">
        <div className="ride-page-heading">
          <button className="ride-back-link" type="button" onClick={() => onNavigate('taxi')}>← Back to Taxi</button>
          <span className="ride-eyebrow">TravelHub · Your ride{booking ? ` #${booking.id}` : ''}</span>
          <button className="ride-back-link" type="button" onClick={() => onNavigate('trips')}>My trips</button>
        </div>

        {unavailable || cancelled ? (
          <section className="ride-panel ride-unavailable">
            <h1>{cancelled ? 'This request is no longer active' : 'Ride unavailable'}</h1>
            <p>{cancelled ? 'You can request another ride whenever you are ready.' : error || 'This ride could not be found or is not available to your account.'}</p>
            <button className="btn btn-primary" type="button" onClick={() => onNavigate('taxi')}>Back to Taxi</button>
          </section>
        ) : !booking ? (
          <section className="ride-panel ride-unavailable" aria-busy={loading}>
            <h1>{loading ? 'Opening your ride…' : 'Unable to load your ride'}</h1>
            <p>{loading ? 'Getting the latest details for you.' : error || 'Please try again.'}</p>
            {!loading && <button className="btn btn-primary" type="button" onClick={onRetry}>Try again</button>}
          </section>
        ) : (
          <>
            {error && <div className="ride-connection-notice" role="status"><span>{error}</span><button type="button" className="ride-back-link" disabled={submitting} onClick={onRetry}>Retry</button></div>}
            <div className="ride-layout">
              <div className="ride-main-column">
                <section className={`ride-panel ride-status-panel${completed ? ' is-completed' : ''}`}>
                  <div className={`ride-symbol${booking.status === 'AwaitingDriver' ? ' is-searching' : ''}`}><RideSymbol completed={completed} /></div>
                  <div className="ride-status-copy" aria-live="polite" aria-atomic="true">
                    <span className="ride-eyebrow">{completed ? 'Thank you for riding with us' : 'Your trip, step by step'}</span>
                    <h1>{title}</h1>
                    <p>{description}</p>
                  </div>
                  <RideProgress booking={booking} />

                  {booking.status === 'DriverArrived' && <div className="ride-pickup-notice"><span className="ride-eyebrow">Meet your driver here</span><strong>{booking.pickupAddress}</strong></div>}
                  {booking.driverId && booking.driverName && (
                    <div className="ride-driver">
                      <span className="ride-avatar" aria-hidden="true">{booking.driverName.trim().split(/\s+/).slice(0, 2).map((name) => name[0]).join('')}</span>
                      <div className="ride-driver-name"><span className="ride-eyebrow">Your driver</span><strong>{booking.driverName}</strong>{booking.driverPhoneNumber && <span>{booking.driverPhoneNumber}</span>}</div>
                      {booking.driverPhoneNumber && !completed && <a className="btn btn-primary" href={`tel:${booking.driverPhoneNumber.replace(/[^+\d]/g, '')}`}>Call driver</a>}
                    </div>
                  )}
                  {booking.status === 'AwaitingDriver' && currentUserId === booking.userId && <div className="ride-cancel"><button type="button" disabled={submitting} onClick={() => void onCancel()}>{submitting ? 'Cancelling…' : 'Cancel request'}</button><p>You can cancel until a driver accepts.</p></div>}
                </section>

                {completed && (
                  <section className="ride-panel ride-review-panel" aria-labelledby="ride-review-heading">
                    {booking.rating != null ? (
                      <><span className="ride-eyebrow">Your review</span><h2 id="ride-review-heading">Thank you for your feedback</h2><StarRating rating={booking.rating} /><p className="ride-review-comment">{booking.reviewComment}</p><RideTime value={booking.reviewedAt} /></>
                    ) : canReview ? (
                      <form onSubmit={(event) => { event.preventDefault(); if (rating > 0 && !submitting) void onSubmitReview(rating, comment); }}>
                        <span className="ride-eyebrow">A moment for your feedback</span>
                        <h2 id="ride-review-heading">How was your ride?</h2>
                        <p>Rate your overall experience with this trip.</p>
                        <fieldset className="ride-review-fields" disabled={submitting}>
                          <legend className="ride-sr-only">Your ride rating and comment</legend>
                          <StarRating rating={rating} onChange={setRating} label="Choose a ride rating from 1 to 5 stars" />
                          <span className="ride-rating-hint">{rating ? `${rating} out of 5 stars` : 'Choose a star rating'}</span>
                          <label htmlFor="ride-review-comment">Anything you would like to share? <span>(optional)</span></label>
                          <textarea id="ride-review-comment" value={comment} maxLength={1000} rows={4} onChange={(event) => setComment(event.target.value)} placeholder="Tell us about your ride…" aria-describedby="ride-comment-limit" />
                          <small id="ride-comment-limit">{comment.length} / 1000 characters</small>
                          <div className="ride-actions"><button className="btn btn-primary" type="submit" disabled={rating === 0 || submitting}>{submitting ? 'Submitting…' : 'Submit review'}</button><button className="btn btn-ghost" type="button" onClick={() => onNavigate('trips')}>Not now</button></div>
                        </fieldset>
                      </form>
                    ) : <><h2 id="ride-review-heading">This ride is complete</h2><p>Only the account that booked this ride can leave a review.</p></>}
                    <div className="ride-next-actions"><button className="btn btn-secondary" type="button" onClick={() => onNavigate('taxi')}>Book another ride</button><button className="ride-back-link" type="button" onClick={() => onNavigate('trips')}>My trips →</button></div>
                  </section>
                )}
              </div>
              <aside className="ride-panel ride-details-panel" aria-label="Trip details">
                {completed ? <details onToggle={(event) => setDetailsOpen(event.currentTarget.open)}><summary><span>Trip details</span><strong>{formatMoney(booking.totalPrice)}</strong></summary>{detailsOpen && <TripDetails booking={booking} />}</details> : <><h2>Trip details</h2><TripDetails booking={booking} /></>}
              </aside>
            </div>
          </>
        )}
      </main>
      <SiteFooter onNavigate={onNavigate} onOpenAuth={onOpenAuth} onShowDestinations={onShowDestinations} />
    </>
  );
}
