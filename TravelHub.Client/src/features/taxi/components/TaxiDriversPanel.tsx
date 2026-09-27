import { useRef, useState } from 'react';
import type { TaxiDriverManagement } from '../taxi.types';
import type { AuthUser } from '../../../types';
import { ActionNotice, ManagementConfirm, UserSummary } from '../../../components/common/ManagementUI';
import Pagination from '../../../components/common/Pagination';

export default function TaxiDriversPanel({ management, submitting, companyName = 'this taxi service' }: {
  management: TaxiDriverManagement; submitting: boolean; companyName?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<AuthUser | null>(null);
  const [removing, setRemoving] = useState<AuthUser | null>(null);
  const [teamSearch, setTeamSearch] = useState('');
  const [candidatePage, setCandidatePage] = useState(1);
  const addButton = useRef<HTMLButtonElement>(null);
  const busy = submitting || management.busy;
  const disabled = busy || management.needsRefresh || Boolean(management.error);
  const drivers = management.drivers.filter((driver) =>
    [driver.name, driver.email, driver.phoneNumber].some((value) => value.toLowerCase().includes(teamSearch.trim().toLowerCase())),
  );

  function closeForm() {
    setAdding(false);
    setSelected(null);
    window.requestAnimationFrame(() => addButton.current?.focus());
  }

  return (
    <section className="management-team" aria-label="Drivers">
      <div className="management-team-header">
        <div><p className="management-eyebrow">Company team</p><h3>Current drivers</h3>
          <span className="management-hint">{management.loading ? 'Updating team…' : `${management.drivers.length} assigned`}</span>
        </div>
        {!adding && <button ref={addButton} className="management-button" disabled={disabled || management.loading} onClick={() => {
          management.clearFeedback(); management.setSearch(''); setCandidatePage(1); setAdding(true);
        }} type="button">Add driver</button>}
      </div>
      {!removing && <ActionNotice feedback={management.feedback} busy={busy}
        onRetry={management.needsRefresh ? () => void management.retry() : undefined} />}
      {management.error && !management.needsRefresh && <ActionNotice feedback={{ kind: 'error', message: `Could not load the team. ${management.error}` }}
        busy={busy} onRetry={() => void management.retry()} />}

      {adding && (
        <form className="management-form" onSubmit={async (event) => {
          event.preventDefault();
          if (selected && !disabled && !management.loading && await management.assign(selected.id)) closeForm();
        }}>
          <h4>Add a driver to {companyName}</h4>
          <label className="management-field">Find a registered user
            <input autoFocus className="management-input" disabled={busy || management.needsRefresh}
              placeholder="Search by name or email" value={management.search} onChange={(event) => {
                setSelected(null); setCandidatePage(1); management.setSearch(event.target.value);
              }} />
          </label>
          <p className="management-hint">Only ordinary, unblocked users can be assigned. Drivers already assigned to another company will not appear here.</p>
          {management.loading ? <p role="status" className="management-hint">Searching users…</p> : !management.error && (
            <div className="management-options">
              {management.candidates.slice((candidatePage - 1) * 6, candidatePage * 6).map((candidate) => (
                <button key={candidate.id} className="management-option" disabled={disabled} aria-pressed={selected?.id === candidate.id}
                  onClick={() => setSelected(candidate)} type="button">
                  <UserSummary user={candidate} /><span>{selected?.id === candidate.id ? 'Selected' : 'Select'}</span>
                </button>
              ))}
              {management.candidates.length === 0 && <p className="management-empty">No eligible users found. Try a different name or email.</p>}
              {management.candidates.length >= 50 && <p className="management-hint">Showing up to 50 candidates. Refine your search to find a specific person.</p>}
            </div>
          )}
          {!management.loading && !management.error && <Pagination ariaLabel="Driver candidates pages" page={candidatePage}
            totalPages={Math.ceil(management.candidates.length / 6)} disabled={busy} onPageChange={setCandidatePage} />}
          {selected && <p className="management-selection">Add <strong>{selected.name}</strong> ({selected.email}) to <strong>{companyName}</strong>? This assigns the TaxiDriver role to their account.</p>}
          <div className="management-actions">
            <button className="management-button" disabled={disabled || management.loading || !selected} type="submit">{busy ? 'Saving…' : 'Confirm add driver'}</button>
            <button className="management-button is-secondary" disabled={busy} onClick={closeForm} type="button">Cancel</button>
          </div>
        </form>
      )}

      <label className="management-field">Search current team
        <input className="management-input" disabled={busy} placeholder="Name, email or phone" value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} />
      </label>
      {management.loading && management.drivers.length === 0 && <p role="status" className="management-hint">Loading drivers…</p>}
      <div className="management-team-list">
        {drivers.map((driver) => (
          <article className="management-team-row" key={driver.id}>
            <UserSummary user={driver} />
            <button className="management-button is-danger" disabled={disabled || management.loading} onClick={() => {
              management.clearFeedback(); setRemoving(driver);
            }} type="button">Remove driver</button>
          </article>
        ))}
        {!management.loading && !management.error && drivers.length === 0 &&
          <p className="management-empty">{teamSearch ? 'No team members match your search.' : 'No drivers assigned yet. Add a registered user to build this team.'}</p>}
      </div>
      {removing && <ManagementConfirm title="Remove driver assignment?" confirmLabel="Remove driver" danger busy={busy}
        feedback={management.feedback} onCancel={() => { setRemoving(null); management.clearFeedback(); }}
        onConfirm={async () => { if (!disabled && await management.remove(removing.id)) setRemoving(null); }}>
        <UserSummary user={removing} />
        <p>Remove this driver from <strong>{companyName}</strong>? Their account will not be deleted. A driver with an active accepted ride cannot be removed.</p>
      </ManagementConfirm>}
    </section>
  );
}
