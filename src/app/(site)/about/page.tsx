import Link from 'next/link';

export const metadata = {
  title: 'About · Plumtree Connect',
  description: 'How Plumtree Connect works: a moderated jobs and services board for Plumtree and Matabeleland South.',
};

const DEMO = [
  ['Administrator', 'admin@plumtreeconnect.co.zw', 'admin1234'],
  ['Job seeker', 'thandiwe@example.com', 'seeker1234'],
  ['Employer', 'hr@plumtreeagro.co.zw', 'employer1234'],
  ['Service provider', 'info@tshitshiboreholes.co.zw', 'provider1234'],
];

export default function AboutPage() {
  return (
    <main className="container" style={{ padding: '2.2rem 1.15rem 3rem', maxWidth: 900 }}>
      <p className="eyebrow">About the platform</p>
      <h1>Plumtree Connect</h1>
      <p className="lede muted">A local jobs and services board built for Plumtree town and the wards of Matabeleland South — Bulilima, Mangwe, Tshitshi, Matjinge, Empandeni and their neighbours.</p>

      <div className="card" style={{ marginTop: '1.4rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>What it does</h2>
        <p>Plumtree Connect brings two things together that usually live in separate places: paid work and the trades people need at home or at their business. Employers post vacancies; artisans and service businesses list what they do. Everyone searches the same board.</p>
        <div className="grid-3" style={{ marginTop: '1rem' }}>
          <div className="feature-tile"><div className="ic">💼</div><h3>Job board</h3><p className="small muted">Filter vacancies by category, area, job type, work mode and salary. Apply with one profile.</p></div>
          <div className="feature-tile"><div className="ic">🔧</div><h3>Service directory</h3><p className="small muted">Find builders, drillers, electricians, transporters and more, with ratings from real customers.</p></div>
          <div className="feature-tile"><div className="ic">🛡️</div><h3>Admin moderation</h3><p className="small muted">Every listing is reviewed before it goes live, so the board stays honest and safe.</p></div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.2rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>How it works</h2>
        <ol className="prose" style={{ paddingLeft: '1.2rem' }}>
          <li><b>Create an account</b> as a job seeker, an employer or a service provider. Each role gets a dashboard suited to it.</li>
          <li><b>Employers and providers post listings.</b> A job listing needs a title, description, category, area and contact details. A service listing needs a business name, description, services and a phone number.</li>
          <li><b>An administrator reviews it.</b> Approved listings appear on the public board. Rejected listings carry a reason the owner can see and fix.</li>
          <li><b>Job seekers apply</b> and track each application through submitted, reviewing, shortlisted, interview and hired. Employers move candidates through the same stages.</li>
          <li><b>Customers send service requests</b> to providers, who reply with a quote and update the request status as work progresses.</li>
          <li><b>Customers rate providers</b> from one to five stars. Ratings are shown publicly and can be moderated if abused.</li>
        </ol>
      </div>

      <div className="card" style={{ marginTop: '1.2rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Roles at a glance</h2>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Role</th><th>Can do</th><th>Dashboard</th></tr></thead>
            <tbody>
              <tr><td><b>Job seeker</b></td><td>Browse jobs, apply, save jobs and providers, send service requests, track applications</td><td>Applications, saved items, profile</td></tr>
              <tr><td><b>Employer</b></td><td>Post and manage vacancies, review applicants, shortlist, hire</td><td>Listings, applicants, profile</td></tr>
              <tr><td><b>Service provider</b></td><td>Publish a business listing, receive and manage service requests, collect reviews</td><td>Listings, requests, profile</td></tr>
              <tr><td><b>Administrator</b></td><td>Moderate listings, verify providers, manage users, categories, locations, reviews, settings</td><td>Full admin panel with statistics</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.2rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Demo data</h2>
        <p className="small">This build ships with sample users, listings, applications, requests and reviews so you can explore every flow. Sign in with any of these accounts:</p>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Role</th><th>Email</th><th>Password</th></tr></thead>
            <tbody>
              {DEMO.map(([role, mail, pass]) => <tr key={mail}><td>{role}</td><td className="mono">{mail}</td><td className="mono">{pass}</td></tr>)}
            </tbody>
          </table>
        </div>
        <Link className="btn" href="/login" style={{ marginTop: '1rem' }}>Sign in to explore</Link>
      </div>
    </main>
  );
}
