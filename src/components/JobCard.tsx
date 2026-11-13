'use client';

import Link from 'next/link';
import type { Job } from '@/lib/client/types';
import { dateLabel, daysLeft, money } from '@/lib/client/format';

export default function JobCard({ job }: { job: Job }) {
  const left = daysLeft(job.deadline);
  return (
    <article className="card job-card">
      <div className="row" style={{ alignItems: 'flex-start', gap: '.7rem' }}>
        <div className="thumb" aria-hidden="true">{job.category?.icon || '💼'}</div>
        <div className="grow">
          <div className="row" style={{ gap: '.4rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.03rem' }}>
              <Link href={`/jobs/${job.id}`}>{job.title}</Link>
            </h3>
            {job.featured && <span className="badge badge-clay">Featured</span>}
          </div>
          <p className="small muted mb0" style={{ marginTop: '.15rem' }}>
            <b style={{ color: 'var(--ink-700)' }}>{job.company}</b>
            {job.location ? <> · 📍 {job.location.name}</> : null}
          </p>
        </div>
      </div>

      <div className="chips" style={{ marginTop: '.75rem' }}>
        <span className="tag">{job.jobTypeLabel}</span>
        <span className="tag">{job.workModeLabel}</span>
        {job.category && <span className="tag">{job.category.name}</span>}
      </div>

      <p className="small" style={{ margin: '.75rem 0 .3rem', color: 'var(--green-800)', fontWeight: 650 }}>{job.salaryLabel}</p>

      <div className="spread" style={{ marginTop: '.6rem' }}>
        <span className="tiny muted">
          {job.deadline
            ? (left !== null && left >= 0 ? `Closes in ${left} day${left === 1 ? '' : 's'}` : `Closed ${dateLabel(job.deadline)}`)
            : 'Rolling deadline'}
        </span>
        <span className="tiny muted">Posted {dateLabel(job.createdAt)}</span>
      </div>
    </article>
  );
}
