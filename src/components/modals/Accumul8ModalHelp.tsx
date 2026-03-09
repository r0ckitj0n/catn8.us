import React from 'react';
import { createPortal } from 'react-dom';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { StandardIconButton } from '../common/StandardIconButton';
import './Accumul8ModalHelp.css';

interface Accumul8ModalHelpProps {
  buttonLabel: string;
  buttonTitle?: string;
  modalTitle: string;
  parentOpen?: boolean;
  children: React.ReactNode;
}

export function Accumul8ModalHelp({
  buttonLabel,
  buttonTitle,
  modalTitle,
  parentOpen = true,
  children,
}: Accumul8ModalHelpProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(() => setOpen(false));
  const [open, setOpen] = React.useState(false);
  const [portalReady, setPortalReady] = React.useState(false);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [modalApiRef, open]);

  React.useEffect(() => {
    setPortalReady(typeof document !== 'undefined');
  }, []);

  React.useEffect(() => {
    if (!parentOpen) {
      setOpen(false);
    }
  }, [parentOpen]);

  const modalNode = (
    <div className="modal fade accumul8-modal-help-popup" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{modalTitle}</h5>
            <ModalCloseIconButton onClick={() => setOpen(false)} />
          </div>
          <div className="modal-body">
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <StandardIconButton
        iconKey="help"
        ariaLabel={buttonLabel}
        title={buttonTitle || buttonLabel}
        className="btn btn-outline-secondary btn-sm catn8-action-icon-btn"
        onClick={() => setOpen(true)}
      />
      {portalReady ? createPortal(modalNode, document.body) : null}
    </>
  );
}
