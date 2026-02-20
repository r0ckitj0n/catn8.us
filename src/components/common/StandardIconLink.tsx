import React from 'react';
import { StandardIcon } from './StandardIcon';
import { StandardIconKey } from '../../types/uiStandards';

interface StandardIconLinkProps {
  iconKey: StandardIconKey;
  ariaLabel: string;
  title?: string;
  className?: string;
  href: string;
  target?: string;
  rel?: string;
}

export function StandardIconLink({
  iconKey,
  ariaLabel,
  title,
  className = '',
  href,
  target,
  rel,
}: StandardIconLinkProps) {
  return (
    <a
      className={`catn8-icon-btn ${className}`.trim()}
      href={href}
      aria-label={ariaLabel}
      title={title || ariaLabel}
      target={target}
      rel={rel}
    >
      <StandardIcon iconKey={iconKey} className="catn8-icon-btn-glyph" />
    </a>
  );
}
