import React, { useRef } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IToast } from '../../../types/common';
import { IJob } from '../../../types/game';

export function useJobTracking(showMysteryToast: (t: Partial<IToast>) => void) {
  const jobToastSeqRef = React.useRef(0);
  const activeIntervalsRef = useRef<Set<any>>(new Set());

  React.useEffect(() => {
    return () => {
      activeIntervalsRef.current.forEach(id => {
        try { window.clearInterval(id); } catch (_err) {}
      });
      activeIntervalsRef.current.clear();
    };
  }, []);

  const watchJobToast = React.useCallback(async ({ caseId: cid, jobId, label, onDone }: { caseId: number; jobId: number; label: string; onDone?: (result: any) => void }) => {
    const caseIdNum = Number(cid || 0);
    const jobIdNum = Number(jobId || 0);
    if (!caseIdNum || !jobIdNum) return;

    const seq = (jobToastSeqRef.current || 0) + 1;
    jobToastSeqRef.current = seq;
    const toastId = 'job:' + String(jobIdNum) + ':' + String(seq);

    const statusLabel = (s: string) => {
      const raw = String(s || '').trim().toLowerCase();
      if (!raw) return '…';
      if (raw === 'queued') return 'Queued';
      if (raw === 'running') return 'Running';
      if (raw === 'done') return 'Done';
      if (raw === 'error') return 'Error';
      if (raw === 'failed') return 'Failed';
      if (raw === 'canceled') return 'Canceled';
      return raw;
    };

    const updateToast = (t: Partial<IToast>) => {
      const wantsPersist = Object.prototype.hasOwnProperty.call((t || {}), 'persist')
        ? Boolean((t || {}).persist)
        : true;
      showMysteryToast({
        ...(t || {}),
        id: toastId,
        persist: wantsPersist,
      });
    };

    updateToast({ tone: 'info', title: 'Generation', message: String(label || 'Job') + ': Queued' });

    const deadline = Date.now() + (12 * 60 * 1000);
    let lastStatus = '';
    let lastErr = '';
    let alive = true;

    const tick = async () => {
      if (!alive) return;
      if (Date.now() > deadline) {
        updateToast({ tone: 'error', title: 'Generation', message: String(label || 'Job') + ': Timed out waiting for status' });
        alive = false;
        return;
      }

      try {
        const res = await ApiClient.get<{ jobs: IJob[] }>('/api/mystery/play.php?action=list_jobs&case_id=' + String(caseIdNum));
        const jobsList = Array.isArray(res?.jobs) ? res.jobs : [];
        const job = jobsList.find((j) => Number(j?.id || 0) === jobIdNum) || null;
        if (!job) {
          updateToast({ tone: 'error', title: 'Generation', message: String(label || 'Job') + ': Job not found (id ' + String(jobIdNum) + ')' });
          alive = false;
          return;
        }

        const st = String(job?.status || '');
        const err = String(job?.error_text || '');
        if (st !== lastStatus || err !== lastErr) {
          lastStatus = st;
          lastErr = err;
          const human = statusLabel(st);
          if (String(st).toLowerCase() === 'done') {
            updateToast({ tone: 'success', title: 'Generation', message: String(label || 'Job') + ': ' + human, persist: false });
            alive = false;
            if (typeof onDone === 'function') {
              onDone(job.result);
            }
            return;
          }
          if (String(st).toLowerCase() === 'error' || String(st).toLowerCase() === 'failed' || String(st).toLowerCase() === 'canceled') {
            updateToast({ tone: 'error', title: 'Generation', message: String(label || 'Job') + ': ' + human + (err ? (' — ' + err) : '') });
            alive = false;
            return;
          }
          updateToast({ tone: 'info', title: 'Generation', message: String(label || 'Job') + ': ' + human + (err ? (' — ' + err) : '') });
        }
      } catch (e) {
        updateToast({ tone: 'error', title: 'Generation', message: String(label || 'Job') + ': Failed to fetch status (' + String((e as any)?.message || 'error') + ')' });
        alive = false;
      }
    };

    const t = window.setInterval(() => {
      void tick();
    }, 1500);
    activeIntervalsRef.current.add(t);

    try {
      await tick();
    } finally {
      const cleanup = window.setInterval(() => {
        if (alive) return;
        window.clearInterval(t);
        activeIntervalsRef.current.delete(t);
        window.clearInterval(cleanup);
        activeIntervalsRef.current.delete(cleanup);
      }, 250);
      activeIntervalsRef.current.add(cleanup);
    }
  }, [showMysteryToast]);

  const returnValue = React.useMemo(() => ({ watchJobToast }), [watchJobToast]);

  return returnValue;
}
