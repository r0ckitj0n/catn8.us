import { PhotoAlbum } from '../../types/photoAlbums';
import { formatAlbumCaption, sanitizeAlbumMessageText, splitAlbumMessages, toAlbumDisplayName } from '../../utils/photoAlbumText';
import { PreparedMediaItem, ViewerTarget, ViewerType } from './types';

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

export type DecorItem = {
  id: string;
  emoji: string;
  x?: number;
  y?: number;
  size?: number;
  rotation?: number;
};

export function isVideoMedia(src: string, mediaType?: string): boolean {
  if (mediaType === 'video') {
    return true;
  }
  return /\.(mov|mp4|m4v|3gp|avi|mkv|webm)(\?.*)?$/i.test(src || '');
}

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

export function positionByFlow(index: number, total: number, groupCenterX: number, seed: string): { x: number; y: number; rotate: number } {
  const hash = hashValue(`${seed}-${index}-${groupCenterX}`);
  const progress = total <= 1 ? 0.5 : index / (total - 1);
  const baseY = 5 + (progress * 84);
  const clusterWidth = 7;
  const jitterX = (((Math.floor(hash / 37) % 100) / 100) - 0.5) * clusterWidth;
  const jitterY = (((Math.floor(hash / 101) % 100) / 100) - 0.5) * 8;
  const x = clamp(groupCenterX + jitterX, 3, 90);
  const y = clamp(baseY + jitterY, 4, 90);
  const rotate = ((Math.floor(hash / 19) % 13) - 6);
  return { x, y, rotate };
}

export function positionByDecorScatter(index: number, total: number, seed: string): { x: number; y: number; rotate: number } {
  const hash = hashValue(`${seed}-${index}`);
  const anchors = [
    { x: 10, y: 10 }, { x: 50, y: 10 }, { x: 88, y: 12 },
    { x: 12, y: 32 }, { x: 88, y: 34 }, { x: 10, y: 56 },
    { x: 50, y: 50 }, { x: 90, y: 56 }, { x: 12, y: 82 },
    { x: 48, y: 84 }, { x: 88, y: 82 }, { x: 28, y: 68 },
  ];
  const anchor = anchors[index % Math.max(total, anchors.length)];
  const jitterX = ((hash % 100) / 100 - 0.5) * 8;
  const jitterY = (((Math.floor(hash / 100) % 100) / 100) - 0.5) * 8;
  return {
    x: clamp(anchor.x + jitterX, 3, 94),
    y: clamp(anchor.y + jitterY, 4, 92),
    rotate: ((Math.floor(hash / 31) % 12) - 6),
  };
}

export function spreadMedia(album: PhotoAlbum, targetSpreadIndex: number): PreparedMediaItem[] {
  const spread = album.spec?.spreads?.[targetSpreadIndex];
  const images = Array.isArray(spread?.images) ? spread.images : [];
  const list: PreparedMediaItem[] = [];
  images.forEach((image, index) => {
    if (!image || typeof image !== 'object') {
      return;
    }
    const src = String(image.display_src || image.src || '').trim();
    if (!src) {
      return;
    }
    const caption = formatAlbumCaption(image.caption || image.memory_text || `Memory ${index + 1}`);
    const capturedAtMs = Date.parse(String(image.captured_at || ''));
    list.push({
      key: `${album.id}-${targetSpreadIndex}-${index}-${src}`,
      sourceIndex: index,
      src,
      mediaType: image.media_type,
      caption,
      capturedAtMs: Number.isFinite(capturedAtMs) ? capturedAtMs : undefined,
    });
  });
  return list.sort((a, b) => {
    if (typeof a.capturedAtMs === 'number' && typeof b.capturedAtMs === 'number') {
      return a.capturedAtMs - b.capturedAtMs;
    }
    if (typeof a.capturedAtMs === 'number') {
      return -1;
    }
    if (typeof b.capturedAtMs === 'number') {
      return 1;
    }
    return a.key.localeCompare(b.key);
  });
}

