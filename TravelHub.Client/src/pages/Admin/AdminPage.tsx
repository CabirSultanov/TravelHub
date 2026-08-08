import type { AuthUser } from '../../types';

type UserAction = (userId: number) => void | Promise<void>;

type AdminPageProps = {
  admins: AuthUser[];
  adminCandidates: AuthUser[];
  submitting: boolean;
  onPromote: UserAction;
  onDemote: UserAction;
  onBlock: UserAction;
  onUnblock: UserAction;
  onDelete: UserAction;
};

export default function AdminPage({
  admins,
  adminCandidates,
  submitting,
  onPromote,
  onDemote,
  onBlock,
  onUnblock,
  onDelete,
}: AdminPageProps) {
  return (
    <section className="page-section">
      <div className="section-title">
        <div>
          <p className="eyebrow">Super Admin</p>
          <h2>User management</h2>
        </div>
        <span>{admins.length} admins / {adminCandidates.length} users</span>
      </div>

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

        {adminCandidates.length === 0 && <p className="empty">No regular users yet.</p>}
      </div>
    </section>
  );
}
