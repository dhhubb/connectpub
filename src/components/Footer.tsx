import Link from 'next/link';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="brand" style={{ color: '#fff' }}><span className="brand-mark">🌳</span><span>Plumtree Connect</span></div>
            <p className="small" style={{ marginTop: '.7rem', maxWidth: '38ch' }}>
              The local jobs and services board for Plumtree and the wider Matabeleland South province.
              Post work, find work, and book trusted service providers near you.
            </p>
          </div>
          <div>
            <h4>Find work</h4>
            <Link href="/jobs">Browse jobs</Link>
            <Link href="/categories?scope=job">Job categories</Link>
            <Link href="/jobs?work_mode=remote">Remote work</Link>
            <Link href="/register">Create a job seeker profile</Link>
          </div>
          <div>
            <h4>Find services</h4>
            <Link href="/providers">Browse providers</Link>
            <Link href="/categories?scope=service">Service categories</Link>
            <Link href="/providers?verified=1">Verified providers</Link>
            <Link href="/register">List your business</Link>
          </div>
          <div>
            <h4>Platform</h4>
            <Link href="/dashboard">User dashboard</Link>
            <Link href="/admin">Admin panel</Link>
            <Link href="/about">About &amp; how it works</Link>
            <a href="/api/health">API status</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {year} Plumtree Connect · Plumtree, Matabeleland South, Zimbabwe</span>
          <span>Built for the local community · Demo data</span>
        </div>
      </div>
    </footer>
  );
}
