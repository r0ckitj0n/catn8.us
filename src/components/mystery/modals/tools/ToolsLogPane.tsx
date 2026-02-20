import React from 'react';
import { IJob } from '../../../../types/game';

export function ToolsLogPane({ jobs, busy, caseId, loadJobs, deleteQueuedJob }: { jobs: IJob[]; busy: boolean; caseId: string | number; loadJobs: (cid: string | number) => void; deleteQueuedJob: (id: number | string) => void; }) {
  const [deleteJobArmedId, setDeleteJobArmedId] = React.useState<number | string>(0);

  return (
    <div className="catn8-card p-3 h-100">
      <div className="d-flex justify-content-between align-items-center gap-2">
        <div>
          <div className="fw-bold">Log</div>
          <div className="form-text">Recent generation jobs and status.</div>
        </div>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadJobs(caseId)} disabled={busy || !caseId}>Refresh</button>
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
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>{job.action}</td>
                <td className="text-muted">{(['done', 'error', 'canceled', 'failed'].includes(String(job.status || '').trim().toLowerCase())) ? (String(job.updated_at || '').trim() || '—') : '—'}</td>
                <td className="text-muted">{job.status}</td>
                <td className="text-muted catn8-mystery-tools-log-col-error">{String(job.status || '').toLowerCase() === 'error' ? (String(job.error_text || '').trim() || 'Error') : ''}</td>
                <td className="text-end">{renderDeleteAction(job, deleteJobArmedId, setDeleteJobArmedId, deleteQueuedJob, busy, caseId)}</td>
              </tr>
            ))}
            {!jobs.length ? <tr><td colSpan={4} className="text-muted">{caseId ? 'No jobs yet.' : 'Select a case.'}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderDeleteAction(job: IJob, deleteJobArmedId: number | string, setDeleteJobArmedId: React.Dispatch<React.SetStateAction<number | string>>, deleteQueuedJob: (id: number | string) => void, busy: boolean, caseId: string | number) {
  if (String(job.status || '') !== 'queued') {
    return null;
  }
  if (Number(deleteJobArmedId) === Number(job.id)) {
    return (
      <div className="d-flex justify-content-end gap-2">
        <button type="button" className="btn btn-sm btn-danger" onClick={() => { deleteQueuedJob(job.id); setDeleteJobArmedId(0); }} disabled={busy || !caseId}>Confirm</button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setDeleteJobArmedId(0)} disabled={busy}>Cancel</button>
      </div>
    );
  }
  return <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setDeleteJobArmedId(Number(job.id))} disabled={busy || !caseId}>Delete</button>;
}
