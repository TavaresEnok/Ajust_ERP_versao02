import Link from 'next/link';
import type { Route } from 'next';
import { ReactNode } from 'react';

type NavItem = {
  href: Route;
  label: string;
};

const navItems: NavItem[] = [
  { href: '/', label: 'Inicio' },
  { href: '/gerencia', label: 'Gerencia' },
  { href: '/analista', label: 'Analista' },
  { href: '/cliente', label: 'Cliente' }
];

export function PortalShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="app-shell">
      <header className="topbar fade-in-up">
        <div>
          <p className="eyebrow">Ajust ERP</p>
          <h1>{title}</h1>
          <p className="subtitle">{subtitle}</p>
        </div>
        <nav>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </main>
  );
}
