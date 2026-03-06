import React from 'react';
import { StandardIcon } from './StandardIcon';
import { StandardIconKey } from '../../types/uiStandards';
import { UI_STANDARDS_EVENT, getStandardizedIconSetting } from '../../core/uiStandards';

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
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    const handleChange = () => setVersion((current) => current + 1);
    window.addEventListener(UI_STANDARDS_EVENT, handleChange);
    return () => window.removeEventListener(UI_STANDARDS_EVENT, handleChange);
  }, []);

  const resolvedTitle = React.useMemo(() => title || getStandardizedIconSetting(iconKey).label || ariaLabel, [ariaLabel, iconKey, title, version]);

  return (
    <a
      className={`catn8-icon-btn ${className}`.trim()}
      href={href}
      aria-label={ariaLabel}
      title={resolvedTitle}
      target={target}
      rel={rel}
    >
      <StandardIcon iconKey={iconKey} className="catn8-icon-btn-glyph" />
    </a>
  );
}
