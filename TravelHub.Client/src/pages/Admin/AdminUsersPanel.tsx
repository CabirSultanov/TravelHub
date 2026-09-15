import { useState } from 'react';
import { api } from '../../api';
import type { AuthUser } from '../../types';
import type { useAdminUsers } from '../../hooks/useAdminUsers';
import type { ActionFeedback } from '../../hooks/useSavedAction';
import { ActionNotice, ManagementConfirm, UserSummary } from '../../components/common/ManagementUI';
import Pagination from '../../components/common/Pagination';

export type AdminUserAction = 'promote' | 'demote' | 'block' | 'unblock' | 'delete';
export function getAdminUserActions(user: AuthUser): AdminUserAction[] {
  if (user.role !== 'User' && user.role !== 'Admin') return [];
  return [user.role === 'Admin' ? 'demote' : 'promote', user.isBlocked ? 'unblock' : 'block', ...(user.isBlocked ? ['delete' as const] : [])];
}

const actions = {
  promote: { label: 'Make admin', description: 'Grant administrator access to this account?', call: api.promoteUserToAdmin },
  demote: { label: 'Remove admin role', description: 'Remove administrator access and return this account to the User role?', call: api.demoteAdminToUser },
  block: { label: 'Block account', description: 'Block this account from using TravelHub?', call: api.blockUser },
  unblock: { label: 'Unblock account', description: 'Restore access for this account?', call: api.unblockUser },
  delete: { label: 'Delete account', description: 'Permanently delete this blocked account? This action cannot be undone.', call: api.deleteAccount },
};

export default function AdminUsersPanel({ data, busy, disabled, feedback, onAction, onClear, onReload }: {
  data: ReturnType<typeof useAdminUsers>; busy: boolean; disabled: boolean; feedback: ActionFeedback | null;
  onAction: (action: () => Promise<void>, message: string) => Promise<boolean>; onClear: () => void; onReload: () => void;
}) {
  const [tab, setTab] = useState<'users' | 'admins'>('users');
  const [adminSearch, setAdminSearch] = useState('');
  const [confirm, setConfirm] = useState<{ user: AuthUser; action: AdminUserAction } | null>(null);
  const listed = tab === 'users' ? data.users : data.admins.filter((user) =>
    [user.name, user.email, user.phoneNumber].some((value) => value.toLowerCase().includes(adminSearch.trim().toLowerCase())));

  return (
    <section className="admin-users-section">
      <div className="admin-section-heading"><div><p className="management-eyebrow">SuperAdmin access</p><h2>Users & admins</h2></div></div>
      <p className="management-hint">View every account and its real role. Owner and driver assignments are managed through their businesses.</p>
      <div className="admin-subnav" aria-label="User lists">
        <button aria-pressed={tab === 'users'} disabled={busy} onClick={() => { setTab('users'); onClear(); }} type="button">All users</button>
        <button aria-pressed={tab === 'admins'} disabled={busy} onClick={() => { setTab('admins'); onClear(); }} type="button">Admins</button>
      </div>
      {!confirm && <ActionNotice feedback={feedback} />}
      <label className="management-field">Search {tab === 'users' ? 'users' : 'admins'}
        <input className="management-input" disabled={busy} placeholder="Name, email or phone" value={tab === 'users' ? data.search : adminSearch}
          onChange={(event) => tab === 'users' ? data.setSearch(event.target.value) : setAdminSearch(event.target.value)} />
      </label>
      {data.error ? <ActionNotice feedback={{ kind: 'error', message: `Could not load accounts. ${data.error}` }} busy={busy} onRetry={onReload} /> :
        data.loading ? <p role="status" className="management-empty">Loading accounts…</p> : <>
          <p className="management-hint">{tab === 'users' ? `${data.totalItems} users · 20 per page` : `${listed.length} admins`}</p>
          <div className="admin-users-list">
            {listed.map((user) => <article className="management-team-row" key={user.id}>
              <UserSummary user={user} />
              {getAdminUserActions(user).length > 0 ? <details className="admin-actions-menu">
                <summary>Actions <span aria-hidden="true">⋯</span></summary>
                <div>
                  {getAdminUserActions(user).map((action) => <button key={action} disabled={disabled}
                    className={action === 'delete' || action === 'block' || action === 'demote' ? 'is-danger' : ''} type="button"
                    onClick={(event) => {
                      const menu = event.currentTarget.closest('details');
                      if (menu) { menu.open = false; menu.querySelector('summary')?.focus(); }
                      onClear(); setConfirm({ user, action });
                    }}>{actions[action].label}</button>)}
                </div>
              </details> : <span className="management-hint">{user.role === 'SuperAdmin' ? 'Protected account' : 'Manage assignment in businesses'}</span>}
            </article>)}
            {listed.length === 0 && <p className="management-empty">No accounts match this search.</p>}
          </div>
        </>}
      {tab === 'users' && !data.error && <Pagination ariaLabel="All users pages" page={data.page} totalPages={data.totalPages}
        disabled={busy || data.loading} onPageChange={data.setPage} />}
      {confirm && <ManagementConfirm title={`${actions[confirm.action].label}?`} confirmLabel={actions[confirm.action].label}
        danger={confirm.action === 'delete' || confirm.action === 'block' || confirm.action === 'demote'} busy={busy} feedback={feedback}
        onCancel={() => { setConfirm(null); onClear(); }} onConfirm={async () => {
          if (!disabled && await onAction(async () => { await actions[confirm.action].call(confirm.user.id); }, `${actions[confirm.action].label}: change saved for ${confirm.user.name}.`)) setConfirm(null);
        }}>
        <UserSummary user={confirm.user} /><p>{actions[confirm.action].description}</p>
      </ManagementConfirm>}
    </section>
  );
}
