import React from 'react';
import { StandardIcon } from './StandardIcon';
import { StandardIconKey } from '../../types/uiStandards';
import { UI_STANDARDS_EVENT, getStandardizedIconSetting } from '../../core/uiStandards';

interface StandardIconButtonProps {
  iconKey: StandardIconKey;
  ariaLabel: string;
  title?: string;
  className?: string;
  onClick?: () => void;
  dismissModal?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export function StandardIconButton({
  iconKey,
  ariaLabel,
  title,
  className = '',
  onClick,
  dismissModal = false,
  disabled = false,
  type = 'button',
}: StandardIconButtonProps) {
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    const handleChange = () => setVersion((current) => current + 1);
    window.addEventListener(UI_STANDARDS_EVENT, handleChange);
    return () => window.removeEventListener(UI_STANDARDS_EVENT, handleChange);
  }, []);

  const resolvedTitle = React.useMemo(() => {
    if (title) return title;
    const match = getStandardizedIconSetting(iconKey);
    return match?.label || ariaLabel;
  }, [title, iconKey, ariaLabel, version]);

  if (dismissModal) {
    return (
      <button
        type={type}
        className={`catn8-icon-btn ${className}`.trim()}
        aria-label={ariaLabel}
        title={resolvedTitle}
        data-bs-dismiss="modal"
        onClick={onClick}
        disabled={disabled}
      >
        <StandardIcon iconKey={iconKey} className="catn8-icon-btn-glyph" />
      </button>
    );
  }

  return (
    <button
      type={type}
      className={`catn8-icon-btn ${className}`.trim()}
      aria-label={ariaLabel}
      title={resolvedTitle}
      onClick={onClick}
      disabled={disabled}
    >
      <StandardIcon iconKey={iconKey} className="catn8-icon-btn-glyph" />
    </button>
  );
}
