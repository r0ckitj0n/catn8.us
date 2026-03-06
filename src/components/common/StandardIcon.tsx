import React from 'react';
import { StandardIconKey } from '../../types/uiStandards';
import { UI_STANDARDS_EVENT, getStandardizedIconSetting } from '../../core/uiStandards';

interface StandardIconProps {
  iconKey: StandardIconKey;
  className?: string;
}

export function StandardIcon({ iconKey, className = '' }: StandardIconProps) {
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    const handleChange = () => setVersion((current) => current + 1);
    window.addEventListener(UI_STANDARDS_EVENT, handleChange);
    return () => window.removeEventListener(UI_STANDARDS_EVENT, handleChange);
  }, []);

  const iconDef = React.useMemo(() => getStandardizedIconSetting(iconKey), [iconKey, version]);

  return (
    <img
      className={className}
      src={iconDef.asset_path}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
    />
  );
}
