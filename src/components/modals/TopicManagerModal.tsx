import React from 'react';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import { useTopicManager } from './hooks/useTopicManager';
import { TopicListSection } from './sections/TopicListSection';
import { TopicFormSection } from './sections/TopicFormSection';
import { useBrandedConfirm } from '../../hooks/useBrandedConfirm';

interface TopicManagerModalProps {
  open: boolean;
  onClose: () => void;
  viewer: any;
  onChanged: () => void;
  onToast?: (toast: IToast) => void;
}

/**
 * TopicManagerModal - Refactored Component
 * COMPLIANCE: File size < 250 lines
 */
export function TopicManagerModal({ open, onClose, viewer, onChanged, onToast }: TopicManagerModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const { confirm, confirmDialog } = useBrandedConfirm();
  const state = useTopicManager(open, onChanged, confirm, onToast);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Topics</h5>
            <ModalCloseIconButton />
          </div>
          <div className="modal-body">
            <div className="row g-3">
              <TopicListSection 
                topics={state.topics}
                activeId={state.activeId}
                busy={state.busy}
                loadTopic={state.loadTopic}
                loadList={state.loadList}
              />

              <TopicFormSection 
                mode={state.mode}
                form={state.form}
                setForm={state.setForm}
                busy={state.busy}
                activeId={state.activeId}
                setActiveId={state.setActiveId}
                setMode={state.setMode}
                remove={state.remove}
                save={state.save}
              />
            </div>
          </div>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
