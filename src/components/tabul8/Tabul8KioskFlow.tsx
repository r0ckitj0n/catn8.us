import React from 'react';

import { ApiClient } from '../../core/ApiClient';
import { IToast } from '../../types/common';
import { Tabul8Board, Tabul8Category, Tabul8Entry } from '../../types/tabul8';
import {
  TABUL8_GREET_THRESHOLD,
  TABUL8_MATCH_THRESHOLD,
  computeFaceEmbedding,
  detectAndMatchGreeting,
  getOrCreateDeviceToken,
  loadTabul8FaceApi,
  type PackIdentity,
} from './tabul8Face';
import { tabul8AdminHref } from './tabul8Paths';

type Contest = Tabul8Category & { voted?: number; entries?: Tabul8Entry[] };

type Step = 'boot' | 'register' | 'costume' | 'home' | 'contest' | 'confirm' | 'thanks';

type Guest = {
  id: number;
  name: string;
  costume_name?: string;
};

const IDLE_MS = 45000;

export function Tabul8KioskFlow({
  partyId,
  onToast,
}: {
  partyId: number;
  onToast?: (t: IToast) => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const idleTimer = React.useRef<number | null>(null);
  const notMeRef = React.useRef(false);
  const stepRef = React.useRef<Step>('boot');
  const identityRef = React.useRef<number | null>(null);
  const packRef = React.useRef<PackIdentity[]>([]);
  const greetThresholdRef = React.useRef(TABUL8_GREET_THRESHOLD);
  const guestIdRef = React.useRef<number | null>(null);
  const costumeDraftRef = React.useRef('');

  const [step, setStep] = React.useState<Step>('boot');
  const [faceReady, setFaceReady] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [greeting, setGreeting] = React.useState('Welcome!');
  const [pack, setPack] = React.useState<PackIdentity[]>([]);
  const [greetThreshold, setGreetThreshold] = React.useState(TABUL8_GREET_THRESHOLD);

  const [identityId, setIdentityId] = React.useState<number | null>(null);
  const [guest, setGuest] = React.useState<Guest | null>(null);
  const [board, setBoard] = React.useState<Tabul8Board | null>(null);
  const [contests, setContests] = React.useState<Contest[]>([]);
  const [partyTitle, setPartyTitle] = React.useState('');

  const [nameDraft, setNameDraft] = React.useState('');
  const [costumeDraft, setCostumeDraft] = React.useState('');
  const [costumeSuggestion, setCostumeSuggestion] = React.useState('');
  const [fuzzyCandidates, setFuzzyCandidates] = React.useState<Guest[]>([]);

  const [activeContest, setActiveContest] = React.useState<Contest | null>(null);
  const [pickedEntry, setPickedEntry] = React.useState<Tabul8Entry | null>(null);
  const [status, setStatus] = React.useState('');

  stepRef.current = step;
  identityRef.current = identityId;
  packRef.current = pack;
  greetThresholdRef.current = greetThreshold;
  guestIdRef.current = guest?.id ?? null;
  costumeDraftRef.current = costumeDraft;

  const resetSession = React.useCallback(() => {
    setStep('boot');
    setIdentityId(null);
    setGuest(null);
    setNameDraft('');
    setCostumeDraft('');
    setCostumeSuggestion('');
    setFuzzyCandidates([]);
    setActiveContest(null);
    setPickedEntry(null);
    setGreeting('Welcome!');
    setStatus('');
    notMeRef.current = false;
  }, []);

  const bumpIdle = React.useCallback(() => {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => resetSession(), IDLE_MS);
  }, [resetSession]);

  React.useEffect(() => {
    const onMove = () => bumpIdle();
    window.addEventListener('pointerdown', onMove);
    bumpIdle();
    return () => {
      window.removeEventListener('pointerdown', onMove);
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [bumpIdle]);

  const loadPack = React.useCallback(async () => {
    const res = await ApiClient.get<{
      pack: { identities: PackIdentity[]; greet_threshold?: number };
    }>(`/api/tabul8.php?action=party_identity_pack&party_id=${partyId}`);
    setPack(res.pack?.identities || []);
    if (res.pack?.greet_threshold) setGreetThreshold(res.pack.greet_threshold);
  }, [partyId]);

  const loadVoterState = React.useCallback(async (id: number | null) => {
    const res = await ApiClient.post<{
      board: Tabul8Board;
      contests: Contest[];
      party?: { title?: string };
    }>('/api/tabul8.php?action=kiosk_voter_state', {
      party_id: partyId,
      identity_id: id,
    });
    setBoard(res.board);
    setContests(res.contests || []);
    setPartyTitle(res.party?.title || '');
    return res;
  }, [partyId]);

  const captureDataUrl = React.useCallback((): string | null => {
    if (!videoRef.current) return null;
    const v = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth || 640;
    canvas.height = v.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  const requestCostumeSuggestion = React.useCallback(async (forGuestId?: number | null) => {
    const dataUrl = captureDataUrl();
    if (!dataUrl) return;
    try {
      const res = await ApiClient.post<{ suggestion?: string | null; source?: string }>(
        '/api/tabul8.php?action=suggest_costume_name',
        {
          party_id: partyId,
          guest_id: forGuestId ?? guestIdRef.current,
          identity_id: identityRef.current,
          image_data_url: dataUrl,
        },
      );
      if (res.suggestion) {
        setCostumeSuggestion(res.suggestion);
        if (!costumeDraftRef.current) setCostumeDraft(res.suggestion);
      }
    } catch {
      // soft-fail — voter can type
    }
  }, [captureDataUrl, partyId]);

  React.useEffect(() => {
    let stream: MediaStream | null = null;
    let greetTimer: number | undefined;
    let cancelled = false;
    void (async () => {
      try {
        await loadTabul8FaceApi();
        await loadPack();
        if (cancelled) return;
        setFaceReady(true);
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        greetTimer = window.setInterval(() => {
          if (!videoRef.current || notMeRef.current) return;
          const curStep = stepRef.current;
          if (curStep !== 'boot' && curStep !== 'home') return;
          void detectAndMatchGreeting(
            videoRef.current,
            packRef.current,
            greetThresholdRef.current,
          ).then(async (m) => {
            if (!m) {
              if (stepRef.current === 'boot') setGreeting('Welcome!');
              return;
            }
            if (m.matched && m.display_name && m.identity_id) {
              const first = m.display_name.split(/\s+/)[0] || m.display_name;
              setGreeting(`Hi ${first}! 👻`);
              if (stepRef.current === 'boot' && !identityRef.current) {
                setIdentityId(m.identity_id);
                try {
                  await loadVoterState(m.identity_id);
                  const packHit = packRef.current.find((p) => p.identity_id === m.identity_id);
                  let g: Guest | null = packHit?.guest_id
                    ? { id: packHit.guest_id, name: m.display_name || '', costume_name: '' }
                    : null;
                  if (packHit?.guest_id) {
                    try {
                      const gr = await ApiClient.get<{ guests?: Guest[] }>(
                        `/api/celebr8.php?action=list_guests&event_id=${partyId}`,
                      );
                      const found = (gr.guests || []).find((x) => x.id === packHit.guest_id);
                      if (found) g = found;
                    } catch {
                      // guest list optional — continue with pack name
                    }
                  }
                  setGuest(g);
                  if (g && !String(g.costume_name || '').trim()) {
                    setStep('costume');
                    void requestCostumeSuggestion(g.id);
                  } else {
                    setStep('home');
                  }
                } catch (error: any) {
                  onToast?.({ tone: 'error', message: error?.message || 'Could not load contests' });
                }
              }
            } else if (stepRef.current === 'boot') {
              setGreeting('Hey there! 🎃');
            }
          });
        }, 1400);
      } catch (error: any) {
        setStatus(error?.message || 'Camera unavailable');
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      if (greetTimer) window.clearInterval(greetTimer);
    };
  }, [loadPack, loadVoterState, onToast, partyId, requestCostumeSuggestion]);

  const startAsNew = () => {
    notMeRef.current = true;
    setIdentityId(null);
    setGuest(null);
    setGreeting('Welcome!');
    setStep('register');
    void requestCostumeSuggestion();
    window.setTimeout(() => { notMeRef.current = false; }, 20000);
  };

  const submitRegister = async (confirmGuestId?: number) => {
    if (!videoRef.current || !nameDraft.trim()) return;
    setBusy(true);
    setStatus('');
    try {
      const embedding = await computeFaceEmbedding(videoRef.current);
      const res = await ApiClient.post<{
        guest: Guest;
        identity?: { id: number; display_name?: string };
        voter_state?: { contests: Contest[]; board: Tabul8Board };
      }>('/api/tabul8.php?action=register_voter', {
        party_id: partyId,
        name: nameDraft.trim(),
        costume_name: costumeDraft.trim() || undefined,
        embedding,
        confirm_guest_id: confirmGuestId || undefined,
      });
      setGuest(res.guest);
      setIdentityId(res.identity?.id || null);
      if (res.voter_state) {
        setContests(res.voter_state.contests || []);
        setBoard(res.voter_state.board);
      } else {
        await loadVoterState(res.identity?.id || null);
      }
      setFuzzyCandidates([]);
      setStep('home');
      bumpIdle();
    } catch (error: any) {
      const payload = error?.payload;
      if (payload?.error === 'ambiguous_guest' || payload?.error === 'confirm_fuzzy') {
        const cands = payload?.match?.candidates || (payload?.match?.guest ? [payload.match.guest] : []);
        setFuzzyCandidates(cands);
        setStatus(payload.error === 'confirm_fuzzy'
          ? `Did you mean ${payload.match?.guest?.name}? Confirm below.`
          : 'Several guests match — pick one.');
      } else {
        setStatus(error?.message || 'Could not register');
        onToast?.({ tone: 'error', message: error?.message || 'Register failed' });
      }
    } finally {
      setBusy(false);
    }
  };

  const saveCostumeAndContinue = async () => {
    if (!guest) {
      setStep('home');
      return;
    }
    setBusy(true);
    try {
      if (costumeDraft.trim()) {
        await ApiClient.post('/api/tabul8.php?action=set_costume_name', {
          guest_id: guest.id,
          costume_name: costumeDraft.trim(),
          identity_id: identityId,
        });
        setGuest({ ...guest, costume_name: costumeDraft.trim() });
      }
      await loadVoterState(identityId);
      setStep('home');
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Could not save costume' });
    } finally {
      setBusy(false);
    }
  };

  const openContest = (c: Contest) => {
    if (Number(c.voting_open) !== 1 || Number(board?.voting_open) !== 1) return;
    if (Number(c.voted) === 1) return;
    setActiveContest(c);
    setPickedEntry(null);
    setStep('contest');
    bumpIdle();
  };

  const confirmVote = async () => {
    if (!videoRef.current || !pickedEntry || !activeContest || !board) return;
    setBusy(true);
    setStatus('Recording vote…');
    try {
      const embedding = await computeFaceEmbedding(videoRef.current);
      const res = await ApiClient.post<{ blocked?: boolean; reason?: string }>(
        '/api/tabul8.php?action=cast_kiosk_vote',
        {
          board_id: board.id,
          category_id: activeContest.id,
          contest_id: activeContest.id,
          entry_id: pickedEntry.id,
          embedding,
          device_token: getOrCreateDeviceToken(),
          identity_id: identityId,
        },
      );
      if (res.blocked) {
        setStatus('Already voted in this contest.');
      }
      const state = await loadVoterState(identityId);
      const remaining = (state.contests || []).filter(
        (c) => Number(c.voting_open) === 1 && Number(c.voted) !== 1,
      );
      if (remaining.length === 0) {
        setStep('thanks');
        window.setTimeout(() => resetSession(), 4000);
      } else {
        setStep('home');
        setActiveContest(null);
        setPickedEntry(null);
      }
      bumpIdle();
    } catch (error: any) {
      setStatus(error?.message || 'Vote failed');
      onToast?.({ tone: 'error', message: error?.message || 'Vote failed' });
    } finally {
      setBusy(false);
    }
  };

  const openContests = contests.filter((c) => Number(c.voting_open) === 1);
  const entries = (activeContest?.entries || []).slice().sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id,
  );

  return (
    <div className="tabul8-kiosk" onPointerDown={bumpIdle}>
      <div className="tabul8-kiosk-selfie" style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 5, width: 120 }}>
        <video ref={videoRef} playsInline muted />
      </div>

      {step === 'boot' ? (
        <>
          <h1 className="tabul8-kiosk-cat">{greeting}</h1>
          <p className="tabul8-kiosk-hint">{partyTitle || 'Party'} · step up to the camera</p>
          <div className="tabul8-kiosk-actions">
            <button type="button" className="btn btn-warning" disabled={!faceReady} onClick={startAsNew}>
              I&apos;m new — enter my name
            </button>
            <a className="btn btn-outline-light" href={tabul8AdminHref(partyId)}>Admin</a>
          </div>
          {greeting.startsWith('Hi ') ? (
            <p className="tabul8-kiosk-hint">
              <button type="button" className="btn btn-sm btn-outline-light" onClick={startAsNew}>Not me</button>
            </p>
          ) : null}
        </>
      ) : null}

      {step === 'register' ? (
        <>
          <h1 className="tabul8-kiosk-cat">Who are you?</h1>
          <p className="tabul8-kiosk-hint">Name required · costume optional</p>
          <div style={{ maxWidth: 520, margin: '0 auto', width: '100%' }}>
            <input
              className="form-control form-control-lg mb-2"
              placeholder="Your name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              autoFocus
            />
            <input
              className="form-control form-control-lg mb-2"
              placeholder={costumeSuggestion ? `Costume (e.g. ${costumeSuggestion})` : 'Costume name (optional)'}
              value={costumeDraft}
              onChange={(e) => setCostumeDraft(e.target.value)}
            />
            {costumeSuggestion ? (
              <button type="button" className="btn btn-sm btn-outline-light mb-2" onClick={() => setCostumeDraft(costumeSuggestion)}>
                Use suggestion: {costumeSuggestion}
              </button>
            ) : null}
            {fuzzyCandidates.length > 0 ? (
              <div className="mb-2">
                {fuzzyCandidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="btn btn-outline-warning btn-lg d-block w-100 mb-1"
                    disabled={busy}
                    onClick={() => void submitRegister(c.id)}
                  >
                    I&apos;m {c.name}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="tabul8-kiosk-actions">
              <button type="button" className="btn btn-warning" disabled={busy || !nameDraft.trim() || !faceReady} onClick={() => void submitRegister()}>
                Continue
              </button>
              <button type="button" className="btn btn-outline-light" onClick={resetSession}>Back</button>
            </div>
            {status ? <p className="tabul8-kiosk-status">{status}</p> : null}
          </div>
        </>
      ) : null}

      {step === 'costume' ? (
        <>
          <h1 className="tabul8-kiosk-cat">{greeting}</h1>
          <p className="tabul8-kiosk-hint">What&apos;s your costume tonight? (optional)</p>
          <div style={{ maxWidth: 520, margin: '0 auto', width: '100%' }}>
            <input
              className="form-control form-control-lg mb-2"
              value={costumeDraft}
              onChange={(e) => setCostumeDraft(e.target.value)}
              placeholder={costumeSuggestion || 'e.g. Zombie Prom Queen'}
            />
            {costumeSuggestion ? (
              <button type="button" className="btn btn-sm btn-outline-light mb-2" onClick={() => setCostumeDraft(costumeSuggestion)}>
                Use suggestion: {costumeSuggestion}
              </button>
            ) : null}
            <div className="tabul8-kiosk-actions">
              <button type="button" className="btn btn-warning" disabled={busy} onClick={() => void saveCostumeAndContinue()}>
                {costumeDraft.trim() ? 'Save & vote' : 'Skip & vote'}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {step === 'home' ? (
        <>
          <h1 className="tabul8-kiosk-cat">{greeting}</h1>
          <p className="tabul8-kiosk-hint">Pick a contest · ✓ = already voted</p>
          <div className="tabul8-kiosk-grid">
            {openContests.map((c) => {
              const done = Number(c.voted) === 1;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`tabul8-kiosk-tile${done ? '' : ''}`}
                  style={{ opacity: done ? 0.55 : 1, minHeight: 120 }}
                  disabled={done || Number(board?.voting_open) !== 1}
                  onClick={() => openContest(c)}
                >
                  <div className="label" style={{ padding: '1.5rem 0.75rem' }}>
                    {done ? '✓ ' : ''}{c.name}
                    <div className="small opacity-75" style={{ fontWeight: 400, fontSize: '0.9rem' }}>
                      {c.contest_type || c.type || 'contest'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {openContests.length === 0 ? (
            <p className="tabul8-kiosk-hint">No open contests yet — ask the host.</p>
          ) : null}
          <div className="tabul8-kiosk-actions">
            <button type="button" className="btn btn-outline-light" onClick={resetSession}>Next person</button>
          </div>
        </>
      ) : null}

      {step === 'contest' && activeContest ? (
        <>
          <h1 className="tabul8-kiosk-cat">{activeContest.name}</h1>
          <p className="tabul8-kiosk-hint">Tap a photo</p>
          <div className="tabul8-kiosk-grid">
            {entries.map((e) => (
              <button
                key={e.id}
                type="button"
                className={`tabul8-kiosk-tile${pickedEntry?.id === e.id ? ' selected' : ''}`}
                onClick={() => { setPickedEntry(e); setStep('confirm'); }}
              >
                {e.photo_url || e.photo_thumb_url
                  ? <img src={e.photo_url || e.photo_thumb_url || ''} alt="" />
                  : <div style={{ aspectRatio: 1, background: '#333' }} />}
                <div className="label">{e.label || `#${e.id}`}</div>
              </button>
            ))}
          </div>
          <div className="tabul8-kiosk-actions">
            <button type="button" className="btn btn-outline-light" onClick={() => { setActiveContest(null); setStep('home'); }}>
              Back
            </button>
          </div>
        </>
      ) : null}

      {step === 'confirm' && activeContest && pickedEntry ? (
        <>
          <h1 className="tabul8-kiosk-cat" style={{ fontSize: 'clamp(1.6rem, 4.5vw, 2.8rem)' }}>
            Your vote for {activeContest.name}:
          </h1>
          <h2 className="tabul8-kiosk-cat">{pickedEntry.label || `Entry #${pickedEntry.id}`}</h2>
          <div className="tabul8-kiosk-actions">
            <button type="button" className="btn btn-warning" disabled={busy || !faceReady} onClick={() => void confirmVote()}>
              Confirm
            </button>
            <button type="button" className="btn btn-outline-light" disabled={busy} onClick={() => setStep('contest')}>
              Back
            </button>
          </div>
          {status ? <p className="tabul8-kiosk-status">{status}</p> : null}
        </>
      ) : null}

      {step === 'thanks' ? (
        <>
          <h1 className="tabul8-kiosk-cat">Thanks for voting! 🎉</h1>
          <p className="tabul8-kiosk-hint">Next guest — step up</p>
        </>
      ) : null}
    </div>
  );
}
