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
  return (
    <header className="site-header">
      <button className="brand" onClick={() => onNavigate('home')} type="button">
        TravelHub
      </button>

      {page !== 'home' && (
        <button className="back-home" onClick={() => onNavigate('home')} type="button">
          Back
        </button>
      )}

      <nav className="site-nav">
        <button className={page === 'taxi' ? 'active' : ''} onClick={() => onNavigate('taxi')} type="button">
          Taxi
        </button>
        <button className={page === 'hotels' ? 'active' : ''} onClick={() => onNavigate('hotels')} type="button">
          Hotels
        </button>
        {currentUser?.role === 'SuperAdmin' && (
          <button className={page === 'admin' ? 'active' : ''} onClick={() => onNavigate('admin')} type="button">
            Admin
          </button>
        )}
      </nav>

      <div className="header-actions">
        {currentUser && <span>{currentUser.name}</span>}
        {currentUser ? (
          <>
            <button onClick={() => onNavigate('profile')} type="button">
              Profile
            </button>
            <button disabled={submitting} onClick={() => void onLogout()} type="button">
              Log out
            </button>
          </>
        ) : (
          <button onClick={onOpenAuth} type="button">
            Register
          </button>
        )}
      </div>
    </header>
  );
}
