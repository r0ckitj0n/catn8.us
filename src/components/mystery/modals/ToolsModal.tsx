import React, { useState } from 'react';
import { IJob } from '../../../types/game';

interface ToolsModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  isAdmin: boolean;
  busy: boolean;
  caseId: string | number;
  setCaseId: (val: string) => void;
  cases: any[];
  jobs: IJob[];
  jobAction: string;
  setJobAction: (val: string) => void;
  jobScopeCharacter: boolean;
  setJobScopeCharacter: (val: boolean) => void;
  jobScopeLocation: boolean;
  setJobScopeLocation: (val: boolean) => void;
  jobScopeWeapon: boolean;
  setJobScopeWeapon: (val: boolean) => void;
  jobScopeMotive: boolean;
  setJobScopeMotive: (val: boolean) => void;
  jobSpecText: string;
  setJobSpecText: (val: string) => void;
  imageStyleMasterDraft: string;
  setImageStyleMasterDraft: (val: string) => void;
  locationImageStyleDraft: string;
  setLocationImageStyleDraft: (val: string) => void;
  mugshotImageStyleDraft: string;
  setMugshotImageStyleDraft: (val: string) => void;
  weaponImageStyleDraft: string;
  setWeaponImageStyleDraft: (val: string) => void;
  enqueueJob: (e: React.FormEvent) => void;
  previewEnqueueJobJson: () => void;
  loadJobs: (cid: string | number) => void;
  clearQueuedJobs: () => void;
  clearCompletedJobs: () => void;
  deleteQueuedJob: (id: number | string) => void;
  saveImageStyleSetting: (params: { key: string; value: string }) => void;
}

