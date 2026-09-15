import { useState } from 'react';
import { api } from '../../api';
import Pagination from '../../components/common/Pagination';
import StarRating from '../../features/hotels/components/StarRating';
import type { Hotel, HotelReviewsResponse } from '../../types';
import { formatRelativeTime, formatReviewTimestamp } from '../../utils/relativeTime';
import { useOwnerQuery } from './useOwnerQuery';

type Props = { hotel: Hotel; accountKey: string };

export default function OwnerReviews(props: Props) {
  return <ReviewList key={JSON.stringify([props.accountKey, props.hotel.id])} {...props} />;
}

function ReviewList({ hotel, accountKey }: Props) {
  const [page, setPage] = useState(1);
  const query = useOwnerQuery<HotelReviewsResponse>(JSON.stringify(['owner-reviews', accountKey, hotel.id, page]), async (signal) => {
    await api.getOwnerOverview(hotel.id, signal);
    return api.getHotelReviews(hotel.id, page, 10, signal);
  });
  const response = query.accessDenied ? null : query.data;
  const busy = query.loading || query.refreshing;
  return <section className="owner-section" aria-labelledby="owner-reviews-title">
    <div className="owner-section-header">
      <div><h2 id="owner-reviews-title">Guest reviews</h2><p className="owner-muted">Feedback for {hotel.name}</p></div>
      <button className="btn btn-secondary" disabled={busy} onClick={() => void query.reload().catch(() => undefined)} type="button">{query.refreshing ? 'Refreshing…' : 'Refresh reviews'}</button>
    </div>
    {query.error && <div className="owner-notice" role="alert"><p>{query.error}</p>{response && <p>Showing the last loaded reviews.</p>}</div>}
    {query.loading && !response && <p className="owner-empty" role="status">Loading reviews…</p>}
    {!query.loading && !query.error && response?.reviewCount === 0 && <p className="owner-empty">No reviews yet.</p>}
    {response && <>
      {response.averageRating !== null && <div className="owner-review-summary">
        <strong>{response.averageRating.toFixed(1)} / 5</strong>
        <StarRating label={`${response.averageRating.toFixed(1)} out of 5 stars`} rating={Math.round(response.averageRating)} />
        <span>{response.reviewCount} {response.reviewCount === 1 ? 'review' : 'reviews'}</span>
      </div>}
      <div className="owner-review-list">
        {response.items.map((review) => <article className="owner-review-card" key={review.id}>
          <div className="owner-section-header"><div><h3>{review.userName}</h3><StarRating rating={review.rating} /></div>
            <div className="owner-review-meta"><time dateTime={review.createdAt} title={formatReviewTimestamp(review.createdAt)}>{formatRelativeTime(review.createdAt)}</time>
              {review.updatedAt && <span title={formatReviewTimestamp(review.updatedAt)}>Edited</span>}
            </div>
          </div>
          <p>{review.comment || 'Rating only — no written comment.'}</p>
        </article>)}
      </div>
      <Pagination ariaLabel="Owner reviews pages" disabled={busy} onPageChange={setPage} page={response.page} totalPages={response.totalPages} />
    </>}
  </section>;
}
