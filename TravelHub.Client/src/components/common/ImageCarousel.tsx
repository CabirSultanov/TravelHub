import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { cleanImageUrls } from '../../utils/images';

type ImageCarouselProps = {
  images: string[];
  alt: string;
  fallbackSrc?: string;
  className?: string;
};

export function carouselImagesKey(images: string[]) {
  return cleanImageUrls(images).join('\n');
}

export function hasCarouselControls(images: string[]) {
  return cleanImageUrls(images).length > 1;
}

export function nextCarouselIndex(currentIndex: number, imageCount: number, step: -1 | 1) {
  if (imageCount <= 0) {
    return 0;
  }

  return (currentIndex + step + imageCount) % imageCount;
}

export default function ImageCarousel({ images, alt, fallbackSrc, className = '' }: ImageCarouselProps) {
  const imageUrls = useMemo(() => cleanImageUrls(images), [images]);
  const imageKey = carouselImagesKey(imageUrls);
  const [currentIndex, setCurrentIndex] = useState(0);
  const hasControls = imageUrls.length > 1;
  const safeIndex = currentIndex < imageUrls.length ? currentIndex : 0;
  const activeImage = imageUrls[safeIndex] ?? fallbackSrc ?? '';

  useEffect(() => {
    setCurrentIndex(0);
  }, [imageKey]);

  function move(step: -1 | 1) {
    setCurrentIndex((index) => nextCarouselIndex(index, imageUrls.length, step));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!hasControls) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(-1);
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(1);
    }
  }

  return (
    <div
      className={`image-carousel ${className}`.trim()}
      onKeyDown={handleKeyDown}
      tabIndex={hasControls ? 0 : undefined}
    >
      {activeImage && <img src={activeImage} alt={alt} />}
      {hasControls && (
        <>
          <button
            aria-label="Previous image"
            className="image-carousel-button image-carousel-button-prev"
            onClick={() => move(-1)}
            type="button"
          >
            <span aria-hidden="true">&lsaquo;</span>
          </button>
          <button
            aria-label="Next image"
            className="image-carousel-button image-carousel-button-next"
            onClick={() => move(1)}
            type="button"
          >
            <span aria-hidden="true">&rsaquo;</span>
          </button>
          <span className="image-carousel-count">
            {safeIndex + 1} / {imageUrls.length}
          </span>
        </>
      )}
    </div>
  );
}
