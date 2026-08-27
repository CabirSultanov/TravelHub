import { useEffect, useState } from 'react';
import { api } from '../../../api';
import type { AuthUser, HotelReview, HotelReviewInput, HotelReviewsResponse } from '../../../types';
import { getErrorMessage } from '../../../utils/errors';

const REVIEW_PAGE_SIZE = 5;

type Options = {
  hotelId: number | null;
  currentUser: AuthUser | null;
  setMessage: (message: string) => void;
  setSubmitting: (submitting: boolean) => void;
  onRequireAuth: (message: string) => void;
  onStatsChange: (hotelId: number, stats: Pick<HotelReviewsResponse, 'averageRating' | 'reviewCount'>) => void;
};

export function useHotelReviews({ hotelId, currentUser, setMessage, setSubmitting, onRequireAuth, onStatsChange }: Options) {
  const [response, setResponse] = useState<HotelReviewsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [ownReview, setOwnReview] = useState<HotelReview | null>(null);
  const [ownReviewLoaded, setOwnReviewLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  async function loadReviews(requestedPage = page) {
    if (hotelId === null) {
      return;
    }

    setLoading(true);

    try {
      const nextResponse = await api.getHotelReviews(hotelId, requestedPage, REVIEW_PAGE_SIZE);
      setResponse(nextResponse);
      setPage(nextResponse.page);
      onStatsChange(hotelId, nextResponse);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (hotelId === null) {
      setResponse(null);
      setPage(1);
      setShowForm(false);
      return;
    }

    void loadReviews(page);
  }, [hotelId, page]);

  useEffect(() => {
    let ignore = false;

    if (hotelId === null || !currentUser) {
      setOwnReview(null);
      setOwnReviewLoaded(true);
      setShowForm(false);
      return;
    }

    setOwnReviewLoaded(false);

    void api
      .getMyHotelReview(hotelId)
      .then((review) => {
        if (!ignore) {
          setOwnReview(review);
          setOwnReviewLoaded(true);
        }
      })
      .catch((error) => {
        if (!ignore) {
          setMessage(getErrorMessage(error));
          setOwnReviewLoaded(true);
        }
      });

    return () => {
      ignore = true;
    };
  }, [currentUser?.id, hotelId]);

  function openForm() {
    if (!currentUser) {
      onRequireAuth('Please sign in to rate this hotel.');
      return;
    }

    setRating(ownReview?.rating ?? 0);
    setComment(ownReview?.comment ?? '');
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setRating(0);
    setComment('');
  }

  async function submit() {
    if (hotelId === null || !currentUser || rating < 1 || rating > 5) {
      return;
    }

    setSubmitting(true);
    setMessage('');
    const review: HotelReviewInput = { rating, comment: comment.trim() || null };

    try {
      const savedReview = ownReview
        ? await api.updateHotelReview(hotelId, ownReview.id, review)
        : await api.createHotelReview(hotelId, review);

      setOwnReview(savedReview);
      cancelForm();
      await loadReviews(1);
      setMessage(ownReview ? 'Review updated.' : 'Review submitted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(review: HotelReview) {
    if (hotelId === null || !currentUser || !window.confirm('Delete this review?')) {
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      await api.deleteHotelReview(hotelId, review.id);

      if (review.id === ownReview?.id) {
        setOwnReview(null);
        cancelForm();
      }

      await loadReviews(page);
      setMessage('Review deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return {
    model: {
      response,
      page,
      loading,
      ownReview,
      ownReviewLoaded,
      showForm,
      rating,
      comment,
      canModerate: currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin',
    },
    actions: {
      openForm,
      cancelForm,
      setRating,
      setComment,
      setPage,
      submit,
      remove,
    },
  };
}
