import Pagination from '../../../components/common/Pagination';
import type { AuthUser, HotelReview } from '../../../types';
import { formatRelativeTime, formatReviewTimestamp } from '../../../utils/relativeTime';
import type { useHotelReviews } from '../hooks/useHotelReviews';
import ReviewForm from './ReviewForm';
import StarRating from './StarRating';

type ReviewsFeature = ReturnType<typeof useHotelReviews>;

type HotelReviewsProps = {
  currentUser: AuthUser | null;
  feature: ReviewsFeature;
  submitting: boolean;
};

export default function HotelReviews({ currentUser, feature, submitting }: HotelReviewsProps) {
  const { model, actions } = feature;
  const response = model.response;
  const averageRating = response?.averageRating ?? null;

  function canDelete(review: HotelReview) {
    return review.userId === currentUser?.id || model.canModerate;
  }

  return (
    <section className="hotel-reviews" aria-labelledby="guest-reviews-title">
      <div className="hotel-reviews-header">
        <div>
          <p className="eyebrow">Guest reviews</p>
          <h3 id="guest-reviews-title">What guests say</h3>
          {averageRating === null ? (
            <p className="review-summary-empty">No reviews yet</p>
          ) : (
            <div className="review-summary">
              <StarRating label={`${averageRating.toFixed(1)} out of 5 stars`} rating={Math.round(averageRating)} />
              <strong>{averageRating.toFixed(1)} / 5</strong>
              <span>{response?.reviewCount ?? 0} reviews</span>
            </div>
          )}
        </div>
        <button className="btn btn-primary" disabled={submitting || (Boolean(currentUser) && !model.ownReviewLoaded)} onClick={actions.openForm} type="button">
          {currentUser && !model.ownReviewLoaded ? 'Loading review...' : model.ownReview ? 'Edit your review' : 'Rate this hotel'}
        </button>
      </div>

      {model.showForm && (
        <ReviewForm
          comment={model.comment}
          editing={Boolean(model.ownReview)}
          onCancel={actions.cancelForm}
          onCommentChange={actions.setComment}
          onRatingChange={actions.setRating}
          onSubmit={() => void actions.submit()}
          rating={model.rating}
          submitting={submitting}
        />
      )}

      {model.loading && !response ? <p className="empty">Loading reviews...</p> : null}

      {response?.items.map((review) => (
        <article className="review-card" key={review.id}>
          <div className="review-card-header">
            <div>
              <strong>{review.userName}</strong>
              <StarRating label={`${review.rating} out of 5 stars`} rating={review.rating} />
            </div>
            <div className="review-card-meta">
              <time dateTime={review.createdAt} title={formatReviewTimestamp(review.createdAt)}>
                {formatRelativeTime(review.createdAt)}
              </time>
              {review.updatedAt && <span>Edited</span>}
              {canDelete(review) && (
                <button className="review-delete-button" disabled={submitting} onClick={() => void actions.remove(review)} type="button">
                  Delete
                </button>
              )}
            </div>
          </div>
          {review.comment && <p>{review.comment}</p>}
        </article>
      ))}

      {!model.loading && response?.totalItems === 0 ? <p className="empty">Be the first to rate this hotel.</p> : null}

      {response && (
        <Pagination
          ariaLabel="Hotel reviews pagination"
          className="hotel-review-pagination user-pagination"
          disabled={model.loading || submitting}
          onPageChange={actions.setPage}
          page={response.page}
          totalPages={response.totalPages}
        />
      )}
    </section>
  );
}
