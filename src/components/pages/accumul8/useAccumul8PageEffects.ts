import React from 'react';

interface ActiveRowEntry {
  key: string;
  hasDraft: boolean;
  clear: () => void;
}

interface UseAccumul8PageEffectsOptions {
  activeRows: ActiveRowEntry[];
  flashSaveButton: (key: string) => void;
  flashSaveButtonTimeoutRef: React.MutableRefObject<number | null>;
  inlineRowRefs: React.MutableRefObject<Record<string, HTMLTableRowElement | null>>;
  setSettingsMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSettingsMenuPosition: React.Dispatch<React.SetStateAction<{ top: number; left: number; width: number }>>;
  settingsButtonRef: React.RefObject<HTMLButtonElement | null>;
  settingsMenuOpen: boolean;
  settingsMenuRef: React.RefObject<HTMLDivElement | null>;
}

export function useAccumul8PageEffects({
  activeRows,
  flashSaveButton,
  flashSaveButtonTimeoutRef,
  inlineRowRefs,
  setSettingsMenuOpen,
  setSettingsMenuPosition,
  settingsButtonRef,
  settingsMenuOpen,
  settingsMenuRef,
}: UseAccumul8PageEffectsOptions) {
  React.useEffect(() => {
    return () => {
      if (flashSaveButtonTimeoutRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(flashSaveButtonTimeoutRef.current);
      }
    };
  }, [flashSaveButtonTimeoutRef]);

  React.useLayoutEffect(() => {
    if (!settingsMenuOpen || typeof window === 'undefined' || !settingsButtonRef.current) {
      return undefined;
    }
    const updateMenuPosition = () => {
      const buttonRect = settingsButtonRef.current?.getBoundingClientRect();
      if (!buttonRect) {
        return;
      }
      const menuWidth = Math.min(320, Math.max(220, Math.round(buttonRect.width + 48)));
      const viewportPadding = 12;
      const nextLeft = Math.min(
        Math.max(viewportPadding, buttonRect.left),
        Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding),
      );
      setSettingsMenuPosition({
        top: Math.round(buttonRect.bottom + 8),
        left: Math.round(nextLeft),
        width: menuWidth,
      });
    };
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [setSettingsMenuPosition, settingsButtonRef, settingsMenuOpen]);

  React.useEffect(() => {
    if (!settingsMenuOpen || typeof document === 'undefined') {
      return undefined;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (!settingsMenuRef.current?.contains(event.target as Node)) {
        setSettingsMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSettingsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [setSettingsMenuOpen, settingsMenuOpen, settingsMenuRef]);

  React.useEffect(() => {
    if (activeRows.length === 0 || typeof document === 'undefined') {
      return undefined;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      for (const row of activeRows) {
        const node = inlineRowRefs.current[row.key];
        if (!node || node.contains(target)) {
          continue;
        }
        if (row.hasDraft) {
          flashSaveButton(row.key);
        }
        row.clear();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [activeRows, flashSaveButton, inlineRowRefs]);
}
