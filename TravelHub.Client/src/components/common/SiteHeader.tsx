import type { AuthUser, Page } from '../../types';

type SiteHeaderProps = {
  page: Page;
  currentUser: AuthUser | null;
  submitting: boolean;
  onNavigate: (page: Page) => void;
  onOpenAuth: () => void;
  onLogout: () => void | Promise<void>;
};

export default function SiteHeader({
  page,
  currentUser,
  submitting,
  onNavigate,
  onOpenAuth,
  onLogout,
}: SiteHeaderProps) {
  const initials = currentUser?.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="site-header">
      <div className="container nav-row">
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

        <nav className="nav-links" aria-label="Primary navigation">
          <button className={`nav-link${page === 'home' ? ' is-active' : ''}`} onClick={() => onNavigate('home')} type="button">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 11.5 12 5l8 6.5" />
              <path d="M6.5 10.5V19h11v-8.5" />
              <path d="M10 19v-5h4v5" />
            </svg>
            <span>Explore</span>
          </button>
          <button className={`nav-link${page === 'hotels' ? ' is-active' : ''}`} onClick={() => onNavigate('hotels')} type="button">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20V9a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v11" />
              <path d="M4 13h16" />
              <path d="M7 13V9.5h4V13" />
              <path d="M13 13V9.5h4V13" />
            </svg>
            <span>Stays</span>
          </button>
          <button className={`nav-link${page === 'taxi' ? ' is-active' : ''}`} onClick={() => onNavigate('taxi')} type="button">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 17h14l-1.5-5.5A3 3 0 0 0 14.6 9H9.4a3 3 0 0 0-2.9 2.5L5 17Z" />
              <path d="M7 17v2" />
              <path d="M17 17v2" />
              <path d="M8 13h8" />
              <path d="M9 6h6" />
            </svg>
            <span>Ride</span>
          </button>
        {currentUser?.role === 'SuperAdmin' && (
          <button className={`nav-link${page === 'admin' ? ' is-active' : ''}`} onClick={() => onNavigate('admin')} type="button">
            Admin
          </button>
        )}
        </nav>

        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => (currentUser ? onNavigate('trips') : onOpenAuth())} type="button">
            My Trips
          </button>
          {currentUser ? (
            <>
              <button className="profile-button" onClick={() => onNavigate('profile')} type="button">
                <span className="avatar" aria-hidden="true">
                  {initials}
                </span>
                <span>{currentUser.name}</span>
              </button>
              <button className="btn btn-secondary" disabled={submitting} onClick={() => void onLogout()} type="button">
                Sign Out
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={onOpenAuth} type="button">
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
