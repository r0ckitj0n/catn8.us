const JUNK_TOKENS = /(streamtyped|NSMutableAttributedString|NSAttributedString|NSObject|NSMutableString|NSString|NSDictionary|NSNumber|NSValue|NSMutableData|NSData|CF\$UID|NSInlineData)/gi;
const JUNK_IM_TOKENS = /\bkIM[A-Za-z0-9_]+\b/g;
const JUNK_LABELS = /\b(iI|typedstream)\b/gi;
const SPEAKER_BOUNDARY = /\s+(Papa|Trinity|Ian|Elijah|Marisa|Lyrielle|Lyra|Contact|admin)\s*:\s*/gi;
const KNOWN_SPEAKER_ONLY = /^(Papa|Trinity|Ian|Elijah|Marisa|Lyrielle|Lyra|Contact|Unknown|admin)$/i;

export function toAlbumDisplayName(value: unknown): string {
  const cleaned = sanitizeAlbumMessageText(value).trim();
  if (!cleaned) {
    return '';
  }
  return /^admin$/i.test(cleaned) ? 'Papa' : cleaned;
}

function ordinal(value: number): string {
  const n = Math.max(1, Math.floor(Number(value) || 1));
  const mod100 = n % 100;
  if (mod100 >= 10 && mod100 <= 20) {
    return `${n}th`;
  }
  const mod10 = n % 10;
  if (mod10 === 1) {
    return `${n}st`;
  }
  if (mod10 === 2) {
    return `${n}nd`;
  }
  if (mod10 === 3) {
    return `${n}rd`;
  }
  return `${n}th`;
}

function childNameForLegacyToken(token: string): string {
  const normalized = sanitizeAlbumMessageText(token).toLowerCase();
  if (/lyra|lyrielle/.test(normalized)) {
    return 'Lyrielle';
  }
  if (/eleanor/.test(normalized)) {
    return 'Eleanor';
  }
  if (/violet/.test(normalized)) {
    return 'Violet';
  }
  if (/trinity/.test(normalized)) {
    return 'Violet';
  }
  return '';
}

function titleFromLegacyIndex(childName: string, oneBasedAlbumIndex: number): string {
  const monthIndex = Math.max(0, Math.floor(oneBasedAlbumIndex) - 1);
  if (monthIndex < 36) {
    return `${childName}'s ${ordinal(monthIndex + 1)} Month`;
  }
  const yearNo = 3 + Math.floor((monthIndex - 36) / 12);
  return `${childName}'s ${ordinal(yearNo)} Year`;
}

export function toPhotoAlbumDisplayTitle(value: unknown): string {
  const cleaned = sanitizeAlbumMessageText(value).trim();
  if (!cleaned) {
    return '';
  }

  const alreadyNewStyle = cleaned.match(/^([A-Za-z]+)'s\s+([0-9]{1,3})(st|nd|rd|th)\s+(Month|Year)(?:\s+Part\s+[0-9]+)?$/i);
  if (alreadyNewStyle) {
    return cleaned;
  }

  const legacy = cleaned.match(/^(.+?)\s+Memories(?:\s+(Violet|Eleanor|Lyra|Lyrielle))?\s+([0-9]{1,3})$/i);
  if (!legacy) {
    return cleaned;
  }

  const explicitChildToken = String(legacy[2] || '').trim();
  const baseToken = String(legacy[1] || '').trim();
  const childName = childNameForLegacyToken(explicitChildToken || baseToken);
  const index = Number(legacy[3] || 0);
  if (!childName || !Number.isFinite(index) || index <= 0) {
    return cleaned;
  }
  return titleFromLegacyIndex(childName, index);
}

export function toPhotoAlbumDisplaySummary(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return '';
  }
  const withoutPrefix = raw.replace(/^Imported memories\s*/i, '').trim();
  return withoutPrefix.replace(/\s{2,}/g, ' ');
}