export function spreadNotes(album: PhotoAlbum, targetSpreadIndex: number, media: PreparedMediaItem[], contactDisplayName?: string): NoteItem[] {
  const spread = album.spec?.spreads?.[targetSpreadIndex];
  const noteLayout = (spread && typeof spread.note_layout === 'object' && spread.note_layout)
    ? spread.note_layout
    : {};
  const dedup = new Set<string>();
  const addUniqueNote = (note: NoteItem, out: NoteItem[]) => {
    const canonical = `${note.speaker}:${note.time || ''}:${note.text}`.toLowerCase();
    if (!canonical.trim() || dedup.has(canonical)) {
      return;
    }
    dedup.add(canonical);
    out.push(note);
  };

  const mediaNotes = media.flatMap((mediaItem) => (
    splitAlbumMessages(mediaItem.caption)
      .map((line, lineIndex) => {
        if (!isMessageLikeLine(line)) {
          return null;
        }
        const sourceImage = spread?.images?.[mediaItem.sourceIndex];
        const mediaContactLabel = String(sourceImage?.speaker_label || spread?.default_contact_label || '').trim();
        const parsed = parseSpeakerLine(line, contactDisplayName, mediaContactLabel);
        if (!parsed.body) {
          return null;
        }
        const fullText = `${parsed.speaker}${parsed.time ? ` (${parsed.time})` : ''}: ${parsed.body}`;
        if (shouldHideNoteText(fullText)) {
          return null;
        }
        return {
          id: `media-note-${mediaItem.sourceIndex}-${lineIndex}`,
          text: parsed.body,
          speaker: parsed.speaker,
          time: parsed.time,
          x: Number((noteLayout as any)?.[`media-note-${mediaItem.sourceIndex}-${lineIndex}`]?.x),
          y: Number((noteLayout as any)?.[`media-note-${mediaItem.sourceIndex}-${lineIndex}`]?.y),
          w: Number((noteLayout as any)?.[`media-note-${mediaItem.sourceIndex}-${lineIndex}`]?.w),
          h: Number((noteLayout as any)?.[`media-note-${mediaItem.sourceIndex}-${lineIndex}`]?.h),
          rotation: Number((noteLayout as any)?.[`media-note-${mediaItem.sourceIndex}-${lineIndex}`]?.rotation),
        } as NoteItem;
      })
      .filter((item): item is NoteItem => Boolean(item))
  ));

  const spreadTextItems = Array.isArray(spread?.text_items) ? spread.text_items : [];
  if (spreadTextItems.length > 0) {
    const notes = spreadTextItems
      .map((item, index) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const textItemContactLabel = String((item as { speaker?: string }).speaker || spread?.default_contact_label || '').trim();
        const parsed = parseSpeakerLine(item.text || '', contactDisplayName, textItemContactLabel);
        const fullText = `${(item.speaker as string) || parsed.speaker}${parsed.time ? ` (${parsed.time})` : ''}: ${parsed.body}`;
        if (shouldHideNoteText(fullText)) {
          return null;
        }
        return {
          id: item.id || `text-${index}`,
          text: parsed.body,
          speaker: resolveContactSpeaker(
            String((item as { speaker?: string }).speaker || '').trim() || parsed.speaker,
            contactDisplayName,
            spread?.default_contact_label,
          ),
          time: item.time || parsed.time,
          x: Number(item.x ?? (noteLayout as any)?.[item.id || `text-${index}`]?.x),
          y: Number(item.y ?? (noteLayout as any)?.[item.id || `text-${index}`]?.y),
          w: Number(item.w ?? (noteLayout as any)?.[item.id || `text-${index}`]?.w),
          h: Number((item as any).h ?? (noteLayout as any)?.[item.id || `text-${index}`]?.h),
          rotation: Number(item.rotation ?? (noteLayout as any)?.[item.id || `text-${index}`]?.rotation),
        } as NoteItem;
      })
      .filter((item): item is NoteItem => Boolean(item && item.text));
    const combined: NoteItem[] = [];
    notes.forEach((note) => addUniqueNote(note, combined));
    mediaNotes.forEach((note) => addUniqueNote(note, combined));
    return combined;
  }

  const rawLines = splitAlbumMessages(spread?.caption || '');
  const notes: NoteItem[] = [];
  mediaNotes.forEach((note) => addUniqueNote(note, notes));
  rawLines.forEach((line, index) => {
    const parsed = parseSpeakerLine(line, contactDisplayName, spread?.default_contact_label);
    if (!parsed.body) {
      return;
    }
    if (!isMessageLikeLine(line)) {
      return;
    }
    if (shouldHideNoteText(`${parsed.speaker}${parsed.time ? ` (${parsed.time})` : ''}: ${parsed.body}`)) {
      return;
    }
    addUniqueNote({
      id: `spread-note-${index}`,
      text: parsed.body,
      speaker: parsed.speaker,
      time: parsed.time,
      x: Number((noteLayout as any)?.[`spread-note-${index}`]?.x),
      y: Number((noteLayout as any)?.[`spread-note-${index}`]?.y),
      w: Number((noteLayout as any)?.[`spread-note-${index}`]?.w),
      h: Number((noteLayout as any)?.[`spread-note-${index}`]?.h),
      rotation: Number((noteLayout as any)?.[`spread-note-${index}`]?.rotation),
    }, notes);
  });
  return notes;
}

