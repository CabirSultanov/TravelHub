import type { Page } from '../../types';

type HomePageProps = {
  onNavigate: (page: Page) => void;
};

export default function HomePage({ onNavigate }: HomePageProps) {
  return (
    <div className="page-shell">
      <main>
        <section className="hero-section">
          <div className="container hero-layout">
            <div className="hero-copy">
              <p className="eyebrow">Hotels and taxi across Azerbaijan</p>
              <h1>Plan the whole trip in one calm place.</h1>
              <p>
                Discover polished stays, preview taxi routes, and keep every booking connected from search to arrival.
              </p>
              <div className="hero-actions">
                <button className="btn btn-primary btn-lg" onClick={() => onNavigate('hotels')} type="button">
                  Find a hotel
                </button>
                <button className="btn btn-secondary btn-lg" onClick={() => onNavigate('taxi')} type="button">
                  Book a taxi
                </button>
              </div>
            </div>

            <div className="hero-card" aria-label="Baku travel preview">
              <img src="/assets/hero-baku.jpg" alt="Baku skyline near the Caspian Sea" />
              <div className="hero-card-overlay">
                <span className="badge badge-glass">Baku today</span>
                <strong>Hotels, rides, and trip history connected.</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="section quick-actions-section">
          <div className="container quick-actions-grid">
            <article className="quick-action-card">
              <span className="value-icon icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M4 20V9a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v11" />
                  <path d="M8 20v-5h8v5" />
                  <path d="M8 10h.01M12 10h.01M16 10h.01" />
                </svg>
              </span>
              <h3>Hotel booking</h3>
              <p>Choose a room, confirm guests, and continue straight to payment.</p>
              <button className="card-link" onClick={() => onNavigate('hotels')} type="button">
                Explore stays
              </button>
            </article>

            <article className="quick-action-card">
              <span className="value-icon icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M5 16h14l-1.5-5h-11z" />
                  <path d="M7 16v2M17 16v2" />
                  <path d="M8 11l1-3h6l1 3" />
                </svg>
              </span>
              <h3>Taxi route preview</h3>
              <p>Pick points on the map, see the road route, then confirm the ride.</p>
              <button className="card-link" onClick={() => onNavigate('taxi')} type="button">
                Open taxi
              </button>
            </article>

            <article className="quick-action-card">
              <span className="value-icon icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M7 7h10M7 12h10M7 17h6" />
                  <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                </svg>
              </span>
              <h3>Trip history</h3>
              <p>Past hotels, taxi rides, and payments stay available in your profile.</p>
              <button className="card-link" onClick={() => onNavigate('profile')} type="button">
                My trips
              </button>
            </article>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <h2>Popular destinations</h2>
                <p>Start with Azerbaijan routes that match the Open Design reference.</p>
              </div>
            </div>

            <div className="destination-grid">
              <DestinationCard image="/assets/hero-baku.jpg" title="Baku" text="City lights, Caspian views and old-town streets" />
              <DestinationCard image="/assets/destination-gabala.jpg" title="Gabala" text="Mountains, lakes and weekend escapes" />
              <DestinationCard image="/assets/destination-sheki.jpg" title="Sheki" text="Silk Road heritage and boutique stays" />
              <DestinationCard image="/assets/destination-ganja.jpg" title="Ganja" text="Cultural routes and a quieter urban rhythm" />
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <h2>Recommended hotels</h2>
                <p>Polished stays for city breaks, mountain weekends, and historic routes.</p>
              </div>
              <button className="section-link" onClick={() => onNavigate('hotels')} type="button">
                View all hotels
              </button>
            </div>

            <div className="hotel-grid">
              <HotelPreview image="/assets/hero-baku.jpg" name="Four Seasons Hotel Baku" place="Baku waterfront" price="$180" />
              <HotelPreview image="/assets/destination-gabala.jpg" name="Qafqaz Riverside Resort" place="Gabala mountain views" price="$132" />
              <HotelPreview image="/assets/destination-sheki.jpg" name="Sheki Palace Boutique" place="Historic quarter" price="$88" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function DestinationCard({ image, title, text }: { image: string; title: string; text: string }) {
  return (
    <article className="destination-card">
      <img src={image} alt={title} />
      <span className="destination-arrow" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M7 17 17 7" />
          <path d="M8 7h9v9" />
        </svg>
      </span>
      <div className="destination-meta">
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </article>
  );
}

function HotelPreview({ image, name, place, price }: { image: string; name: string; place: string; price: string }) {
  return (
    <article className="hotel-card od-hotel-preview">
      <div className="hotel-photo">
        <img src={image} alt={name} />
        <span className="hotel-badge">Guest favorite</span>
      </div>
      <div className="hotel-body">
        <div className="hotel-topline">
          <h3>{name}</h3>
          <span className="rating">4.8</span>
        </div>
        <p>{place}</p>
        <div className="hotel-price">
          <span className="price">From {price} <span>/ night</span></span>
        </div>
      </div>
    </article>
  );
}
