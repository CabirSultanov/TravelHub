import { useState } from 'react';

type StarRatingProps = {
  rating: number;
  onChange?: (rating: number) => void;
  label?: string;
};

export default function StarRating({ rating, onChange, label = `${rating} out of 5 stars` }: StarRatingProps) {
  const [hoveredRating, setHoveredRating] = useState(0);
  const activeRating = onChange ? hoveredRating || rating : rating;

  if (!onChange) {
    return (
      <span aria-label={label} className="star-rating" role="img">
        {[1, 2, 3, 4, 5].map((star) => (
          <span aria-hidden="true" className={star <= activeRating ? 'star is-filled' : 'star'} key={star}>
            ★
          </span>
        ))}
      </span>
    );
  }

  return (
    <div aria-label={label} className="star-rating star-rating-interactive" onMouseLeave={() => setHoveredRating(0)} role="group">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          aria-label={`Rate ${star} out of 5`}
          aria-pressed={rating === star}
          className={star <= activeRating ? 'star-button is-filled' : 'star-button'}
          key={star}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHoveredRating(star)}
          type="button"
        >
          <span aria-hidden="true">★</span>
        </button>
      ))}
    </div>
  );
}
