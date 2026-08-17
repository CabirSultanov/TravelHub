import type { Page } from '../../types';

type SiteFooterProps = {
  onNavigate: (page: Page) => void;
  onOpenAuth: () => void;
  onShowDestinations: () => void;
};

export default function SiteFooter({ onNavigate, onOpenAuth, onShowDestinations }: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <button className="brand" onClick={() => onNavigate('home')} type="button" aria-label="TravelHub home">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 17 12 4l8 13" />
                <path d="m8 17 4-6 4 6" />
                <path d="M5 17h14" />
              </svg>
            </span>
            <span>TravelHub</span>
          </button>
          <p>A modern platform for hotels and taxi trips across Azerbaijan.</p>
        </div>
        <div className="footer-col">
          <strong>Explore</strong>
          <button className="footer-link" onClick={() => onNavigate('hotels')} type="button">
            Hotels
          </button>
          <button className="footer-link" onClick={() => onNavigate('taxi')} type="button">
            Taxi
          </button>
          <button className="footer-link" onClick={onShowDestinations} type="button">
            Destinations
          </button>
        </div>
        <div className="footer-col">
          <strong>Account</strong>
          <button className="footer-link" onClick={() => onNavigate('trips')} type="button">
            My Trips
          </button>
          <button className="footer-link" onClick={() => onNavigate('profile')} type="button">
            Profile
          </button>
          <button className="footer-link" onClick={onOpenAuth} type="button">
            Sign In
          </button>
        </div>
        <div className="footer-col">
          <strong>Support</strong>
          <a className="footer-link" href="#">
            Help
          </a>
          <a className="footer-link" href="#">
            Terms
          </a>
          <a className="footer-link" href="#">
            Privacy
          </a>
        </div>
      </div>
    </footer>
  );
}
