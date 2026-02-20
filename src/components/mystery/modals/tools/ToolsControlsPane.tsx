import React from 'react';
import { ToolsModalProps } from './types';

interface ToolsControlsPaneProps extends Pick<ToolsModalProps,
  'isAdmin' | 'busy' | 'caseId' | 'setCaseId' | 'cases' | 'jobAction' | 'setJobAction' |
  'jobScopeCharacter' | 'setJobScopeCharacter' | 'jobScopeLocation' | 'setJobScopeLocation' |
  'jobScopeWeapon' | 'setJobScopeWeapon' | 'jobScopeMotive' | 'setJobScopeMotive' |
  'jobSpecText' | 'setJobSpecText' | 'imageStyleMasterDraft' | 'setImageStyleMasterDraft' |
  'locationImageStyleDraft' | 'setLocationImageStyleDraft' | 'mugshotImageStyleDraft' | 'setMugshotImageStyleDraft' |
  'weaponImageStyleDraft' | 'setWeaponImageStyleDraft' | 'enqueueJob' | 'previewEnqueueJobJson' |
  'loadJobs' | 'clearQueuedJobs' | 'clearCompletedJobs' | 'saveImageStyleSetting'> {}

export function ToolsControlsPane(props: ToolsControlsPaneProps) {
  const {
    isAdmin, busy, caseId, setCaseId, cases, jobAction, setJobAction,
    jobScopeCharacter, setJobScopeCharacter, jobScopeLocation, setJobScopeLocation,
    jobScopeWeapon, setJobScopeWeapon, jobScopeMotive, setJobScopeMotive,
    jobSpecText, setJobSpecText, imageStyleMasterDraft, setImageStyleMasterDraft,
    locationImageStyleDraft, setLocationImageStyleDraft, mugshotImageStyleDraft, setMugshotImageStyleDraft,
    weaponImageStyleDraft, setWeaponImageStyleDraft, enqueueJob, previewEnqueueJobJson,
    loadJobs, clearQueuedJobs, clearCompletedJobs, saveImageStyleSetting,
  } = props;
  const [clearQueueArmed, setClearQueueArmed] = React.useState(false);

  return (
    <>
      <div className="catn8-card p-3">
        <div className="fw-bold">Controls</div>
        <div className="form-text mb-2">Queue generation jobs and manage image prompt styles.</div>
        <form className="row g-2" onSubmit={enqueueJob}>
          <div className="col-12">
            <label className="form-label" htmlFor="mystery-tools-case">Case</label>
            <select id="mystery-tools-case" className="form-select" value={String(caseId || '')} onChange={(e) => setCaseId(e.target.value)} disabled={busy}>
              <option value="">Select a case…</option>
              {(Array.isArray(cases) ? cases : []).map((c: any) => (
                <option key={`tools-case-${String(c?.id || '')}`} value={String(c?.id || '')}>{String(c?.title || c?.slug || (`Case #${String(c?.id || '')}`))}</option>
              ))}
            </select>
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="mystery-job-action">Action</label>
            <select id="mystery-job-action" className="form-select" value={jobAction} onChange={(e) => setJobAction(e.target.value)} disabled={busy || !caseId}>
              <option value="generate">Generate</option>
              <option value="regenerate">Regenerate (rebuild only unlocked items)</option>
              <option value="reset">Reset</option>
            </select>
            <div className="form-text">Generate (fill missing content). Regenerate (overwrite unlocked content only).</div>
          </div>
          <div className="col-12">
            <label className="form-label">Scope</label>
            <div className="d-flex flex-wrap gap-3">
              <label className="form-check m-0"><input className="form-check-input" type="checkbox" checked={jobScopeCharacter} onChange={(e) => setJobScopeCharacter(e.target.checked)} disabled={busy || !caseId} /><span className="form-check-label">Characters</span></label>
              <label className="form-check m-0"><input className="form-check-input" type="checkbox" checked={jobScopeLocation} onChange={(e) => setJobScopeLocation(e.target.checked)} disabled={busy || !caseId} /><span className="form-check-label">Locations</span></label>
              <label className="form-check m-0"><input className="form-check-input" type="checkbox" checked={jobScopeWeapon} onChange={(e) => setJobScopeWeapon(e.target.checked)} disabled={busy || !caseId} /><span className="form-check-label">Weapons</span></label>
              <label className="form-check m-0"><input className="form-check-input" type="checkbox" checked={jobScopeMotive} onChange={(e) => setJobScopeMotive(e.target.checked)} disabled={busy || !caseId} /><span className="form-check-label">Motives</span></label>
            </div>
          </div>
          <div className="col-12 d-flex gap-2">
            {isAdmin ? <button type="button" className="btn btn-outline-secondary" onClick={previewEnqueueJobJson} disabled={busy || !caseId}>View JSON</button> : null}
            {isAdmin ? <button type="submit" className="btn btn-primary" disabled={busy || !caseId}>Queue Job</button> : null}
            <button type="button" className="btn btn-outline-secondary" onClick={() => loadJobs(caseId)} disabled={busy || !caseId}>{isAdmin ? 'Refresh' : 'Refresh Log'}</button>
          </div>
        </form>
        {isAdmin ? (
          <div className="mt-2 d-flex flex-wrap align-items-center gap-2">
            {!clearQueueArmed ? <button type="button" className="btn btn-outline-danger" onClick={() => setClearQueueArmed(true)} disabled={busy || !caseId}>Clear queued jobs</button> : null}
            <button type="button" className="btn btn-outline-danger" onClick={clearCompletedJobs} disabled={busy || !caseId}>Clear Completed Jobs</button>
            {clearQueueArmed ? (
              <>
                <button type="button" className="btn btn-danger" onClick={() => { clearQueuedJobs(); setClearQueueArmed(false); }} disabled={busy || !caseId}>Confirm clear</button>
                <button type="button" className="btn btn-outline-secondary" onClick={() => setClearQueueArmed(false)} disabled={busy}>Cancel</button>
              </>
            ) : null}
          </div>
        ) : null}
        <hr className="my-3" />
        <StyleBlock title="Image Style Master" hint="Prepended to every image prompt." value={imageStyleMasterDraft} onChange={setImageStyleMasterDraft} onBlur={() => saveImageStyleSetting({ key: 'master', value: imageStyleMasterDraft })} busy={busy} isAdmin={isAdmin} />
        <StyleBlock title="Location Image Style" hint="Added after master style for location prompts." value={locationImageStyleDraft} onChange={setLocationImageStyleDraft} onBlur={() => saveImageStyleSetting({ key: 'location', value: locationImageStyleDraft })} busy={busy} isAdmin={isAdmin} />
        <StyleBlock title="Mugshot Image Style" hint="Added after master style for mugshot prompts." value={mugshotImageStyleDraft} onChange={setMugshotImageStyleDraft} onBlur={() => saveImageStyleSetting({ key: 'mugshot', value: mugshotImageStyleDraft })} busy={busy} isAdmin={isAdmin} />
        <StyleBlock title="Weapon Image Style" hint="Added after master style for weapon prompts." value={weaponImageStyleDraft} onChange={setWeaponImageStyleDraft} onBlur={() => saveImageStyleSetting({ key: 'weapon', value: weaponImageStyleDraft })} busy={busy} isAdmin={isAdmin} />
      </div>
      <div className="catn8-card p-3 mt-3">
        <div className="fw-bold">Job Spec (JSON)</div>
        <div className="form-text mb-2">Optional extra parameters for generation jobs. Image styles are auto-injected when you queue jobs.</div>
        <textarea className="form-control" rows={10} value={jobSpecText} onChange={(e) => setJobSpecText(e.target.value)} disabled={busy || !caseId} spellCheck={false} />
      </div>
    </>
  );
}

function StyleBlock({ title, hint, value, onChange, onBlur, busy, isAdmin }: { title: string; hint: string; value: string; onChange: (value: string) => void; onBlur: () => void; busy: boolean; isAdmin: boolean; }) {
  return (
    <div className="catn8-card p-2 mt-2">
      <div className="fw-bold">{title}</div>
      <div className="form-text">{hint}</div>
      <textarea className="form-control mt-2" rows={3} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} disabled={busy || !isAdmin} spellCheck={false} />
    </div>
  );
}
