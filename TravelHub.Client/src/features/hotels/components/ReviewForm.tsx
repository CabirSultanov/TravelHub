import type { FormEvent } from 'react';
import StarRating from './StarRating';

type ReviewFormProps = {
  rating: number;
  comment: string;
  editing: boolean;
  submitting: boolean;
  onRatingChange: (rating: number) => void;
  onCommentChange: (comment: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export default function ReviewForm({
  rating,
  comment,
  editing,
  submitting,
  onRatingChange,
  onCommentChange,
  onSubmit,
  onCancel,
}: ReviewFormProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="hotel-review-form" onSubmit={submit}>
      <label className="review-form-label">Your rating</label>
      <StarRating label="Your hotel rating" onChange={onRatingChange} rating={rating} />
      <label className="review-form-label" htmlFor="hotel-review-comment">
        Comment <span>(optional)</span>
      </label>
      <textarea
        id="hotel-review-comment"
        maxLength={1000}
        onChange={(event) => onCommentChange(event.target.value)}
        placeholder="Share details about your stay"
        rows={4}
        value={comment}
      />
      <span className="review-character-count">{comment.length} / 1000</span>
      <div className="review-form-actions">
        <button className="btn btn-primary" disabled={submitting || rating < 1 || rating > 5} type="submit">
          {editing ? 'Save review' : 'Submit review'}
        </button>
        <button className="btn btn-secondary" disabled={submitting} onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}
