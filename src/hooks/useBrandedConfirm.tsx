import React from 'react';

export type BrandedConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
};

export type BrandedConfirmFn = (options: BrandedConfirmOptions) => Promise<boolean>;

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: 'danger' | 'primary';
  resolve: (confirmed: boolean) => void;
};

export function useBrandedConfirm() {
  const [confirmState, setConfirmState] = React.useState<ConfirmState | null>(null);

  const closeConfirm = React.useCallback((confirmed: boolean) => {
    setConfirmState((current) => {
      if (current) {
        current.resolve(confirmed);
      }
      return null;
    });
  }, []);

  const confirm: BrandedConfirmFn = React.useCallback(async (options: BrandedConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        title: String(options.title || 'Please Confirm'),
        message: String(options.message || ''),
        confirmLabel: String(options.confirmLabel || 'Confirm'),
        cancelLabel: String(options.cancelLabel || 'Cancel'),
        tone: options.tone === 'primary' ? 'primary' : 'danger',
        resolve,
      });
    });
  }, []);

  React.useEffect(() => {
    if (!confirmState) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeConfirm(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeConfirm, confirmState]);

  React.useEffect(() => {
    return () => {
      setConfirmState((current) => {
        if (current) {
          current.resolve(false);
        }
        return null;
      });
    };
  }, []);

  const confirmDialog = confirmState ? (
    <div className="catn8-confirm-overlay" onClick={() => closeConfirm(false)} role="dialog" aria-modal="true" aria-label={confirmState.title}>
      <div className="catn8-confirm-dialog card" onClick={(event) => event.stopPropagation()}>
        <div className="catn8-confirm-header">
          <h5>{confirmState.title}</h5>
          <button type="button" className="btn-close" aria-label="Close confirmation dialog" onClick={() => closeConfirm(false)} />
        </div>
        <p className="catn8-confirm-message">{confirmState.message}</p>
        <div className="catn8-confirm-actions">
          <button type="button" className="btn btn-outline-secondary" onClick={() => closeConfirm(false)}>
            {confirmState.cancelLabel}
          </button>
          <button type="button" className={confirmState.tone === 'primary' ? 'btn btn-primary' : 'btn btn-danger'} onClick={() => closeConfirm(true)}>
            {confirmState.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, confirmDialog };
}
