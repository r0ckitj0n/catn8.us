import React from 'react';
import { StandardIcon } from './StandardIcon';
import { StandardIconKey } from '../../types/uiStandards';
import { loadStandardizedIconSettings } from '../../core/uiStandards';

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
  const resolvedTitle = React.useMemo(() => {
    if (title) return title;
    const match = loadStandardizedIconSettings().find((item) => item.key === iconKey);
    return match?.label || ariaLabel;
  }, [title, iconKey, ariaLabel]);

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
