import React from 'react';

import { ApiClient } from '../../core/ApiClient';
import type { Tabul8BoardParticipant } from '../../types/tabul8';

type ToastFn = ((t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void) | undefined;

type MatchCandidate = { id: number; name: string; phone?: string; email?: string; rsvp_status?: string };

function rsvpLabel(status: string): string {
  switch (status) {
    case 'going': return 'Going';
    case 'maybe': return 'Maybe';
    case 'not_going': return 'Not going';
    case 'no_reply': return 'No reply';
    default: return status || 'No reply';
  }
}

export function Tabul8ParticipantsPanel({
  boardId,
  partyId,
  busy,
  onBusy,
  onToast,
}: {
  boardId: number;
  partyId: number;
  busy?: boolean;
  onBusy?: (v: boolean) => void;
  onToast?: ToastFn;
}) {
  const [participants, setParticipants] = React.useState<Tabul8BoardParticipant[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [pendingConfirm, setPendingConfirm] = React.useState<{
    candidates: MatchCandidate[];
    draft: { name: string; phone: string; email: string };
  } | null>(null);

  const load = React.useCallback(async () => {
    if (boardId <= 0) return;
    setLoading(true);
    try {
      const res = await ApiClient.get<{ participants?: Tabul8BoardParticipant[] }>(
        `/api/tabul8.php?action=list_board_participants&board_id=${boardId}&party_id=${partyId}`,
      );
      setParticipants(res.participants || []);
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Failed to load participants' });
    } finally {
      setLoading(false);
    }
  }, [boardId, partyId, onToast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const setActive = async (guestId: number, isActive: boolean) => {
    onBusy?.(true);
    try {
      const res = await ApiClient.post<{ participants?: Tabul8BoardParticipant[] }>(
        '/api/tabul8.php?action=set_participant_active',
        { board_id: boardId, guest_id: guestId, is_active: isActive ? 1 : 0 },
      );
      setParticipants(res.participants || []);
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Update failed' });
    } finally {
      onBusy?.(false);
    }
  };

  const bulkUncheckAbsent = async () => {
    onBusy?.(true);
    try {
      const res = await ApiClient.post<{ updated?: number; participants?: Tabul8BoardParticipant[] }>(
        '/api/tabul8.php?action=bulk_deactivate_absent',
        { board_id: boardId },
      );
      setParticipants(res.participants || []);
      onToast?.({
        tone: 'success',
        message: `Unchecked ${res.updated ?? 0} not-going / no-reply guest(s)`,
      });
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Bulk uncheck failed' });
    } finally {
      onBusy?.(false);
    }
  };

  const submitAdd = async (confirmGuestId?: number) => {
    const draft = pendingConfirm?.draft || { name: name.trim(), phone: phone.trim(), email: email.trim() };
    if (!draft.name) {
      onToast?.({ tone: 'error', message: 'Name is required' });
      return;
    }
    onBusy?.(true);
    try {
      const res = await ApiClient.post<{
        success?: boolean;
        error?: string;
        participants?: Tabul8BoardParticipant[];
        guest?: MatchCandidate;
        candidates?: MatchCandidate[];
        created?: boolean;
      }>('/api/tabul8.php?action=add_board_person', {
        board_id: boardId,
        name: draft.name,
        phone: draft.phone,
        email: draft.email,
        confirm_guest_id: confirmGuestId || undefined,
      });
      setParticipants(res.participants || []);
      setPendingConfirm(null);
      setName('');
      setPhone('');
      setEmail('');
      onToast?.({
        tone: 'success',
        message: res.created ? `Added walk-in ${draft.name}` : `Linked ${res.guest?.name || draft.name}`,
      });
    } catch (error: any) {
      const payload = error?.payload || error?.data || {};
      const err = String(payload?.error || error?.message || '');
      if (err === 'confirm_link' || err === 'ambiguous_guest' || err === 'confirm_fuzzy') {
        const candidates: MatchCandidate[] = Array.isArray(payload.candidates) && payload.candidates.length
          ? payload.candidates
          : (payload.guest ? [payload.guest] : []);
        setPendingConfirm({ candidates, draft });
        onToast?.({
          tone: 'info',
          message: candidates.length > 1
            ? 'Several guests match — confirm which to link'
            : `Likely match: ${candidates[0]?.name || 'existing guest'}. Confirm to link.`,
        });
      } else {
        onToast?.({ tone: 'error', message: err || 'Add person failed' });
      }
    } finally {
      onBusy?.(false);
    }
  };

  const activeCount = participants.filter((p) => Number(p.is_active) === 1).length;

  return (
    <div className="tabul8-panel">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
        <div>
          <h2 className="h5 mb-0">Party participants</h2>
          <p className="small text-muted mb-0">
            Prefills from all Celebr8 invites. Unchecked people stay on the guest list but cannot vote or enter contests.
            {' '}{activeCount}/{participants.length} active
            {loading ? ' · loading…' : ''}
          </p>
        </div>
        <div className="tabul8-toolbar">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={busy || loading}
            onClick={() => void bulkUncheckAbsent()}
          >
            Uncheck all not-going / no-reply
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={busy || loading}
            onClick={() => void load()}
          >
            Refresh list
          </button>
        </div>
      </div>

      <div className="tabul8-participants-list mb-3">
        {participants.map((p) => (
          <label key={p.guest_id} className={`tabul8-participant-row${Number(p.is_active) === 1 ? '' : ' inactive'}`}>
            <input
              type="checkbox"
              checked={Number(p.is_active) === 1}
              disabled={busy}
              onChange={(e) => void setActive(p.guest_id, e.target.checked)}
            />
            <span className="tabul8-participant-name">{p.name}</span>
            <span className={`tabul8-rsvp tabul8-rsvp-${p.rsvp_status || 'no_reply'}`}>
              {rsvpLabel(p.rsvp_status)}
            </span>
            {Number(p.walk_in) === 1 ? <span className="tabul8-walkin-badge">Walk-in</span> : null}
          </label>
        ))}
        {participants.length === 0 && !loading ? (
          <p className="small text-muted mb-0">No guests on this party yet — add invites in Celebr8 or add a walk-in below.</p>
        ) : null}
      </div>

      <div className="tabul8-add-person">
        <h3 className="h6">Add person</h3>
        <p className="small text-muted">Works mid-game. Creates a Celebr8 walk-in (or asks to link a match). Name required.</p>
        <div className="tabul8-toolbar flex-wrap">
          <input
            className="form-control form-control-sm"
            style={{ minWidth: 160 }}
            placeholder="Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="form-control form-control-sm"
            style={{ minWidth: 140 }}
            placeholder="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className="form-control form-control-sm"
            style={{ minWidth: 180 }}
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={busy || !name.trim()}
            onClick={() => void submitAdd()}
          >
            Add to board
          </button>
        </div>

        {pendingConfirm ? (
          <div className="tabul8-confirm-link mt-2">
            <p className="small mb-1">Confirm linking to an existing Celebr8 guest:</p>
            <div className="tabul8-toolbar flex-wrap">
              {pendingConfirm.candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  disabled={busy}
                  onClick={() => void submitAdd(c.id)}
                >
                  Link {c.name}{c.rsvp_status ? ` (${rsvpLabel(c.rsvp_status)})` : ''}
                </button>
              ))}
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={busy}
                onClick={() => setPendingConfirm(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
