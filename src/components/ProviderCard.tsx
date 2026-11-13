'use client';

import Link from 'next/link';
import type { Provider } from '@/lib/client/types';
import { money } from '@/lib/client/format';
import Stars from './Stars';

export default function ProviderCard({ provider }: { provider: Provider }) {
  return (
    <article className="card provider-card">
      <div className="row" style={{ alignItems: 'flex-start', gap: '.7rem' }}>
        <div className="thumb" aria-hidden="true">{provider.category?.icon || '🔧'}</div>
        <div className="grow">
          <div className="row" style={{ gap: '.4rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.03rem' }}>
              <Link href={`/providers/${provider.id}`}>{provider.businessName}</Link>
            </h3>
            {provider.verified && <span className="badge badge-green" title="Verified provider">✓ Verified</span>}
            {provider.featured && <span className="badge badge-clay">Featured</span>}
          </div>
          <p className="small muted mb0" style={{ marginTop: '.15rem' }}>
            {provider.category?.name || 'Service provider'}
            {provider.location ? <> · 📍 {provider.location.name}</> : null}
          </p>
        </div>
      </div>

      {provider.tagline && <p className="small" style={{ margin: '.7rem 0 .4rem' }}>{provider.tagline}</p>}

      <div className="row" style={{ gap: '.5rem', marginTop: '.5rem' }}>
        {provider.rating !== null ? (
          <>
            <Stars rating={provider.rating} />
            <span className="tiny muted">{provider.rating} ({provider.ratingCount})</span>
          </>
        ) : (
          <span className="tiny muted">No reviews yet</span>
        )}
      </div>

      <div className="chips" style={{ marginTop: '.6rem' }}>
        <span className={'tag'}>{provider.availabilityLabel}</span>
        {provider.yearsExperience > 0 && <span className="tag">{provider.yearsExperience} yrs experience</span>}
      </div>

      <div className="spread" style={{ marginTop: '.7rem' }}>
        <span className="small" style={{ color: 'var(--green-800)', fontWeight: 650 }}>
          {provider.priceFrom ? `From ${money(provider.priceFrom, provider.currency)}` : 'Request a quote'}
        </span>
        <Link className="btn btn-sm btn-outline" href={`/providers/${provider.id}`}>View profile</Link>
      </div>
    </article>
  );
}