export function spreadDecor(album: PhotoAlbum, targetSpreadIndex: number, emojiPool: string[]): DecorItem[] {
  const spread = album.spec?.spreads?.[targetSpreadIndex];
  const existing = Array.isArray(spread?.decor_items) ? spread.decor_items : [];
  if (existing.length > 0) {
    return existing.map((item, idx) => {
      const safe = (item && typeof item === 'object') ? item : {};
      return {
        id: (safe as any).id || `${album.id}-${targetSpreadIndex}-decor-${idx}`,
        emoji: (safe as any).emoji || emojiPool[idx % emojiPool.length] || '✨',
        x: (safe as any).x,
        y: (safe as any).y,
        size: (safe as any).size,
        rotation: (safe as any).rotation,
      };
    });
  }
  return emojiPool.slice(0, 6).map((emoji, index) => {
    const pos = positionByDecorScatter(index, 6, `${album.id}-${targetSpreadIndex}-decor`);
    return {
      id: `${album.id}-${targetSpreadIndex}-decor-auto-${index}`,
      emoji,
      x: pos.x,
      y: pos.y,
      size: 1 + ((index % 3) * 0.1),
      rotation: pos.rotate,
    };
  });
}

export function findAdjacentItemTarget(album: PhotoAlbum, current: ViewerTarget, direction: -1 | 1, contactDisplayName?: string): ViewerTarget | null {
  const spreads = Array.isArray(album.spec?.spreads) ? album.spec.spreads : [];
  const itemListAt = (type: ViewerType, sidx: number): number => {
    const media = spreadMedia(album, sidx);
    const notes = spreadNotes(album, sidx, media, contactDisplayName);
    return type === 'media' ? media.length : notes.length;
  };

  const currentCount = itemListAt(current.type, current.spreadIndex);
  if (direction === 1 && current.itemIndex + 1 < currentCount) {
    return { ...current, itemIndex: current.itemIndex + 1 };
  }
  if (direction === -1 && current.itemIndex - 1 >= 0) {
    return { ...current, itemIndex: current.itemIndex - 1 };
  }

  const start = current.spreadIndex + direction;
  for (let sidx = start; sidx >= 0 && sidx < spreads.length; sidx += direction) {
    const count = itemListAt(current.type, sidx);
    if (count > 0) {
      return {
        type: current.type,
        spreadIndex: sidx,
        itemIndex: direction === 1 ? 0 : count - 1,
      };
    }
  }

  return null;
}

export type LayoutItem = {
  id: string;
  type: 'media' | 'note' | 'decor';
  index: number;
  sourceIndex?: number;
  pinned?: boolean;
  timelineOrder?: number;
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  size?: number;
};

export type SelectedItem = {
  type: 'media' | 'note' | 'decor';
  index: number;
  sourceIndex?: number;
};

export type ResizeState = {
  type: 'media' | 'note' | 'decor';
  index: number;
  sourceIndex?: number;
  direction: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
};

export const CANVAS_MIN_X = 2;
export const CANVAS_MAX_X = 98;
export const CANVAS_MIN_Y = 4;
export const CANVAS_MAX_Y = 94;
export const MAX_COVERAGE = 0.01;
export const MAX_CORE_OVERLAP = 0;
export const OVERLAP_EPSILON = 0.001;
export const RESERVED_PADDING_PCT = 1.4;
export const LAYOUT_NUDGE_PCT = 0.8;
export const MIN_CORE_GAP_PCT = 2.6;
export const MIN_ITEM_GAP_PCT = 0.9;
export const TIMELINE_TOP_PCT = 6;
export const TIMELINE_BOTTOM_PCT = 90;

export type LayoutRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type LayoutConstraints = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  reserved: LayoutRect[];
};

export function estimateNoteHeightPct(note: NoteItem, widthPct: number): number {
  const text = formatNoteText(note);
  const charsPerLine = Math.max(10, Math.floor(widthPct * 1.45));
  const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
  const base = 9.2;
  const lineHeight = 4.35;
  return clamp(base + (lines * lineHeight), 14, 68);
}

export function estimateMediaHeightPct(caption: string, widthPct: number): number {
  const text = sanitizeAlbumMessageText(caption || '');
  const charsPerLine = Math.max(12, Math.floor(widthPct * 1.6));
  const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
  // Image footprint (4:3) + frame/padding + caption text block.
  const imageHeight = widthPct * 0.76;
  const frameBase = 5.8;
  const captionLineHeight = 3.5;
  return clamp(imageHeight + frameBase + (lines * captionLineHeight), 18, 72);
}

export function visibleMediaCaption(caption: string): string {
  return isTranscriptCaption(caption) ? '' : caption;
}

