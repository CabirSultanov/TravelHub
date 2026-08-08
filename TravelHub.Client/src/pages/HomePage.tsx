import type { Page } from '../types';

type HomePageProps = {
  onNavigate: (page: Page) => void;
};

export default function HomePage({ onNavigate }: HomePageProps) {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">TravelHub</p>
        <h1>Plan your trip in a few clicks.</h1>
        <p>Taxi, hotels, and interesting places are gathered in one simple draft interface.</p>
      </section>

      <section className="home-steps" aria-label="TravelHub services">
        <button className="feature-card" onClick={() => onNavigate('taxi')} type="button">
          <span className="feature-icon">T</span>
          <strong>Taxi booking</strong>
          <small>Choose a taxi service and view contacts for your trip.</small>
        </button>

        <button className="feature-card" onClick={() => onNavigate('hotels')} type="button">
          <span className="feature-icon">H</span>
          <strong>Hotel booking</strong>
          <small>Open hotels, choose a room, and create a booking.</small>
        </button>

        <button className="feature-card" onClick={() => onNavigate('places')} type="button">
          <span className="feature-icon">P</span>
          <strong>Interesting places</strong>
          <small>View cities and places worth adding to your route.</small>
        </button>
      </section>
    </>
  );
}
