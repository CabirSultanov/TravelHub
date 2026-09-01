import type { AuthUser, Hotel, TaxiService } from '../../types';
import Pagination from '../../components/common/Pagination';

type UserAction = (userId: number) => void | Promise<void>;

type AdminPageProps = {
  canManageUsers: boolean;
  admins: AuthUser[];
  adminCandidates: AuthUser[];
  regularUsersPage: number;
  regularUsersTotalItems: number;
  regularUsersTotalPages: number;
  regularUsersLoading: boolean;
  submitting: boolean;
  onRegularUsersPageChange: (page: number) => void;
  onPromote: UserAction;
  onDemote: UserAction;
  onBlock: UserAction;
  onUnblock: UserAction;
  onDelete: UserAction;
  hotels: Hotel[];
  taxiServices: TaxiService[];
  hotelCandidates: AuthUser[];
  taxiCandidates: AuthUser[];
  onAssignHotel: (hotelId: number, ownerId: number | null) => void | Promise<void>;
  onAssignTaxi: (taxiServiceId: number, ownerId: number | null) => void | Promise<void>;
};

export default function AdminPage({
  canManageUsers,
  admins,
  adminCandidates,
  regularUsersPage,
  regularUsersTotalItems,
  regularUsersTotalPages,
  regularUsersLoading,
  submitting,
  onRegularUsersPageChange,
  onPromote,
  onDemote,
  onBlock,
  onUnblock,
  onDelete,
  hotels,
  taxiServices,
  hotelCandidates,
  taxiCandidates,
  onAssignHotel,
  onAssignTaxi,
}: AdminPageProps) {
  const paginationDisabled = submitting || regularUsersLoading;

  return (
    <section className="page-section">
      <div className="section-title">
        <div>
          <p className="eyebrow">Management</p>
          <h2>{canManageUsers ? 'User and ownership management' : 'Ownership management'}</h2>
        </div>
        {canManageUsers && <span>{admins.length} admins / {regularUsersTotalItems} users</span>}
      </div>

      {canManageUsers && (
        <>
      <h3>Admins</h3>
      <div className="user-list">
        {admins.map((user) => (
          <article className="user-row" key={user.id}>
            <span>
              <strong>{user.name}</strong>
              <small>{user.email}{user.isBlocked ? ' / blocked' : ''}</small>
            </span>
            <div className="user-actions">
              {user.isBlocked ? (
                <>
                  <button disabled={submitting} onClick={() => void onDemote(user.id)} type="button">
                    Demote to user
                  </button>
                  <button disabled={submitting} onClick={() => void onUnblock(user.id)} type="button">
                    Unban
                  </button>
                  <button disabled={submitting} onClick={() => void onDelete(user.id)} type="button">
                    Delete account
                  </button>
                </>
              ) : (
                <>
                  <button disabled={submitting} onClick={() => void onDemote(user.id)} type="button">
                    Demote to user
                  </button>
                  <button disabled={submitting} onClick={() => void onBlock(user.id)} type="button">
                    Ban
                  </button>
                </>
              )}
            </div>
          </article>
        ))}

        {admins.length === 0 && <p className="empty">No admins yet.</p>}
      </div>

      <h3>Regular users</h3>
      <div className="user-list">
        {regularUsersLoading && <p className="empty">Loading users...</p>}

        {adminCandidates.map((user) => (
          <article className="user-row" key={user.id}>
            <span>
              <strong>{user.name}</strong>
              <small>{user.email}{user.isBlocked ? ' / blocked' : ''}</small>
            </span>
            <div className="user-actions">
              {user.isBlocked ? (
                <>
                  <button disabled={submitting} onClick={() => void onPromote(user.id)} type="button">
                    Make admin
                  </button>
                  <button disabled={submitting} onClick={() => void onUnblock(user.id)} type="button">
                    Unban
                  </button>
                  <button disabled={submitting} onClick={() => void onDelete(user.id)} type="button">
                    Delete account
                  </button>
                </>
              ) : (
                <>
                  <button disabled={submitting} onClick={() => void onPromote(user.id)} type="button">
                    Make admin
                  </button>
                  <button disabled={submitting} onClick={() => void onBlock(user.id)} type="button">
                    Ban
                  </button>
                </>
              )}
            </div>
          </article>
        ))}

        {!regularUsersLoading && regularUsersTotalItems === 0 && <p className="empty">No regular users yet.</p>}
      </div>

      <Pagination
        ariaLabel="Regular users pagination"
        disabled={paginationDisabled}
        onPageChange={onRegularUsersPageChange}
        page={regularUsersPage}
        totalPages={regularUsersTotalPages}
      />
        </>
      )}

      <h3>Hotel owners</h3>
      <OwnerRows
        candidates={hotelCandidates}
        label={(hotel) => `${hotel.name} — ${hotel.city}`}
        onAssign={onAssignHotel}
        resources={hotels}
        submitting={submitting}
      />

      <h3>Taxi owners</h3>
      <OwnerRows
        candidates={taxiCandidates}
        label={(taxi) => `${taxi.companyName} — ${taxi.city}`}
        onAssign={onAssignTaxi}
        resources={taxiServices}
        submitting={submitting}
      />
    </section>
  );
}

function OwnerRows<T extends { id: number; ownerId?: number | null }>({
  candidates,
  label,
  onAssign,
  resources,
  submitting,
}: {
  candidates: AuthUser[];
  label: (resource: T) => string;
  onAssign: (resourceId: number, ownerId: number | null) => void | Promise<void>;
  resources: T[];
  submitting: boolean;
}) {
  return (
    <div className="user-list">
      {resources.map((resource) => {
        const owner = candidates.find((candidate) => candidate.id === resource.ownerId);

        return (
          <article className="user-row" key={resource.id}>
            <span>
              <strong>{label(resource)}</strong>
              <small>{owner ? `${owner.name} — ${owner.email} (${owner.role})` : 'No owner assigned'}</small>
            </span>
            <select
              aria-label={`Owner for ${label(resource)}`}
              disabled={submitting}
              onChange={(event) => void onAssign(resource.id, event.target.value ? Number(event.target.value) : null)}
              value={resource.ownerId ?? ''}
            >
              <option value="">No owner</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} — {candidate.email} ({candidate.role})
                </option>
              ))}
            </select>
          </article>
        );
      })}
      {resources.length === 0 && <p className="empty">No services to assign.</p>}
    </div>
  );
}