function cleanWhitespace(value: string): string {
  return value
    .replace(/\u0000/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function sanitizeAlbumMessageText(value: unknown): string {
  const raw = String(value ?? '');
  if (!raw.trim()) {
    return '';
  }

  let next = cleanWhitespace(raw)
    .replace(JUNK_TOKENS, ' ')
    .replace(JUNK_IM_TOKENS, ' ')
    .replace(JUNK_LABELS, ' ')
    .replace(/\s*\|\s*/g, ' | ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const tokenHits = (next.match(/\b(NS|NSMutable|NSDictionary|kIM|streamtyped)\w*\b/g) || []).length;
  if (tokenHits >= 3) {
    return '';
  }

  next = next
    .replace(/^\W+/, '')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();

  return next;
}

export function splitAlbumMessages(value: unknown): string[] {
  const cleaned = sanitizeAlbumMessageText(value);
  if (!cleaned) {
    return [];
  }

  const speakerSplit = cleaned.replace(SPEAKER_BOUNDARY, '\n$1: ');
  const parts = speakerSplit
    .split(/\s+\|\s+|\n+/)
    .map((part) => sanitizeAlbumMessageText(part))
    .filter((part) => part.length > 1);

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(part);
  }

  return unique;
}

export function formatAlbumCaption(value: unknown, maxLines = 4): string {
  const rawLines = splitAlbumMessages(value);
  const lines: string[] = [];
  for (let i = 0; i < rawLines.length; i += 1) {
    const current = sanitizeAlbumMessageText(rawLines[i]);
    const next = sanitizeAlbumMessageText(rawLines[i + 1] || '');
    const senderMatch = current.match(KNOWN_SPEAKER_ONLY);
    const sentMatch = next.match(/^Sent\s+(.+)$/i);
    if (senderMatch && sentMatch) {
      lines.push(`${toAlbumDisplayName(senderMatch[1]) || senderMatch[1]} ${sentMatch[1]}`.trim());
      i += 1;
      continue;
    }
    const inlineSentMatch = current.match(/^(Papa|Trinity|Ian|Elijah|Marisa|Lyrielle|Lyra|Contact|Unknown|admin)\s*\|\s*Sent\s+(.+)$/i);
    if (inlineSentMatch) {
      lines.push(`${toAlbumDisplayName(inlineSentMatch[1]) || inlineSentMatch[1]} ${inlineSentMatch[2]}`.trim());
      continue;
    }
    lines.push(current.replace(/^admin(\s*[:|])/i, 'Papa$1'));
  }
  if (lines.length === 0) {
    return sanitizeAlbumMessageText(value);
  }
  return lines.slice(0, Math.max(1, maxLines)).join('\n');
}

export interface AlbumTheme {
  name: 'warm' | 'celebration' | 'calm' | 'support';
  emojis: string[];
  borderColor: string;
  accentColor: string;
}

export function inferAlbumTheme(value: unknown): AlbumTheme {
  const corpus = sanitizeAlbumMessageText(value).toLowerCase();
  if (/(birthday|party|celebrate|graduation|holiday|christmas|halloween)/.test(corpus)) {
    return { name: 'celebration', emojis: ['🎉', '🎈', '✨', '🥳'], borderColor: '#a54c1f', accentColor: '#ffe6b7' };
  }
  if (/(hospital|medicine|sick|weak|help|covered|plan|work)/.test(corpus)) {
    return { name: 'support', emojis: ['💪', '🤍', '🫶', '🙏'], borderColor: '#3d5f7e', accentColor: '#dcecff' };
  }
  if (/(baby|newborn|sleep|tiny|family|grandma|mom|dad)/.test(corpus)) {
    return { name: 'warm', emojis: ['🍼', '💛', '🧸', '📸'], borderColor: '#8a4d2e', accentColor: '#ffe8cf' };
  }
  return { name: 'calm', emojis: ['🌿', '☁️', '📷', '💌'], borderColor: '#3f5f48', accentColor: '#dff5df' };
}
