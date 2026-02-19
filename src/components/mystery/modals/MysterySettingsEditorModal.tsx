import React from 'react';

interface MysterySettingsEditorModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  busy: boolean;
  isAdmin: boolean;
  isMysterySettingsEditorDirty: boolean;
  mysterySettingsEditorTarget: string;
  setMysterySettingsEditorTarget: (val: string) => void;
  mysterySettingsEditorText: string;
  setMysterySettingsEditorText: (val: string) => void;
  
  // Actions
  applyMysterySettingsEditor: (opts: { saveToServer: number }) => Promise<void>;
  
  // Icons
  saveSvg: React.ReactNode;
}

export function MysterySettingsEditorModal({
  modalRef,
  busy,
  isAdmin,
  isMysterySettingsEditorDirty,
  mysterySettingsEditorTarget,
  setMysterySettingsEditorTarget,
  mysterySettingsEditorText,
  setMysterySettingsEditorText,
  applyMysterySettingsEditor,
  saveSvg,
}: MysterySettingsEditorModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Mystery Settings JSON Editor</div>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className={isMysterySettingsEditorDirty ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary'}
                onClick={() => applyMysterySettingsEditor({ saveToServer: 1 })}
                disabled={busy || !isAdmin || !isMysterySettingsEditorDirty}
                aria-label="Save"
                title={isMysterySettingsEditorDirty ? 'Save changes' : 'No changes to save'}
              >
                {saveSvg}
                <span className="ms-1">Save</span>
              </button>
              <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body">
            <div className="row g-2 align-items-end">
              <div className="col-8">
                <label className="form-label" htmlFor="mystery-settings-editor-target-2">Target</label>
                <select
                  id="mystery-settings-editor-target-2"
                  className="form-select"
                  value={mysterySettingsEditorTarget}
                  onChange={(e) => setMysterySettingsEditorTarget(e.target.value)}
                  disabled={busy || !isAdmin}
                >
                  <option value="tts">settings.tts</option>
                  <option value="tts_voice_map">settings.tts.voice_map (active)</option>
                  <option value="tts_voice_map_google">settings.tts.voice_maps.google.voice_map</option>
                  <option value="tts_voice_map_live">settings.tts.voice_maps.live.voice_map</option>
                  <option value="full">Full settings</option>
                </select>
              </div>
              <div className="col-4 d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary w-100"
                  onClick={() => applyMysterySettingsEditor({ saveToServer: 0 })}
                  disabled={busy || !isAdmin}
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="mt-3">
              <label className="form-label" htmlFor="mystery-settings-editor-text">JSON</label>
              <textarea
                id="mystery-settings-editor-text"
                className="form-control"
                rows={12}
                value={mysterySettingsEditorText}
                onChange={(e) => setMysterySettingsEditorText(e.target.value)}
                disabled={busy || !isAdmin}
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
