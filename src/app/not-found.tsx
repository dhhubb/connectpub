import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container" style={{ padding: '3rem 1.15rem', textAlign: 'center' }}>
      <div className="empty">
        <span className="icon">🌳</span>
        <b>Page not found</b>
        <p>That page does not exist or has moved.</p>
        <div className="row" style={{ justifyContent: 'center', marginTop: '.6rem' }}>
          <Link className="btn" href="/">Back to home</Link>
          <Link className="btn btn-outline" href="/jobs">Browse jobs</Link>
        </div>
      </div>
    </main>
  );
}
