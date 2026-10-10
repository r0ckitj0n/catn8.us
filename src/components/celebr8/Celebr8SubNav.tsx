import React from 'react';

type Props = {
  active: 'parties' | 'templates' | 'activities';
};

export function Celebr8SubNav({ active }: Props) {
  const links: Array<{ key: Props['active']; href: string; label: string }> = [
    { key: 'parties', href: '/celebr8', label: 'My Parties' },
    { key: 'activities', href: '/celebr8/activities', label: 'Activities' },
    { key: 'templates', href: '/celebr8/templates', label: 'Templates' },
  ];

  return (
    <nav className="celebr8-subnav" aria-label="Celebr8 sections">
      {links.map((link) => (
        <a
          key={link.key}
          href={link.href}
          className={`celebr8-subnav-link${active === link.key ? ' is-active' : ''}`}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
