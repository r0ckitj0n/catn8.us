import React from 'react';
import { isBootstrapModalReady, createBootstrapModal, IBootstrapModal } from '../../../core/bootstrapModal';

export function useMysteryModalsCore(
  setError: (err: string) => void,
  cleanupModalArtifactsIfNoOpenModals: () => void,
  syncStackedMysteryModalDimming: () => void
) {
  const modalOpenSeqRef = React.useRef(0);

  const showModalNow = React.useCallback((
    ref: React.RefObject<HTMLElement>,
    apiRef: React.MutableRefObject<IBootstrapModal | null>,
    setOpen?: (open: boolean) => void
  ) => {
    const el = ref?.current;
    if (!el) return;
    if (!isBootstrapModalReady()) {
      setError('Bootstrap modal is not ready.');
      return;
    }
    const Modal = window.bootstrap?.Modal;
    if (!Modal) {
      setError('Bootstrap JS is not loaded (window.bootstrap.Modal missing).');
      return;
    }

    if (setOpen) setOpen(true);

    try {
      modalOpenSeqRef.current += 1;
      el.dataset.catn8OpenSeq = String(modalOpenSeqRef.current);
    } catch (_err) {}

    const wantsNoBackdrop = Boolean(el?.classList && el.classList.contains('catn8-stacked-modal'));
    const instance = apiRef.current || createBootstrapModal(el, wantsNoBackdrop ? { backdrop: false } : {});
    apiRef.current = instance;

    const onHidden = () => {
      el.removeEventListener('hidden.bs.modal', onHidden);
      if (setOpen) setOpen(false);
      cleanupModalArtifactsIfNoOpenModals();
      window.setTimeout(syncStackedMysteryModalDimming, 50);
    };
    
    el.removeEventListener('hidden.bs.modal', onHidden);
    el.addEventListener('hidden.bs.modal', onHidden);

    try {
      instance.show();
    } catch (_err) {}
    
    window.setTimeout(syncStackedMysteryModalDimming, 0);
    window.setTimeout(syncStackedMysteryModalDimming, 80);
    window.setTimeout(syncStackedMysteryModalDimming, 250);
  }, [setError, cleanupModalArtifactsIfNoOpenModals, syncStackedMysteryModalDimming]);

  const transitionToModal = React.useCallback((
    fromRef: React.RefObject<HTMLElement>,
    toRef: React.RefObject<HTMLElement>,
    toApiRef: React.MutableRefObject<IBootstrapModal | null>,
    setToOpen: (open: boolean) => void
  ) => {
    const toEl = toRef?.current;
    if (!toEl) return;

    if (!isBootstrapModalReady()) {
      setError('Bootstrap modal is not ready.');
      return;
    }

    const fromEl = fromRef?.current;
    if (!fromEl) {
      setToOpen(true);
      showModalNow(toRef, toApiRef, setToOpen);
      return;
    }

    const showTarget = () => {
      setToOpen(true);
      showModalNow(toRef, toApiRef, setToOpen);
    };

    if (fromEl === toEl) {
      showTarget();
      return;
    }

    if (!fromEl.classList || (!fromEl.classList.contains('show') && !fromEl.classList.contains('showing'))) {
      showTarget();
      return;
    }

    let fallbackTimer = window.setTimeout(() => {
      showTarget();
    }, 800);

    const onHidden = () => {
      fromEl.removeEventListener('hidden.bs.modal', onHidden);
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      window.setTimeout(showTarget, 0);
    };

    fromEl.addEventListener('hidden.bs.modal', onHidden);

    const el = document.activeElement as HTMLElement | null;
    if (el && typeof el.blur === 'function') el.blur();

    const Modal = window.bootstrap?.Modal;
    const inst = Modal?.getInstance(fromEl);
    if (inst) {
      try {
        inst.hide();
      } catch (_err) {
        onHidden();
      }
    } else {
      fromEl.classList.remove('show');
      onHidden();
    }
  }, [setError, showModalNow]);

  return { showModalNow, transitionToModal };
}
