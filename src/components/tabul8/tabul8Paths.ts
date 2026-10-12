export type Tabul8Mode = 'hub' | 'admin' | 'camera' | 'display' | 'kiosk' | 'vote';

export function parseTabul8Path(pathname?: string): {
  mode: Tabul8Mode;
  partyId: number;
  voteToken: string;
} {
  const path = (pathname || (typeof window !== 'undefined' ? window.location.pathname : '/tabul8')).replace(/\/+$/, '') || '/tabul8';

  const vote = path.match(/^\/tabul8\/vote\/([^/]+)$/);
  if (vote) {
    return { mode: 'vote', partyId: 0, voteToken: decodeURIComponent(vote[1]) };
  }
  const kiosk = path.match(/^\/tabul8\/party\/(\d+)\/vote$/);
  if (kiosk) {
    return { mode: 'kiosk', partyId: Number(kiosk[1]) || 0, voteToken: '' };
  }
  const camera = path.match(/^\/tabul8\/party\/(\d+)\/camera$/);
  if (camera) {
    return { mode: 'camera', partyId: Number(camera[1]) || 0, voteToken: '' };
  }
  const display = path.match(/^\/tabul8\/party\/(\d+)\/display$/);
  if (display) {
    return { mode: 'display', partyId: Number(display[1]) || 0, voteToken: '' };
  }
  const admin = path.match(/^\/tabul8\/party\/(\d+)$/);
  if (admin) {
    return { mode: 'admin', partyId: Number(admin[1]) || 0, voteToken: '' };
  }
  return { mode: 'hub', partyId: 0, voteToken: '' };
}

export function tabul8AdminHref(partyId: number): string {
  return `/tabul8/party/${partyId}`;
}

export function tabul8CameraHref(partyId: number): string {
  return `/tabul8/party/${partyId}/camera`;
}

export function tabul8DisplayHref(partyId: number): string {
  return `/tabul8/party/${partyId}/display`;
}

export function tabul8KioskVoteHref(partyId: number): string {
  return `/tabul8/party/${partyId}/vote`;
}

export function tabul8PhoneVoteHref(token: string, exp?: number, sig?: string): string {
  const base = `/tabul8/vote/${encodeURIComponent(token)}`;
  if (exp && sig) {
    return `${base}?exp=${exp}&sig=${encodeURIComponent(sig)}`;
  }
  return base;
}
