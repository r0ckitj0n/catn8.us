import React from 'react';

import { WebpImage } from '../../common/WebpImage';

interface MasterAssetDetailsModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  busy: boolean;
  isAdmin: boolean;
  masterAssetDetailsItem: any;
  masterAssetDetailsType: string;
  masterAssetDetailsName: string;
  setMasterAssetDetailsName: (val: string) => void;
  masterAssetDetailsSlug: string;
  setMasterAssetDetailsSlug: (val: string) => void;
  masterAssetDetailsFields: any;
  setMasterAssetDetailsFields: React.Dispatch<React.SetStateAction<any>>;
  masterAssetDetailsRapport: any;
  setMasterAssetDetailsRapport: React.Dispatch<React.SetStateAction<any>>;
  masterAssetDetailsFavorites: any;
  setMasterAssetDetailsFavorites: React.Dispatch<React.SetStateAction<any>>;
  voiceProfiles: any[];
  isMasterAssetDetailsDirty: boolean;
  
  // Character Images
  masterCharacterImageUrl: string;
  masterCharacterMugshotUrl: string;
  masterCharacterIrUrls: string[];
  masterCharacterIrIndex: number;
  setMasterCharacterIrIndex: React.Dispatch<React.SetStateAction<number>>;
  masterCharacterIrEmotions: string[];
  masterCharacterIrEmotionEnabled: Record<string, boolean>;
  setMasterCharacterIrEmotionEnabled: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  masterCharacterMissingRequiredImageFields: string[];

  // Deposition
  loadMasterCharacterDeposition: () => Promise<void>;
  masterCharacterDepositionText: string;
  masterCharacterDepositionUpdatedAt: string;
  masterCharacterDepositionError: string;
  masterCharacterDepositionBusy: boolean;
  scenarioId: string | number;
  caseId: string | number;
  masterCharacterScenarioEntityId: number | null;
  enqueueSpecificJob: (params: { action: string, spec: any, requireScenario: boolean, entityId?: any }) => Promise<void>;
  openJsonPreview: (opts: { title: string; payload: any }) => void;

  // Actions
  saveMasterAssetDetails: () => Promise<void>;
  generateMasterAssetContent: () => Promise<void>;
  clearMasterAssetFields: () => void;
  openMasterAssetDerivedJson: () => void;
  updateMasterAssetDetailsDataObject: (updater: any) => void;
  toggleMasterAssetFieldLock: (field: string) => void;
  isMasterAssetFieldLocked: (field: string) => boolean;
  onOpenAiImageConfig: () => void;
  uploadMasterCharacterImage: (opts: { kind: 'character' | 'mugshot' | 'ir', file: File }) => Promise<void>;
  deleteMasterCharacterImage: (opts: { kind: 'character' | 'mugshot' | 'ir', url?: string }) => Promise<void>;
  openMasterCharacterImagePrompt: (opts: { kind: 'character' | 'mugshot' | 'ir' }) => Promise<void>;
  generateMasterCharacterImages: (opts: { kind: 'character' | 'mugshot' | 'ir' }) => Promise<void>;
  generateAllMissingMasterCharacterImages: () => Promise<void>;
  uploadMasterAssetImage: (opts: { file: File }) => Promise<void>;
  generateMasterAssetPrimaryImage: () => Promise<void>;
  deleteMasterAssetPrimaryImage: () => Promise<void>;
  archiveMasterAsset: (opts: { type: string; id: string | number; is_archived: number }) => Promise<void>;
  resetMasterAssetDetails: () => void;
  getMasterAssetDataObject: () => any;
  masterAssetDetailsDataText: string;

  // Icons/SVGs
  saveSvg: React.ReactNode;
  cogSvg: React.ReactNode;
  lockSvg: React.ReactNode;
  unlockSvg: React.ReactNode;
  trashSvg: React.ReactNode;
  pencilSvg: React.ReactNode;
}

