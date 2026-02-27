const JUNK_TOKENS = /(streamtyped|NSMutableAttributedString|NSAttributedString|NSObject|NSMutableString|NSString|NSDictionary|NSNumber|NSValue|NSMutableData|NSData|CF\$UID|NSInlineData)/gi;
const JUNK_IM_TOKENS = /\bkIM[A-Za-z0-9_]+\b/g;
const JUNK_LABELS = /\b(iI|typedstream)\b/gi;
const SPEAKER_ALIAS = /\bContact\s*:/gi;
const SPEAKER_BOUNDARY = /\s+(Jon|Trinity|Contact)\s*:\s*/gi;

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
    .replace(SPEAKER_ALIAS, 'Trinity:')
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
    .map((part) => sanitizeAlbumMessageText(part).replace(SPEAKER_ALIAS, 'Trinity:'))
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
  const lines = splitAlbumMessages(value);
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