export function sizeVariation(seed: string, min: number, max: number): number {
  const hash = hashValue(seed) % 10_000;
  const factor = hash / 10_000;
  return min + ((max - min) * factor);
}

export function effectiveRect(item: LayoutItem): LayoutRect {
  const radians = (Math.abs(item.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rotatedWidth = Math.abs((item.w * cos) + (item.h * sin));
  const rotatedHeight = Math.abs((item.w * sin) + (item.h * cos));
  const safetyScale = isCoreItem(item) ? 1.06 : 1;
  const w = rotatedWidth * safetyScale;
  const h = rotatedHeight * safetyScale;
  const centerX = item.x + (item.w / 2);
  const centerY = item.y + (item.h / 2);
  return {
    x: centerX - (w / 2),
    y: centerY - (h / 2),
    w,
    h,
  };
}

export function overlapArea(a: LayoutItem, b: LayoutItem): number {
  const aPad = (MIN_ITEM_GAP_PCT / 2) + (isCoreItem(a) ? (MIN_CORE_GAP_PCT / 2) : 0);
  const bPad = (MIN_ITEM_GAP_PCT / 2) + (isCoreItem(b) ? (MIN_CORE_GAP_PCT / 2) : 0);
  const ra = effectiveRect(a);
  const rb = effectiveRect(b);
  const left = Math.max(ra.x - aPad, rb.x - bPad);
  const right = Math.min(ra.x + ra.w + aPad, rb.x + rb.w + bPad);
  const top = Math.max(ra.y - aPad, rb.y - bPad);
  const bottom = Math.min(ra.y + ra.h + aPad, rb.y + rb.h + bPad);
  if (right <= left || bottom <= top) {
    return 0;
  }
  return (right - left) * (bottom - top);
}

export function rectsOverlap(a: LayoutRect, b: LayoutRect): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

export function itemWithoutReservedCollision(item: LayoutItem, constraints: LayoutConstraints): LayoutItem {
  if (constraints.reserved.length === 0) {
    return item;
  }
  const next = { ...item };
  const itemRect = (): LayoutRect => ({ x: next.x, y: next.y, w: next.w, h: next.h });
  const isValid = (candidate: LayoutRect): boolean => (
    !constraints.reserved.some((rect) => rectsOverlap(candidate, rect))
  );

  for (let guard = 0; guard < 6; guard += 1) {
    const collision = constraints.reserved.find((rect) => rectsOverlap(itemRect(), rect));
    if (!collision) {
      break;
    }
    const maxX = Math.max(constraints.minX, constraints.maxX - next.w);
    const maxY = Math.max(constraints.minY, constraints.maxY - next.h);
    const candidates: Array<{ x: number; y: number }> = [
      { x: next.x, y: clamp(collision.y + collision.h + LAYOUT_NUDGE_PCT, constraints.minY, maxY) },
      { x: clamp(collision.x + collision.w + LAYOUT_NUDGE_PCT, constraints.minX, maxX), y: next.y },
      { x: clamp(collision.x - next.w - LAYOUT_NUDGE_PCT, constraints.minX, maxX), y: next.y },
      { x: next.x, y: clamp(collision.y - next.h - LAYOUT_NUDGE_PCT, constraints.minY, maxY) },
    ];
    let best = { x: next.x, y: next.y };
    let bestDistance = Number.POSITIVE_INFINITY;
    candidates.forEach((candidate) => {
      const candidateRect: LayoutRect = { x: candidate.x, y: candidate.y, w: next.w, h: next.h };
      if (!isValid(candidateRect)) {
        return;
      }
      const dx = candidate.x - next.x;
      const dy = candidate.y - next.y;
      const distance = (dx * dx) + (dy * dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    });
    next.x = best.x;
    next.y = best.y;
  }

  return next;
}

export function constrainLayout(item: LayoutItem, constraints: LayoutConstraints): LayoutItem {
  const itemMinX = Number.isFinite(item.minX) ? Number(item.minX) : constraints.minX;
  const itemMaxX = Number.isFinite(item.maxX) ? Number(item.maxX) : constraints.maxX;
  const itemMinY = Number.isFinite(item.minY) ? Number(item.minY) : constraints.minY;
  const itemMaxY = Number.isFinite(item.maxY) ? Number(item.maxY) : constraints.maxY;
  const laneWidth = Math.max(1, itemMaxX - itemMinX);
  const laneHeight = Math.max(1, itemMaxY - itemMinY);
  const fittedW = Math.min(item.w, laneWidth);
  const fittedH = Math.min(item.h, laneHeight);
  const maxX = Math.max(itemMinX, itemMaxX - fittedW);
  const maxY = Math.max(itemMinY, itemMaxY - fittedH);
  const bounded = {
    ...item,
    w: fittedW,
    h: fittedH,
    x: clamp(item.x, itemMinX, maxX),
    y: clamp(item.y, itemMinY, maxY),
  };
  return itemWithoutReservedCollision(bounded, constraints);
}

export function constrainEditableLayout(item: LayoutItem, constraints: LayoutConstraints): LayoutItem {
  const itemMinX = Number.isFinite(item.minX) ? Number(item.minX) : constraints.minX;
  const itemMaxX = Number.isFinite(item.maxX) ? Number(item.maxX) : constraints.maxX;
  const itemMinY = Number.isFinite(item.minY) ? Number(item.minY) : constraints.minY;
  const itemMaxY = Number.isFinite(item.maxY) ? Number(item.maxY) : constraints.maxY;
  const laneWidth = Math.max(1, itemMaxX - itemMinX);
  const laneHeight = Math.max(1, itemMaxY - itemMinY);
  return {
    ...item,
    w: Math.min(item.w, laneWidth),
    h: Math.min(item.h, laneHeight),
    x: clamp(item.x, itemMinX, itemMaxX),
    y: clamp(item.y, itemMinY, itemMaxY),
  };
}

export function isCoreItem(item: LayoutItem): boolean {
  return item.type === 'media' || item.type === 'note';
}

export function minimumWidthFor(item: LayoutItem): number {
  if (item.type === 'media') {
    return 9.5;
  }
  if (item.type === 'note') {
    return 10.5;
  }
  return 3.2;
}

export function minimumHeightFor(item: LayoutItem): number {
  if (item.type === 'media') {
    return 9.5;
  }
  if (item.type === 'note') {
    return 8.2;
  }
  return 3.2;
}

export function collidesWithReserved(item: LayoutItem, constraints: LayoutConstraints): boolean {
  if (constraints.reserved.length === 0) {
    return false;
  }
  const rect: LayoutRect = { x: item.x, y: item.y, w: item.w, h: item.h };
  return constraints.reserved.some((reserved) => rectsOverlap(rect, reserved));
}

export function maximizeCoreItems(items: LayoutItem[], constraints: LayoutConstraints): LayoutItem[] {
  const resolved = items.map((item) => constrainLayout({ ...item }, constraints));
  for (let pass = 0; pass < 4; pass += 1) {
    for (let i = 0; i < resolved.length; i += 1) {
      const current = resolved[i];
      if (!isCoreItem(current)) {
        continue;
      }
      const maxWidth = current.type === 'media' ? 62 : 58;
      const maxHeight = current.type === 'media' ? 74 : 72;
      const step = current.type === 'media' ? 1.038 : 1.032;
      let candidate = { ...current };
      for (let grow = 0; grow < 40; grow += 1) {
        if (candidate.w >= maxWidth || candidate.h >= maxHeight) {
          break;
        }
        const nextW = Math.min(maxWidth, candidate.w * step);
        const nextH = Math.min(maxHeight, candidate.h * step);
        let next: LayoutItem = {
          ...candidate,
          w: nextW,
          h: nextH,
          x: candidate.x - ((nextW - candidate.w) / 2),
          y: candidate.y - ((nextH - candidate.h) / 2),
        };
        next = constrainLayout(next, constraints);
        if (collidesWithReserved(next, constraints)) {
          break;
        }
        const hasCoreCollision = resolved.some((other, j) => (
          j !== i
          && isCoreItem(other)
          && overlapArea(next, other) > OVERLAP_EPSILON
        ));
        if (hasCoreCollision) {
          break;
        }
        if ((next.w * next.h) <= (candidate.w * candidate.h)) {
          break;
        }
        candidate = next;
      }
      resolved[i] = candidate;
    }
  }
  return resolved;
}

export function forceSeparate(items: LayoutItem[], seed: string, constraints: LayoutConstraints): LayoutItem[] {
  const resolved = items.map((item) => constrainLayout({ ...item }, constraints));
  for (let pass = 0; pass < 120; pass += 1) {
    let changed = false;
    for (let i = 0; i < resolved.length; i += 1) {
      for (let j = i + 1; j < resolved.length; j += 1) {
        const a = resolved[i];
        const b = resolved[j];
        const overlap = overlapArea(a, b);
        if (overlap <= OVERLAP_EPSILON) {
          continue;
        }
        const hash = hashValue(`${seed}-separate-${pass}-${a.id}-${b.id}`);
        const acx = a.x + (a.w / 2);
        const acy = a.y + (a.h / 2);
        const bcx = b.x + (b.w / 2);
        const bcy = b.y + (b.h / 2);
        let dx = acx - bcx;
        let dy = acy - bcy;
        if (Math.abs(dx) < 0.02 && Math.abs(dy) < 0.02) {
          dx = hash % 2 === 0 ? 1 : -1;
          dy = Math.floor(hash / 13) % 2 === 0 ? 1 : -1;
        }
        const len = Math.max(0.001, Math.hypot(dx, dy));
        const push = 0.52 + Math.min(4.6, overlap / 16);
        const aWeight = a.pinned && !b.pinned ? 0.15 : !a.pinned && b.pinned ? 0.85 : 0.5;
        const bWeight = 1 - aWeight;

        a.x += (dx / len) * push * aWeight;
        a.y += (dy / len) * push * aWeight;
        b.x -= (dx / len) * push * bWeight;
        b.y -= (dy / len) * push * bWeight;

        resolved[i] = constrainLayout(a, constraints);
        resolved[j] = constrainLayout(b, constraints);
        changed = true;
      }
    }
    if (!changed && pass > 5) {
      break;
    }
    if (pass % 20 === 19) {
      resolved.forEach((item, idx) => {
        const hasCollision = resolved.some((other, j) => j !== idx && overlapArea(item, other) > OVERLAP_EPSILON);
        if (!hasCollision) {
          return;
        }
        item.w = Math.max(minimumWidthFor(item), item.w * 0.975);
        item.h = Math.max(minimumHeightFor(item), item.h * 0.975);
        resolved[idx] = constrainLayout(item, constraints);
      });
    }
  }
  return resolved;
}

export function enforceNoTouch(items: LayoutItem[], seed: string, constraints: LayoutConstraints): LayoutItem[] {
  const cores = items
    .filter((item) => isCoreItem(item))
    .sort((a, b) => {
      const ao = Number.isFinite(a.timelineOrder) ? Number(a.timelineOrder) : Number.POSITIVE_INFINITY;
      const bo = Number.isFinite(b.timelineOrder) ? Number(b.timelineOrder) : Number.POSITIVE_INFINITY;
      if (ao !== bo) {
        return ao - bo;
      }
      return a.id.localeCompare(b.id);
    });
  const decors = items
    .filter((item) => !isCoreItem(item))
    .sort((a, b) => a.id.localeCompare(b.id));

  const placed: LayoutItem[] = [];
  const fits = (candidate: LayoutItem): boolean => (
    !placed.some((other) => overlapArea(candidate, other) > OVERLAP_EPSILON)
  );
  const maxOrder = cores.reduce((max, item) => {
    const order = Number.isFinite(item.timelineOrder) ? Number(item.timelineOrder) : 0;
    return Math.max(max, order);
  }, 0);

  const placeItem = (item: LayoutItem, preferredX: number, preferredY: number): LayoutItem => {
    let candidate = constrainLayout({ ...item, x: preferredX, y: preferredY }, constraints);
    let found = fits(candidate);
    let w = candidate.w;
    let h = candidate.h;

    for (let shrinkPass = 0; shrinkPass < 20 && !found; shrinkPass += 1) {
      const ringStep = 1.1 + (shrinkPass * 0.12);
      for (let attempt = 0; attempt < 280 && !found; attempt += 1) {
        const hash = hashValue(`${seed}-${item.id}-${shrinkPass}-${attempt}`);
        const ring = Math.floor(attempt / 14);
        const angle = ((hash % 360) * Math.PI) / 180;
        const radiusX = ring * ringStep;
        const radiusY = ring * ringStep * 0.95;
        const dx = Math.cos(angle) * radiusX;
        const dy = Math.sin(angle) * radiusY;
        const test = constrainLayout({ ...candidate, x: preferredX + dx, y: preferredY + dy, w, h }, constraints);
        if (fits(test)) {
          candidate = test;
          found = true;
        }
      }
      if (!found) {
        w = Math.max(minimumWidthFor(item), w * 0.97);
        h = Math.max(minimumHeightFor(item), h * 0.97);
        candidate = constrainLayout({ ...candidate, w, h, x: preferredX, y: preferredY }, constraints);
        found = fits(candidate);
      }
    }
    return candidate;
  };

  cores.forEach((item) => {
    const order = Number.isFinite(item.timelineOrder) ? Number(item.timelineOrder) : 0;
    const progress = maxOrder <= 0 ? 0.5 : clamp(order / maxOrder, 0, 1);
    const ySpan = Math.max(2, TIMELINE_BOTTOM_PCT - TIMELINE_TOP_PCT);
    const preferredY = TIMELINE_TOP_PCT + (progress * ySpan);
    const placedItem = placeItem(item, item.x, preferredY);
    placed.push(placedItem);
  });

  decors.forEach((item) => {
    placed.push(placeItem(item, item.x, item.y));
  });

  const byId = new Map<string, LayoutItem>();
  placed.forEach((item) => byId.set(item.id, item));
  return items.map((item) => byId.get(item.id) || item);
}

export function resolveLayout(items: LayoutItem[], seed: string, constraints: LayoutConstraints): LayoutItem[] {
  const resolved = items.map((item) => constrainLayout({ ...item }, constraints));
  for (let pass = 0; pass < 72; pass += 1) {
    let changed = false;
    for (let i = 0; i < resolved.length; i += 1) {
      const current = resolved[i];
      const currentPushFactor = current.pinned ? 0.55 : 1;
      let pushX = 0;
      let pushY = 0;
      for (let j = 0; j < resolved.length; j += 1) {
        if (i === j) {
          continue;
        }
        const placed = resolved[j];
        const overlap = overlapArea(current, placed);
        if (!overlap) {
          continue;
        }
        const strictNoOverlap = isCoreItem(current) && isCoreItem(placed);
        const currentCoverage = overlap / Math.max(1, current.w * current.h);
        const placedCoverage = overlap / Math.max(1, placed.w * placed.h);
        const maxAllowed = strictNoOverlap ? MAX_CORE_OVERLAP : MAX_COVERAGE;
        if (currentCoverage <= maxAllowed && placedCoverage <= maxAllowed) {
          continue;
        }
        const hash = hashValue(`${seed}-${current.id}-${placed.id}-${pass}-${j}`);
        const currentCx = current.x + (current.w / 2);
        const currentCy = current.y + (current.h / 2);
        const placedCx = placed.x + (placed.w / 2);
        const placedCy = placed.y + (placed.h / 2);
        let dx = currentCx - placedCx;
        let dy = currentCy - placedCy;
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
          dx = (hash % 2 === 0) ? 1 : -1;
          dy = (Math.floor(hash / 11) % 2 === 0) ? 1 : -1;
        }
        const len = Math.max(0.001, Math.hypot(dx, dy));
        const severity = Math.max(currentCoverage, placedCoverage) - maxAllowed;
        const push = strictNoOverlap ? (1.5 + (severity * 22)) : (0.8 + (severity * 14));
        pushX += (dx / len) * push * currentPushFactor;
        pushY += (dy / len) * push * currentPushFactor;
      }
      if (Math.abs(pushX) > 0.01 || Math.abs(pushY) > 0.01) {
        current.x += pushX;
        current.y += pushY;
        const bounded = constrainLayout(current, constraints);
        current.x = bounded.x;
        current.y = bounded.y;
        changed = true;
      }
      resolved[i] = constrainLayout(current, constraints);
    }
    if (!changed && pass > 6) {
      break;
    }
    if (pass % 12 === 11) {
      for (let i = 0; i < resolved.length; i += 1) {
        const current = resolved[i];
        if (!isCoreItem(current)) {
          continue;
        }
        let violation = 0;
        for (let j = 0; j < resolved.length; j += 1) {
          if (i === j) {
            continue;
          }
          const overlap = overlapArea(current, resolved[j]);
          if (!overlap) {
            continue;
          }
          if (!isCoreItem(resolved[j])) {
            continue;
          }
          const coverage = overlap / Math.max(1, current.w * current.h);
          if (coverage > MAX_CORE_OVERLAP) {
            violation += (coverage - MAX_CORE_OVERLAP);
          }
        }
        if (violation > OVERLAP_EPSILON) {
          current.w = Math.max(current.type === 'media' ? 10.5 : 11.5, current.w * 0.975);
          current.h = Math.max(current.type === 'media' ? 11 : 10, current.h * 0.975);
          resolved[i] = constrainLayout(current, constraints);
          changed = true;
        }
      }
    }
    if (!changed) {
      break;
    }
  }

  for (let i = 0; i < resolved.length; i += 1) {
    const current = resolved[i];
    if (!isCoreItem(current)) {
      continue;
    }
    for (let guard = 0; guard < 80; guard += 1) {
      let hasCollision = false;
      for (let j = 0; j < resolved.length; j += 1) {
        if (i === j || !isCoreItem(resolved[j])) {
          continue;
        }
        if (overlapArea(current, resolved[j]) > OVERLAP_EPSILON) {
          hasCollision = true;
          break;
        }
      }
      if (!hasCollision) {
        break;
      }
      const hash = hashValue(`${seed}-final-${current.id}-${guard}`);
      const stepX = ((hash % 2 === 0) ? 1 : -1) * (2 + (hash % 3));
      const stepY = 2 + (Math.floor(hash / 7) % 4);
      current.x += stepX;
      current.y += stepY;
      const bounded = constrainLayout(current, constraints);
      current.x = bounded.x;
      current.y = bounded.y;
      if (guard % 10 === 9) {
        current.w = Math.max(current.type === 'media' ? 10 : 11, current.w * 0.985);
        current.h = Math.max(current.type === 'media' ? 10.5 : 9.5, current.h * 0.985);
      }
    }
    resolved[i] = constrainLayout(current, constraints);
  }

  return enforceNoTouch(
    maximizeCoreItems(forceSeparate(resolved, `${seed}-finalize`, constraints), constraints),
    seed,
    constraints,
  );
}

export function createFlowOrders(mediaItems: PreparedMediaItem[], notes: NoteItem[], spreadTitle: string): {
  mediaOrder: Map<number, number>;
  noteOrder: Map<number, number>;
  mediaGroup: Map<number, number>;
  noteGroup: Map<number, number>;
  groupCenterXByIndex: Map<number, number>;
  total: number;
  totalGroups: number;
} {
  const mediaOrder = new Map<number, number>();
  const noteOrder = new Map<number, number>();
  const mediaGroup = new Map<number, number>();
  const noteGroup = new Map<number, number>();
  const timeline: Array<{ type: 'media' | 'note'; index: number; orderKey: number; groupKey: number }> = [];
  const spreadDateMs = Date.parse(String(spreadTitle || '').trim());
  const halfHourMs = 30 * 60 * 1000;
  let fallbackCursor = 0;

  mediaItems.forEach((item, index) => {
    const fallback = 10_000_000_000 + index;
    const timed = typeof item.capturedAtMs === 'number' ? item.capturedAtMs : null;
    const groupKey = timed !== null ? Math.floor(timed / halfHourMs) : 9_000_000 + Math.floor(fallbackCursor / 2);
    fallbackCursor += 1;
    timeline.push({
      type: 'media',
      index,
      orderKey: timed !== null ? timed : fallback,
      groupKey,
    });
  });

  notes.forEach((note, index) => {
    const minuteOffset = parseClockToMinutes(note.time);
    const fallback = 20_000_000_000 + index;
    const timedOrderKey = Number.isFinite(spreadDateMs) && minuteOffset !== null
      ? (spreadDateMs + (minuteOffset * 60 * 1000))
      : null;
    const groupKey = timedOrderKey !== null ? Math.floor(timedOrderKey / halfHourMs) : 9_000_000 + Math.floor(fallbackCursor / 2);
    fallbackCursor += 1;
    timeline.push({ type: 'note', index, orderKey: timedOrderKey !== null ? timedOrderKey : fallback, groupKey });
  });

  timeline.sort((a, b) => {
    if (a.orderKey !== b.orderKey) {
      return a.orderKey - b.orderKey;
    }
    return a.index - b.index;
  });

  timeline.forEach((entry, flowIndex) => {
    if (entry.type === 'media') {
      mediaOrder.set(entry.index, flowIndex);
      mediaGroup.set(entry.index, entry.groupKey);
    } else {
      noteOrder.set(entry.index, flowIndex);
      noteGroup.set(entry.index, entry.groupKey);
    }
  });

  const groupKeys = Array.from(new Set(timeline.map((entry) => entry.groupKey))).sort((a, b) => a - b);
  const groupIndexByKey = new Map<number, number>();
  groupKeys.forEach((key, idx) => {
    groupIndexByKey.set(key, idx);
  });

  const groupCenterXByIndex = new Map<number, number>();
  const groupKeysForX = [...groupKeys].sort((a, b) => {
    const ah = hashValue(`gx-${a}`);
    const bh = hashValue(`gx-${b}`);
    return ah - bh;
  });
  const slotByGroupKey = new Map<number, number>();
  groupKeysForX.forEach((key, slot) => {
    slotByGroupKey.set(key, slot);
  });
  groupKeys.forEach((key, chronologicalIndex) => {
    const slot = slotByGroupKey.get(key) ?? 0;
    const denom = Math.max(1, groupKeys.length - 1);
    const centerX = groupKeys.length <= 1 ? 50 : (6 + ((slot / denom) * 86));
    groupCenterXByIndex.set(chronologicalIndex, centerX);
  });

  mediaGroup.forEach((key, index) => {
    mediaGroup.set(index, groupIndexByKey.get(key) ?? 0);
  });
  noteGroup.forEach((key, index) => {
    noteGroup.set(index, groupIndexByKey.get(key) ?? 0);
  });

  const total = Math.max(1, timeline.length);
  return {
    mediaOrder,
    noteOrder,
    mediaGroup,
    noteGroup,
    groupCenterXByIndex,
    total,
    totalGroups: Math.max(1, groupKeys.length),
  };
}

