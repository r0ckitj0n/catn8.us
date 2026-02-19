import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import { useGroupMemberships } from './hooks/useGroupMemberships';
import { GroupEditSection } from './sections/GroupEditSection';
import { GroupMemberSection } from './sections/GroupMemberSection';

interface GroupMembershipsModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
}

/**
 * GroupMembershipsModal - Refactored Component
 * COMPLIANCE: File size < 250 lines
 */
export function GroupMembershipsModal({ open, onClose, onToast }: GroupMembershipsModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const state = useGroupMemberships(open, onToast);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Group Access</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label" htmlFor="group-access-group">Select group</label>
              <select
                id="group-access-group"
                className="form-select"
                value={state.groupSlug}
                onChange={(e) => state.setGroupSlug(e.target.value)}
                disabled={state.busy}
              >
                <option value="">Select a group…</option>
                {state.groups.map((g: any) => (
                  <option key={'group-opt-' + String(g?.id || '')} value={String(g?.slug || '')}>
                    {String(g?.title || g?.slug || '')}
                  </option>
                ))}
              </select>
            </div>

            <GroupEditSection 
              busy={state.busy}
              groupSlug={state.groupSlug}
              editGroupSlug={state.editGroupSlug}
              setEditGroupSlug={state.setEditGroupSlug}
              editGroupTitle={state.editGroupTitle}
              setEditGroupTitle={state.setEditGroupTitle}
              updateGroup={state.updateGroup}
              deleteGroup={state.deleteGroup}
            />

            <GroupMemberSection 
              busy={state.busy}
              groupSlug={state.groupSlug}
              availableUsers={state.availableUsers}
              addUserId={state.addUserId}
              setAddUserId={state.setAddUserId}
              members={state.members}
              addMember={state.addMember}
              removeMember={state.removeMember}
              load={state.load}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
