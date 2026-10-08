import React from 'react';

import { ApiClient } from '../../core/ApiClient';
import {
  Celebr8AudienceType,
  Celebr8Guest,
  Celebr8GuestGroup,
  Celebr8Request,
  Celebr8RequestMessage,
  Celebr8RsvpStatus,
  Celebr8TextMessage,
} from '../../types/celebr8';
import { IToast } from '../../types/common';

type Props = {
  isAdmin: boolean;
  partyId?: number | null;
  guests?: Celebr8Guest[];
  groups?: Celebr8GuestGroup[];
  onToast?: (toast: IToast) => void;
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  notified: 'Notified',
  working: 'Working',
  needs_jon: 'Needs you',
  done: 'Done',
  failed: 'Failed',
};

export function Celebr8AskPanel({
  isAdmin,
  partyId = null,
  guests = [],
  groups = [],
  onToast,
}: Props) {
  const [busy, setBusy] = React.useState(false);
  const [requests, setRequests] = React.useState<Celebr8Request[]>([]);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [thread, setThread] = React.useState<Celebr8RequestMessage[]>([]);
  const [outbox, setOutbox] = React.useState<Celebr8TextMessage[]>([]);
  const [draft, setDraft] = React.useState('');
  const [followUp, setFollowUp] = React.useState('');
  const [showBefore, setShowBefore] = React.useState(true);
  const [audienceType, setAudienceType] = React.useState<Celebr8AudienceType>('none');
  const [audienceRsvp, setAudienceRsvp] = React.useState<Celebr8RsvpStatus | ''>('');
  const [audienceGroupId, setAudienceGroupId] = React.useState<number | ''>('');
  const [audienceGuestIds, setAudienceGuestIds] = React.useState<number[]>([]);

  const loadList = React.useCallback(async () => {
    const qs = new URLSearchParams({ limit: '30' });
    if (partyId && partyId > 0) qs.set('party_id', String(partyId));
    const res = await ApiClient.get<{ success: boolean; requests: Celebr8Request[] }>(
      `/api/celebr8.php?action=list_requests&${qs.toString()}`,
    );
    setRequests(res.requests || []);
  }, [partyId]);

  const loadDetail = React.useCallback(async (id: number) => {
    const res = await ApiClient.get<{
      success: boolean;
      request: Celebr8Request;
      thread: Celebr8RequestMessage[];
      outbox: Celebr8TextMessage[];
    }>(`/api/celebr8.php?action=get_request&request_id=${id}`);
    setSelectedId(id);
    setThread(res.thread || []);
    setOutbox(res.outbox || []);
  }, []);

  React.useEffect(() => {
    void loadList().catch((error: any) => {
      onToast?.({ tone: 'error', message: error?.message || 'Failed to load Celebr8r requests' });
    });
  }, [loadList, onToast]);

  const submitAsk = async () => {
    const text = draft.trim();
    if (!text) {
      onToast?.({ tone: 'error', message: 'Tell Celebr8r what you need' });
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        request_text: text,
        show_before_sending: showBefore ? 1 : 0,
        audience_type: audienceType,
      };
      if (partyId && partyId > 0) payload.party_id = partyId;
      if (audienceType === 'guests') payload.audience_guest_ids = audienceGuestIds;
      if (audienceType === 'rsvp') payload.audience_rsvp_status = audienceRsvp;
      if (audienceType === 'group' && audienceGroupId) payload.audience_group_id = audienceGroupId;

      const res = await ApiClient.post<{
        success: boolean;
        request: Celebr8Request;
        thread: Celebr8RequestMessage[];
      }>('/api/celebr8.php?action=create_request', payload);
      setDraft('');
      setAudienceType('none');
      setAudienceGuestIds([]);
      await loadList();
      if (res.request?.id) {
        setSelectedId(res.request.id);
        setThread(res.thread || []);
        setOutbox([]);
      }
      onToast?.({ tone: 'success', message: 'Asked Celebr8r — relay will wake the agent' });
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Could not ask Celebr8r' });
    } finally {
      setBusy(false);
    }
  };

  const submitFollowUp = async () => {
    if (!selectedId || !followUp.trim()) return;
    setBusy(true);
    try {
      const res = await ApiClient.post<{
        success: boolean;
        request: Celebr8Request;
        thread: Celebr8RequestMessage[];
        outbox: Celebr8TextMessage[];
      }>('/api/celebr8.php?action=reply_request', {
        request_id: selectedId,
        body: followUp.trim(),
      });
      setFollowUp('');
      setThread(res.thread || []);
      setOutbox(res.outbox || []);
      await loadList();
      onToast?.({ tone: 'success', message: 'Follow-up sent — Celebr8r will be re-notified' });
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Follow-up failed' });
    } finally {
      setBusy(false);
    }
  };

  const selected = requests.find((r) => r.id === selectedId) || null;

  return (
    <div className="celebr8-panel celebr8-ask-panel">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="h5 mb-0">Ask Celebr8r</h2>
        <button type="button" className="btn btn-link btn-sm" onClick={() => void loadList()}>Refresh</button>
      </div>
      <p className="small text-muted mb-2">Celebr8r drafts texts; the Mac relay sends them from the outbox.</p>

      {isAdmin ? (
        <div className="celebr8-ask-compose mb-3">
          <textarea className="form-control mb-2" rows={3} placeholder={partyId ? 'Remind maybes about chili…' : 'Nudge Halloween no-replies…'} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <label className="form-check mb-2">
            <input className="form-check-input" type="checkbox" checked={showBefore} onChange={(e) => setShowBefore(e.target.checked)} />
            <span className="form-check-label">Show me before sending</span>
          </label>
          {partyId ? (
            <div className="celebr8-toolbar mb-2 flex-wrap">
              <select className="form-select form-select-sm" value={audienceType} onChange={(e) => setAudienceType(e.target.value as Celebr8AudienceType)} aria-label="Audience">
                <option value="none">Audience: Celebr8r decides</option>
                <option value="guests">Specific guests</option>
                <option value="rsvp">RSVP filter</option>
                <option value="group">Saved group</option>
              </select>
              {audienceType === 'rsvp' ? (
                <select className="form-select form-select-sm" value={audienceRsvp} onChange={(e) => setAudienceRsvp(e.target.value as Celebr8RsvpStatus | '')}>
                  <option value="">Pick RSVP…</option>
                  <option value="going">Going</option>
                  <option value="maybe">Maybe</option>
                  <option value="not_going">Can&apos;t go</option>
                  <option value="no_reply">No reply</option>
                </select>
              ) : null}
              {audienceType === 'group' ? (
                <select className="form-select form-select-sm" value={audienceGroupId} onChange={(e) => setAudienceGroupId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Pick group…</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.member_count})</option>)}
                </select>
              ) : null}
            </div>
          ) : null}
          {audienceType === 'guests' && partyId ? (
            <ul className="small mb-2" style={{ maxHeight: 120, overflow: 'auto' }}>
              {guests.map((g) => (
                <li key={g.id}>
                  <label>
                    <input type="checkbox" checked={audienceGuestIds.includes(g.id)} onChange={() => setAudienceGuestIds((prev) => (prev.includes(g.id) ? prev.filter((id) => id !== g.id) : [...prev, g.id]))} />
                    {' '}{g.name}
                  </label>
                </li>
              ))}
            </ul>
          ) : null}
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || !draft.trim()} onClick={() => void submitAsk()}>Ask Celebr8r</button>
        </div>
      ) : <p className="small text-muted">Only admins can ask Celebr8r.</p>}

      <div className="celebr8-ask-layout">
        <ul className="celebr8-ask-list">
          {requests.length === 0 ? <li className="text-muted small">No asks yet.</li> : null}
          {requests.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={`celebr8-ask-item${selectedId === r.id ? ' is-active' : ''}`}
                onClick={() => void loadDetail(r.id)}
              >
                <span className={`celebr8-ask-status celebr8-ask-status-${r.status}`}>
                  {STATUS_LABEL[r.status] || r.status}
                </span>
                <strong>{r.preview || r.request_text}</strong>
                <small>
                  {r.party_title || (r.party_id ? `Party #${r.party_id}` : 'All parties')}
                  {' · '}
                  {r.created_at}
                </small>
              </button>
            </li>
          ))}
        </ul>

        <div className="celebr8-ask-thread">
          {!selected ? (
            <p className="small text-muted mb-0">Select a request to see Celebr8r&apos;s replies and queued texts.</p>
          ) : (
            <>
              <div className="small text-muted mb-2">
                Status: <strong>{STATUS_LABEL[selected.status] || selected.status}</strong>
                {selected.show_before_sending ? ' · show before send' : ' · send when ready'}
              </div>
              <ul className="celebr8-ask-messages">
                {thread.map((m) => (
                  <li key={m.id} className={`celebr8-ask-msg celebr8-ask-msg-${m.author_role}`}>
                    <span>{m.author_role === 'jon' ? 'You' : m.author_role === 'celebr8r' ? 'Celebr8r' : 'System'}</span>
                    <p>{m.body}</p>
                    <small>{m.created_at}</small>
                  </li>
                ))}
              </ul>
              {outbox.length > 0 ? (
                <div className="celebr8-ask-outbox mt-2">
                  <h3 className="h6">Texts from this ask</h3>
                  <ul className="small mb-0">
                    {outbox.map((m) => (
                      <li key={m.id}>
                        #{m.id} → {m.to_address}: <strong>{m.status}</strong>
                        {m.error_text ? ` (${m.error_text})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {isAdmin ? (
                <div className="mt-2">
                  <textarea
                    className="form-control form-control-sm mb-1"
                    rows={2}
                    placeholder="Follow up (sets status back to pending)"
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    disabled={busy || !followUp.trim()}
                    onClick={() => void submitFollowUp()}
                  >
                    Send follow-up
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
