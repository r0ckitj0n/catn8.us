import React from 'react';

import { VoiceSettingsTab } from './mystery-settings/VoiceSettingsTab';

interface MysterySettingsModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  busy: boolean;
  isAdmin: boolean;
  isMysterySettingsDirty: boolean;
  mysterySettingsObj: any;
  mysterySettingsUpdatedAt: string;
  mysterySettingsTab: string;
  setMysterySettingsTab: (val: string) => void;
  filteredTtsVoices: any[];
  voiceMapRowIds: string[];
  voiceIdToCharacters: Map<string, string[]>;
  accentDraftByVoiceId: Record<string, string>;
  setAccentDraftByVoiceId: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  newVoiceMapId: string;
  setNewVoiceMapId: (val: string) => void;
  voiceIdSuggestions: string[];
  saveMysterySettingsObject: (obj: any) => Promise<void>;
  loadMysterySettings: () => Promise<void>;
  onOpenAiVoiceConfig: () => void;
  loadAgentProfiles: () => Promise<void>;
  addMissingVoiceIdsFromCharacters: () => void;
  autoAssignVoiceMapBestMatchAndSave: () => Promise<void>;
  addVoiceMapEntry: (vid: string) => void;
  deleteVoiceMapEntry: (vid: string) => void;
  toggleVoiceMapLock: (vid: string) => void;
  updateVoiceMapEntry: (vid: string, field: string, val: any) => void;
  setAccentPreferenceForVoiceId: (vid: string, val: string) => void;
  openMysterySettingsEditor: () => void;
  getActiveVoiceMap: (settings: any) => any;
  describeVoiceTier: (name: string) => string;
  saveSvg: React.ReactNode;
  cogSvg: React.ReactNode;
  lockSvg: React.ReactNode;
  unlockSvg: React.ReactNode;
}

export function MysterySettingsModal(props: MysterySettingsModalProps) {
  const { modalRef, busy, isAdmin, isMysterySettingsDirty, mysterySettingsObj, mysterySettingsUpdatedAt, mysterySettingsTab, setMysterySettingsTab, saveMysterySettingsObject, onOpenAiVoiceConfig, loadMysterySettings, openMysterySettingsEditor, saveSvg, cogSvg } = props;

  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl catn8-modal-wide">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Communications</div>
            <div className="d-flex align-items-center gap-2">
              <button type="button" className={isMysterySettingsDirty ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary'} onClick={() => saveMysterySettingsObject(mysterySettingsObj)} disabled={busy || !isAdmin || !isMysterySettingsDirty}>{saveSvg}<span className="ms-1">Save</span></button>
              {isAdmin ? <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onOpenAiVoiceConfig} disabled={busy}>{cogSvg}<span className="ms-1">Config</span></button> : null}
              <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body">
            {!isAdmin ? <div className="text-muted">Only admins can manage Mystery settings.</div> : null}
            <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
              <div className="text-muted">Updated: {mysterySettingsUpdatedAt || '(unknown)'}</div>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={loadMysterySettings} disabled={busy || !isAdmin}>Refresh</button>
            </div>
            <ul className="nav nav-tabs mb-3" role="tablist">
              <li className="nav-item"><button className={`nav-link${mysterySettingsTab === 'voice' ? ' active' : ''}`} onClick={() => setMysterySettingsTab('voice')}>Communications</button></li>
              <li className="nav-item"><button className={`nav-link${mysterySettingsTab === 'advanced' ? ' active' : ''}`} onClick={() => setMysterySettingsTab('advanced')}>Advanced</button></li>
            </ul>
            {mysterySettingsTab === 'voice' ? (
              <VoiceSettingsTab {...props} />
            ) : (
              <div className="row g-3"><div className="col-12"><div className="catn8-card p-3 h-100"><div className="fw-bold">Advanced JSON</div><div className="row g-2 align-items-end mt-2"><div className="col-md-8"><button type="button" className="btn btn-outline-secondary w-100" onClick={openMysterySettingsEditor} disabled={busy || !isAdmin}>Open Editor</button></div></div></div></div></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
