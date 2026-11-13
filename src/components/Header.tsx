'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useSession } from '@/lib/client/session';
import { initials, roleLabel } from '@/lib/client/format';
import { useUi } from '@/lib/client/ui';

export default function Header() {
  const { user, logout } = useSession();
  const { toast } = useUi();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const link = (href: string, label: string) => {
    const active = pathname === href || (href !== '/' && pathname.startsWith(href));
    return <Link className={'navlink' + (active ? ' active' : '')} href={href}>{label}</Link>;
  };

  const signOut = async () => {
    await logout();
    toast('You have been signed out');
    window.location.href = '/';
  };

  return (
    <header className="site-header">
      <div className="container inner">
        <Link className="brand" href="/">
          <span className="brand-mark">🌳</span>
          <span>Plumtree Connect<small>Matabeleland South</small></span>
        </Link>
        <button className="btn btn-ghost btn-sm nav-toggle" aria-label="Menu" onClick={() => setOpen((v) => !v)}>☰ Menu</button>
        <nav className={'nav' + (open ? ' open' : '')}>
          {user ? (
            <>
              {link('/jobs', 'Jobs')}
              {link('/providers', 'Services')}
              <Link className="navlink" href={user.role === 'admin' ? '/admin' : '/dashboard'}>Dashboard</Link>
              <span className="badge badge-green" title={user.email}>{initials(user.name)} · {roleLabel(user.role)}</span>
              <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
            </>
          ) : (
            <>
              {link('/jobs', 'Jobs')}
              {link('/providers', 'Services')}
              <Link className="navlink" href="/login">Sign in</Link>
              <Link className="btn btn-sm" href="/register">Create account</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
