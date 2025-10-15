'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Tableau de bord' },
  { href: '/import', label: 'Imports CSV' },
  { href: '/settings', label: 'Configuration' },
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
            return (
              <Link
                key={link.href}
                href={link.href}
                className={isActive ? 'app-nav__link app-nav__link--active' : 'app-nav__link'}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}






