import { useRef, useState } from 'react';
import { api } from '../../api';
import type { AuthUser } from '../../types';
import { useOwnerAssignments } from '../../hooks/useOwnerAssignments';
import { useAdminUsers } from '../../hooks/useAdminUsers';
import { useSavedAction } from '../../hooks/useSavedAction';
import { useTaxiDrivers } from '../../features/taxi/hooks/useTaxiDrivers';
import TaxiDriversPanel from '../../features/taxi/components/TaxiDriversPanel';
import { ActionNotice } from '../../components/common/ManagementUI';
import Pagination from '../../components/common/Pagination';
import OwnerAssignmentPanel from './OwnerAssignmentPanel';
import AdminUsersPanel from './AdminUsersPanel';
import { filterAndSortAdminResources, getOwnerLabel, matchesOwnerFilter } from './adminListUtils';
import './AdminPage.css';

type Section = 'taxi' | 'hotels' | 'users';
type Resource = { id: number; name: string; city: string; phone?: string; ownerId?: number | null };

export default function AdminPage({ currentUser }: { currentUser: AuthUser }) {
  if (currentUser.role !== 'Admin' && currentUser.role !== 'SuperAdmin') return null;
  return <AdminWorkspace key={`${currentUser.id}-${currentUser.role}`} canManageUsers={currentUser.role === 'SuperAdmin'} />;
}

