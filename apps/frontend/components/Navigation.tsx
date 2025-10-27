'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, SVGProps } from 'react';

type NavLink = {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const DashboardIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...props}>
    <rect x="3" y="3" width="8" height="8" rx="1.4" fill="currentColor" />
    <rect x="13" y="3" width="8" height="5" rx="1.4" fill="currentColor" />
    <rect x="13" y="10" width="8" height="11" rx="1.4" fill="currentColor" />
    <rect x="3" y="13" width="8" height="8" rx="1.4" fill="currentColor" />
  </svg>
);

const ImportIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...props}>
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="8 11 12 7 16 11" />
      <line x1="12" y1="7" x2="12" y2="17" />
      <polyline points="5 17 5 20 19 20 19 17" />
    </g>
  </svg>
);

const HistoryIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...props}>
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3.5 2.1" />
    </g>
  </svg>
);

const SettingsIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...props}>
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </g>
    <g fill="currentColor">
      <circle cx="10" cy="6" r="1.9" />
      <circle cx="15" cy="12" r="1.9" />
      <circle cx="8.5" cy="18" r="1.9" />
    </g>
  </svg>
);

const links: NavLink[] = [
  { href: '/', label: 'Tableau de bord', Icon: DashboardIcon },
  { href: '/history', label: 'Historique', Icon: HistoryIcon },
  { href: '/import', label: 'Imports CSV', Icon: ImportIcon },
  { href: '/settings', label: 'Configuration', Icon: SettingsIcon },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-header__brand">
          <span className="app-header__logo">PM</span>
          <div>
            <div className="app-header__title">Portefeuille Multi-Sources</div>
            <div className="app-header__subtitle">Pilotez vos investissements en un coup d'oeil</div>
          </div>
        </div>
        <nav className="app-nav">
          {links.map((link) => {
            const isActive =
              pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            const { Icon } = link;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={isActive ? 'app-nav__link app-nav__link--active' : 'app-nav__link'}
              >
                <span className="app-nav__icon-bubble">
                  <Icon className="app-nav__icon" aria-hidden="true" />
                </span>
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}






