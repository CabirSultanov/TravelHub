import type { FormEvent, MouseEvent } from 'react';
import SiteFooter from '../../components/common/SiteFooter';
import type { Hotel, Page } from '../../types';
import {
  addDateInputDays,
  hotelDateRangeErrorMessage,
  isHotelDateRangeValid,
  todayDateInputValue,
} from '../../utils/dateRange';
import { fallbackImage } from '../../utils/images';

type HomePageProps = {
  cities: string[];
  hotels: Hotel[];
  onHotelSearch: (city: string, checkIn?: string, checkOut?: string) => void;
  onNavigate: (page: Page) => void;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pluralize(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function createHotelCards(hotels: Hotel[]) {
  const cards = hotels.slice(0, 3).map((hotel) => {
    const imageUrl = hotel.imageUrl || fallbackImage(hotel.name, 'hotel');
    const description = hotel.description ? `<p>${escapeHtml(hotel.description)}</p>` : '';
    const rating = hotel.averageRating === null ? 'No reviews yet' : `★ ${hotel.averageRating.toFixed(1)} (${hotel.reviewCount} reviews)`;

    return `<article class="hotel-card" data-od-id="hotel-card-${hotel.id}">
              <div class="hotel-photo">
                <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(hotel.name)}">
                <span class="hotel-badge">${escapeHtml(hotel.city)}</span>
              </div>
              <div class="hotel-body">
                <div class="hotel-topline">
                  <h3>${escapeHtml(hotel.name)}</h3>
                </div>
                ${description}
                <div class="hotel-rating">${escapeHtml(rating)}</div>
                <div class="hotel-review">
                  <span>${escapeHtml(pluralize(hotel.roomTypesCount, 'room type', 'room types'))}</span>
                  <span>/</span>
                  <span>${escapeHtml(pluralize(hotel.totalRoomsCount, 'room', 'rooms'))}</span>
                  <span>/</span>
                  <span>${escapeHtml(pluralize(hotel.totalGuestPlaces, 'guest place', 'guest places'))}</span>
                </div>
                <div class="hotel-price">
                  <span class="price">${escapeHtml(hotel.city)}</span>
                  <button class="card-link" type="button" data-action="hotel-city" data-city="${escapeHtml(hotel.city)}">View stay</button>
                </div>
              </div>
            </article>`;
  });

  return cards.length ? cards.join('') : '<p class="empty">Hotels will appear here after they are added.</p>';
}

function createHomeMarkup(cities: string[], hotels: Hotel[]) {
  const todayDate = todayDateInputValue();
  const minCheckOutDate = addDateInputDays(todayDate, 1);
  const destinationOptions = [
    '<option value="">All cities</option>',
    ...cities.map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`),
  ].join('');
  const hotelCards = createHotelCards(hotels);

  return String.raw`<main>
      <section class="hero" data-od-id="hero-section">
        <div class="container hero-grid">
          <div class="hero-copy" data-od-id="hero-image-panel">
            <p class="hero-label" data-od-id="hero-kicker">Azerbaijan in one seamless trip</p>
            <h1 data-od-id="hero-heading">Explore Azerbaijan Your Way</h1>
            <p data-od-id="hero-copy">Discover stays across Baku, mountain retreats, and historic towns, then plan your taxi route with confidence.</p>
            <div class="hero-actions" data-od-id="hero-actions">
              <button class="btn btn-secondary" type="button" data-action="hotels" data-od-id="hero-find-hotel-cta">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V9a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v11"/><path d="M8 20v-5h8v5"/></svg>
                Find a Hotel
              </button>
              <button class="btn btn-secondary" type="button" data-action="taxi" data-od-id="hero-book-taxi-cta">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16h14l-1.5-5h-11z"/><path d="M7 16v2M17 16v2"/><path d="M8 11l1-3h6l1 3"/></svg>
                Book a Taxi
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="booking-section" data-od-id="booking-section">
        <div class="container">
          <aside class="booking-panel" data-od-id="hotel-search-panel" aria-label="Hotel search">
            <div class="panel-title">
              <h2 data-od-id="search-heading">Find your stay</h2>
              <p>Search by destination and dates.</p>
            </div>

            <form class="search-form" data-od-id="hotel-search-form">
              <div class="field" data-od-id="destination-field">
                <label for="destination">Destination</label>
                <div class="field-control has-select">
                  <span class="field-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg></span>
                  <select id="destination" name="destination">
                    ${destinationOptions}
                  </select>
                </div>
              </div>
              <div class="field-row">
                <div class="field" data-od-id="checkin-field">
                  <label for="checkin">Check-in</label>
                  <div class="field-control">
                    <span class="field-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1z"/></svg></span>
                    <input id="checkin" name="checkin" type="date" min="${todayDate}">
                  </div>
                </div>
                <div class="field" data-od-id="checkout-field">
                  <label for="checkout">Check-out</label>
                  <div class="field-control">
                    <span class="field-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1z"/><path d="m9 15 2 2 4-5"/></svg></span>
                    <input id="checkout" name="checkout" type="date" min="${minCheckOutDate}">
                  </div>
                </div>
              </div>
              <button class="btn btn-primary" type="submit" data-od-id="search-hotels-cta">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 3.5 3.5"/></svg>
                Search Hotels
              </button>
              <p class="search-note" data-od-id="search-feedback" aria-live="polite">We will show available stays and nightly prices.</p>
            </form>
          </aside>
        </div>
      </section>

      <section class="section" data-od-id="services-section">
        <div class="container">
          <div class="section-head">
            <div>
              <h2 data-od-id="services-heading">TravelHub Services</h2>
              <p>Hotel booking and routed taxi trips work together as one calm travel flow.</p>
            </div>
          </div>

          <div class="service-grid" data-od-id="service-card-grid">
            <article class="service-card" data-od-id="service-card-hotels">
              <div class="service-content">
                <div>
                  <p class="service-kicker">Hotels</p>
                  <h3>Stay Across Azerbaijan</h3>
                  <p>Find city hotels, mountain retreats, and relaxed stays for weekend escapes.</p>
                </div>
                <button class="card-link" type="button" data-action="hotels" data-od-id="explore-hotels-cta">
                  Explore Hotels
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
                </button>
              </div>
              <div class="service-media" data-od-id="hotel-service-image">
                <img src="/assets/destination-gabala.jpg" alt="Mountain landscape in Gabala">
              </div>
            </article>

            <article class="service-card" data-od-id="service-card-taxi">
              <div class="service-content">
                <div>
                  <p class="service-kicker">Taxi</p>
                  <h3>Route-aware taxi booking</h3>
                  <p>Set pickup and destination points, then preview distance, time, and estimated fare.</p>
                </div>
                <button class="card-link" type="button" data-action="taxi" data-od-id="book-taxi-cta">
                  Book a Taxi
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
                </button>
              </div>
              <div class="taxi-visual" data-od-id="taxi-route-visual">
                <div class="route-map" aria-hidden="true">
                  <span class="route-line"></span>
                  <span class="pin pin-start"></span>
                  <span class="pin pin-end"></span>
                </div>
                <div class="route-chip">
                  <strong>Baku City Center -> GYD Airport</strong>
                  <span>Real road route with live estimate styling</span>
                  <div class="route-details">
                    <div class="route-detail"><span>Distance</span><strong>27 km</strong></div>
                    <div class="route-detail"><span>Time</span><strong>32 min</strong></div>
                    <div class="route-detail"><span>From</span><strong>22 AZN</strong></div>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section class="section" data-od-id="destinations-section">
        <div class="container">
          <div class="section-head">
            <div>
              <h2 data-od-id="destinations-heading">Discover Azerbaijan</h2>
              <p>Editorial picks for short breaks, business stays, and nature-focused escapes.</p>
            </div>
            <button class="section-link" type="button" data-action="destinations" data-od-id="all-destinations-link">All destinations</button>
          </div>

          <div class="dest-grid" data-od-id="destination-card-grid">
            <article class="destination-card" data-od-id="destination-card-baku">
              <img src="/assets/hero-baku.jpg" alt="Baku skyline near the Caspian Sea">
              <span class="destination-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg></span>
              <div class="destination-meta">
                <h3>Baku</h3>
                <p>City lights, Caspian views & old-town streets</p>
              </div>
            </article>
            <article class="destination-card" data-od-id="destination-card-gabala">
              <img src="/assets/destination-gabala.jpg" alt="Green mountain landscape in Gabala">
              <span class="destination-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg></span>
              <div class="destination-meta">
                <h3>Gabala</h3>
                <p>Mountains, lakes & weekend escapes</p>
              </div>
            </article>
            <article class="destination-card" data-od-id="destination-card-sheki">
              <img src="/assets/destination-sheki.jpg" alt="Sheki Khan Palace facade">
              <span class="destination-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg></span>
              <div class="destination-meta">
                <h3>Sheki</h3>
                <p>Silk Road heritage & boutique stays</p>
              </div>
            </article>
            <article class="destination-card" data-od-id="destination-card-ganja">
              <img src="/assets/destination-ganja.jpg" alt="Street view in Ganja">
              <span class="destination-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg></span>
              <div class="destination-meta">
                <h3>Ganja</h3>
                <p>Cultural routes & a quieter urban rhythm</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section class="section" data-od-id="featured-hotels-section">
        <div class="container">
          <div class="section-head">
            <div>
              <h2 data-od-id="featured-hotels-heading">Available Hotels</h2>
              <p>Real stays currently available in TravelHub.</p>
            </div>
            <button class="section-link" type="button" data-action="hotels" data-od-id="view-all-hotels-link">View all hotels</button>
          </div>

          <div class="hotel-grid" data-od-id="hotel-card-grid">
            ${hotelCards}
          </div>
        </div>
      </section>

      <section class="value-band" data-od-id="value-section">
        <div class="container value-layout">
          <div class="section-head" style="display:grid;margin:0;">
            <div>
              <h2 data-od-id="value-heading">Everything for the trip, in one account</h2>
              <p>Bookings, taxi routes, payments, and trip history stay connected from search to arrival.</p>
            </div>
          </div>

          <div class="value-grid" data-od-id="value-card-grid">
            <article class="value-card" data-od-id="value-card-hotel-booking">
              <span class="value-icon icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 20V9a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v11"/><path d="M8 20v-5h8v5"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg></span>
              <h3>Easy Booking</h3>
              <p>Clear dates, guests, nightly prices, and a direct path to payment.</p>
            </article>
            <article class="value-card" data-od-id="value-card-taxi-estimates">
              <span class="value-icon icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 16h14l-1.5-5h-11z"/><path d="M7 16v2M17 16v2"/><path d="M8 11l1-3h6l1 3"/></svg></span>
              <h3>Real Route Estimates</h3>
              <p>Preview distance, time, and fare before confirming a taxi.</p>
            </article>
            <article class="value-card" data-od-id="value-card-secure-bookings">
              <span class="value-icon icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z"/><path d="m9.5 12 1.7 1.7 3.5-4"/></svg></span>
              <h3>Secure Payments</h3>
              <p>Saved cards and booking statuses stay protected in your profile.</p>
            </article>
            <article class="value-card" data-od-id="value-card-trip-history">
              <span class="value-icon icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 7h10M7 12h10M7 17h6"/><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg></span>
              <h3>Trip History</h3>
              <p>Past hotels, taxi rides, and payments remain available in My Trips.</p>
            </article>
          </div>
        </div>
      </section>
    </main>`;
}

export default function HomePage({ cities, hotels, onHotelSearch, onNavigate }: HomePageProps) {
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const actionTarget = target.closest<HTMLElement>('[data-action]');
    const linkTarget = target.closest<HTMLAnchorElement>('a[href="#"]');

    if (actionTarget || linkTarget) {
      event.preventDefault();
    }

    const action = actionTarget?.dataset.action;

    if (action === 'taxi') {
      onNavigate('taxi');
    } else if (action === 'hotel-city') {
      onHotelSearch(actionTarget?.dataset.city ?? '');
    } else if (action === 'hotels') {
      onNavigate('hotels');
    } else if (action === 'my-trips') {
      onNavigate('trips');
    } else if (action === 'signin') {
      onNavigate('auth');
    } else if (action === 'profile') {
      onNavigate('profile');
    } else if (action === 'destinations') {
      document.querySelector('[data-od-id="destinations-section"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function handleSubmit(event: FormEvent<HTMLDivElement>) {
    const form = (event.target as HTMLElement).closest('[data-od-id="hotel-search-form"]');

    if (!form) {
      return;
    }

    event.preventDefault();
    const data = new FormData(form as HTMLFormElement);
    const city = String(data.get('destination') ?? '').trim();
    const checkIn = String(data.get('checkin') ?? '').trim();
    const checkOut = String(data.get('checkout') ?? '').trim();
    const feedback = (form as HTMLFormElement).querySelector<HTMLElement>('[data-od-id="search-feedback"]');
    const todayDate = todayDateInputValue();

    if ((checkIn && checkIn < todayDate) || (checkIn && checkOut && !isHotelDateRangeValid(checkIn, checkOut))) {
      if (feedback) {
        feedback.textContent = hotelDateRangeErrorMessage;
      }
      return;
    }

    if (feedback) {
      feedback.textContent = 'We will show available stays and nightly prices.';
    }

    onHotelSearch(city, checkIn, checkOut);
  }

  function handleChange(event: FormEvent<HTMLDivElement>) {
    const target = event.target as HTMLInputElement;

    if (target.name !== 'checkin') {
      return;
    }

    const form = target.closest('[data-od-id="hotel-search-form"]');
    const checkout = form?.querySelector<HTMLInputElement>('input[name="checkout"]');

    if (!checkout) {
      return;
    }

    const todayDate = todayDateInputValue();
    const minCheckOutDate = addDateInputDays(target.value || todayDate, 1);
    checkout.min = minCheckOutDate;

    if (!target.value || (checkout.value && checkout.value <= target.value)) {
      checkout.value = '';
    }
  }

  return (
    <div
      className="page-shell od-home-page"
      onClick={handleClick}
      onChange={handleChange}
      onSubmit={handleSubmit}
    >
      <div dangerouslySetInnerHTML={{ __html: createHomeMarkup(cities, hotels) }} />
      <SiteFooter
        onNavigate={onNavigate}
        onOpenAuth={() => onNavigate('auth')}
        onShowDestinations={() =>
          document.querySelector('[data-od-id="destinations-section"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      />
    </div>
  );
}
