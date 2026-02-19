import React from 'react';
import { MysteryPickerAdminSection } from './sections/MysteryPickerAdminSection';

interface MysteryPickerModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  busy: boolean;
  isAdmin: boolean;
  mysteryPickerList: any[];
  mysteryPickerSelectedId: string;
  setMysteryPickerSelectedId: (val: string) => void;
  mysteryPickerAdminOpen: boolean;
  setMysteryPickerAdminOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mysteryAdminCreateTitle: string;
  setMysteryAdminCreateTitle: (val: string) => void;
  mysteryAdminCreateSlug: string;
  setMysteryAdminCreateSlug: (val: string) => void;
  mysteryAdminEditTitle: string;
  setMysteryAdminEditTitle: (val: string) => void;
  mysteryAdminEditSlug: string;
  setMysteryAdminEditSlug: (val: string) => void;
  mysteryAdminEditArchived: boolean;
  setMysteryAdminEditArchived: (val: boolean) => void;
  mysteryAdminDeleteArmed: boolean;
  setMysteryAdminDeleteArmed: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Actions
  importDefaultMystery: () => Promise<void>;
  createMysteryFromPicker: () => Promise<void>;
  refreshMysteryPickerList: () => Promise<void>;
  saveMysteryFromPicker: () => Promise<void>;
  deleteMysteryFromPicker: () => Promise<void>;
  confirmMysterySelection: (id?: string) => void;
  isPersistent?: boolean;
}

/**
 * MysteryPickerModal - Refactored Component
 * COMPLIANCE: File size < 250 lines
 */
export function MysteryPickerModal(props: MysteryPickerModalProps) {
  return (
    <div 
      className="modal fade catn8-mystery-modal catn8-stacked-modal" 
      tabIndex={-1} 
      aria-hidden="true" 
      ref={props.modalRef}
      data-bs-backdrop={props.isPersistent ? 'static' : 'true'}
      data-bs-keyboard={props.isPersistent ? 'false' : 'true'}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Choose Mystery</div>
            {!props.isPersistent && (
              <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
            )}
          </div>
          <div className="modal-body">
            <div className="catn8-mystery-picker-list d-flex flex-column gap-3">
              {props.mysteryPickerList.length === 0 && !props.busy && (
                <div className="catn8-card p-4 text-center">
                  <div className="h5 text-muted mb-3">No mystery worlds found.</div>
                  {props.isAdmin ? (
                    <div className="text-light opacity-75 mb-0">
                      Use the <strong>Admin — Manage Mysteries</strong> section below to create your first mystery world or import the defaults.
                    </div>
                  ) : (
                    <div className="text-light opacity-75 mb-0">
                      Please contact an administrator to set up a mystery world.
                    </div>
                  )}
                </div>
              )}
                  {props.mysteryPickerList.map((m: any) => (
                <button
                  key={'mystery-picker-item-' + String(m?.id || '')}
                  type="button"
                  className={`btn btn-lg text-start p-4 border-2 transition-all ${
                    props.mysteryPickerSelectedId === String(m?.id || '')
                      ? 'btn-outline-gold active'
                      : 'btn-outline-secondary'
                  }`}
                  onClick={() => {
                    const mid = String(m?.id || '');
                    props.setMysteryPickerSelectedId(mid);
                    // Click and Go: For everyone, confirm immediately
                    props.confirmMysterySelection(mid);
                  }}
                  disabled={props.busy}
                  style={{
                    backgroundColor: props.mysteryPickerSelectedId === String(m?.id || '') ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                    borderColor: props.mysteryPickerSelectedId === String(m?.id || '') ? 'var(--catn8-color-noir-gold)' : 'rgba(255,255,255,0.1)'
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="h4 mb-1 text-gold">{String(m?.title || ('Mystery #' + String(m?.id || '')))}</div>
                    {props.mysteryPickerSelectedId === String(m?.id || '') && (
                      <i className="bi bi-check-circle-fill text-gold h4 mb-0"></i>
                    )}
                  </div>
                  <div className="small text-muted text-uppercase mb-2" style={{ letterSpacing: '0.1rem' }}>
                    {m?.slug || 'CLASSIC CASE'}
                  </div>
                  {m?.description && (
                    <div className="text-light opacity-75">{m.description}</div>
                  )}
                  {!m?.description && (
                    <div className="text-muted italic small">A deep, dark mystery waiting to be solved...</div>
                  )}
                </button>
              ))}
            </div>

            {props.isAdmin && (
              <MysteryPickerAdminSection {...props} />
            )}
          </div>
          <div className="modal-footer d-none">
            <button 
              type="button" 
              className="btn btn-primary" 
              data-bs-dismiss="modal" 
              onClick={() => props.confirmMysterySelection()} 
              disabled={props.busy || !props.mysteryPickerSelectedId}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
