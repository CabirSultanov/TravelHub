import { useRef, useState } from 'react';
import TaxiDriversPanel from '../../features/taxi/components/TaxiDriversPanel';
import type { TaxiDriverManagement } from '../../features/taxi/taxi.types';
import type { AuthUser, Hotel, TaxiService } from '../../types';
import { filterAndSortAdminResources } from './adminListUtils';

type UserAction = (userId: number) => void | Promise<void>;

type AdminPageProps = {
  canManageUsers: boolean;
  admins: AuthUser[];
  adminCandidates: AuthUser[];
  regularUsersTotalItems: number;
  regularUsersLoading: boolean;
  submitting: boolean;
  regularUsersSearch: string;
  onRegularUsersSearchChange: (search: string) => void;
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
  onManageTaxiDrivers: (taxiService: TaxiService) => void;
  taxiDriverManagement: TaxiDriverManagement;
};

export default function AdminPage({
  canManageUsers,
  admins,
  adminCandidates,
  regularUsersTotalItems,
  regularUsersLoading,
  submitting,
  regularUsersSearch,
  onRegularUsersSearchChange,
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
  onManageTaxiDrivers,
  taxiDriverManagement,
}: AdminPageProps) {
  const [hotelSearch, setHotelSearch] = useState('');
  const [taxiSearch, setTaxiSearch] = useState('');
  const [managedTaxiService, setManagedTaxiService] = useState<TaxiService | null>(null);
  const filteredHotels = filterAndSortAdminResources(
    hotels,
    hotelSearch,
    (hotel) => [hotel.name, hotel.city],
    (hotel) => hotel.name,
  );
  const filteredTaxiServices = filterAndSortAdminResources(
    taxiServices,
    taxiSearch,
    (taxi) => [taxi.companyName, taxi.city],
    (taxi) => taxi.companyName,
  );

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
      <div className="admin-search">
        <input
          aria-label="Search users"
          onChange={(event) => onRegularUsersSearchChange(event.target.value)}
          placeholder="Search users..."
          value={regularUsersSearch}
        />
      </div>
      <div className="admin-scroll-list user-list">
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

        {!regularUsersLoading && regularUsersTotalItems === 0 && <p className="empty">No regular users found.</p>}
      </div>
        </>
      )}

      <h3>Hotel owners</h3>
      <div className="admin-search">
        <input
          aria-label="Search hotels"
          onChange={(event) => setHotelSearch(event.target.value)}
          placeholder="Search hotels..."
          value={hotelSearch}
        />
      </div>
      <OwnerRows
        candidates={hotelCandidates}
        emptyMessage="No hotels found."
        label={(hotel) => `${hotel.name} — ${hotel.city}`}
        onAssign={onAssignHotel}
        resources={filteredHotels}
        submitting={submitting}
      />

      <h3>Taxi owners</h3>
      <div className="admin-search">
        <input
          aria-label="Search taxi services"
          onChange={(event) => setTaxiSearch(event.target.value)}
          placeholder="Search taxi services..."
          value={taxiSearch}
        />
      </div>
      <OwnerRows
        candidates={taxiCandidates}
        emptyMessage="No taxi services found."
        label={(taxi) => `${taxi.companyName} — ${taxi.city}`}
        onAssign={onAssignTaxi}
        onManageDrivers={(taxiService) => {
          setManagedTaxiService(taxiService);
          onManageTaxiDrivers(taxiService);
        }}
        resources={filteredTaxiServices}
        submitting={submitting}
      />

      {managedTaxiService && (
        <section className="panel wide taxi-drivers-card admin-drivers-card" aria-label="Driver management">
          <div className="section-title">
            <div>
              <p className="eyebrow">Taxi service</p>
              <h3>{managedTaxiService.companyName}</h3>
            </div>
          </div>
          <TaxiDriversPanel management={taxiDriverManagement} submitting={submitting} />
        </section>
      )}
    </section>
  );
}

function OwnerRows<T extends { id: number; ownerId?: number | null }>({
  candidates,
  emptyMessage,
  label,
  onAssign,
  onManageDrivers,
  resources,
  submitting,
}: {
  candidates: AuthUser[];
  emptyMessage: string;
  label: (resource: T) => string;
  onAssign: (resourceId: number, ownerId: number | null) => void | Promise<void>;
  onManageDrivers?: (resource: T) => void;
  resources: T[];
  submitting: boolean;
}) {
  return (
    <div className="admin-scroll-list user-list">
      {resources.map((resource) => {
        return (
          <article className="user-row" key={resource.id}>
            <span>
              <strong>{label(resource)}</strong>
              <small>{resource.ownerId ? 'Owner assigned' : 'No owner assigned'}</small>
            </span>
            <div className="owner-resource-actions">
              {onManageDrivers && <button disabled={submitting} onClick={() => onManageDrivers(resource)} type="button">Manage drivers</button>}
              <OwnerPicker
                ariaLabel={`Owner for ${label(resource)}`}
                candidates={candidates}
                onAssign={onAssign}
                ownerId={resource.ownerId ?? null}
                resourceId={resource.id}
                submitting={submitting}
              />
            </div>
          </article>
        );
      })}
      {resources.length === 0 && <p className="empty">{emptyMessage}</p>}
    </div>
  );
}

function OwnerPicker({
  ariaLabel,
  candidates,
  onAssign,
  ownerId,
  resourceId,
  submitting,
}: {
  ariaLabel: string;
  candidates: AuthUser[];
  onAssign: (resourceId: number, ownerId: number | null) => void | Promise<void>;
  ownerId: number | null;
  resourceId: number;
  submitting: boolean;
}) {
  const pickerRef = useRef<HTMLDetailsElement>(null);
  const owner = candidates.find((candidate) => candidate.id === ownerId);

  function chooseOwner(nextOwnerId: number | null) {
    pickerRef.current?.removeAttribute('open');
    void onAssign(resourceId, nextOwnerId);
  }

  return (
    <details className={`owner-picker${submitting ? ' is-disabled' : ''}`} ref={pickerRef}>
      <summary aria-label={ariaLabel}>
        <span>{owner ? owner.name : 'No owner'}</span>
        {owner && <small>{owner.email}</small>}
      </summary>
      <div aria-label={ariaLabel} className="owner-picker-menu" role="listbox">
        <button
          aria-selected={ownerId === null}
          className={`owner-picker-option${ownerId === null ? ' is-selected' : ''}`}
          disabled={submitting}
          onClick={() => chooseOwner(null)}
          role="option"
          type="button"
        >
          <strong>No owner</strong>
          <small>Remove assignment</small>
        </button>
        {candidates.map((candidate) => (
          <button
            aria-selected={candidate.id === ownerId}
            className={`owner-picker-option${candidate.id === ownerId ? ' is-selected' : ''}`}
            disabled={submitting}
            key={candidate.id}
            onClick={() => chooseOwner(candidate.id)}
            role="option"
            type="button"
          >
            <strong>{candidate.name}</strong>
            <small>{candidate.email} · {candidate.role}</small>
          </button>
        ))}
      </div>
    </details>
  );
}
