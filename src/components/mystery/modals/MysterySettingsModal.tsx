import React from 'react';
import { IToast } from '../../../types/common';

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
  
  // Actions
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
  
  // Icons
  saveSvg: React.ReactNode;
  cogSvg: React.ReactNode;
  lockSvg: React.ReactNode;
  unlockSvg: React.ReactNode;
}

export function MysterySettingsModal({
  modalRef,
  busy,
  isAdmin,
  isMysterySettingsDirty,
  mysterySettingsObj,
  mysterySettingsUpdatedAt,
  mysterySettingsTab,
  setMysterySettingsTab,
  filteredTtsVoices,
  voiceMapRowIds,
  voiceIdToCharacters,
  accentDraftByVoiceId,
  setAccentDraftByVoiceId,
  newVoiceMapId,
  setNewVoiceMapId,
  voiceIdSuggestions,
  saveMysterySettingsObject,
  loadMysterySettings,
  onOpenAiVoiceConfig,
  loadAgentProfiles,
  addMissingVoiceIdsFromCharacters,
  autoAssignVoiceMapBestMatchAndSave,
  addVoiceMapEntry,
  deleteVoiceMapEntry,
  toggleVoiceMapLock,
  updateVoiceMapEntry,
  setAccentPreferenceForVoiceId,
  openMysterySettingsEditor,
  getActiveVoiceMap,
  describeVoiceTier,
  saveSvg,
  cogSvg,
  lockSvg,
  unlockSvg,
}: MysterySettingsModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl catn8-modal-wide">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Communications</div>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className={isMysterySettingsDirty ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary'}
                onClick={() => saveMysterySettingsObject(mysterySettingsObj)}
                disabled={busy || !isAdmin || !isMysterySettingsDirty}
                aria-label="Save"
                title={isMysterySettingsDirty ? 'Save changes' : 'No changes to save'}
              >
                {saveSvg}
                <span className="ms-1">Save</span>
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={onOpenAiVoiceConfig}
                  disabled={busy}
                  aria-label="AI Voice Configuration"
                  title="AI Voice Configuration"
                >
                  {cogSvg}
                  <span className="ms-1">Config</span>
                </button>
              )}
              <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body">
            {!isAdmin && (
              <div className="text-muted">Only admins can manage Mystery settings.</div>
            )}

            <datalist id="mystery-tts-voice-options">
              {filteredTtsVoices.map((v) => (
                <option key={String(v?.name || '')} value={String(v?.name || '')} />
              ))}
            </datalist>

            <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
              <div className="text-muted">Updated: {mysterySettingsUpdatedAt || '(unknown)'}</div>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={loadMysterySettings} disabled={busy || !isAdmin}>
                  Refresh
                </button>
              </div>
            </div>

            <ul className="nav nav-tabs mb-3" role="tablist">
              <li className="nav-item">
                <button
                  className={'nav-link' + (mysterySettingsTab === 'voice' ? ' active' : '')}
                  onClick={() => setMysterySettingsTab('voice')}
                >
                  Communications
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={'nav-link' + (mysterySettingsTab === 'advanced' ? ' active' : '')}
                  onClick={() => setMysterySettingsTab('advanced')}
                >
                  Advanced
                </button>
              </li>
            </ul>

            {mysterySettingsTab === 'voice' ? (
              <div className="row g-3">
                <div className="col-12">
                  <div className="catn8-card p-3">
                    <div className="d-flex justify-content-between align-items-center gap-2">
                      <div>
                        <div className="fw-bold">AI Model Sync</div>
                        <div className="form-text">Persist voice matches in the database.</div>
                      </div>
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={loadAgentProfiles} disabled={busy || !isAdmin}>
                        Refresh Profiles
                      </button>
                    </div>
                    <hr />
                    <div className="d-flex justify-content-between align-items-center gap-2">
                      <div className="fw-bold">Voice Map</div>
                      <div className="d-flex gap-2">
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addMissingVoiceIdsFromCharacters} disabled={busy || !isAdmin}>
                          Add Missing
                        </button>
                        <button type="button" className="btn btn-sm btn-primary" onClick={autoAssignVoiceMapBestMatchAndSave} disabled={busy || !isAdmin}>
                          Auto-Assign + Save
                        </button>
                      </div>
                    </div>
                    <div className="table-responsive mt-3">
                      <table className="table table-sm table-hover align-middle catn8-mystery-table">
                        <thead>
                          <tr>
                            <th>Key</th>
                            <th>Characters</th>
                            <th>Active Voice</th>
                            <th>Language</th>
                            <th>Rate</th>
                            <th>Pitch</th>
                            <th className="text-center">Lock</th>
                            <th className="text-end">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {voiceMapRowIds.map((vid) => {
                            const active = getActiveVoiceMap(mysterySettingsObj);
                            const entry = active.voice_map?.[vid] || {};
                            const chars = voiceIdToCharacters.get(vid) || [];
                            const locked = (active.voice_map_locks || []).includes(vid);

                            return (
                              <tr key={vid}>
                                <td className="fw-bold">{vid}</td>
                                <td className="small text-muted">{chars.join(', ')}</td>
                                <td>
                                  <input
                                    type="text"
                                    list="mystery-tts-voice-options"
                                    className="form-control form-control-sm"
                                    value={entry.voice_name || ''}
                                    onChange={(e) => updateVoiceMapEntry(vid, 'voice_name', e.target.value)}
                                    disabled={busy || !isAdmin}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    style={{ width: '70px' }}
                                    value={entry.language_code || ''}
                                    onChange={(e) => updateVoiceMapEntry(vid, 'language_code', e.target.value)}
                                    disabled={busy || !isAdmin}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="0.1"
                                    className="form-control form-control-sm"
                                    style={{ width: '60px' }}
                                    value={entry.speaking_rate ?? 1.0}
                                    onChange={(e) => updateVoiceMapEntry(vid, 'speaking_rate', parseFloat(e.target.value))}
                                    disabled={busy || !isAdmin}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="0.1"
                                    className="form-control form-control-sm"
                                    style={{ width: '60px' }}
                                    value={entry.pitch ?? 0.0}
                                    onChange={(e) => updateVoiceMapEntry(vid, 'pitch', parseFloat(e.target.value))}
                                    disabled={busy || !isAdmin}
                                  />
                                </td>
                                <td className="text-center">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-link p-0"
                                    onClick={() => toggleVoiceMapLock(vid)}
                                    disabled={busy || !isAdmin}
                                    title={locked ? 'Locked' : 'Unlocked'}
                                  >
                                    {locked ? lockSvg : unlockSvg}
                                  </button>
                                </td>
                                <td className="text-end">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => deleteVoiceMapEntry(vid)}
                                    disabled={busy || !isAdmin}
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {!voiceMapRowIds.length && (
                            <tr>
                              <td colSpan={8} className="text-center text-muted py-4">
                                No voice map entries found. Click "Add Missing" to start.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-3 pt-3 border-top">
                      <div className="row g-2 align-items-end">
                        <div className="col-md-6">
                          <label className="form-label small">Add Manual Entry</label>
                          <div className="input-group input-group-sm">
                            <input
                              type="text"
                              className="form-control"
                              placeholder="e.g. suspect_slug or voice_id"
                              value={newVoiceMapId}
                              onChange={(e) => setNewVoiceMapId(e.target.value)}
                              list="mystery-voice-id-suggestions"
                            />
                            <button
                              className="btn btn-outline-secondary"
                              type="button"
                              onClick={() => {
                                if (newVoiceMapId) {
                                  addVoiceMapEntry(newVoiceMapId);
                                  setNewVoiceMapId('');
                                }
                              }}
                              disabled={busy || !isAdmin || !newVoiceMapId}
                            >
                              Add
                            </button>
                          </div>
                          <datalist id="mystery-voice-id-suggestions">
                            {voiceIdSuggestions.map(id => <option key={id} value={id} />)}
                          </datalist>
                        </div>
                        <div className="col-md-6 text-end">
                          <div className="form-check form-check-inline">
                            <input 
                              className="form-check-input" 
                              type="radio" 
                              name="active-provider" 
                              id="provider-google" 
                              value="google"
                              checked={mysterySettingsObj?.tts?.voice_map_active !== 'live'}
                              onChange={() => updateVoiceMapEntry('active_provider', 'active', 'google')}
                              disabled={busy || !isAdmin}
                            />
                            <label className="form-check-label" htmlFor="provider-google">Google TTS</label>
                          </div>
                          <div className="form-check form-check-inline">
                            <input 
                              className="form-check-input" 
                              type="radio" 
                              name="active-provider" 
                              id="provider-live" 
                              value="live"
                              checked={mysterySettingsObj?.tts?.voice_map_active === 'live'}
                              onChange={() => updateVoiceMapEntry('active_provider', 'active', 'live')}
                              disabled={busy || !isAdmin}
                            />
                            <label className="form-check-label" htmlFor="provider-live">Gemini Live</label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="row g-3">
                <div className="col-12">
                  <div className="catn8-card p-3 h-100">
                    <div className="fw-bold">Advanced JSON</div>
                    <div className="row g-2 align-items-end mt-2">
                      <div className="col-md-8">
                        <button type="button" className="btn btn-outline-secondary w-100" onClick={openMysterySettingsEditor} disabled={busy || !isAdmin}>
                          Open Editor
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
