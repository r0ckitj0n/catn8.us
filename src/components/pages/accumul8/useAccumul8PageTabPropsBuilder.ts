import React from 'react';

import { Accumul8PageTabContent } from './Accumul8PageTabContent';
import { buildAccumul8PrimaryTabProps } from './buildAccumul8PrimaryTabProps';
import { buildAccumul8SecondaryTabProps } from './buildAccumul8SecondaryTabProps';

export function useAccumul8PageTabPropsBuilder(options: any): React.ComponentProps<typeof Accumul8PageTabContent> {
  return React.useMemo(() => ({
    ...buildAccumul8PrimaryTabProps(options),
    ...buildAccumul8SecondaryTabProps(options),
  }), [options]);
}