export function ToolsModal({
  modalRef,
  isAdmin,
  busy,
  caseId,
  setCaseId,
  cases,
  jobs,
  jobAction,
  setJobAction,
  jobScopeCharacter,
  setJobScopeCharacter,
  jobScopeLocation,
  setJobScopeLocation,
  jobScopeWeapon,
  setJobScopeWeapon,
  jobScopeMotive,
  setJobScopeMotive,
  jobSpecText,
  setJobSpecText,
  imageStyleMasterDraft,
  setImageStyleMasterDraft,
  locationImageStyleDraft,
  setLocationImageStyleDraft,
  mugshotImageStyleDraft,
  setMugshotImageStyleDraft,
  weaponImageStyleDraft,
  setWeaponImageStyleDraft,
  enqueueJob,
  previewEnqueueJobJson,
  loadJobs,
  clearQueuedJobs,
  clearCompletedJobs,
  deleteQueuedJob,
  saveImageStyleSetting,
}: ToolsModalProps) {
  const [clearQueueArmed, setClearQueueArmed] = React.useState(false);
  const [deleteJobArmedId, setDeleteJobArmedId] = useState<number | string>(0);

  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Darkroom</div>
            <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <div className="row g-3">
              <div className="col-12 col-lg-6">
                <div className="catn8-card p-3">
                  <div className="fw-bold">Controls</div>
                  <div className="form-text mb-2">Queue generation jobs and manage image prompt styles.</div>

                  <form className="row g-2" onSubmit={enqueueJob}>
                    <div className="col-12">
                      <label className="form-label" htmlFor="mystery-tools-case">Case</label>
                      <select
                        id="mystery-tools-case"
                        className="form-select"
                        value={String(caseId || '')}
                        onChange={(e) => setCaseId(e.target.value)}
                        disabled={busy}
                      >
                        <option value="">Select a case…</option>
                        {(Array.isArray(cases) ? cases : []).map((c: any) => (
                          <option key={'tools-case-' + String(c?.id || '')} value={String(c?.id || '')}>
                            {String(c?.title || c?.slug || ('Case #' + String(c?.id || '')))}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12">
                      <label className="form-label" htmlFor="mystery-job-action">Action</label>
                      <select
                        id="mystery-job-action"
                        className="form-select"
                        value={jobAction}
                        onChange={(e) => setJobAction(e.target.value)}
                        disabled={busy || !caseId}
                      >
                        <option value="generate">Generate</option>
                        <option value="regenerate">Regenerate (rebuild only unlocked items)</option>
                        <option value="reset">Reset</option>
                      </select>
                      <div className="form-text">
                        Generate (fill missing content). Regenerate (overwrite unlocked content only).
                      </div>
                    </div>

                    <div className="col-12">
                      <label className="form-label">Scope</label>
                      <div className="d-flex flex-wrap gap-3">
                        <label className="form-check m-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={jobScopeCharacter}
                            onChange={(e) => setJobScopeCharacter(e.target.checked)}
                            disabled={busy || !caseId}
                          />
                          <span className="form-check-label">Characters</span>
                        </label>
                        <label className="form-check m-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={jobScopeLocation}
                            onChange={(e) => setJobScopeLocation(e.target.checked)}
                            disabled={busy || !caseId}
                          />
                          <span className="form-check-label">Locations</span>
                        </label>
                        <label className="form-check m-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={jobScopeWeapon}
                            onChange={(e) => setJobScopeWeapon(e.target.checked)}
                            disabled={busy || !caseId}
                          />
                          <span className="form-check-label">Weapons</span>
                        </label>
                        <label className="form-check m-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={jobScopeMotive}
                            onChange={(e) => setJobScopeMotive(e.target.checked)}
                            disabled={busy || !caseId}
                          />
                          <span className="form-check-label">Motives</span>
                        </label>
                      </div>
                      <div className="form-text">Used by scoped jobs (e.g., regenerating only some master datasets).</div>
                    </div>

                      {isAdmin && (
                        <div className="col-12 d-flex gap-2">
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={previewEnqueueJobJson}
                            disabled={busy || !caseId}
                          >
                            View JSON
                          </button>
                          <button type="submit" className="btn btn-primary" disabled={busy || !caseId}>
                            Queue Job
                          </button>
                          <button type="button" className="btn btn-outline-secondary" onClick={() => loadJobs(caseId)} disabled={busy || !caseId}>
                            Refresh
                          </button>
                        </div>
                      )}
                      {!isAdmin && (
                        <div className="col-12">
                          <button type="button" className="btn btn-outline-secondary w-100" onClick={() => loadJobs(caseId)} disabled={busy || !caseId}>
                            Refresh Log
                          </button>
                        </div>
                      )}
                  </form>

                  {isAdmin && (
                    <div className="mt-2 d-flex flex-wrap align-items-center gap-2">
                      {!clearQueueArmed ? (
                        <button
                          type="button"
                          className="btn btn-outline-danger"
                          onClick={() => setClearQueueArmed(true)}
                          disabled={busy || !caseId}
                        >
                          Clear queued jobs
                        </button>
                      ) : null}
                      <button type="button" className="btn btn-outline-danger" onClick={clearCompletedJobs} disabled={busy || !caseId}>
                        Clear Completed Jobs
                      </button>
                      {clearQueueArmed ? (
                        <>
                          <button type="button" className="btn btn-danger" onClick={() => { clearQueuedJobs(); setClearQueueArmed(false); }} disabled={busy || !caseId}>
                            Confirm clear
                          </button>
                          <button type="button" className="btn btn-outline-secondary" onClick={() => setClearQueueArmed(false)} disabled={busy}>
                            Cancel
                          </button>
                        </>
                      ) : null}
                    </div>
                  )}

                  <hr className="my-3" />

                  <div className="catn8-card p-2">
                    <div className="fw-bold">Image Style Master</div>
                    <div className="form-text">Prepended to every image prompt.</div>
                    <textarea
                      className="form-control mt-2"
                      rows={3}
                      value={imageStyleMasterDraft}
                      onChange={(e) => setImageStyleMasterDraft(e.target.value)}
                      onBlur={() => saveImageStyleSetting({ key: 'master', value: imageStyleMasterDraft })}
                      disabled={busy || !isAdmin}
                      spellCheck={false}
                    />
                  </div>

                  <div className="catn8-card p-2 mt-2">
                    <div className="fw-bold">Location Image Style</div>
                    <div className="form-text">Added after master style for location prompts.</div>
                    <textarea
                      className="form-control mt-2"
                      rows={3}
                      value={locationImageStyleDraft}
                      onChange={(e) => setLocationImageStyleDraft(e.target.value)}
                      onBlur={() => saveImageStyleSetting({ key: 'location', value: locationImageStyleDraft })}
                      disabled={busy || !isAdmin}
                      spellCheck={false}
                    />
                  </div>

                  <div className="catn8-card p-2 mt-2">
                    <div className="fw-bold">Mugshot Image Style</div>
                    <div className="form-text">Added after master style for mugshot prompts.</div>
                    <textarea
                      className="form-control mt-2"
                      rows={3}
                      value={mugshotImageStyleDraft}
                      onChange={(e) => setMugshotImageStyleDraft(e.target.value)}
                      onBlur={() => saveImageStyleSetting({ key: 'mugshot', value: mugshotImageStyleDraft })}
                      disabled={busy || !isAdmin}
                      spellCheck={false}
                    />
                  </div>

                  <div className="catn8-card p-2 mt-2">
                    <div className="fw-bold">Weapon Image Style</div>
                    <div className="form-text">Added after master style for weapon prompts.</div>
                    <textarea
                      className="form-control mt-2"
                      rows={3}
                      value={weaponImageStyleDraft}
                      onChange={(e) => setWeaponImageStyleDraft(e.target.value)}
                      onBlur={() => saveImageStyleSetting({ key: 'weapon', value: weaponImageStyleDraft })}
                      disabled={busy || !isAdmin}
                      spellCheck={false}
                    />
                  </div>
                </div>

                <div className="catn8-card p-3 mt-3">
                  <div>
                    <div className="fw-bold">Job Spec (JSON)</div>
                    <div className="form-text mb-2">Optional extra parameters for generation jobs. Image styles are auto-injected when you queue jobs.</div>
                  </div>
                  <textarea
                    className="form-control"
                    rows={10}
                    value={jobSpecText}
                    onChange={(e) => setJobSpecText(e.target.value)}
                    disabled={busy || !caseId}
                    spellCheck={false}
                  />
                </div>
              </div>
              <div className="col-12 col-lg-6">
                <div className="catn8-card p-3 h-100">
                  <div className="d-flex justify-content-between align-items-center gap-2">
                    <div>
                      <div className="fw-bold">Log</div>
                      <div className="form-text">Recent generation jobs and status.</div>
                    </div>
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadJobs(caseId)} disabled={busy || !caseId}>
                      Refresh
                    </button>
                  </div>

                  <div className="table-responsive mt-2 catn8-mystery-tools-log-scroll" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    <table className="table table-sm align-middle">
                      <thead>
                        <tr>
                          <th>Action</th>
                          <th>Finished</th>
                          <th>Status</th>
                          <th className="catn8-mystery-tools-log-col-error">Error</th>
                          <th className="text-end"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobs.map((j) => (
                          <tr key={j.id}>
                            <td>{j.action}</td>
                            <td className="text-muted">
                              {(['done', 'error', 'canceled', 'failed'].includes(String(j.status || '').trim().toLowerCase()))
                                ? (String(j.updated_at || '').trim() || '—')
                                : '—'}
                            </td>
                            <td className="text-muted">{j.status}</td>
                            <td className="text-muted catn8-mystery-tools-log-col-error">
                              {String(j.status || '').toLowerCase() === 'error' ? (String(j.error_text || '').trim() || 'Error') : ''}
                            </td>
                            <td className="text-end">
                              {String(j.status || '') === 'queued' ? (
                                Number(deleteJobArmedId) === Number(j.id) ? (
                                  <div className="d-flex justify-content-end gap-2">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-danger"
                                      onClick={() => {
                                        deleteQueuedJob(j.id);
                                        setDeleteJobArmedId(0);
                                      }}
                                      disabled={busy || !caseId}
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-secondary"
                                      onClick={() => setDeleteJobArmedId(0)}
                                      disabled={busy}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => setDeleteJobArmedId(Number(j.id))}
                                    disabled={busy || !caseId}
                                  >
                                    Delete
                                  </button>
                                )
                              ) : null}
                            </td>
                          </tr>
                        ))}
                        {!jobs.length ? (
                          <tr>
                            <td colSpan={4} className="text-muted">{caseId ? 'No jobs yet.' : 'Select a case.'}</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
