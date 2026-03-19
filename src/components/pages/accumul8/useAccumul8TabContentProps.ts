import React from 'react';

import { Accumul8PageTabContent } from './Accumul8PageTabContent';
import { DateRangeFilter, LedgerFilterPreset } from './accumul8PageTypes';

export function useAccumul8TabContentProps(
  options: React.ComponentProps<typeof Accumul8PageTabContent>,
) {
  return React.useMemo<React.ComponentProps<typeof Accumul8PageTabContent>>(() => ({
    ...options,
    ledgerTabProps: {
      ...options.ledgerTabProps,
      setLedgerDateFilter: (value) => options.ledgerTabProps.setLedgerDateFilter(value as DateRangeFilter),
      setLedgerFilterPreset: (value) => options.ledgerTabProps.setLedgerFilterPreset(value as LedgerFilterPreset),
    },
    payBillsTabProps: {
      ...options.payBillsTabProps,
      setPayBillsDateFilter: (value) => options.payBillsTabProps.setPayBillsDateFilter(value as DateRangeFilter),
    },
  }), [options]);
}
