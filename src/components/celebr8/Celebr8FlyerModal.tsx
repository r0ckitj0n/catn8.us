import React from 'react';

import { ApiClient } from '../../core/ApiClient';
import { Celebr8Flyer, Celebr8Request } from '../../types/celebr8';
import { IToast } from '../../types/common';

type Props = {
  open: boolean;
  partyId: number;
  partyTitle: string;
  isAdmin: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
  onFlyerChanged?: () => void;
};

type FlyerPayload = {
  success: boolean;
  has_flyer: boolean;
  flyer: Celebr8Flyer | null;
  versions?: Celebr8Flyer[];
  history?: Celebr8Flyer[];
  active_flyer_request: Celebr8Request | null;
  flyer_brief?: string;
  flyer_style_notes?: string;
};

function usableImageUrl(url: string | undefined | null): string {
  const trimmed = (url || '').trim();
  if (!trimmed || trimmed === '#' || trimmed === 'about:blank') return '';
  return trimmed;
}

export function Celebr8FlyerModal({
  open,
  partyId,
  partyTitle,
  isAdmin,
  onClose,
  onToast,
  onFlyerChanged,
}: Props) {
  const [busy, setBusy] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [hasFlyer, setHasFlyer] = React.useState(false);
  const [flyer, setFlyer] = React.useState<Celebr8Flyer | null>(null);
  const [versions, setVersions] = React.useState<Celebr8Flyer[]>([]);
  const [activeRequest, setActiveRequest] = React.useState<Celebr8Request | null>(null);
  const [briefDraft, setBriefDraft] = React.useState('');
  const [styleDraft, setStyleDraft] = React.useState('');
  const [createNotes, setCreateNotes] = React.useState('');
  const [regenNotes, setRegenNotes] = React.useState('');
  const [showVersions, setShowVersions] = React.useState(false);
  const [showBrief, setShowBrief] = React.useState(false);
  const [imageBroken, setImageBroken] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const applyPayload = (res: FlyerPayload) => {
    const nextFlyer = res.flyer || null;
    const nextUrl = usableImageUrl(nextFlyer?.url);
    const nextHas = Boolean(res.has_flyer) && nextUrl !== '';
    setHasFlyer(nextHas);
    setFlyer(nextHas ? nextFlyer : null);
    setVersions(res.versions || res.history || []);
    setActiveRequest(res.active_flyer_request || null);
    setBriefDraft(res.flyer_brief || '');
    setStyleDraft(res.flyer_style_notes || '');
    setImageBroken(false);
    setLoaded(true);
  };

  const load = React.useCallback(async () => {
    const res = await ApiClient.get<FlyerPayload>(
      `/api/celebr8.php?action=get_flyer&party_id=${partyId}&history=1`,
    );
    applyPayload(res);
  }, [partyId]);

  React.useEffect(() => {
    if (!open) return;
    setLoaded(false);
    setShowVersions(false);
    setShowBrief(false);
    setRegenNotes('');
    setCreateNotes('');
    setImageBroken(false);
    // Load metadata only — never auto-queue a flyer request on open.
    void load().catch((error: unknown) => {
      // Empty parties are a normal empty state, not a toast error.
      const message = error instanceof Error ? error.message : '';
      if (message && !/not found|no flyer|missing/i.test(message)) {
        onToast?.({ tone: 'error', message: message || 'Failed to load flyer' });
      }
      setHasFlyer(false);
      setFlyer(null);
      setActiveRequest(null);
      setLoaded(true);
    });
  }, [open, load, onToast]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const notifyChanged = () => {
    onFlyerChanged?.();
  };

  const uploadFlyer = async (files: FileList | null) => {
    if (!isAdmin || !files || files.length === 0) return;
    const file = files[0];
    if (file.type && !file.type.startsWith('image/')) {
      onToast?.({ tone: 'error', message: 'Only image uploads are allowed' });
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('party_id', String(partyId));
      fd.append('file', file, file.name);
      await ApiClient.postFormData('/api/celebr8.php?action=upload_flyer', fd);
      await load();
      notifyChanged();
      onToast?.({ tone: 'success', message: 'Flyer uploaded' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      onToast?.({ tone: 'error', message });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const saveBrief = async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const res = await ApiClient.post<FlyerPayload>('/api/celebr8.php?action=update_flyer_brief', {
        party_id: partyId,
        flyer_brief: briefDraft,
        flyer_style_notes: styleDraft,
      });
      applyPayload(res);
      onToast?.({ tone: 'success', message: 'Flyer brief saved' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save brief';
      onToast?.({ tone: 'error', message });
    } finally {
      setBusy(false);
    }
  };

  const deleteFlyer = async () => {
    if (!isAdmin || !hasFlyer) return;
    if (!window.confirm('Delete the current flyer? Past versions stay available to restore.')) return;
    setBusy(true);
    try {
      const res = await ApiClient.post<FlyerPayload>('/api/celebr8.php?action=delete_flyer', {
        party_id: partyId,
      });
      applyPayload(res);
      notifyChanged();
      onToast?.({ tone: 'success', message: 'Flyer deleted (history kept)' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete flyer';
      onToast?.({ tone: 'error', message });
    } finally {
      setBusy(false);
    }
  };

  const restoreVersion = async (version: Celebr8Flyer) => {
    if (!isAdmin || !version.id) return;
    setBusy(true);
    try {
      const res = await ApiClient.post<FlyerPayload>('/api/celebr8.php?action=restore_flyer_version', {
        flyer_id: version.id,
      });
      applyPayload(res);
      notifyChanged();
      onToast?.({ tone: 'success', message: `Restored version ${version.version}` });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to restore version';
      onToast?.({ tone: 'error', message });
    } finally {
      setBusy(false);
    }
  };

  const createFlyer = async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const res = await ApiClient.post<{
        success: boolean;
        request: Celebr8Request;
        created: boolean;
      }>('/api/celebr8.php?action=request_flyer', {
        party_id: partyId,
        style_notes: createNotes,
        regenerate: false,
      });
      setActiveRequest(res.request);
      setCreateNotes('');
      onToast?.({
        tone: 'success',
        message: res.created ? 'Flyer request queued for Celebr8r' : 'Flyer request already in progress',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to queue flyer request';
      onToast?.({ tone: 'error', message });
    } finally {
      setBusy(false);
    }
  };

  const regenerateFlyer = async () => {
    if (!isAdmin || !hasFlyer) return;
    setBusy(true);
    try {
      const res = await ApiClient.post<{
        success: boolean;
        request: Celebr8Request;
        created: boolean;
      }>('/api/celebr8.php?action=request_flyer', {
        party_id: partyId,
        style_notes: regenNotes,
        regenerate: true,
      });
      setActiveRequest(res.request);
      setRegenNotes('');
      onToast?.({
        tone: 'success',
        message: res.created ? 'Regenerate queued for Celebr8r' : 'Flyer request already in progress',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to queue regenerate';
      onToast?.({ tone: 'error', message });
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const imageUrl = usableImageUrl(flyer?.url);
  const showImage = hasFlyer && imageUrl !== '' && !imageBroken;
  const pastVersions = versions.filter((v) => v.id && !v.is_current);

  return (
    <div
      className="celebr8-flyer-modal-root"
      role="dialog"
      aria-modal="true"
      aria-label={`${partyTitle} flyer`}
    >
      <div className="celebr8-flyer-modal-backdrop no-print" onClick={onClose} />
      <div className="celebr8-flyer-modal-shell">
        <div className="celebr8-flyer-modal-toolbar no-print">
          <strong>Flyer</strong>
          <div className="celebr8-toolbar flex-wrap">
            {showImage ? (
              <button type="button" className="btn btn-sm btn-primary" onClick={() => window.print()}>
                Print
              </button>
            ) : null}
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {!loaded ? (
          <p className="text-muted p-3 no-print">Loading flyer…</p>
        ) : (
          <>
            {showImage ? (
              <div className="celebr8-flyer-page">
                <img
                  className="celebr8-flyer-page-image"
                  src={imageUrl}
                  alt={`${partyTitle} flyer`}
                  onError={() => {
                    // Broken/missing file → quiet empty state, never a browser broken-image icon.
                    setImageBroken(true);
                    setHasFlyer(false);
                  }}
                />
              </div>
            ) : activeRequest ? (
              <div className="celebr8-flyer-waiting no-print">
                <p className="mb-1"><strong>Celebr8r is making your flyer…</strong></p>
                <p className="small text-muted mb-0">
                  Request #{activeRequest.id} · {activeRequest.status}
                  {activeRequest.type || activeRequest.request_type
                    ? ` · type=${activeRequest.type || activeRequest.request_type}`
                    : ''}
                </p>
              </div>
            ) : (
              <div className="celebr8-flyer-empty no-print">
                {isAdmin ? (
                  <>
                    <label className="form-label small" htmlFor="celebr8-flyer-create-notes">
                      Style notes <span className="text-muted">(optional)</span>
                    </label>
                    <textarea
                      id="celebr8-flyer-create-notes"
                      className="form-control form-control-sm mb-2"
                      rows={3}
                      value={createNotes}
                      onChange={(e) => setCreateNotes(e.target.value)}
                      disabled={busy}
                      placeholder="Colors, vibe, motifs…"
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={busy}
                      onClick={() => void createFlyer()}
                    >
                      Create Flyer
                    </button>
                  </>
                ) : (
                  <p className="text-muted mb-0">No flyer yet.</p>
                )}
              </div>
            )}

            {isAdmin ? (
              <div className="celebr8-flyer-admin no-print">
                <div className="celebr8-toolbar flex-wrap mb-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="visually-hidden"
                    id={`celebr8-flyer-upload-${partyId}`}
                    onChange={(e) => void uploadFlyer(e.target.files)}
                  />
                  <label htmlFor={`celebr8-flyer-upload-${partyId}`} className="btn btn-sm btn-outline-secondary mb-0">
                    {showImage ? 'Replace flyer' : 'Upload flyer'}
                  </label>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={busy}
                    onClick={() => setShowBrief((v) => !v)}
                  >
                    {showBrief ? 'Hide brief' : 'Edit brief'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={busy || pastVersions.length === 0}
                    onClick={() => setShowVersions((v) => !v)}
                  >
                    Versions{pastVersions.length ? ` (${pastVersions.length})` : ''}
                  </button>
                  {showImage ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      disabled={busy}
                      onClick={() => void deleteFlyer()}
                    >
                      Delete flyer
                    </button>
                  ) : null}
                </div>

                {showBrief ? (
                  <div className="celebr8-flyer-brief-editor mb-2">
                    <label className="form-label small" htmlFor="celebr8-flyer-brief">Flyer brief</label>
                    <textarea
                      id="celebr8-flyer-brief"
                      className="form-control form-control-sm mb-2"
                      rows={5}
                      value={briefDraft}
                      onChange={(e) => setBriefDraft(e.target.value)}
                      disabled={busy}
                      placeholder="Saved party flyer brief used for the next Celebr8r request…"
                    />
                    <label className="form-label small" htmlFor="celebr8-flyer-style">Style notes</label>
                    <textarea
                      id="celebr8-flyer-style"
                      className="form-control form-control-sm mb-2"
                      rows={3}
                      value={styleDraft}
                      onChange={(e) => setStyleDraft(e.target.value)}
                      disabled={busy}
                      placeholder="Colors, vibe, motifs…"
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={busy}
                      onClick={() => void saveBrief()}
                    >
                      Save brief &amp; notes
                    </button>
                  </div>
                ) : null}

                {showVersions ? (
                  <div className="celebr8-flyer-versions mb-2">
                    <p className="small fw-bold mb-1">Past versions</p>
                    {pastVersions.length === 0 ? (
                      <p className="small text-muted mb-0">No history yet.</p>
                    ) : (
                      <ul className="celebr8-flyer-version-list">
                        {pastVersions.map((v) => {
                          const thumb = usableImageUrl(v.url);
                          return (
                            <li key={v.id ?? `${v.version}-${v.created_at}`}>
                              <div className="celebr8-flyer-version-row">
                                {thumb ? (
                                  <img
                                    src={thumb}
                                    alt={`Version ${v.version}`}
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <span className="small text-muted">v{v.version}</span>
                                )}
                                <div>
                                  <div className="small">v{v.version} · {v.source}</div>
                                  <button
                                    type="button"
                                    className="btn btn-link btn-sm px-0"
                                    disabled={busy || !v.id}
                                    onClick={() => void restoreVersion(v)}
                                  >
                                    Restore
                                  </button>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}

                {showImage ? (
                  <div className="celebr8-flyer-regen">
                    <label className="form-label small" htmlFor="celebr8-flyer-regen-notes">
                      Regenerate (keeps current flyer until Celebr8r uploads a new one)
                    </label>
                    <textarea
                      id="celebr8-flyer-regen-notes"
                      className="form-control form-control-sm mb-2"
                      rows={2}
                      value={regenNotes}
                      onChange={(e) => setRegenNotes(e.target.value)}
                      disabled={busy || Boolean(activeRequest)}
                      placeholder='Extra notes for this run, e.g. "make it scarier" or "more purple"'
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={busy || Boolean(activeRequest)}
                      onClick={() => void regenerateFlyer()}
                    >
                      {activeRequest ? 'Regenerate already queued…' : 'Regenerate'}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
