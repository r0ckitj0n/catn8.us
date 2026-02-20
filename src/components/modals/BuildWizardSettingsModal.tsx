import React from 'react';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { DocumentSettingsModal } from './DocumentSettingsModal';
import { BuildWizardDropdownManagerModal } from './BuildWizardDropdownManagerModal';
import { IToast } from '../../types/common';

interface BuildWizardSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
}

export function BuildWizardSettingsModal({ open, onClose, onToast }: BuildWizardSettingsModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [documentSettingsOpen, setDocumentSettingsOpen] = React.useState(false);
  const [dropdownManagerOpen, setDropdownManagerOpen] = React.useState(false);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  return (
    <>
      <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Build Wizard</h5>
              <ModalCloseIconButton />
            </div>
            <div className="modal-body">
              <p className="text-muted mb-3">Manage Build Wizard-specific tools and configuration.</p>
              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setDropdownManagerOpen(true)}
                >
                  Dropdown Manager
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setDocumentSettingsOpen(true)}
                >
                  Document Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BuildWizardDropdownManagerModal
        open={dropdownManagerOpen}
        onClose={() => setDropdownManagerOpen(false)}
        onToast={onToast}
      />

      <DocumentSettingsModal
        open={documentSettingsOpen}
        onClose={() => setDocumentSettingsOpen(false)}
        onToast={onToast}
      />
    </>
  );
}
