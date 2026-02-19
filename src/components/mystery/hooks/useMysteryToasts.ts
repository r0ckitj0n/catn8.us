import React from 'react';
import { IToast } from '../../../types/common';

export function useMysteryToasts(onToast: (toast: IToast) => void) {
  const voiceToastDedupRef = React.useRef({ key: '', at: 0 });

  const showMysteryToast = React.useCallback((t: Partial<IToast>) => {
    if (typeof onToast !== 'function') return;
    const cls = String(t?.className || '').trim();
    const overlayCls = String(t?.overlayClassName || '').trim();
    onToast({
      tone: 'info', // Default tone
      message: '', // Default message
      ...(t as any),
      className: (cls ? (cls + ' ') : '') + 'catn8-toast-mystery',
      overlayClassName: (overlayCls ? (overlayCls + ' ') : '') + 'catn8-toast-overlay-mystery',
    });
  }, [onToast]);

  const showVoiceToast = React.useCallback((t: any) => {
    const title = String(t?.title || 'Voice');
    const msg = String(t?.message || '').trim();
    if (!msg) return;

    const key = title + '|' + msg;
    const now = Date.now();
    const last = voiceToastDedupRef.current || { key: '', at: 0 };
    if (last.key === key && (now - Number(last.at || 0)) < 5000) return;
    voiceToastDedupRef.current = { key, at: now };
    showMysteryToast({ tone: 'error', title, message: msg });
  }, [showMysteryToast]);

  const returnValue = React.useMemo(() => ({
    showMysteryToast,
    showVoiceToast
  }), [showMysteryToast, showVoiceToast]);

  return returnValue;
}
