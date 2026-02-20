import React from 'react';
import { STANDARDIZED_ICON_DEFINITIONS } from '../../data/standardizedIcons';
import { StandardIconKey } from '../../types/uiStandards';

interface StandardIconProps {
  iconKey: StandardIconKey;
  className?: string;
}

export function StandardIcon({ iconKey, className = '' }: StandardIconProps) {
  const iconDef = React.useMemo(
    () => STANDARDIZED_ICON_DEFINITIONS.find((item) => item.key === iconKey) || STANDARDIZED_ICON_DEFINITIONS[0],
    [iconKey],
  );

  return (
    <svg
      className={className}
      viewBox={iconDef.viewBox}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={iconDef.path} />
    </svg>
  );
}
