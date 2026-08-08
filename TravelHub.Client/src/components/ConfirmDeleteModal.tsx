import type { DeleteTarget } from '../types';

type ConfirmDeleteModalProps = {
  target: DeleteTarget;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export default function ConfirmDeleteModal({ target, submitting, onCancel, onConfirm }: ConfirmDeleteModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="confirm-modal" aria-modal="true" role="dialog">
        <p className="eyebrow">Confirm action</p>
        <h3>Delete {target.kind}?</h3>
        <p>{target.name} will be removed from the list.</p>
        <div className="confirm-actions">
          <button className="link-button" disabled={submitting} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="danger-button" disabled={submitting} onClick={() => void onConfirm()} type="button">
            Delete
          </button>
        </div>
      </section>
    </div>
  );
}
