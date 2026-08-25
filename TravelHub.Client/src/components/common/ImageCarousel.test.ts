import { describe, expect, it } from 'vitest';
import { carouselImagesKey, hasCarouselControls, nextCarouselIndex } from './ImageCarousel';

describe('ImageCarousel helpers', () => {
  it('hides controls for one image', () => {
    expect(hasCarouselControls(['https://example.com/a.jpg'])).toBe(false);
  });

  it('shows controls for multiple images', () => {
    expect(hasCarouselControls(['https://example.com/a.jpg', 'https://example.com/b.jpg'])).toBe(true);
  });

  it('cycles to the next image', () => {
    expect(nextCarouselIndex(2, 3, 1)).toBe(0);
  });

  it('cycles to the previous image', () => {
    expect(nextCarouselIndex(0, 3, -1)).toBe(2);
  });

  it('changes reset key when the image set changes', () => {
    expect(carouselImagesKey(['https://example.com/a.jpg'])).not.toBe(
      carouselImagesKey(['https://example.com/b.jpg']),
    );
  });
});
