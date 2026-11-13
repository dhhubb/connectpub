'use client';

import { PER_PAGE_OPTIONS, pageNumbers } from '@/lib/client/format';

export interface Pagination {
  page: number;
  perPage: number;
  total: number;
  pages: number;
  from?: number;
  to?: number;
  hasPrev?: boolean;
  hasNext?: boolean;
}

/**
 * Portable pager: numbered pages with ellipses, a per-page selector and a jump
 * box for long result sets. Renders nothing when there are no results.
 */
export default function Pager({ pagination, unit = 'result', onPage, onPerPage, showPerPage = true, showJump = true }: {
  pagination: Pagination;
  unit?: string;
  onPage: (page: number) => void;
  onPerPage?: (perPage: number) => void;
  showPerPage?: boolean;
  showJump?: boolean;
}) {
  const { page, perPage, total, pages, from, to } = pagination;
  if (!total) return null;

  const summary = (
    <span className="pager-summary">
      Showing <b>{from ?? 0}–{to ?? 0}</b> of <b>{total}</b> {unit}{total === 1 ? '' : 's'}
    </span>
  );

  if (pages <= 1 && !showPerPage) {
    return <div className="pager"><div className="pager-bar">{summary}</div></div>;
  }

  return (
    <div className="pager">
      <div className="pager-bar">
        {summary}
        <div className="pager-controls">
          <button type="button" className="pager-btn" disabled={page === 1} aria-label="First page" onClick={() => onPage(1)}>«</button>
          <button type="button" className="pager-btn" disabled={page === 1} aria-label="Previous page" onClick={() => onPage(page - 1)}>‹</button>
          {pageNumbers(page, pages).map((p, i) => (
            p === '…'
              ? <span key={'gap' + i} className="pager-gap" aria-hidden="true">…</span>
              : (
                <button
                  key={p}
                  type="button"
                  className={'pager-btn' + (p === page ? ' active' : '')}
                  aria-current={p === page ? 'page' : undefined}
                  onClick={() => { if (p !== page) onPage(p); }}
                >{p}</button>
              )
          ))}
          <button type="button" className="pager-btn" disabled={page === pages} aria-label="Next page" onClick={() => onPage(page + 1)}>›</button>
          <button type="button" className="pager-btn" disabled={page === pages} aria-label="Last page" onClick={() => onPage(pages)}>»</button>
        </div>
        <div className="pager-tools">
          {showPerPage && onPerPage && (
            <label className="pager-size">
              Per page
              <select value={perPage} onChange={(e) => onPerPage(Number(e.target.value))}>
                {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
          {showJump && pages > 7 && (
            <label className="pager-jump">
              Go to
              <input
                type="number"
                min={1}
                max={pages}
                defaultValue={page}
                aria-label="Page number"
                key={page}
                onBlur={(e) => {
                  const target = Math.min(pages, Math.max(1, Number(e.target.value) || page));
                  if (target !== page) onPage(target);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