function AdminWorkspace({ canManageUsers }: { canManageUsers: boolean }) {
  const [section, setSection] = useState<Section>('taxi');
  const [taxiId, setTaxiId] = useState<number | null>(null);
  const [hotelId, setHotelId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<'owner' | 'drivers'>('owner');
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const data = useOwnerAssignments();
  const users = useAdminUsers(canManageUsers);
  const action = useSavedAction();
  // Admin has its own selection. It never selects a company in the customer booking form.
  const drivers = useTaxiDrivers({ active: section === 'taxi' && detailTab === 'drivers' && taxiId !== null, taxiServiceId: taxiId });
  const taxis: Resource[] = data.taxiServices.map((taxi) => ({
    id: taxi.id, name: taxi.companyName, city: taxi.city, phone: taxi.phoneNumber, ownerId: taxi.ownerId,
  }));
  const hotels: Resource[] = data.hotels.map((hotel) => ({ id: hotel.id, name: hotel.name, city: hotel.city, ownerId: hotel.ownerId }));
  const resources = section === 'taxi' ? taxis : hotels;
  const candidates = section === 'taxi' ? data.taxiCandidates : data.hotelCandidates;
  const selectedId = section === 'taxi' ? taxiId : hotelId;
  const selected = resources.find((resource) => resource.id === selectedId);
  const locked = action.busy || action.needsRefresh;
  const disabled = locked || data.loading || Boolean(data.error);
  const feedback = action.feedback?.kind === 'warning' ? null : action.feedback;

  async function refreshAll() {
    await Promise.all([data.refresh(), users.refresh(), drivers.refresh()]);
  }
  const run = (write: () => Promise<void>, message: string) => action.run(write, refreshAll, message);
  const reload = () => void action.retry(refreshAll);

  function selectResource(id: number) {
    if (locked) return;
    action.clear();
    if (section === 'taxi') { setTaxiId(id); setDetailTab('owner'); } else setHotelId(id);
    // Keep the change intentional; polling/reloads never move keyboard focus.
    window.requestAnimationFrame(() => detailHeading.current?.focus());
  }

  return (
    <section className="admin-workspace" aria-label="Administration">
      <header className="admin-header">
        <div><p className="management-eyebrow">TravelHub workspace</p><h1>Administration</h1>
          <p>People, businesses, and the teams behind every trip.</p></div>
        <span className="admin-access-label">{canManageUsers ? 'SuperAdmin' : 'Admin'} access</span>
      </header>
      <div className="admin-shell">
        <nav className="admin-navigation" aria-label="Admin sections">
          {([{ id: 'taxi', label: 'Taxi services', hint: 'Owners & driver teams', number: '01' },
            { id: 'hotels', label: 'Hotels', hint: 'Property ownership', number: '02' },
            ...(canManageUsers ? [{ id: 'users', label: 'Users & admins', hint: 'Accounts & permissions', number: '03' }] : [])] as const).map((item) => (
            <button key={item.id} aria-current={section === item.id ? 'page' : undefined} disabled={locked}
              onClick={() => { action.clear(); setSection(item.id as Section); }} type="button">
              <span className="admin-nav-number" aria-hidden="true">{item.number}</span>
              <span><strong>{item.label}</strong><small>{item.hint}</small></span>
            </button>
          ))}
          <p className="admin-nav-note">Manage assignments here.<br />Bookings stay in Taxi and Hotels.</p>
        </nav>
        <div className="admin-content">
          {action.needsRefresh && <ActionNotice feedback={action.feedback} busy={action.busy} onRetry={reload} />}
          {section === 'users' && canManageUsers ? <AdminUsersPanel data={users} busy={action.busy} disabled={locked || users.loading || Boolean(users.error)}
            feedback={feedback} onAction={run} onClear={action.clear} onReload={reload} /> : <>
            <div className="admin-section-heading"><div><p className="management-eyebrow">{section === 'taxi' ? 'Taxi operations' : 'Property access'}</p>
              <h2>{section === 'taxi' ? 'Taxi services' : 'Hotels'}</h2></div>
              <span className="management-hint">{data.loading ? 'Updating…' : `${resources.length} ${section === 'taxi' ? 'companies' : 'properties'}`}</span>
            </div>
            {data.error && !action.needsRefresh && <ActionNotice feedback={{ kind: 'error', message: `Could not load businesses and owners. ${data.error}` }}
              busy={action.busy} onRetry={reload} />}
            {data.loading && resources.length === 0 ? <p role="status" className="management-empty">Loading businesses and owner details…</p> :
              <div className={`admin-resource-layout${selected ? ' has-selection' : ''}`}>
                <ResourceList key={section} resources={resources} candidates={candidates} selectedId={selectedId} isTaxi={section === 'taxi'}
                  disabled={locked} loading={data.loading} error={Boolean(data.error)} onSelect={selectResource} />
                <div className="admin-detail">
                  {selected ? <>
                    <button className="management-button is-secondary admin-back" disabled={locked} type="button" onClick={() => {
                      action.clear();
                      if (section === 'taxi') setTaxiId(null); else setHotelId(null);
                      window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-manage-id="${selected.id}"]`)?.focus());
                    }}>← Back to {section === 'taxi' ? 'companies' : 'hotels'}</button>
                    <header className="admin-detail-header">
                      <p className="management-eyebrow">{section === 'taxi' ? 'Taxi service' : 'Hotel'}</p>
                      <h3 ref={detailHeading} tabIndex={-1}>{selected.name}</h3>
                      <p>{selected.city}</p>
                      {section === 'taxi' && <p>{selected.phone || 'No company phone number'}</p>}
                    </header>
                    {section === 'taxi' && <div className="admin-subnav" aria-label="Company management">
                      <button aria-pressed={detailTab === 'owner'} disabled={locked} onClick={() => { action.clear(); setDetailTab('owner'); }} type="button">Owner</button>
                      <button aria-pressed={detailTab === 'drivers'} disabled={locked} onClick={() => { action.clear(); setDetailTab('drivers'); }} type="button">Drivers</button>
                    </div>}
                    <div className="admin-detail-body">
                      {section === 'taxi' && detailTab === 'drivers' ? <TaxiDriversPanel key={selected.id} companyName={selected.name} submitting={action.busy}
                        management={{ ...drivers, busy: action.busy, needsRefresh: action.needsRefresh || Boolean(data.error), feedback,
                          retry: () => action.retry(refreshAll), clearFeedback: action.clear,
                          assign: (id) => run(() => api.assignTaxiDriver(selected.id, id), `Driver added to ${selected.name}.`),
                          remove: (id) => run(() => api.removeTaxiDriver(selected.id, id), `Driver removed from ${selected.name}. Their account was not deleted.`),
                        }} /> :
                        <OwnerAssignmentPanel key={`${section}-${selected.id}`} objectName={selected.name} ownerId={selected.ownerId} candidates={candidates}
                          busy={action.busy} disabled={disabled} feedback={feedback} onClear={action.clear} onSave={(id) =>
                            run(() => section === 'taxi' ? api.updateTaxiServiceOwner(selected.id, id) : api.updateHotelOwner(selected.id, id),
                              `Owner assignment ${id === null ? 'removed' : 'saved'} for ${selected.name}.`)} />}
                    </div>
                  </> : <div className="admin-selection-empty">
                    <div className="admin-selection-mark" aria-hidden="true">{section === 'taxi' ? 'T' : 'H'}</div>
                    <h3>Select {section === 'taxi' ? 'a company' : 'a hotel'}</h3>
                    <p>Choose <strong>Manage</strong> to view the owner{section === 'taxi' ? ', assign drivers, and manage the team' : ' and manage their assignment'}.</p>
                  </div>}
                </div>
              </div>}
          </>}
        </div>
      </div>
    </section>
  );
}

function ResourceList({ resources, candidates, selectedId, isTaxi, disabled, loading, error, onSelect }: {
  resources: Resource[]; candidates: AuthUser[]; selectedId: number | null; isTaxi: boolean;
  disabled: boolean; loading: boolean; error: boolean; onSelect: (id: number) => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'with' | 'without'>('all');
  const [page, setPage] = useState(1);
  const found = filterAndSortAdminResources(resources.filter((resource) => matchesOwnerFilter(resource.ownerId, filter)),
    search, (resource) => [resource.name, resource.city], (resource) => resource.name);
  const totalPages = Math.ceil(found.length / 8);
  const currentPage = Math.min(page, Math.max(1, totalPages));
  return (
    <section className="admin-resource-list" aria-label={isTaxi ? 'Companies' : 'Hotels list'}>
      <label className="management-field">Find {isTaxi ? 'a company' : 'a hotel'}
        <input className="management-input" disabled={disabled} placeholder="Search name or city" value={search} onChange={(event) => {
          setSearch(event.target.value); setPage(1);
        }} />
      </label>
      {isTaxi && <div className="admin-filters" aria-label="Company owner filter">
        {([{ id: 'all', label: 'All' }, { id: 'with', label: 'With owner' }, { id: 'without', label: 'Without owner' }] as const).map((item) => (
          <button key={item.id} disabled={disabled} aria-pressed={filter === item.id} onClick={() => { setFilter(item.id); setPage(1); }} type="button">{item.label}</button>
        ))}
      </div>}
      <p className="management-hint">{loading ? 'Updating list…' : `${found.length} results`}</p>
      <div className="admin-company-cards">
        {found.slice((currentPage - 1) * 8, currentPage * 8).map((resource) => (
          <article className={`admin-company-card${selectedId === resource.id ? ' is-selected' : ''}`} key={resource.id}>
            <h3>{resource.name}</h3><p>{resource.city}</p>
            <div className="admin-company-owner"><span>Owner</span><strong>{getOwnerLabel(resource.ownerId, candidates)}</strong></div>
            <button data-manage-id={resource.id} className={`management-button${selectedId === resource.id ? '' : ' is-secondary'}`}
              disabled={disabled} aria-label={`Manage ${resource.name}`} aria-pressed={selectedId === resource.id} onClick={() => onSelect(resource.id)} type="button">
              {selectedId === resource.id ? 'Selected' : 'Manage'}<span aria-hidden="true">↗</span>
            </button>
          </article>
        ))}
      </div>
      {!loading && !error && found.length === 0 && <p className="management-empty">No {isTaxi ? 'companies' : 'hotels'} match these filters.</p>}
      <Pagination ariaLabel={isTaxi ? 'Companies pages' : 'Hotels pages'} page={currentPage} totalPages={totalPages} disabled={disabled} onPageChange={setPage} />
    </section>
  );
}