export function MasterAssetDetailsModal({
  modalRef,
  busy,
  isAdmin,
  masterAssetDetailsItem,
  masterAssetDetailsType,
  masterAssetDetailsName,
  setMasterAssetDetailsName,
  masterAssetDetailsFields,
  setMasterAssetDetailsFields,
  masterAssetDetailsRapport,
  setMasterAssetDetailsRapport,
  masterAssetDetailsFavorites,
  setMasterAssetDetailsFavorites,
  voiceProfiles,
  isMasterAssetDetailsDirty,
  masterCharacterImageUrl,
  masterCharacterMugshotUrl,
  masterCharacterIrUrls,
  masterCharacterIrIndex,
  setMasterCharacterIrIndex,
  masterCharacterIrEmotions,
  masterCharacterIrEmotionEnabled,
  setMasterCharacterIrEmotionEnabled,
  masterCharacterMissingRequiredImageFields,
  loadMasterCharacterDeposition,
  masterCharacterDepositionText,
  masterCharacterDepositionUpdatedAt,
  masterCharacterDepositionError,
  masterCharacterDepositionBusy,
  scenarioId,
  caseId,
  masterCharacterScenarioEntityId,
  enqueueSpecificJob,
  openJsonPreview,
  saveMasterAssetDetails,
  generateMasterAssetContent,
  clearMasterAssetFields,
  openMasterAssetDerivedJson,
  updateMasterAssetDetailsDataObject,
  toggleMasterAssetFieldLock,
  isMasterAssetFieldLocked,
  onOpenAiImageConfig,
  uploadMasterCharacterImage,
  deleteMasterCharacterImage,
  openMasterCharacterImagePrompt,
  generateMasterCharacterImages,
  generateAllMissingMasterCharacterImages,
  uploadMasterAssetImage,
  generateMasterAssetPrimaryImage,
  deleteMasterAssetPrimaryImage,
  archiveMasterAsset,
  resetMasterAssetDetails,
  getMasterAssetDataObject,
  masterAssetDetailsDataText,
  saveSvg,
  cogSvg,
  lockSvg,
  unlockSvg,
}: MasterAssetDetailsModalProps) {
  const isCharacter = masterAssetDetailsType === 'character';
  const isLocation = masterAssetDetailsType === 'location';
  const isWeapon = masterAssetDetailsType === 'weapon';

  const getFav = (key: string) => masterAssetDetailsFavorites?.[key] || '';
  const setFav = (key: string, val: string) => {
    setMasterAssetDetailsFavorites((prev: any) => ({ ...prev, [key]: val }));
  };

  const getRap = (key: string) => masterAssetDetailsRapport?.[key] || [];
  const setRap = (key: string, val: string[]) => {
    setMasterAssetDetailsRapport((prev: any) => ({ ...prev, [key]: val }));
  };

  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Asset Details</div>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className={isMasterAssetDetailsDirty ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary'}
                onClick={saveMasterAssetDetails}
                disabled={busy || !isAdmin || !isMasterAssetDetailsDirty}
                title={isMasterAssetDetailsDirty ? 'Save changes' : 'No changes to save'}
              >
                {saveSvg}
                <span className="ms-1">Save</span>
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={onOpenAiImageConfig}
                  disabled={busy}
                  title="AI Image Configuration"
                >
                  {cogSvg}
                  <span className="ms-1">Config</span>
                </button>
              )}
              <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body">
            {!masterAssetDetailsItem ? (
              <div className="text-muted">Select an asset first.</div>
            ) : (
              <div className="row g-3">
                {/* Column 1: Basics & Profile */}
                <div className="col-12 col-xl-4">
                  <div className="catn8-card p-3 h-100">
                    <div className="d-flex justify-content-between align-items-center gap-2">
                      <div>
                        <div className="fw-bold">Basics</div>
                        <div className="form-text">Type: {masterAssetDetailsType}</div>
                      </div>
                    <div className="d-flex gap-2">
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={clearMasterAssetFields}
                            disabled={busy || Boolean(masterAssetDetailsItem?.is_regen_locked)}
                            title="Clear fields"
                          >
                            Clear Fields
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={openMasterAssetDerivedJson}
                            disabled={busy}
                            title="View content prompt"
                          >
                            View Content Prompt
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={generateMasterAssetContent}
                            disabled={busy || Boolean(masterAssetDetailsItem?.is_regen_locked)}
                            title="Generate content"
                          >
                            Generate Content
                          </button>
                        </>
                      )}
                    </div>
                    </div>

                    <div className="mt-3">
                      <label className="form-label" htmlFor="details-name">Name</label>
                      <div className="input-group">
                        <button
                          type="button"
                          className={isMasterAssetFieldLocked('name') ? 'btn btn-outline-warning' : 'btn btn-outline-secondary'}
                          onClick={() => toggleMasterAssetFieldLock('name')}
                          disabled={busy || !isAdmin}
                        >
                          {isMasterAssetFieldLocked('name') ? lockSvg : unlockSvg}
                        </button>
                        <input
                          id="details-name"
                          className="form-control"
                          value={masterAssetDetailsName}
                          onChange={(e) => setMasterAssetDetailsName(e.target.value)}
                          disabled={busy || !isAdmin || isMasterAssetFieldLocked('name')}
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="fw-bold">Profile</div>
                      <div className="form-text mb-2">Database curated fields.</div>
                      
                      {isCharacter && (
                        <div className="row g-2">
                          <div className="col-12">
                            <label className="form-label">Voice Profile</label>
                            <select
                              className="form-select"
                              value={masterAssetDetailsFields.voice_profile_id || '0'}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, voice_profile_id: e.target.value }))}
                              disabled={busy || !isAdmin}
                            >
                              <option value="0">(None)</option>
                              {voiceProfiles.map((vp) => (
                                <option key={vp.id} value={vp.id}>{vp.display_name || vp.voice_id}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-6">
                            <label className="form-label">DOB</label>
                            <input
                              type="date"
                              className="form-control"
                              value={masterAssetDetailsFields.dob || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, dob: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-6">
                            <label className="form-label">Age</label>
                            <input
                              type="number"
                              className="form-control"
                              value={masterAssetDetailsFields.age || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, age: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Hometown</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.hometown || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, hometown: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Address</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.address || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, address: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Ethnicity</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.ethnicity || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, ethnicity: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-6">
                            <label className="form-label">Zodiac</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.zodiac || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, zodiac: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-6">
                            <label className="form-label">MBTI</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.mbti || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, mbti: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-6">
                            <label className="form-label">Height</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.height || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, height: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-6">
                            <label className="form-label">Weight</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.weight || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, weight: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Eye Color</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.eye_color || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, eye_color: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Hair Color</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.hair_color || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, hair_color: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Aliases (one per line)</label>
                            <textarea
                              className="form-control"
                              rows={2}
                              value={(masterAssetDetailsFields.aliases || []).join('\n')}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, aliases: e.target.value.split('\n').filter(Boolean) }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Employment (one per line)</label>
                            <textarea
                              className="form-control"
                              rows={2}
                              value={(masterAssetDetailsFields.employment || []).join('\n')}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, employment: e.target.value.split('\n').filter(Boolean) }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Marks</label>
                            <textarea
                              className="form-control"
                              rows={2}
                              value={masterAssetDetailsFields.distinguishing_marks || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, distinguishing_marks: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Education</label>
                            <textarea
                              className="form-control"
                              rows={2}
                              value={masterAssetDetailsFields.education || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, education: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Fav Color</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.fav_color || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, fav_color: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Fav Snack</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.fav_snack || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, fav_snack: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Fav Drink</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.fav_drink || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, fav_drink: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Fav Music</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.fav_music || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, fav_music: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Fav Hobby</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.fav_hobby || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, fav_hobby: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Fav Pet</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.fav_pet || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, fav_pet: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                        </div>
                      )}

                      {isLocation && (
                        <div className="row g-2">
                          <div className="col-12">
                            <label className="form-label">Location ID</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.location_id || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, location_id: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Address Line 1</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.address_line1 || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, address_line1: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Address Line 2</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.address_line2 || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, address_line2: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">City</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.city || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, city: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-6">
                            <label className="form-label">Region/State</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.region || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, region: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-6">
                            <label className="form-label">Postal Code</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.postal_code || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, postal_code: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Country</label>
                            <input
                              className="form-control"
                              value={masterAssetDetailsFields.country || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, country: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                          <div className="col-12 mt-3">
                            <div className="fw-bold small">AI Generation Prompts</div>
                            <label className="form-label smallest text-muted mt-1">Base Image Prompt</label>
                            <textarea
                              className="form-control form-control-sm"
                              rows={2}
                              value={masterAssetDetailsFields.base_image_prompt || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, base_image_prompt: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                            <label className="form-label smallest text-muted mt-2">Overlay Asset Prompt</label>
                            <textarea
                              className="form-control form-control-sm"
                              rows={2}
                              value={masterAssetDetailsFields.overlay_asset_prompt || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, overlay_asset_prompt: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                            <label className="form-label smallest text-muted mt-2">Overlay Trigger</label>
                            <input
                              className="form-control form-control-sm"
                              value={masterAssetDetailsFields.overlay_trigger || ''}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, overlay_trigger: e.target.value }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                        </div>
                      )}

                      {isWeapon && (
                        <div className="row g-2">
                          <div className="col-12">
                            <label className="form-label">Fingerprints (one per line)</label>
                            <textarea
                              className="form-control"
                              rows={3}
                              value={(masterAssetDetailsFields.fingerprints || []).join('\n')}
                              onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, fingerprints: e.target.value.split('\n').filter(Boolean) }))}
                              disabled={busy || !isAdmin}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Column 2: Images & Descriptions */}
                <div className="col-12 col-xl-4">
                  <div className="catn8-card p-3 h-100">
                    {isCharacter ? (
                      <>
                        <div className="d-flex align-items-center justify-content-between gap-2">
                          <div className="fw-bold">Character Images</div>
                          {isAdmin && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={generateAllMissingMasterCharacterImages}
                              disabled={busy}
                            >
                              Generate All Missing
                            </button>
                          )}
                        </div>

                        <div className="mt-3">
                          <div className="fw-bold">Main Image</div>
                          {masterCharacterImageUrl ? (
                            <WebpImage className="img-fluid rounded mt-2" src={masterCharacterImageUrl} alt="Character" />
                          ) : (
                            <div className="form-text mt-2">No image found.</div>
                          )}
                          <div className="mt-2 d-flex gap-2">
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => openMasterCharacterImagePrompt({ kind: 'character' })}>View Prompt</button>
                            {isAdmin && (
                              <>
                                <button
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => generateMasterCharacterImages({ kind: 'character' })}
                                  disabled={busy || masterCharacterMissingRequiredImageFields.length > 0}
                                  title={masterCharacterMissingRequiredImageFields.length ? `Missing: ${masterCharacterMissingRequiredImageFields.join(', ')}` : ''}
                                >
                                  Generate
                                </button>
                                <button className="btn btn-sm btn-outline-danger" onClick={() => deleteMasterCharacterImage({ kind: 'character' })}>Delete</button>
                              </>
                            )}
                          </div>
                          {isAdmin && (
                            <input
                              type="file"
                              className="form-control form-control-sm mt-2"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) uploadMasterCharacterImage({ kind: 'character', file: f });
                              }}
                            />
                          )}
                        </div>

                        <hr className="my-3" />

                        <div className="mt-3">
                          <div className="fw-bold">Mugshot</div>
                          {masterCharacterMugshotUrl ? (
                            <WebpImage className="img-fluid rounded mt-2" src={masterCharacterMugshotUrl} alt="Mugshot" />
                          ) : (
                            <div className="form-text mt-2">No mugshot found.</div>
                          )}
                          <div className="mt-2 d-flex gap-2">
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => openMasterCharacterImagePrompt({ kind: 'mugshot' })}>View Prompt</button>
                            {isAdmin && (
                              <>
                                <button className="btn btn-sm btn-outline-primary" onClick={() => generateMasterCharacterImages({ kind: 'mugshot' })}>Generate</button>
                                <button className="btn btn-sm btn-outline-danger" onClick={() => deleteMasterCharacterImage({ kind: 'mugshot' })}>Delete</button>
                              </>
                            )}
                          </div>
                        </div>

                        <hr className="my-3" />

                        <div className="mt-3">
                          <div className="fw-bold">Interrogation Room Photos</div>
                          {masterCharacterIrUrls.length > 0 ? (
                            <div className="mt-2">
                              <div className="form-text">Photo {masterCharacterIrIndex + 1} / {masterCharacterIrUrls.length}</div>
                              <WebpImage className="img-fluid rounded" src={masterCharacterIrUrls[masterCharacterIrIndex]} alt="IR" />
                              <div className="mt-2 d-flex gap-2">
                                <button className="btn btn-sm btn-outline-secondary" onClick={() => setMasterCharacterIrIndex(i => Math.max(0, i - 1))} disabled={masterCharacterIrIndex === 0}>Prev</button>
                                <button className="btn btn-sm btn-outline-secondary" onClick={() => setMasterCharacterIrIndex(i => (i + 1) % masterCharacterIrUrls.length)}>Next</button>
                                <button className="btn btn-sm btn-outline-danger" onClick={() => deleteMasterCharacterImage({ kind: 'ir', url: masterCharacterIrUrls[masterCharacterIrIndex] })}>Delete</button>
                              </div>
                            </div>
                          ) : (
                            <div className="form-text mt-2">No IR photos found.</div>
                          )}
                          <div className="mt-2">
                            <div className="small fw-bold">Emotions</div>
                            <div className="d-flex flex-wrap gap-2 mt-1">
                              {masterCharacterIrEmotions.map(emo => (
                                <label key={emo} className="form-check m-0 small">
                                  <input
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={masterCharacterIrEmotionEnabled[emo] !== false}
                                    onChange={(e) => setMasterCharacterIrEmotionEnabled(p => ({ ...p, [emo]: e.target.checked }))}
                                  />
                                  {emo}
                                </label>
                              ))}
                            </div>
                            {isAdmin && (
                              <button
                                className="btn btn-sm btn-outline-primary mt-2"
                                onClick={() => generateMasterCharacterImages({ kind: 'ir' })}
                                disabled={busy}
                              >
                                Generate IR Photo
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="fw-bold">Description</div>
                        <div className="input-group mt-2">
                          <button
                            type="button"
                            className={isMasterAssetFieldLocked('description') ? 'btn btn-outline-warning' : 'btn btn-outline-secondary'}
                            onClick={() => toggleMasterAssetFieldLock('description')}
                            disabled={busy || !isAdmin}
                          >
                            {isMasterAssetFieldLocked('description') ? lockSvg : unlockSvg}
                          </button>
                          <textarea
                            className="form-control"
                            rows={4}
                            value={getMasterAssetDataObject().description || ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateMasterAssetDetailsDataObject((prev: any) => ({
                                ...prev,
                                description: v
                              }));
                            }}
                            disabled={busy || !isAdmin || isMasterAssetFieldLocked('description')}
                          />
                        </div>

                        {(isLocation || isWeapon) && (
                          <div className="mt-3">
                            <div className="fw-bold">Image</div>
                            {getMasterAssetDataObject().image?.url && (
                              <WebpImage className="img-fluid rounded mt-2" src={getMasterAssetDataObject().image.url} alt="Asset" />
                            )}
                            <div className="mt-2 d-flex gap-2">
                              {isAdmin && <button className="btn btn-sm btn-outline-primary" onClick={generateMasterAssetPrimaryImage}>Generate Image</button>}
                              {isAdmin && <button className="btn btn-sm btn-outline-danger" onClick={deleteMasterAssetPrimaryImage}>Delete Image</button>}
                            </div>
                            {isAdmin && (
                              <input
                                type="file"
                                className="form-control form-control-sm mt-2"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) uploadMasterAssetImage({ file: f });
                                }}
                              />
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Column 3: Rapport, Favorites, Advanced */}
                <div className="col-12 col-xl-4">
                  {isCharacter ? (
                    <div className="catn8-card p-3 h-100">
                      <div className="fw-bold">Rapport Traits</div>
                      <div className="row g-2 mt-2">
                        <div className="col-12">
                          <label className="form-label">Likes (one per line)</label>
                          <textarea
                            className="form-control"
                            rows={2}
                            value={(masterAssetDetailsFields.rapport_likes || []).join('\n')}
                            onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, rapport_likes: e.target.value.split('\n').filter(Boolean) }))}
                            disabled={busy || !isAdmin}
                          />
                        </div>
                        <div className="col-12">
                          <label className="form-label">Dislikes (one per line)</label>
                          <textarea
                            className="form-control"
                            rows={2}
                            value={(masterAssetDetailsFields.rapport_dislikes || []).join('\n')}
                            onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, rapport_dislikes: e.target.value.split('\n').filter(Boolean) }))}
                            disabled={busy || !isAdmin}
                          />
                        </div>
                        <div className="col-12">
                          <label className="form-label">Quirks (one per line)</label>
                          <textarea
                            className="form-control"
                            rows={2}
                            value={(masterAssetDetailsFields.rapport_quirks || []).join('\n')}
                            onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, rapport_quirks: e.target.value.split('\n').filter(Boolean) }))}
                            disabled={busy || !isAdmin}
                          />
                        </div>
                        <div className="col-12">
                          <label className="form-label">Fun Facts (one per line)</label>
                          <textarea
                            className="form-control"
                            rows={2}
                            value={(masterAssetDetailsFields.rapport_fun_facts || []).join('\n')}
                            onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, rapport_fun_facts: e.target.value.split('\n').filter(Boolean) }))}
                            disabled={busy || !isAdmin}
                          />
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="fw-bold">Legacy (Deprecated)</div>
                        <details className="mt-2">
                          <summary className="fw-bold small">JSON Fields</summary>
                          <div className="row g-2 mt-2">
                            {['color', 'snack', 'drink', 'music', 'hobby', 'pet'].map(key => (
                              <div key={key} className="col-6">
                                <label className="form-label text-capitalize">{key}</label>
                                <input
                                  className="form-control"
                                  value={getFav(key)}
                                  onChange={(e) => setFav(key, e.target.value)}
                                  disabled={busy || !isAdmin}
                                />
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>

                      <hr className="my-3" />

                      <div>
                        <div className="d-flex align-items-center justify-content-between gap-2">
                          <div>
                            <div className="fw-bold">Deposition</div>
                            <div className="form-text">Sworn statement for this scenario.</div>
                          </div>
                          <div className="d-flex gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => loadMasterCharacterDeposition()}
                              disabled={busy || masterCharacterDepositionBusy || !scenarioId || !masterCharacterScenarioEntityId}
                              title="Refresh deposition"
                            >
                              Refresh
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => openJsonPreview({
                                title: 'generate_deposition job',
                                payload: {
                                  action: 'generate_deposition',
                                  case_id: caseId,
                                  scenario_id: scenarioId,
                                  entity_id: masterCharacterScenarioEntityId,
                                },
                              })}
                              disabled={busy || !scenarioId || !masterCharacterScenarioEntityId}
                            >
                              View Prompt
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => enqueueSpecificJob({ action: 'generate_deposition', spec: {}, requireScenario: true, entityId: masterCharacterScenarioEntityId })}
                                disabled={busy || !scenarioId || !masterCharacterScenarioEntityId}
                              >
                                Generate
                              </button>
                            )}
                          </div>
                        </div>

                        {masterCharacterDepositionError && (
                          <div className="alert alert-danger mt-2 mb-0 small" role="alert">{masterCharacterDepositionError}</div>
                        )}

                        {!scenarioId ? (
                          <div className="text-muted mt-2 small">Select a scenario to view depositions.</div>
                        ) : (!masterCharacterScenarioEntityId ? (
                          <div className="text-muted mt-2 small">Character not in this scenario.</div>
                        ) : (
                          <div className="mt-2">
                            {masterCharacterDepositionUpdatedAt && (
                              <div className="text-muted smallest mb-1">Updated: {masterCharacterDepositionUpdatedAt}</div>
                            )}
                            <div className="catn8-card p-2 smallest bg-light">
                              {masterCharacterDepositionText.trim()
                                ? <div className="catn8-prewrap">{masterCharacterDepositionText}</div>
                                : <div className="text-muted italic">No deposition yet.</div>}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3">
                        <div className="fw-bold">Advanced</div>
                        <details className="mt-2">
                          <summary className="fw-bold small">Data JSON</summary>
                          <textarea
                            className="form-control mt-1"
                            rows={10}
                            value={masterAssetDetailsDataText}
                            readOnly
                          />
                        </details>
                      </div>

                      <div className="mt-3 d-flex justify-content-end gap-2">
                        {isAdmin && <button className="btn btn-outline-secondary" onClick={resetMasterAssetDetails}>Reset</button>}
                        {isAdmin && (
                          <button
                            className={`btn ${Number(masterAssetDetailsItem?.is_archived) ? 'btn-outline-success' : 'btn-outline-danger'}`}
                            onClick={() => archiveMasterAsset({ type: 'character', id: masterAssetDetailsItem.id, is_archived: Number(masterAssetDetailsItem.is_archived) ? 0 : 1 })}
                          >
                            {Number(masterAssetDetailsItem?.is_archived) ? 'Restore' : 'Archive'}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="catn8-card p-3 h-100">
                      <div className="fw-bold">Advanced</div>
                      <textarea
                        className="form-control mt-2"
                        rows={15}
                        value={masterAssetDetailsDataText}
                        readOnly
                      />
                      <div className="mt-3 d-flex justify-content-end gap-2">
                        {isAdmin && <button className="btn btn-outline-secondary" onClick={resetMasterAssetDetails}>Reset</button>}
                        {isAdmin && (
                          <button
                            className={`btn ${Number(masterAssetDetailsItem?.is_archived) ? 'btn-outline-success' : 'btn-outline-danger'}`}
                            onClick={() => archiveMasterAsset({ type: masterAssetDetailsType, id: masterAssetDetailsItem.id, is_archived: Number(masterAssetDetailsItem.is_archived) ? 0 : 1 })}
                          >
                            {Number(masterAssetDetailsItem?.is_archived) ? 'Restore' : 'Archive'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

