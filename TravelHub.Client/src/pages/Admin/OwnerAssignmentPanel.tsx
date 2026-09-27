import { useRef, useState } from 'react';
import type { AuthUser } from '../../types';
import type { ActionFeedback } from '../../hooks/useSavedAction';
import { ActionNotice, ManagementConfirm, UserSummary } from '../../components/common/ManagementUI';
import Pagination from '../../components/common/Pagination';
import { filterAndSortAdminResources } from './adminListUtils';

export default function OwnerAssignmentPanel({ ownerId, candidates, objectName, busy, disabled, feedback, onSave, onClear }: {
  ownerId: number | null | undefined; candidates: AuthUser[]; objectName: string;
  busy: boolean; disabled: boolean; feedback: ActionFeedback | null;
  onSave: (ownerId: number | null) => Promise<boolean>; onClear: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuthUser | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const owner = candidates.find((candidate) => candidate.id === ownerId);
  const found = filterAndSortAdminResources(candidates, search, (user) => [user.name, user.email], (user) => user.name);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(found.length / 6)));

  function closeForm() { setEditing(false); setSelected(null); window.requestAnimationFrame(() => trigger.current?.focus()); }

  return (
    <section aria-label="Owner assignment">
      <p className="management-eyebrow">Company & property access</p>
      <h3 className="admin-panel-title">Owner</h3>
      <p className="management-hint">The owner manages this business from their TravelHub account.</p>
      <div className="admin-owner-card">
        {owner ? <UserSummary user={owner} /> : ownerId != null ? <div>
          <strong>Owner details unavailable</strong>
          <p className="management-hint">An owner is assigned (account #{ownerId}), but their details are not available in the current candidate list.</p>
        </div> : <div><strong>No owner assigned</strong><p className="management-hint">Choose a registered user to manage {objectName}.</p></div>}
      </div>
      {!removing && <ActionNotice feedback={feedback} />}
      {!editing && <div className="management-actions">
        <button ref={trigger} className="management-button" disabled={disabled} onClick={() => {
          onClear(); setSearch(''); setPage(1); setSelected(null); setEditing(true);
        }} type="button">{ownerId == null ? 'Assign owner' : 'Change owner'}</button>
        {ownerId != null && <button className="management-button is-danger" disabled={disabled} onClick={() => {
          onClear(); setRemoving(true);
        }} type="button">Remove owner</button>}
      </div>}

      {editing && <form className="management-form" onSubmit={async (event) => {
        event.preventDefault();
        if (selected && !disabled && selected.id !== ownerId && await onSave(selected.id)) closeForm();
      }}>
        <h4>{ownerId == null ? 'Assign an owner' : 'Change the owner'}</h4>
        <label className="management-field">Find a registered user
          <input className="management-input" autoFocus disabled={busy} placeholder="Search by name or email" value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); setSelected(null); }} />
        </label>
        <p className="management-hint">Candidates and their eligibility come from the existing ownership service. Selecting a person does not save the change.</p>
        <div className="management-options">
          {found.slice((currentPage - 1) * 6, currentPage * 6).map((candidate) => (
            <button className="management-option" key={candidate.id} disabled={disabled || candidate.id === ownerId}
              aria-pressed={selected?.id === candidate.id} onClick={() => setSelected(candidate)} type="button">
              <UserSummary user={candidate} /><span>{candidate.id === ownerId ? 'Current' : selected?.id === candidate.id ? 'Selected' : 'Select'}</span>
            </button>
          ))}
          {found.length === 0 && <p className="management-empty">No eligible users match this name or email.</p>}
        </div>
        <Pagination ariaLabel="Owner candidates pages" page={currentPage} totalPages={Math.ceil(found.length / 6)} disabled={busy} onPageChange={setPage} />
        {selected && <p className="management-selection">Give <strong>{selected.name}</strong> ({selected.email}) ownership of <strong>{objectName}</strong>?
          {ownerId != null && ' This replaces the current owner for this business.'}</p>}
        <div className="management-actions">
          <button className="management-button" disabled={disabled || !selected || selected.id === ownerId} type="submit">{busy ? 'Saving…' : 'Save assignment'}</button>
          <button className="management-button is-secondary" disabled={busy} onClick={closeForm} type="button">Cancel</button>
        </div>
      </form>}

      {removing && <ManagementConfirm title="Remove owner assignment?" confirmLabel="Remove owner" danger busy={busy} feedback={feedback}
        onCancel={() => { setRemoving(false); onClear(); }}
        onConfirm={async () => { if (!disabled && await onSave(null)) setRemoving(false); }}>
        {owner && <UserSummary user={owner} />}
        <p>Remove {owner ? owner.name : `account #${ownerId}`} as the owner of <strong>{objectName}</strong>? The account will not be deleted. Assignments to other businesses are not removed.</p>
      </ManagementConfirm>}
    </section>
  );
}
