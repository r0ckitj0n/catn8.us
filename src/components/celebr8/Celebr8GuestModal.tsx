import React from 'react';

import { ApiClient } from '../../core/ApiClient';
import {
  Celebr8GuestGroup,
  Celebr8RsvpNote,
  Celebr8RsvpStatus,
} from '../../types/celebr8';

export type Celebr8GuestDraft = {
  id?: number;
  name: string;
  phone: string;
  email: string;
  rsvp_status: Celebr8RsvpStatus;
  party_size: number;
  kids_count: number;
  invited_via: string;
  relation_label: string;
  bringing_chili: number;
  bringing: string;
  phone_unverified: number;
  notes: string;
};

const RSVP_OPTIONS: Array<{ value: Celebr8RsvpStatus; label: string }> = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'not_going', label: "Can't go" },
  { value: 'no_reply', label: 'No reply' },
];

function formatReceivedAt(value: string): string {
  if (!value) return '';
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusLabel(status: string): string {
  if (status === 'not_going') return "Can't go";
  return status.replace(/_/g, ' ');
}

type Props = {
  draft: Celebr8GuestDraft;
  groups: Celebr8GuestGroup[];
  guestGroupIds: number[];
  isAdmin: boolean;
  busy: boolean;
  partyId: number;
  onDraftChange: (next: Celebr8GuestDraft) => void;
  onGuestGroupIdsChange: (ids: number[]) => void;
  onClose: () => void;
  onSave: () => void;
  onRemove?: () => void;
};

export function Celebr8GuestModal({
  draft,
  groups,
  guestGroupIds,
  isAdmin,
  busy,
  partyId,
  onDraftChange,
  onGuestGroupIdsChange,
  onClose,
  onSave,
  onRemove,
}: Props) {
  const [history, setHistory] = React.useState<Celebr8RsvpNote[]>([]);
  const [historyLoaded, setHistoryLoaded] = React.useState(false);
  const [historyError, setHistoryError] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    if (!draft.id) {
      setHistory([]);
      setHistoryLoaded(true);
      setHistoryError('');
      return undefined;
    }
    setHistoryLoaded(false);
    setHistoryError('');
    void (async () => {
      try {
        const res = await ApiClient.get<{
          success: boolean;
          history: Celebr8RsvpNote[];
          error?: string;
        }>(`/api/celebr8.php?action=list_rsvp_history&guest_id=${draft.id}&party_id=${partyId}`);
        if (cancelled) return;
        setHistory(Array.isArray(res.history) ? res.history : []);
        setHistoryLoaded(true);
      } catch (err) {
        if (cancelled) return;
        setHistory([]);
        setHistoryLoaded(true);
        setHistoryError(err instanceof Error ? err.message : 'Could not load RSVP history');
      }
    })();
    return () => { cancelled = true; };
  }, [draft.id, partyId]);

  return (
    <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.45)' }} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title h5">
              {draft.id ? (isAdmin ? 'Edit guest' : 'Guest') : 'Add guest'}
            </h2>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="mb-2">
              <label className="form-label">Name</label>
              <input
                className="form-control"
                value={draft.name}
                disabled={!isAdmin}
                onChange={(e) => onDraftChange({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="mb-2">
              <label className="form-label">Phone</label>
              <input
                className="form-control"
                value={draft.phone}
                disabled={!isAdmin}
                onChange={(e) => onDraftChange({ ...draft, phone: e.target.value })}
              />
            </div>
            <div className="mb-2">
              <label className="form-label">RSVP</label>
              <select
                className="form-select"
                value={draft.rsvp_status}
                disabled={!isAdmin}
                onChange={(e) => onDraftChange({
                  ...draft,
                  rsvp_status: e.target.value as Celebr8RsvpStatus,
                })}
              >
                {RSVP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label">Notes</label>
              <textarea
                className="form-control"
                rows={2}
                value={draft.notes}
                disabled={!isAdmin}
                onChange={(e) => onDraftChange({ ...draft, notes: e.target.value })}
              />
            </div>
            {draft.id && groups.length > 0 && isAdmin ? (
              <div className="mb-3">
                <label className="form-label">Groups</label>
                <ul className="small mb-0">
                  {groups.map((g) => (
                    <li key={g.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={guestGroupIds.includes(g.id)}
                          onChange={() => onGuestGroupIdsChange(
                            guestGroupIds.includes(g.id)
                              ? guestGroupIds.filter((id) => id !== g.id)
                              : [...guestGroupIds, g.id],
                          )}
                        />
                        {' '}{g.name}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {draft.id ? (
              <div className="celebr8-rsvp-history">
                <h3 className="h6 mb-2">RSVP history</h3>
                {!historyLoaded ? (
                  <p className="small text-muted mb-0">Loading…</p>
                ) : historyError ? (
                  <p className="small text-danger mb-0">{historyError}</p>
                ) : history.length === 0 ? (
                  <p className="small text-muted mb-0">No RSVP replies recorded yet.</p>
                ) : (
                  <ul className="celebr8-rsvp-history-list">
                    {history.map((item) => (
                      <li key={item.id} className={`celebr8-rsvp-history-item celebr8-status-${item.status}`}>
                        <div className="celebr8-rsvp-history-meta">
                          <strong>{statusLabel(String(item.status))}</strong>
                          <span>{formatReceivedAt(item.received_at)}</span>
                          <span className="celebr8-rsvp-history-source">{item.source}</span>
                        </div>
                        {item.note ? <p className="celebr8-rsvp-history-note">{item.note}</p> : null}
                        {item.quote ? (
                          <blockquote className="celebr8-rsvp-history-quote">
                            <span className="visually-hidden">Exact text: </span>
                            {item.quote}
                          </blockquote>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
          <div className="modal-footer">
            {isAdmin && draft.id && onRemove ? (
              <button type="button" className="btn btn-outline-danger me-auto" onClick={onRemove}>
                Remove
              </button>
            ) : null}
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              {isAdmin ? 'Cancel' : 'Close'}
            </button>
            {isAdmin ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !draft.name.trim()}
                onClick={onSave}
              >
                Save
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
