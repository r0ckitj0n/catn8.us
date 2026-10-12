import React from 'react';

import { ApiClient } from '../../core/ApiClient';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { TABUL8_FACE_NOTICE, Tabul8Board, Tabul8Category, Tabul8Entry } from '../../types/tabul8';
import { PageLayout } from '../layout/PageLayout';
import {
  TABUL8_GREET_THRESHOLD,
  TABUL8_MATCH_THRESHOLD,
  computeFaceEmbedding,
  detectAndMatchGreeting,
  getOrCreateDeviceToken,
  loadTabul8FaceApi,
  type PackIdentity,
} from '../tabul8/tabul8Face';
import { Tabul8KioskFlow } from '../tabul8/Tabul8KioskFlow';
import { Tabul8ParticipantsPanel } from '../tabul8/Tabul8ParticipantsPanel';
import {
  parseTabul8Path,
  tabul8AdminHref,
  tabul8CameraHref,
  tabul8DisplayHref,
  tabul8KioskVoteHref,
} from '../tabul8/tabul8Paths';
import { useTabul8Board } from '../../hooks/useTabul8Board';
import '../tabul8/Tabul8Css.css';

function qrUrl(target: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(target)}`;
}

function AbsoluteUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}

function phoneLinkQuery(): { exp: number; sig: string } {
  if (typeof window === 'undefined') return { exp: 0, sig: '' };
  const q = new URLSearchParams(window.location.search);
  return {
    exp: Number(q.get('exp') || 0) || 0,
    sig: q.get('sig') || '',
  };
}

export function Tabul8Page({
  viewer,
  onLoginClick,
  onLogout,
  onAccountClick,
  mysteryTitle,
  onToast,
}: AppShellPageProps) {
  const { mode, partyId, voteToken } = parseTabul8Path();
  const isAuthed = Boolean(viewer?.id);

  // Optional phone/QR path — signed token checked by API (may be unauthenticated).
  if (mode === 'vote') {
    const { exp, sig } = phoneLinkQuery();
    return (
      <Tabul8KioskVote
        mode="phone"
        voteToken={voteToken}
        phoneExp={exp}
        phoneSig={sig}
        partyId={0}
        viewer={viewer}
        onLoginClick={onLoginClick}
        onLogout={onLogout}
        onAccountClick={onAccountClick}
        mysteryTitle={mysteryTitle}
        onToast={onToast}
      />
    );
  }

  if (!isAuthed) {
    return (
      <PageLayout page="tabul8" title="TABUL8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
        <section className="section tabul8-page">
          <div className="tabul8-hero"><h1>TABUL8</h1><p>Sign in to run live party voting.</p></div>
          <button type="button" className="btn btn-primary" onClick={onLoginClick}>Log in</button>
        </section>
      </PageLayout>
    );
  }

  if (mode === 'hub') {
    return (
      <Tabul8Hub
        viewer={viewer}
        onLoginClick={onLoginClick}
        onLogout={onLogout}
        onAccountClick={onAccountClick}
        mysteryTitle={mysteryTitle}
        onToast={onToast}
      />
    );
  }

  if (mode === 'camera') {
    return (
      <Tabul8CameraView
        partyId={partyId}
        viewer={viewer}
        onLoginClick={onLoginClick}
        onLogout={onLogout}
        onAccountClick={onAccountClick}
        mysteryTitle={mysteryTitle}
        onToast={onToast}
      />
    );
  }

  if (mode === 'display') {
    return (
      <Tabul8DisplayView
        partyId={partyId}
        viewer={viewer}
        onLoginClick={onLoginClick}
        onLogout={onLogout}
        onAccountClick={onAccountClick}
        mysteryTitle={mysteryTitle}
        onToast={onToast}
      />
    );
  }

  if (mode === 'kiosk') {
    return <Tabul8KioskFlow partyId={partyId} onToast={onToast} />;
  }

  return (
    <Tabul8AdminView
      partyId={partyId}
      viewer={viewer}
      onLoginClick={onLoginClick}
      onLogout={onLogout}
      onAccountClick={onAccountClick}
      mysteryTitle={mysteryTitle}
      onToast={onToast}
    />
  );
}

function Tabul8IdentityAdmin({
  boardId,
  partyId,
  onToast,
}: {
  boardId: number;
  partyId: number;
  onToast?: AppShellPageProps['onToast'];
}) {
  type IdentRow = {
    id: number;
    display_name: string;
    guest_id?: number | null;
    pending_guest_id?: number | null;
    admin_named?: number;
    greetable?: number;
    from_photos_unlinked?: number;
    label?: string;
    embedding_count?: number;
    stale_embedding_count?: number;
  };
  const [identities, setIdentities] = React.useState<IdentRow[]>([]);
  const [guests, setGuests] = React.useState<Array<{ id: number; name: string }>>([]);
  const [votes, setVotes] = React.useState<Array<{
    id: number; category_name: string; entry_label: string; identity_name: string;
    match_confidence: number | null; is_void: number;
  }>>([]);
  const [nameDrafts, setNameDrafts] = React.useState<Record<number, string>>({});
  const [linkDrafts, setLinkDrafts] = React.useState<Record<number, number>>({});
  const [mergeKeep, setMergeKeep] = React.useState(0);
  const [mergeAbsorb, setMergeAbsorb] = React.useState(0);

  const load = React.useCallback(async () => {
    const [idents, audit, guestRes] = await Promise.all([
      ApiClient.get<{ identities: IdentRow[] }>('/api/tabul8.php?action=list_identities'),
      ApiClient.get<{ votes: typeof votes }>(`/api/tabul8.php?action=list_vote_audit&board_id=${boardId}`),
      ApiClient.get<{ guests?: Array<{ id: number; name: string }> }>(
        `/api/celebr8.php?action=list_guests&event_id=${partyId}`,
      ).catch(() => ({ guests: [] })),
    ]);
    setIdentities(idents.identities || []);
    setVotes(audit.votes || []);
    setGuests(guestRes.guests || []);
  }, [boardId, partyId]);

  React.useEffect(() => { void load().catch(() => undefined); }, [load]);

  const guestName = (id?: number | null) => {
    if (!id) return '';
    return guests.find((g) => g.id === id)?.name || `#${id}`;
  };

  return (
    <div className="tabul8-panel">
      <div className="d-flex justify-content-between flex-wrap gap-2 mb-2">
        <h2 className="h5 mb-0">Identities & vote audit</h2>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void load()}>Reload</button>
      </div>
      <p className="small text-muted">
        Persistent across parties (no auto-delete). Only <strong>linked guests</strong> or identities you
        explicitly <strong>Save</strong>-name are greeted on the kiosk. Photos people without a link show as
        <em> From Photos (unlinked)</em> — rename / link / purge as needed. JT Whetstone is never linked.
        Pipeline <code>2.0-arcface</code> embeddings only (stale unaligned ignored until Compil8r rerun).
      </p>
      <div className="table-responsive mb-3" style={{ maxHeight: 320, overflow: 'auto' }}>
        <table className="table table-sm align-middle mb-0">
          <thead><tr><th>ID</th><th>Name</th><th>Status</th><th>Guest</th><th>#emb</th><th /></tr></thead>
          <tbody>
            {identities.map((i) => {
              const pendingIan = Number(i.pending_guest_id) === 42
                || (guestName(i.pending_guest_id).toLowerCase().includes('ian pilsbury'));
              const unlinked = Number(i.from_photos_unlinked) === 1;
              return (
              <tr key={i.id} className={pendingIan ? 'table-warning' : unlinked ? 'table-light' : ''}>
                <td>{i.id}</td>
                <td>
                  <input
                    className="form-control form-control-sm"
                    value={nameDrafts[i.id] ?? i.display_name}
                    onChange={(e) => setNameDrafts((d) => ({ ...d, [i.id]: e.target.value }))}
                  />
                  {unlinked ? (
                    <div className="small text-muted">From Photos (unlinked)</div>
                  ) : null}
                  {pendingIan ? (
                    <div className="small text-danger fw-semibold">Confirm link → Ian Pilsbury (guest 42)?</div>
                  ) : null}
                </td>
                <td className="small">
                  {Number(i.greetable) === 1 ? 'Greetable' : 'No greet'}
                  {Number(i.stale_embedding_count) > 0 ? (
                    <div className="text-warning">{i.stale_embedding_count} stale</div>
                  ) : null}
                </td>
                <td>
                  {i.guest_id ? (
                    <span>{guestName(i.guest_id)} <span className="text-muted">#{i.guest_id}</span></span>
                  ) : i.pending_guest_id ? (
                    <span className="text-warning">pending {guestName(i.pending_guest_id)}</span>
                  ) : '—'}
                  <div className="mt-1">
                    <select
                      className="form-select form-select-sm"
                      value={linkDrafts[i.id] ?? i.pending_guest_id ?? i.guest_id ?? 0}
                      onChange={(e) => setLinkDrafts((d) => ({ ...d, [i.id]: Number(e.target.value) || 0 }))}
                    >
                      <option value={0}>Link guest…</option>
                      {guests.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                </td>
                <td>{i.embedding_count ?? '—'}</td>
                <td className="text-nowrap">
                  <button
                    type="button"
                    className="btn btn-link btn-sm px-1"
                    onClick={() => {
                      void ApiClient.post('/api/tabul8.php?action=name_identity', {
                        identity_id: i.id,
                        display_name: nameDrafts[i.id] ?? i.display_name,
                      }).then(() => { onToast?.({ tone: 'success', message: 'Named (greetable)' }); void load(); });
                    }}
                  >
                    Save
                  </button>
                  {i.pending_guest_id ? (
                    <button
                      type="button"
                      className="btn btn-link btn-sm px-1"
                      onClick={() => {
                        void ApiClient.post('/api/tabul8.php?action=confirm_pending_guest', {
                          identity_id: i.id,
                          guest_id: linkDrafts[i.id] || i.pending_guest_id,
                        }).then(() => { onToast?.({ tone: 'success', message: 'Guest link confirmed' }); void load(); });
                      }}
                    >
                      Confirm link
                    </button>
                  ) : null}
                  {(linkDrafts[i.id] || 0) > 0 && !i.pending_guest_id ? (
                    <button
                      type="button"
                      className="btn btn-link btn-sm px-1"
                      onClick={() => {
                        void ApiClient.post('/api/tabul8.php?action=link_identity_guest', {
                          identity_id: i.id,
                          guest_id: linkDrafts[i.id],
                        }).then(() => { onToast?.({ tone: 'success', message: 'Linked' }); void load(); });
                      }}
                    >
                      Link
                    </button>
                  ) : null}
                  {i.guest_id ? (
                    <button
                      type="button"
                      className="btn btn-link btn-sm px-1"
                      onClick={() => {
                        void ApiClient.post('/api/tabul8.php?action=unlink_identity_guest', { identity_id: i.id })
                          .then(() => { onToast?.({ tone: 'success', message: 'Unlinked' }); void load(); });
                      }}
                    >
                      Unlink
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-danger px-1"
                    onClick={() => {
                      if (!window.confirm(`Purge identity #${i.id}?`)) return;
                      void ApiClient.post('/api/tabul8.php?action=purge_identity', { identity_id: i.id })
                        .then(() => { onToast?.({ tone: 'success', message: 'Purged' }); void load(); });
                    }}
                  >
                    Purge
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="tabul8-toolbar mb-3">
        <input className="form-control form-control-sm" style={{ width: 90 }} placeholder="Keep id" value={mergeKeep || ''} onChange={(e) => setMergeKeep(Number(e.target.value) || 0)} />
        <input className="form-control form-control-sm" style={{ width: 90 }} placeholder="Absorb id" value={mergeAbsorb || ''} onChange={(e) => setMergeAbsorb(Number(e.target.value) || 0)} />
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          disabled={!mergeKeep || !mergeAbsorb}
          onClick={() => {
            void ApiClient.post('/api/tabul8.php?action=merge_identities', { keep_id: mergeKeep, absorb_id: mergeAbsorb })
              .then(() => { onToast?.({ tone: 'success', message: 'Merged' }); setMergeAbsorb(0); void load(); });
          }}
        >
          Merge identities
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-danger"
          onClick={() => {
            if (!window.confirm('Purge ALL identities and embeddings? This cannot be undone.')) return;
            void ApiClient.post('/api/tabul8.php?action=purge_all_identities', { confirm: 1 })
              .then(() => { onToast?.({ tone: 'success', message: 'All identities purged' }); void load(); });
          }}
        >
          Purge all identities
        </button>
      </div>
      <h3 className="h6">Recent votes</h3>
      <div className="table-responsive" style={{ maxHeight: 200, overflow: 'auto' }}>
        <table className="table table-sm mb-0">
          <thead><tr><th>When</th><th>Category</th><th>Entry</th><th>Who</th><th>Conf</th><th /></tr></thead>
          <tbody>
            {votes.slice(0, 40).map((v) => (
              <tr key={v.id} className={v.is_void ? 'table-secondary' : ''}>
                <td className="small">{v.id}</td>
                <td>{v.category_name}</td>
                <td>{v.entry_label}</td>
                <td>{v.identity_name || '—'}</td>
                <td>{v.match_confidence != null ? v.match_confidence.toFixed(2) : '—'}</td>
                <td>
                  {!v.is_void ? (
                    <button
                      type="button"
                      className="btn btn-link btn-sm px-1"
                      onClick={() => {
                        void ApiClient.post('/api/tabul8.php?action=void_vote', { vote_id: v.id, board_id: boardId })
                          .then(() => { onToast?.({ tone: 'success', message: 'Vote voided — tallies refresh' }); void load(); });
                      }}
                    >
                      Void
                    </button>
                  ) : 'void'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small text-muted mb-0 mt-1">Party {partyId} · voiding re-counts via live tallies (voided votes excluded).</p>
    </div>
  );
}

function Tabul8Hub(props: AppShellPageProps) {
  const [parties, setParties] = React.useState<Array<{ id: number; title: string; event_date?: string }>>([]);
  React.useEffect(() => {
    void (async () => {
      try {
        const res = await ApiClient.get<{ success: boolean; events: Array<{ id: number; title: string; event_date?: string }> }>(
          '/api/celebr8.php?action=list_events',
        );
        setParties(res.events || []);
      } catch (error: any) {
        props.onToast?.({ tone: 'error', message: error?.message || 'Failed to list parties' });
      }
    })();
  }, [props]);

  return (
    <PageLayout page="tabul8" title="TABUL8" viewer={props.viewer} onLoginClick={props.onLoginClick} onLogout={props.onLogout} onAccountClick={props.onAccountClick} mysteryTitle={props.mysteryTitle}>
      <section className="section tabul8-page">
        <div className="tabul8-hero">
          <h1>TABUL8</h1>
          <p className="mb-0">Live party voting — pick a Celebr8 party to open the board.</p>
        </div>
        <div className="tabul8-panel">
          <ul className="list-unstyled mb-0">
            {parties.map((p) => (
              <li key={p.id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                <div>
                  <strong>{p.title}</strong>
                  <div className="small text-muted">{p.event_date || 'TBD'}</div>
                </div>
                <a className="btn btn-sm btn-primary" href={tabul8AdminHref(p.id)}>Open board</a>
              </li>
            ))}
          </ul>
          {parties.length === 0 ? <p className="text-muted mb-0">No parties yet — create one in Celebr8.</p> : null}
        </div>
      </section>
    </PageLayout>
  );
}

function Tabul8AdminView({
  partyId,
  viewer,
  onLoginClick,
  onLogout,
  onAccountClick,
  mysteryTitle,
  onToast,
}: AppShellPageProps & { partyId: number }) {
  const { busy, board, categories, entries, partyTitle, refresh, post } = useTabul8Board(partyId, onToast);
  const [activeCat, setActiveCat] = React.useState<number>(0);
  const [newCatName, setNewCatName] = React.useState('');
  const [editEntry, setEditEntry] = React.useState<Tabul8Entry | null>(null);

  React.useEffect(() => {
    if (categories.length && !categories.find((c) => c.id === activeCat)) {
      setActiveCat(categories[0].id);
    }
  }, [categories, activeCat]);

  const catEntries = entries.filter((e) => e.category_id === activeCat);
  const phoneOpen = Number(board?.phone_voting_open || 0) === 1;
  const [phoneLink, setPhoneLink] = React.useState('');
  const [phoneExpLabel, setPhoneExpLabel] = React.useState('');

  React.useEffect(() => {
    // Live refresh so labels appear as snaps are labeled.
    const t = window.setInterval(() => { void refresh(); }, 3000);
    return () => window.clearInterval(t);
  }, [refresh]);

  const mintPhoneLink = async () => {
    if (!board) return;
    const res = await post('mint_phone_vote_link', { board_id: board.id }) as {
      link?: { url_path?: string; exp?: number; phone_voting_open?: number };
    };
    const path = res.link?.url_path || '';
    setPhoneLink(path ? AbsoluteUrl(path) : '');
    setPhoneExpLabel(res.link?.exp ? new Date(res.link.exp * 1000).toLocaleTimeString() : '');
  };

  return (
    <PageLayout page="tabul8" title="TABUL8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className="section tabul8-page">
        <div className="tabul8-hero d-flex justify-content-between flex-wrap gap-2">
          <div>
            <p className="mb-0"><a href="/tabul8">← Tabul8</a> · <a href={`/celebr8/party/${partyId}`}>Celebr8 party</a></p>
            <h1>{partyTitle || 'Party'} — Tabul8</h1>
          </div>
          <div className="tabul8-toolbar">
            <a className="btn btn-sm btn-primary" href={tabul8KioskVoteHref(partyId)}>Kiosk vote</a>
            <a className="btn btn-sm btn-outline-secondary" href={tabul8CameraHref(partyId)}>Camera station</a>
            <a className="btn btn-sm btn-outline-secondary" href={tabul8DisplayHref(partyId)}>Big screen</a>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => void refresh()}>Refresh</button>
          </div>
        </div>

        {board ? (
          <div className="tabul8-panel">
            <div className="tabul8-toolbar mb-2">
              <label className="small mb-0">
                <input
                  type="checkbox"
                  checked={Number(board.voting_open) === 1}
                  onChange={(e) => void post('update_board', { board_id: board.id, voting_open: e.target.checked ? 1 : 0 })}
                />{' '}
                Party voting open
              </label>
              <label className="small mb-0">
                <input
                  type="checkbox"
                  checked={phoneOpen}
                  onChange={(e) => {
                    void post('update_board', { board_id: board.id, phone_voting_open: e.target.checked ? 1 : 0 }).then(() => {
                      setPhoneLink('');
                      setPhoneExpLabel('');
                    });
                  }}
                />{' '}
                Phone / QR voting (off by default)
              </label>
              <label className="small mb-0">
                <input
                  type="checkbox"
                  checked={Number(board.show_bars) === 1}
                  onChange={(e) => void post('update_board', { board_id: board.id, show_bars: e.target.checked ? 1 : 0 })}
                />{' '}
                Show vote bars on display
              </label>
              <label className="small mb-0">
                <input
                  type="checkbox"
                  checked={Number(board.reveal_winners) === 1}
                  onChange={(e) => void post('update_board', { board_id: board.id, reveal_winners: e.target.checked ? 1 : 0 })}
                />{' '}
                Reveal winners
              </label>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={busy}
                onClick={() => void post('save_results', { board_id: board.id }).then(() => onToast?.({ tone: 'success', message: 'Results saved to party' }))}
              >
                Save results
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm('Purge legacy party-scoped vote embeddings only? Persistent identities are kept.')) return;
                  void post('purge_face_data', { party_id: partyId }).then(() => onToast?.({ tone: 'success', message: 'Legacy party embeddings purged' }));
                }}
              >
                Purge party embeddings
              </button>
            </div>
            <p className="small mb-1">
              Primary voting: logged-in <a href={tabul8KioskVoteHref(partyId)}>kiosk device</a>
              {' '}({AbsoluteUrl(tabul8KioskVoteHref(partyId))}).
              Face greet threshold {TABUL8_GREET_THRESHOLD}; vote match {TABUL8_MATCH_THRESHOLD} (ArcFace-aligned pipeline).
            </p>
            {phoneOpen ? (
              <div className="mt-2">
                <div className="tabul8-toolbar mb-1">
                  <button type="button" className="btn btn-sm btn-outline-primary" disabled={busy} onClick={() => void mintPhoneLink()}>
                    Mint short-lived phone QR (~15 min)
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm('Rotate the base vote token? Existing phone QRs stop working.')) return;
                      void post('rotate_vote_token', { board_id: board.id }).then(() => {
                        setPhoneLink('');
                        onToast?.({ tone: 'success', message: 'Vote token rotated' });
                      });
                    }}
                  >
                    Rotate base token
                  </button>
                </div>
                {phoneLink ? (
                  <>
                    <code className="small d-block mb-1">{phoneLink}</code>
                    <div className="tabul8-qr mt-2">
                      <img src={qrUrl(phoneLink)} alt="Voting QR" />
                      <div className="small">Scan to vote{phoneExpLabel ? ` · expires ${phoneExpLabel}` : ''}</div>
                    </div>
                  </>
                ) : (
                  <p className="small text-muted mb-0">Mint a link to show the QR. Links expire (~15 minutes) and require the face check.</p>
                )}
              </div>
            ) : (
              <p className="small text-muted mb-0">Phone/QR voting is off — big screen hides the QR.</p>
            )}
            <p className="tabul8-notice mt-2 mb-0">{TABUL8_FACE_NOTICE}</p>
          </div>
        ) : null}

        {board ? (
          <Tabul8ParticipantsPanel
            boardId={board.id}
            partyId={partyId}
            busy={busy}
            onToast={onToast}
          />
        ) : null}

        {board ? <Tabul8IdentityAdmin boardId={board.id} partyId={partyId} onToast={onToast} /> : null}

        <div className="tabul8-panel">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
            <h2 className="h5 mb-0">Categories</h2>
            <div className="tabul8-toolbar">
              <input className="form-control form-control-sm" style={{ maxWidth: 180 }} placeholder="New category" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={busy || !newCatName.trim() || !board}
                onClick={() => {
                  void post('upsert_category', { board_id: board!.id, name: newCatName.trim() }).then(() => setNewCatName(''));
                }}
              >
                Add
              </button>
            </div>
          </div>
          <div className="tabul8-cats">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`tabul8-cat-chip${activeCat === c.id ? ' active' : ''}${Number(c.voting_open) === 1 ? ' open' : ''}`}
                onClick={() => setActiveCat(c.id)}
              >
                {c.name}{Number(c.voting_open) === 1 ? ' · open' : ''}
              </button>
            ))}
          </div>
          {activeCat > 0 ? (
            <div className="tabul8-toolbar mb-3">
              <button
                type="button"
                className="btn btn-sm btn-success"
                disabled={busy}
                onClick={() => void post('set_category_voting', { category_id: activeCat, voting_open: 1 })}
              >
                Open voting
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={busy}
                onClick={() => void post('set_category_voting', { category_id: activeCat, voting_open: 0 })}
              >
                Close voting
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm('Delete this category and its entries/votes?')) return;
                  void post('delete_category', { category_id: activeCat });
                }}
              >
                Delete category
              </button>
            </div>
          ) : null}

          <h3 className="h6">Entries</h3>
          <div className="tabul8-entry-grid">
            {catEntries.map((e) => (
              <div key={e.id} className="tabul8-entry-card">
                {e.photo_thumb_url || e.photo_url ? <img src={e.photo_thumb_url || e.photo_url || ''} alt="" /> : <div style={{ aspectRatio: 1, background: '#ddd' }} />}
                <div className="meta">
                  <strong>{e.label || `Entry #${e.id}`}</strong>
                  <div className="small text-muted">{e.vote_count ?? 0} votes</div>
                  <div className="tabul8-toolbar justify-content-center mt-1">
                    <button type="button" className="btn btn-link btn-sm px-1" onClick={() => setEditEntry(e)}>Edit</button>
                    <button
                      type="button"
                      className="btn btn-link btn-sm px-1"
                      onClick={() => void post('request_entry_label', { entry_id: e.id }).then(() => onToast?.({ tone: 'success', message: 'Label request queued for Celebr8r' }))}
                    >
                      Ask Celebr8r
                    </button>
                    <button
                      type="button"
                      className="btn btn-link btn-sm text-danger px-1"
                      onClick={() => {
                        if (!window.confirm('Delete entry?')) return;
                        void post('delete_entry', { entry_id: e.id });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {catEntries.length === 0 ? <p className="text-muted">No entries yet — use the Camera station.</p> : null}
        </div>

        <VotesPanel board={board} categories={categories} onToast={onToast} refresh={refresh} />
      </section>

      {editEntry ? (
        <EntryEditModal
          entry={editEntry}
          categories={categories}
          onClose={() => setEditEntry(null)}
          onSave={async (fields) => {
            await post('upsert_entry', fields);
            setEditEntry(null);
            onToast?.({ tone: 'success', message: 'Entry updated' });
          }}
          onMerge={async (targetId, sourceId) => {
            await post('merge_entries', { target_id: targetId, source_id: sourceId });
            setEditEntry(null);
            onToast?.({ tone: 'success', message: 'Entries merged' });
          }}
        />
      ) : null}
    </PageLayout>
  );
}

function VotesPanel({
  board,
  categories,
  onToast,
  refresh,
}: {
  board: Tabul8Board | null;
  categories: Tabul8Category[];
  onToast?: AppShellPageProps['onToast'];
  refresh: () => Promise<void>;
}) {
  const [votes, setVotes] = React.useState<Array<{ id: number; category_id: number; entry_id: number; is_void: number; created_at: string }>>([]);
  React.useEffect(() => {
    if (!board) return;
    void (async () => {
      try {
        const res = await ApiClient.get<{ success: boolean; votes: typeof votes }>(
          `/api/tabul8.php?action=list_votes&board_id=${board.id}&include_void=1`,
        );
        setVotes(res.votes || []);
      } catch {
        /* ignore */
      }
    })();
  }, [board]);

  const catName = (id: number) => categories.find((c) => c.id === id)?.name || `#${id}`;

  return (
    <div className="tabul8-panel">
      <h2 className="h5">Votes</h2>
      <div className="table-responsive">
        <table className="table table-sm">
          <thead><tr><th>ID</th><th>Category</th><th>Entry</th><th>When</th><th></th></tr></thead>
          <tbody>
            {votes.slice(0, 80).map((v) => (
              <tr key={v.id} className={Number(v.is_void) === 1 ? 'table-secondary' : ''}>
                <td>{v.id}</td>
                <td>{catName(v.category_id)}</td>
                <td>{v.entry_id}</td>
                <td className="small">{v.created_at}</td>
                <td>
                  {Number(v.is_void) === 1 ? (
                    <span className="small text-muted">void</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-link btn-sm text-danger px-0"
                      onClick={() => {
                        void ApiClient.post('/api/tabul8.php?action=void_vote', { vote_id: v.id })
                          .then(() => refresh())
                          .then(() => onToast?.({ tone: 'success', message: 'Vote voided; counts refreshed' }))
                          .catch((error: any) => onToast?.({ tone: 'error', message: error?.message || 'Void failed' }));
                      }}
                    >
                      Void
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EntryEditModal({
  entry,
  categories,
  onClose,
  onSave,
  onMerge,
}: {
  entry: Tabul8Entry;
  categories: Tabul8Category[];
  onClose: () => void;
  onSave: (fields: Record<string, unknown>) => Promise<void>;
  onMerge: (targetId: number, sourceId: number) => Promise<void>;
}) {
  const [label, setLabel] = React.useState(entry.label || '');
  const [description, setDescription] = React.useState(entry.description || '');
  const [categoryId, setCategoryId] = React.useState(entry.category_id);
  const [mergeInto, setMergeInto] = React.useState('');

  return (
    <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.45)' }} role="dialog">
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title h5">Edit entry #{entry.id}</h2>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body">
            <label className="form-label">Label</label>
            <input className="form-control mb-2" value={label} onChange={(e) => setLabel(e.target.value)} />
            <label className="form-label">Description</label>
            <textarea className="form-control mb-2" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            <label className="form-label">Category</label>
            <select className="form-select mb-2" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label className="form-label">Merge this entry into (target entry id)</label>
            <input className="form-control" value={mergeInto} onChange={(e) => setMergeInto(e.target.value)} placeholder="Target entry id" />
          </div>
          <div className="modal-footer">
            {mergeInto ? (
              <button type="button" className="btn btn-warning" onClick={() => void onMerge(Number(mergeInto), entry.id)}>Merge into target</button>
            ) : null}
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void onSave({ id: entry.id, label, description, category_id: categoryId })}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tabul8CameraView({
  partyId,
  viewer,
  onLoginClick,
  onLogout,
  onAccountClick,
  mysteryTitle,
  onToast,
}: AppShellPageProps & { partyId: number }) {
  const { busy, board, categories, partyTitle, refresh } = useTabul8Board(partyId, onToast);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [categoryId, setCategoryId] = React.useState(0);
  const [label, setLabel] = React.useState('');
  const [streamReady, setStreamReady] = React.useState(false);
  const [checkInMode, setCheckInMode] = React.useState(false);
  const [guests, setGuests] = React.useState<Array<{ id: number; name: string }>>([]);
  const [guestId, setGuestId] = React.useState(0);
  const [enrollName, setEnrollName] = React.useState('');

  React.useEffect(() => {
    if (categories.length && categoryId === 0) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  React.useEffect(() => {
    void ApiClient.get<{ guests?: Array<{ id: number; name: string }> }>(
      `/api/celebr8.php?action=list_guests&event_id=${partyId}`,
    ).then((res) => setGuests(res.guests || [])).catch(() => {
      // Fallback: empty list — Unknown #n still works
      setGuests([]);
    });
  }, [partyId]);

  React.useEffect(() => {
    let stream: MediaStream | null = null;
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStreamReady(true);
        }
      } catch (error: any) {
        onToast?.({ tone: 'error', message: error?.message || 'Camera permission denied' });
      }
    })();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onToast]);

  const enrollCheckIn = async () => {
    if (!videoRef.current) return;
    try {
      await loadTabul8FaceApi();
      const embedding = await computeFaceEmbedding(videoRef.current);
      const res = await ApiClient.post<{
        created?: boolean;
        identity?: { display_name?: string; id?: number };
      }>('/api/tabul8.php?action=checkin_enroll', {
        party_id: partyId,
        embedding,
        guest_id: guestId || null,
        display_name: enrollName.trim() || undefined,
      });
      onToast?.({
        tone: 'success',
        message: res.created
          ? `Enrolled ${res.identity?.display_name || 'guest'}`
          : `Updated ${res.identity?.display_name || 'identity'}`,
      });
      setEnrollName('');
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Check-in failed' });
    }
  };

  const snapAndUpload = async (requestLabel: boolean) => {
    if (!videoRef.current || !categoryId) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) {
      onToast?.({ tone: 'error', message: 'Could not capture frame' });
      return;
    }
    const fd = new FormData();
    fd.append('party_id', String(partyId));
    fd.append('category_id', String(categoryId));
    fd.append('label', label);
    fd.append('request_label', requestLabel ? '1' : '0');
    fd.append('file', blob, `tabul8-${Date.now()}.jpg`);
    try {
      const res = await ApiClient.postFormData<{
        success: boolean;
        entry?: { label?: string; label_source?: string };
        label_result?: { source?: string; error?: string };
      }>('/api/tabul8.php?action=upload_entry_photo', fd);
      const src = res.label_result?.source || res.entry?.label_source || '';
      let msg = 'Captured';
      if (requestLabel || src) {
        if (src === 'openai') msg = `Captured — labeled “${res.entry?.label || ''}”`;
        else if (src === 'celebr8r') msg = 'Captured — queued Celebr8r label';
        else if (src === 'manual') msg = 'Captured — label left for manual edit';
        else if (src === 'provided') msg = 'Captured — using your label';
        else if (requestLabel) msg = 'Captured — labeling attempted';
      }
      onToast?.({ tone: 'success', message: msg });
      setLabel('');
      await refresh();
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Upload failed' });
    }
  };

  return (
    <PageLayout page="tabul8" title="TABUL8 Camera" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className="section tabul8-page">
        <p className="mb-1"><a href={tabul8AdminHref(partyId)}>← Board</a></p>
        <h1>Camera station — {partyTitle || `Party ${partyId}`}</h1>
        <div className="tabul8-camera-stage">
          <div className="tabul8-video-wrap">
            <video ref={videoRef} playsInline muted />
          </div>
          <div className="tabul8-panel mb-0">
            <label className="form-label">Category</label>
            <select className="form-select mb-2" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label className="small mb-2 d-block">
              <input type="checkbox" checked={checkInMode} onChange={(e) => setCheckInMode(e.target.checked)} />{' '}
              Check-in mode (enroll faces as people arrive)
            </label>
            {checkInMode ? (
              <>
                <label className="form-label">Guest (optional)</label>
                <select className="form-select mb-2" value={guestId} onChange={(e) => {
                  const id = Number(e.target.value);
                  setGuestId(id);
                  const g = guests.find((x) => x.id === id);
                  if (g) setEnrollName(g.name);
                }}>
                  <option value={0}>— Unknown / type a name —</option>
                  {guests.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <label className="form-label">Display name</label>
                <input className="form-control mb-2" value={enrollName} onChange={(e) => setEnrollName(e.target.value)} placeholder="Leave blank for Unknown #n" />
                <button type="button" className="btn btn-success" disabled={!streamReady} onClick={() => void enrollCheckIn()}>
                  Enroll face
                </button>
                <p className="small text-muted mt-2 mb-0">Adds a MobileFaceNet embedding to the persistent identity store (encrypted at rest).</p>
              </>
            ) : (
              <>
                <label className="form-label">Entrant name / label (optional)</label>
                <input className="form-control mb-2" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Aunt Sue's ghost / Chili #3" />
                <div className="tabul8-toolbar">
                  <button type="button" className="btn btn-primary" disabled={busy || !streamReady || !board} onClick={() => void snapAndUpload(true)}>
                    Snap + label
                  </button>
                  <button type="button" className="btn btn-outline-secondary" disabled={busy || !streamReady || !board} onClick={() => void snapAndUpload(false)}>
                    Snap only
                  </button>
                </div>
                <p className="small text-muted mt-2 mb-0">
                  Snap + label tries OpenAI on the server (~8s max), then falls back to Celebr8r or manual per Settings → Tabul8 / AI Labels.
                  For chili: photograph the pot/dish. Photos go into the party album.
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </PageLayout>
  );
}

function Tabul8DisplayView({
  partyId,
  viewer,
  onLoginClick,
  onLogout,
  onAccountClick,
  mysteryTitle,
  onToast,
}: AppShellPageProps & { partyId: number }) {
  const { board, categories, partyTitle, refresh } = useTabul8Board(partyId, onToast);
  const [activeCat, setActiveCat] = React.useState(0);
  const [phoneLink, setPhoneLink] = React.useState('');

  React.useEffect(() => {
    // Live refresh — labeled contestants appear as soon as they arrive.
    const t = window.setInterval(() => { void refresh(); }, 2500);
    return () => window.clearInterval(t);
  }, [refresh]);

  React.useEffect(() => {
    if (categories.length && !categories.find((c) => c.id === activeCat)) {
      setActiveCat(categories[0].id);
    }
  }, [categories, activeCat]);

  const phoneOpen = Number(board?.phone_voting_open || 0) === 1;

  React.useEffect(() => {
    if (!phoneOpen || !board) {
      setPhoneLink('');
      return;
    }
    let cancelled = false;
    const mint = async () => {
      try {
        const res = await ApiClient.post<{ link?: { url_path?: string } }>(
          '/api/tabul8.php?action=mint_phone_vote_link',
          { board_id: board.id },
        );
        if (!cancelled && res.link?.url_path) {
          setPhoneLink(AbsoluteUrl(res.link.url_path));
        }
      } catch {
        // Admin mint may fail for non-admin display sessions — hide QR.
        if (!cancelled) setPhoneLink('');
      }
    };
    void mint();
    const t = window.setInterval(() => { void mint(); }, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [phoneOpen, board?.id]);

  const cat = categories.find((c) => c.id === activeCat);
  const entries = cat?.entries || [];
  const maxVotes = Math.max(1, ...entries.map((e) => Number(e.vote_count || 0)));
  const showBars = Number(board?.show_bars || 0) === 1;
  const reveal = Number(board?.reveal_winners || 0) === 1;

  return (
    <div className="tabul8-display">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 px-2">
        <div>
          <div className="small opacity-75">TABUL8 · {partyTitle}</div>
          <h1>{cat?.name || 'Contest'}</h1>
        </div>
        <div className="tabul8-toolbar">
          {categories.map((c) => (
            <button key={c.id} type="button" className={`btn btn-sm ${activeCat === c.id ? 'btn-warning' : 'btn-outline-light'}`} onClick={() => setActiveCat(c.id)}>
              {c.name}
            </button>
          ))}
          <a className="btn btn-sm btn-outline-light" href={tabul8AdminHref(partyId)}>Admin</a>
          <a className="btn btn-sm btn-outline-light" href={tabul8KioskVoteHref(partyId)}>Kiosk</a>
        </div>
      </div>
      <div className="d-flex flex-wrap gap-3">
        <div style={{ flex: '1 1 640px' }}>
          <div className="tabul8-display-grid">
            {entries.map((e, idx) => {
              const isWinner = reveal && idx === 0 && Number(e.vote_count || 0) > 0;
              return (
                <div key={e.id} className={`tabul8-display-card${isWinner ? ' winner' : ''}`}>
                  {e.photo_url || e.photo_thumb_url ? <img src={e.photo_url || e.photo_thumb_url || ''} alt="" /> : <div style={{ aspectRatio: 1, background: '#333' }} />}
                  <div className="p-2">
                    <strong>{e.label || (e.photo_id ? 'Labeling…' : `Entry #${e.id}`)}</strong>
                    {e.description ? <div className="small opacity-75">{e.description}</div> : null}
                    {showBars ? (
                      <>
                        <div className="small mt-1">{e.vote_count ?? 0} votes</div>
                        <div className="tabul8-bar-wrap">
                          <div className="tabul8-bar" style={{ width: `${(Number(e.vote_count || 0) / maxVotes) * 100}%` }} />
                        </div>
                      </>
                    ) : (
                      <div className="small opacity-50 mt-1">Votes hidden</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {phoneOpen && phoneLink ? (
          <div className="tabul8-qr">
            <img src={qrUrl(phoneLink)} alt="Vote QR" />
            <div className="small mt-1">Scan to vote</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function pickNextOpenCategory(categories: Tabul8Category[], afterId: number): number {
  const open = categories.filter((c) => Number(c.voting_open) === 1);
  if (!open.length) return afterId;
  const idx = open.findIndex((c) => c.id === afterId);
  if (idx < 0) return open[0].id;
  return open[(idx + 1) % open.length].id;
}

function Tabul8KioskVote({
  mode,
  partyId,
  voteToken,
  phoneExp,
  phoneSig,
  viewer,
  onLoginClick,
  onLogout,
  onAccountClick,
  mysteryTitle,
  onToast,
}: AppShellPageProps & {
  mode: 'kiosk' | 'phone';
  partyId: number;
  voteToken: string;
  phoneExp: number;
  phoneSig: string;
}) {
  const [state, setState] = React.useState<{
    board: Tabul8Board;
    categories: Tabul8Category[];
    party?: { title?: string };
    face_notice?: string;
  } | null>(null);
  const [categoryId, setCategoryId] = React.useState(0);
  const [entryId, setEntryId] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [faceReady, setFaceReady] = React.useState(false);
  const [status, setStatus] = React.useState('');
  const [greeting, setGreeting] = React.useState('Welcome!');
  const [greetedIdentityId, setGreetedIdentityId] = React.useState<number | null>(null);
  const [packIdentities, setPackIdentities] = React.useState<PackIdentity[]>([]);
  const [greetThreshold, setGreetThreshold] = React.useState(TABUL8_GREET_THRESHOLD);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const votedCats = React.useRef<Set<number>>(new Set());
  const notMeRef = React.useRef(false);

  const load = React.useCallback(async () => {
    let res: any;
    if (mode === 'phone') {
      const qs = new URLSearchParams({
        action: 'public_state',
        vote_token: voteToken,
        exp: String(phoneExp),
        sig: phoneSig,
      });
      res = await ApiClient.get(`/api/tabul8.php?${qs.toString()}`);
    } else {
      res = await ApiClient.get(`/api/tabul8.php?action=kiosk_state&party_id=${partyId}`);
    }
    setState(res);
    const cats: Tabul8Category[] = res?.categories || [];
    setCategoryId((prev) => {
      if (prev && cats.find((c) => c.id === prev)) return prev;
      const firstOpen = cats.find((c) => Number(c.voting_open) === 1);
      return firstOpen?.id || cats[0]?.id || 0;
    });
  }, [mode, partyId, voteToken, phoneExp, phoneSig]);

  React.useEffect(() => {
    void load().catch((error: any) => onToast?.({ tone: 'error', message: error?.message || 'Could not load voting' }));
  }, [load, onToast]);

  React.useEffect(() => {
    const t = window.setInterval(() => { void load().catch(() => undefined); }, 2500);
    return () => window.clearInterval(t);
  }, [load]);

  // Preload party identity pack (session-only) for local greeting match.
  React.useEffect(() => {
    if (mode !== 'kiosk' || partyId <= 0) return;
    let cancelled = false;
    const loadPack = async () => {
      try {
        const res = await ApiClient.get<{
          pack: {
            identities: PackIdentity[];
            greet_threshold?: number;
          };
        }>(`/api/tabul8.php?action=party_identity_pack&party_id=${partyId}`);
        if (cancelled) return;
        setPackIdentities(res.pack?.identities || []);
        if (res.pack?.greet_threshold) setGreetThreshold(res.pack.greet_threshold);
      } catch {
        // Server match still works without pack.
      }
    };
    void loadPack();
    const t = window.setInterval(() => { void loadPack(); }, 8 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(t); };
  }, [mode, partyId]);

  React.useEffect(() => {
    let stream: MediaStream | null = null;
    let greetTimer: number | undefined;
    void (async () => {
      try {
        await loadTabul8FaceApi();
        setFaceReady(true);
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        greetTimer = window.setInterval(() => {
          if (!videoRef.current || notMeRef.current) return;
          void detectAndMatchGreeting(videoRef.current, packIdentities, greetThreshold).then((m) => {
            if (!m) {
              setGreeting('Welcome!');
              setGreetedIdentityId(null);
              return;
            }
            if (m.matched && m.display_name) {
              const first = m.display_name.split(/\s+/)[0] || m.display_name;
              setGreeting(`Hi ${first}! 👻`);
              setGreetedIdentityId(m.identity_id);
            } else {
              setGreeting('Hey there! 🎃');
              setGreetedIdentityId(null);
            }
          });
        }, 1200);
      } catch (error: any) {
        setStatus(error?.message || 'Camera / face model unavailable');
      }
    })();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      if (greetTimer) window.clearInterval(greetTimer);
    };
  }, [packIdentities, greetThreshold]);

  const cat = state?.categories.find((c) => c.id === categoryId);
  const entries = (cat?.entries || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id);
  const partyClosed = state?.board && Number(state.board.voting_open) !== 1;
  const catClosed = cat && Number(cat.voting_open) !== 1;

  const advanceCategory = () => {
    const next = pickNextOpenCategory(state?.categories || [], categoryId);
    setCategoryId(next);
    setEntryId(0);
    setStatus('');
  };

  const cast = async () => {
    if (!videoRef.current || !entryId || !categoryId || !state?.board) return;
    setBusy(true);
    setStatus('Checking face…');
    try {
      const embedding = await computeFaceEmbedding(videoRef.current);
      const device_token = getOrCreateDeviceToken();
      // Prefer local match; fall back to server match_embedding if pack cold.
      let identityId = !notMeRef.current ? greetedIdentityId : null;
      if (!identityId && mode === 'kiosk') {
        try {
          const m = await ApiClient.post<{ match?: { matched?: boolean; identity?: { id?: number } } }>(
            '/api/tabul8.php?action=match_embedding',
            { embedding, threshold: TABUL8_MATCH_THRESHOLD },
          );
          if (m.match?.matched && m.match.identity?.id) {
            identityId = m.match.identity.id;
          }
        } catch {
          // resolveIdentityForVote on cast handles unknown faces
        }
      }
      let res: { success: boolean; blocked?: boolean; reason?: string };
      if (mode === 'phone') {
        res = await ApiClient.post('/api/tabul8.php?action=cast_vote', {
          vote_token: voteToken,
          exp: phoneExp,
          sig: phoneSig,
          category_id: categoryId,
          entry_id: entryId,
          embedding,
          device_token,
          identity_id: identityId,
        });
      } else {
        res = await ApiClient.post('/api/tabul8.php?action=cast_kiosk_vote', {
          board_id: state.board.id,
          category_id: categoryId,
          entry_id: entryId,
          embedding,
          device_token,
          identity_id: identityId,
        });
      }
      if (res.blocked) {
        setStatus(
          res.reason === 'already_voted_face' || res.reason === 'already_voted_device'
            ? 'Already voted in this category — next up!'
            : 'Vote blocked.',
        );
        votedCats.current.add(categoryId);
        window.setTimeout(() => advanceCategory(), 900);
      } else {
        setStatus('Thanks! Next category…');
        votedCats.current.add(categoryId);
        onToast?.({ tone: 'success', message: 'Vote recorded' });
        await load();
        window.setTimeout(() => advanceCategory(), 700);
      }
    } catch (error: any) {
      setStatus(error?.message || 'Vote failed');
      onToast?.({ tone: 'error', message: error?.message || 'Vote failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tabul8-kiosk">
      <p className="tabul8-kiosk-hint">
        {state?.party?.title || 'Party'} · {mode === 'kiosk' ? 'Kiosk vote' : 'Phone vote'}
        {viewer?.id ? (
          <>
            {' · '}
            <a className="link-light" href={tabul8AdminHref(partyId || state?.board?.party_id || 0)}>Admin</a>
          </>
        ) : null}
      </p>
      <h1 className="tabul8-kiosk-cat" style={{ fontSize: 'clamp(2.2rem, 7vw, 4rem)' }}>{greeting}</h1>
      {greetedIdentityId && !notMeRef.current ? (
        <p className="tabul8-kiosk-hint">
          <button
            type="button"
            className="btn btn-sm btn-outline-light"
            onClick={() => {
              notMeRef.current = true;
              setGreeting('Hey there! 🎃');
              setGreetedIdentityId(null);
              window.setTimeout(() => { notMeRef.current = false; }, 15000);
            }}
          >
            Not me
          </button>
        </p>
      ) : null}
      <h2 className="tabul8-kiosk-cat" style={{ fontSize: 'clamp(1.6rem, 4vw, 2.6rem)' }}>{cat?.name || 'Pick a category'}</h2>
      {partyClosed ? <p className="tabul8-kiosk-hint">Voting is closed for this party.</p> : null}
      {catClosed && !partyClosed ? <p className="tabul8-kiosk-hint">This category is closed.</p> : null}
      {!partyClosed && !catClosed ? (
        <p className="tabul8-kiosk-hint">Tap a photo, then Vote. One vote per person per category.</p>
      ) : null}

      <div className="tabul8-kiosk-grid">
        {entries.map((e) => (
          <button
            key={e.id}
            type="button"
            className={`tabul8-kiosk-tile${entryId === e.id ? ' selected' : ''}`}
            onClick={() => setEntryId(e.id)}
            disabled={busy || Boolean(partyClosed) || Boolean(catClosed)}
          >
            {e.photo_url || e.photo_thumb_url
              ? <img src={e.photo_url || e.photo_thumb_url || ''} alt="" />
              : <div style={{ aspectRatio: 1, background: '#333' }} />}
            <div className="label">{e.label || (e.photo_id ? 'Labeling…' : `#${e.id}`)}</div>
          </button>
        ))}
      </div>

      <div className="tabul8-kiosk-actions">
        <div className="tabul8-kiosk-selfie">
          <video ref={videoRef} playsInline muted />
        </div>
        <button
          type="button"
          className="btn btn-warning"
          disabled={busy || !faceReady || !entryId || Boolean(partyClosed) || Boolean(catClosed)}
          onClick={() => void cast()}
        >
          Vote
        </button>
        <button type="button" className="btn btn-outline-light" disabled={busy} onClick={advanceCategory}>
          Skip category
        </button>
      </div>
      <p className="tabul8-kiosk-status">{status || (faceReady ? '' : 'Warming up camera…')}</p>
    </div>
  );
}
