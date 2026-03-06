import React from 'react';
import { ApiClient } from '../core/ApiClient';
import { IToast } from '../types/common';
import { Valid8VaultEntryWithSecrets, Valid8VaultListResponse } from '../types/valid8';

export function useValid8(enabled: boolean, onToast?: (toast: IToast) => void) {
  const [busy, setBusy] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [includeInactive, setIncludeInactive] = React.useState(false);
  const [entries, setEntries] = React.useState<Valid8VaultEntryWithSecrets[]>([]);

  const load = React.useCallback(async (nextIncludeInactive: boolean = includeInactive) => {
    setBusy(true);
    try {
      const includeInactiveValue = nextIncludeInactive ? 1 : 0;
      const res = await ApiClient.get<Valid8VaultListResponse>(`/api/valid8.php?action=list&include_inactive=${includeInactiveValue}`);
      setEntries(Array.isArray(res?.entries) ? res.entries : []);
      setLoaded(true);
    } catch (error: any) {
      const message = String(error?.message || 'Failed to load VALID8 entries');
      if (onToast) {
        onToast({ tone: 'error', message });
      }
    } finally {
      setBusy(false);
    }
  }, [includeInactive, onToast]);

  React.useEffect(() => {
    if (!enabled) {
      setLoaded(false);
      setEntries([]);
      return;
    }
    void load(includeInactive);
  }, [enabled, includeInactive, load]);

  return {
    busy,
    loaded,
    includeInactive,
    entries,
    setIncludeInactive,
    load,
  };
}
