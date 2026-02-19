import React from 'react';
import { useMysteryModalsDimming } from './useMysteryModalsDimming';
import { useMysteryModalsCore } from './useMysteryModalsCore';

/**
 * useMysteryModals - Refactored Conductor Hook
 * COMPLIANCE: File size < 250 lines
 */
export function useMysteryModals(
  setError: (err: string) => void,
  cleanupModalArtifactsIfNoOpenModals: () => void
) {
  // 1. Dimming & Backdrop Logic
  const { syncStackedMysteryModalDimming } = useMysteryModalsDimming(cleanupModalArtifactsIfNoOpenModals);

  // 2. Core Transition & Show Logic
  const { showModalNow, transitionToModal } = useMysteryModalsCore(
    setError,
    cleanupModalArtifactsIfNoOpenModals,
    syncStackedMysteryModalDimming
  );

  // 3. Global Keyboard Listeners
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e?.key !== 'Escape') return;

      try {
        const Modal = (window as any).bootstrap?.Modal;
        if (Modal) {
          const openModals = Array.from(document.querySelectorAll('.modal.show'));
          const topModal = openModals[openModals.length - 1] as HTMLElement;
          if (topModal && (topModal.dataset.bsKeyboard === 'false' || topModal.getAttribute('data-bs-keyboard') === 'false')) {
            return;
          }

          openModals.forEach((el) => {
            const inst = Modal.getInstance(el);
            if (inst) inst.hide();
            else el.classList.remove('show');
          });
        }
      } catch (_err) {}

      cleanupModalArtifactsIfNoOpenModals();
      window.setTimeout(syncStackedMysteryModalDimming, 0);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cleanupModalArtifactsIfNoOpenModals, syncStackedMysteryModalDimming]);

  // 4. Conductor Composition
  const returnValue = React.useMemo(() => ({
    showModalNow,
    transitionToModal,
    syncStackedMysteryModalDimming,
    cleanupModalArtifactsIfNoOpenModals
  }), [showModalNow, transitionToModal, syncStackedMysteryModalDimming, cleanupModalArtifactsIfNoOpenModals]);

  return returnValue;
}
