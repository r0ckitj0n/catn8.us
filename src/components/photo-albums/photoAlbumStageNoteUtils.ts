import { sanitizeAlbumMessageText, splitAlbumMessages, toAlbumDisplayName } from '../../utils/photoAlbumText';

export type NoteItem = {
  id: string;
  text: string;
  speaker: string;
  time?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rotation?: number;
};

export function hashValue(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function resolveContactSpeaker(rawSpeaker: string, contactDisplayName?: string, perMessageContactLabel?: string): string {
  const normalizedSpeaker = toAlbumDisplayName(rawSpeaker);
  if (/^contact$/i.test(rawSpeaker.trim())) {
    const perMessage = toAlbumDisplayName(perMessageContactLabel);
    if (perMessage) {
      return perMessage;
    }
    const display = toAlbumDisplayName(contactDisplayName);
    return display || 'Contact';
  }
  return normalizedSpeaker || 'Unknown';
}

export function parseSpeakerLine(
  line: string,
  contactDisplayName?: string,
  perMessageContactLabel?: string,
): { speaker: string; time?: string; body: string } {
  const cleaned = sanitizeAlbumMessageText(line);
  const rich = cleaned.match(/^([A-Za-z][A-Za-z' -]{0,30})\s*(?:\(([0-9]{1,2}:[0-9]{2}\s*[AP]M)\)|\[([0-9]{1,2}:[0-9]{2}\s*[AP]M)\])?\s*:\s*(.+)$/i);
  if (rich) {
    const speakerToken = sanitizeAlbumMessageText(rich[1] || '') || 'Unknown';
    const speaker = resolveContactSpeaker(speakerToken, contactDisplayName, perMessageContactLabel);
    const time = (rich[2] || rich[3] || '').trim() || undefined;
    return { speaker, time, body: sanitizeAlbumMessageText(rich[4] || '') };
  }
  const basic = cleaned.match(/^([A-Za-z][A-Za-z' -]{0,30})\s*:\s*(.+)$/i);
  if (basic) {
    const speakerToken = sanitizeAlbumMessageText(basic[1] || '') || 'Unknown';
    const speaker = resolveContactSpeaker(speakerToken, contactDisplayName, perMessageContactLabel);
    return { speaker, body: sanitizeAlbumMessageText(basic[2] || '') };
  }
  return { speaker: 'Unknown', body: cleaned };
}

export function formatNoteText(note: NoteItem): string {
  const timePart = note.time ? ` (${note.time})` : '';
  return `${note.speaker}${timePart}: ${note.text}`;
}

export function isMessageLikeLine(line: string): boolean {
  return /^([A-Za-z][A-Za-z' -]{0,30}|Contact|Unknown)\s*(?:\([0-9]{1,2}:[0-9]{2}\s*[AP]M\)|\[[0-9]{1,2}:[0-9]{2}\s*[AP]M\])?\s*:/i.test(sanitizeAlbumMessageText(line));
}

export function isTranscriptCaption(text: string): boolean {
  const lines = splitAlbumMessages(text).filter(Boolean);
  if (!lines.length) {
    return false;
  }
  const messageLikeCount = lines.filter((line) => isMessageLikeLine(line)).length;
  return messageLikeCount >= 1 && (messageLikeCount / lines.length) >= 0.6;
}

export function shouldHideNoteText(value: string): boolean {
  const normalized = sanitizeAlbumMessageText(value).toLowerCase();
  if (!normalized) {
    return true;
  }
  if (/\bno\s+message\s+text\b/.test(normalized)) {
    return true;
  }
  return normalized.includes('attachment media currently unavailable');
}

export function parseClockToMinutes(value?: string): number | null {
  if (!value) {
    return null;
  }
  const match = String(value).trim().match(/^([0-9]{1,2}):([0-9]{2})\s*([AP]M)$/i);
  if (!match) {
    return null;
  }
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59 || hour < 1 || hour > 12) {
    return null;
  }
  if (period === 'AM') {
    if (hour === 12) {
      hour = 0;
    }
  } else if (hour !== 12) {
    hour += 12;
  }
  return (hour * 60) + minute;
}
