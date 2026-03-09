import React, { useRef } from 'react';
import { createBootstrapModal, isBootstrapModalReady, IBootstrapModal } from '../core/bootstrapModal';
import { captureScrollBeforeModalOpen, restoreScrollAfterModalClose } from '../utils/modalUtils';

interface UseBootstrapModalOptions {
  centerDialog?: boolean;
}

export function useBootstrapModal(onClose?: () => void, options?: UseBootstrapModalOptions) {
  const modalRef = useRef<HTMLDivElement>(null);
  const modalApiRef = useRef<IBootstrapModal | null>(null);
  const [bootstrapTick, setBootstrapTick] = React.useState(0);
  const centerDialog = options?.centerDialog ?? true;

  React.useEffect(() => {
    const el = modalRef.current;
    if (!el) return;

    const dialog = el.querySelector<HTMLElement>('.modal-dialog');
    if (dialog) {
      dialog.classList.toggle('modal-dialog-centered', centerDialog);
    }

    if (!isBootstrapModalReady()) {
      const t = window.setTimeout(() => setBootstrapTick((v) => v + 1), 50);
      return () => window.clearTimeout(t);
    }

    const modal = modalApiRef.current || createBootstrapModal(el);
    modalApiRef.current = modal;

    const onHidden = () => {
      restoreScrollAfterModalClose();
      if (typeof onClose === 'function') onClose();
    };
    const onShow = () => {
      captureScrollBeforeModalOpen();
    };
    el.addEventListener('show.bs.modal', onShow);
    el.addEventListener('hidden.bs.modal', onHidden);
    return () => {
      el.removeEventListener('show.bs.modal', onShow);
      el.removeEventListener('hidden.bs.modal', onHidden);
    };
  }, [centerDialog, onClose, bootstrapTick]);

  return { modalRef, modalApiRef };
}
