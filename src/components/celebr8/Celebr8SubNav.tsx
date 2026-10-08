import React from 'react';

type Props = {
  active: 'event' | 'templates' | 'activities';
};

export function Celebr8SubNav({ active }: Props) {
  const links: Array<{ key: Props['active']; href: string; label: string }> = [
    { key: 'event', href: '/celebr8', label: 'Event' },
    { key: 'templates', href: '/celebr8/templates', label: 'Party Templates' },
    { key: 'activities', href: '/celebr8/activities', label: 'Activities' },
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
