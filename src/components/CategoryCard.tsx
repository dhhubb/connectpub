import Link from 'next/link';
import type { Category } from '@/lib/client/types';

/** Category tile linking to the category landing page for its kind. */
export default function CategoryCard({ category, kind }: { category: Category; kind: 'job' | 'service' }) {
  const count = kind === 'job' ? (category.jobCount ?? 0) : (category.providerCount ?? 0);
  const countLabel = kind === 'job'
    ? `${count} open job${count === 1 ? '' : 's'}`
    : `${count} provider${count === 1 ? '' : 's'}`;
  return (
    <Link className="card cat-card" href={`/categories/${category.slug}`}>
      <div className="row">
        <div className="thumb">{category.icon || '📌'}</div>
        <div className="grow">
          <b style={{ color: 'var(--ink-900)' }}>{category.name}</b>
          <div className="tiny muted">{countLabel}</div>
        </div>
      </div>
      {category.description && <p className="small muted" style={{ margin: '.6rem 0 0' }}>{category.description}</p>}
      {category.group && (
        <div className="cat-card-foot">
          <span className="tag">{category.group.icon || '📁'} {category.group.name}</span>
          <span className="cat-go">{kind === 'job' ? 'View jobs' : 'View providers'} →</span>
        </div>
      )}
    </Link>
  );
}
