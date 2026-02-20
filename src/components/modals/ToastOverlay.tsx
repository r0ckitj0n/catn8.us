import React from 'react';
import './ToastOverlay.css';
import { IToast } from '../../types/common';
import { StandardIconButton } from '../common/StandardIconButton';

interface ToastOverlayProps {
  toast: IToast | null;
  onClose: () => void;
}

export function ToastOverlay({ toast, onClose }: ToastOverlayProps) {
  React.useEffect(() => {
    if (!toast) return undefined;
    if (toast && (toast as any).persist) return undefined;
    const t = window.setTimeout(() => {
      if (typeof onClose === 'function') onClose();
    }, 30000);
    return () => window.clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;

  const rawTone = String(toast?.tone || '').trim();
  const tone = (rawTone === 'success' || rawTone === 'error' || rawTone === 'info')
    ? rawTone
    : 'error';
  const title = String(toast?.title || (
    tone === 'success'
      ? 'Success'
      : (tone === 'info'
        ? 'Info'
        : 'Error')
  ));
  const message = String(toast?.message || '');
  const extraClassName = String(toast?.className || '').trim();
  const extraOverlayClassName = String(toast?.overlayClassName || '').trim();

  return (
    <div
      className={'catn8-toast-overlay' + (extraOverlayClassName ? (' ' + extraOverlayClassName) : '')}
      role="presentation"
      onClick={() => {
        if (typeof onClose === 'function') onClose();
      }}
    >
      <div
        className={'catn8-toast catn8-toast-' + tone + (extraClassName ? (' ' + extraClassName) : '')}
        role="alert"
        aria-live="polite"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="catn8-toast-header">
          <div className="catn8-toast-title">{title}</div>
          <StandardIconButton
            iconKey="close"
            ariaLabel="Close"
            className="btn btn-outline-light btn-sm catn8-action-icon-btn catn8-toast-close"
            onClick={() => {
              if (typeof onClose === 'function') onClose();
            }}
          />
        </div>
        {message ? <div className="catn8-toast-body">{message}</div> : null}
      </div>
    </div>
  );
}
