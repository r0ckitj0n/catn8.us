import React from 'react';

import { useAccumul8 } from '../../../hooks/useAccumul8';
import { ACCUMUL8_OWNER_STORAGE_KEY } from './accumul8PageDefaults';

export function useAccumul8PageSessionData(viewer: any, onToast?: (toast: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void) {
  const isAuthed = Boolean(viewer?.id);
  const isAdministrator = Number(viewer?.is_admin || 0) === 1 || Number(viewer?.is_administrator || 0) === 1;
  const isAccumul8User = Number(viewer?.is_accumul8_user || 0) === 1;
  const canAccess = isAuthed && (isAdministrator || isAccumul8User);
  const [selectedOwnerUserId, setSelectedOwnerUserId] = React.useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const raw = window.localStorage.getItem(ACCUMUL8_OWNER_STORAGE_KEY);
    const parsed = Number(raw || 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  });
  const accumul8ActionUrl = React.useCallback((action: string) => {
    const params = new URLSearchParams({ action });
    if (selectedOwnerUserId > 0) params.set('owner_user_id', String(selectedOwnerUserId));
    return `/api/accumul8.php?${params.toString()}`;
  }, [selectedOwnerUserId]);
  const accumul8 = useAccumul8(onToast, selectedOwnerUserId > 0 ? selectedOwnerUserId : undefined);

  return React.useMemo(() => ({
    ACCUMUL8_OWNER_STORAGE_KEY,
    accumul8ActionUrl,
    canAccess,
    isAccumul8User,
    isAdministrator,
    isAuthed,
    selectedOwnerUserId,
    setSelectedOwnerUserId,
    ...accumul8,
  }), [
    accumul8,
    accumul8ActionUrl,
    canAccess,
    isAccumul8User,
    isAdministrator,
    isAuthed,
    selectedOwnerUserId,
  ]);
}
