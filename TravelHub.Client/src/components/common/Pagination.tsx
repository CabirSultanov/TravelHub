type PaginationProps = {
  page: number;
  totalPages: number;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  onPageChange: (page: number) => void;
};

export function getPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const items: Array<number | 'ellipsis'> = [];
  let previousPage = 0;

  for (const page of Array.from(pages).filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b)) {
    if (page - previousPage > 1) {
      items.push('ellipsis');
    }

    items.push(page);
    previousPage = page;
  }

  return items;
}

export default function Pagination({
  page,
  totalPages,
  disabled = false,
  ariaLabel,
  className = 'user-pagination',
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pageItems = getPaginationItems(page, totalPages);

  return (
    <div className={className} aria-label={ariaLabel}>
      <button
        className="pagination-button"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
        type="button"
      >
        Previous
      </button>
      {pageItems.map((item, index) =>
        item === 'ellipsis' ? (
          <span className="pagination-ellipsis" key={`ellipsis-${index}`}>
            ...
          </span>
        ) : (
          <button
            aria-current={item === page ? 'page' : undefined}
            className={`pagination-button pagination-page${item === page ? ' active' : ''}`}
            disabled={disabled || item === page}
            key={item}
            onClick={() => onPageChange(item)}
            type="button"
          >
            {item}
          </button>
        ),
      )}
      <button
        className="pagination-button"
        disabled={disabled || page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        type="button"
      >
        Next
      </button>
    </div>
  );
}
