import React, { useRef } from 'react';
import { createBootstrapModal, isBootstrapModalReady, IBootstrapModal } from '../core/bootstrapModal';

export function useBootstrapModal(onClose?: () => void) {
  const modalRef = useRef<HTMLDivElement>(null);
  const modalApiRef = useRef<IBootstrapModal | null>(null);
  const [bootstrapTick, setBootstrapTick] = React.useState(0);

  React.useEffect(() => {
    const el = modalRef.current;
    if (!el) return;

    if (!isBootstrapModalReady()) {
      const t = window.setTimeout(() => setBootstrapTick((v) => v + 1), 50);
      return () => window.clearTimeout(t);
    }

    const modal = modalApiRef.current || createBootstrapModal(el);
    modalApiRef.current = modal;

    const onHidden = () => {
      if (typeof onClose === 'function') onClose();
    };
    el.addEventListener('hidden.bs.modal', onHidden);
    return () => {
      el.removeEventListener('hidden.bs.modal', onHidden);
    };
  }, [onClose, bootstrapTick]);

  return { modalRef, modalApiRef };
}
