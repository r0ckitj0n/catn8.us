import React from 'react';

export function useModalBackdropCleanup(): void {
  React.useEffect(() => {
    const clearOrphanedBackdrops = () => {
      const openModals = document.querySelectorAll('.modal.show, .modal.showing');
      if (openModals.length > 0) {
        return;
      }

      const backdrops = Array.from(document.querySelectorAll('.modal-backdrop'));
      if (backdrops.length === 0) {
        return;
      }

      backdrops.forEach((el) => el.remove());
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-right');
    };

    clearOrphanedBackdrops();

    const onBackdropClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.classList) {
        return;
      }

      const isBackdrop = target.classList.contains('modal-backdrop');
      const modalTarget = target.closest('.modal') as HTMLElement | null;
      const clickedInsideDialog = Boolean(target.closest('.modal-dialog'));
      const isModalOverlayClick = Boolean(
        !isBackdrop
        && modalTarget
        && (modalTarget.classList.contains('show') || modalTarget.classList.contains('showing'))
        && !clickedInsideDialog,
      );

      if (!isBackdrop && !isModalOverlayClick) {
        return;
      }

      const openModals = Array.from(document.querySelectorAll('.modal.show, .modal.showing')) as HTMLElement[];
      if (!openModals.length) {
        if (isBackdrop) {
          target.remove();
          document.body.classList.remove('modal-open');
          document.body.style.removeProperty('overflow');
          document.body.style.removeProperty('padding-right');
        }
        return;
      }

      const topModal = openModals
        .slice()
        .sort((a, b) => Number(getComputedStyle(a).zIndex || 0) - Number(getComputedStyle(b).zIndex || 0))
        .pop();

      if (!topModal) {
        return;
      }

      const modalClass = (window as any).bootstrap?.Modal;
      const instance = modalClass?.getInstance(topModal);
      if (instance && typeof instance.hide === 'function') {
        instance.hide();
        return;
      }

      topModal.classList.remove('show');
    };

    const observer = new MutationObserver(() => clearOrphanedBackdrops());
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('click', onBackdropClickCapture, true);
    return () => {
      observer.disconnect();
      document.removeEventListener('click', onBackdropClickCapture, true);
    };
  }, []);
}
