import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { AuthUser } from '../../types';
import type { ActionFeedback } from '../../hooks/useSavedAction';
import './management.css';

export function UserSummary({ user }: { user: AuthUser }) {
  return (
    <div className="management-person">
      <strong>{user.name}</strong>
      <span>{user.email}</span>
      <span>{user.phoneNumber || 'No phone number'}</span>
      <div className="management-badges">
        <span className="management-badge">{user.role}</span>
        <span className={`management-badge ${user.isBlocked ? 'is-blocked' : 'is-enabled'}`}>
          {user.isBlocked ? 'Blocked' : 'Not blocked'}
        </span>
      </div>
    </div>
  );
}

export function ActionNotice({ feedback, busy, onRetry }: {
  feedback: ActionFeedback | null; busy?: boolean; onRetry?: () => void;
}) {
  if (!feedback) return null;
  return (
    <div className={`management-notice is-${feedback.kind}`} role={feedback.kind === 'success' ? 'status' : 'alert'}>
      <p>{feedback.message}</p>
      {onRetry && <button className="management-button is-secondary" disabled={busy} onClick={onRetry} type="button">Reload lists</button>}
    </div>
  );
}

export function ManagementConfirm({ title, children, confirmLabel, busy, feedback, onConfirm, onCancel, danger = false }: {
  title: string; children: ReactNode; confirmLabel: string; busy: boolean; feedback?: ActionFeedback | null;
  onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    cancelRef.current?.focus();
    return () => {
      dialog?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return (
    <dialog ref={ref} className="management-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
      <p className="management-eyebrow">Confirm change</p>
      <h2 id={titleId}>{title}</h2>
      <div id={descriptionId} className="management-confirm-description">{children}</div>
      <ActionNotice feedback={feedback ?? null} />
      <div className="management-actions">
        <button ref={cancelRef} className="management-button is-secondary" disabled={busy} onClick={onCancel} type="button">Cancel</button>
        <button className={`management-button${danger ? ' is-danger' : ''}`} disabled={busy} onClick={onConfirm} type="button">
          {busy ? 'Saving…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
