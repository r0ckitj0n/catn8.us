import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';
import { formatAlbumCaption, inferAlbumTheme, sanitizeAlbumMessageText, splitAlbumMessages, toAlbumDisplayName } from '../../utils/photoAlbumText';
import { LockIcon } from './LockIcon';
import { PhotoAlbumElementViewer } from './PhotoAlbumElementViewer';
import { PreparedMediaItem, ViewerTarget, ViewerType } from './types';

interface PhotoAlbumStageProps {
  album: PhotoAlbum;
  spreadIndex: number;
  zoom: number;
  contactDisplayName?: string;
  respectSavedPositions?: boolean;
  pageFavorite?: boolean;
  isMediaFavorite?: (spreadIndex: number, mediaSourceIndex: number) => boolean;
  isTextFavorite?: (spreadIndex: number, textItemId: string) => boolean;
  canPrev?: boolean;
  canNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onTogglePageFavorite?: (spreadIndex: number) => void;
  onToggleMediaFavorite?: (spreadIndex: number, mediaSourceIndex: number) => void;
  onToggleTextFavorite?: (spreadIndex: number, textItemId: string) => void;
  pageLocked?: boolean;
  albumLocked?: boolean;
  onTogglePageLock?: (spreadIndex: number) => void;
  onToggleAlbumLock?: () => void;
  editable?: boolean;
  onMoveMedia?: (index: number, patch: { x: number; y: number; w?: number; h?: number }) => void;
  onMoveNote?: (noteId: string, index: number, patch: { x: number; y: number; w?: number; h?: number }) => void;
  onMoveDecor?: (index: number, patch: { x: number; y: number; emoji?: string; size?: number; rotation?: number }) => void;
  onEditNoteText?: (index: number, nextText: string) => void;
  onEditMediaCaption?: (index: number, nextCaption: string) => void;
  onEditDecor?: (index: number, patch: { emoji?: string; size?: number }) => void;
  onDuplicateMedia?: (index: number) => void;
  onDuplicateNote?: (index: number) => void;
  onDuplicateDecor?: (index: number) => void;
  onDeleteMedia?: (index: number) => void;
  onDeleteNote?: (index: number) => void;
  onDeleteDecor?: (index: number) => void;
  onBackToAlbums?: () => void;
}

type NoteItem = {
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

type DecorItem = {
  id: string;
  emoji: string;
  x?: number;
  y?: number;
  size?: number;
  rotation?: number;
};

function isVideoMedia(src: string, mediaType?: string): boolean {
  if (mediaType === 'video') {
    return true;
  }
  return /\.(mov|mp4|m4v|3gp|avi|mkv|webm)(\?.*)?$/i.test(src || '');
}

function hashValue(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveContactSpeaker(rawSpeaker: string, contactDisplayName?: string, perMessageContactLabel?: string): string {
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

function parseSpeakerLine(
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

function formatNoteText(note: NoteItem): string {
  const timePart = note.time ? ` (${note.time})` : '';
  return `${note.speaker}${timePart}: ${note.text}`;
}

function isMessageLikeLine(line: string): boolean {
  return /^([A-Za-z][A-Za-z' -]{0,30}|Contact|Unknown)\s*(?:\([0-9]{1,2}:[0-9]{2}\s*[AP]M\)|\[[0-9]{1,2}:[0-9]{2}\s*[AP]M\])?\s*:/i.test(sanitizeAlbumMessageText(line));
}

function isTranscriptCaption(text: string): boolean {
  const lines = splitAlbumMessages(text).filter(Boolean);
  if (!lines.length) {
    return false;
  }
  const messageLikeCount = lines.filter((line) => isMessageLikeLine(line)).length;
  return messageLikeCount >= 1 && (messageLikeCount / lines.length) >= 0.6;
}

function shouldHideNoteText(value: string): boolean {
  const normalized = sanitizeAlbumMessageText(value).toLowerCase();
  if (!normalized) {
    return true;
  }
  if (/\bno\s+message\s+text\b/.test(normalized)) {
    return true;
  }
  return normalized.includes('attachment media currently unavailable');
}

function parseClockToMinutes(value?: string): number | null {
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

function positionByFlow(index: number, total: number, groupCenterX: number, seed: string): { x: number; y: number; rotate: number } {
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

function positionByDecorScatter(index: number, total: number, seed: string): { x: number; y: number; rotate: number } {
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

function spreadMedia(album: PhotoAlbum, targetSpreadIndex: number): PreparedMediaItem[] {
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

function spreadNotes(album: PhotoAlbum, targetSpreadIndex: number, media: PreparedMediaItem[], contactDisplayName?: string): NoteItem[] {
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

function spreadDecor(album: PhotoAlbum, targetSpreadIndex: number, emojiPool: string[]): DecorItem[] {
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

function findAdjacentItemTarget(album: PhotoAlbum, current: ViewerTarget, direction: -1 | 1, contactDisplayName?: string): ViewerTarget | null {
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

function findAdjacentSpreadTarget(album: PhotoAlbum, current: ViewerTarget, direction: -1 | 1, contactDisplayName?: string): ViewerTarget | null {
  const spreads = Array.isArray(album.spec?.spreads) ? album.spec.spreads : [];
  const itemListAt = (type: ViewerType, sidx: number): number => {
    const media = spreadMedia(album, sidx);
    const notes = spreadNotes(album, sidx, media, contactDisplayName);
    return type === 'media' ? media.length : notes.length;
  };
  for (let sidx = current.spreadIndex + direction; sidx >= 0 && sidx < spreads.length; sidx += direction) {
    const count = itemListAt(current.type, sidx);
    if (count > 0) {
      return {
        type: current.type,
        spreadIndex: sidx,
        itemIndex: clamp(current.itemIndex, 0, Math.max(0, count - 1)),
      };
    }
  }
  return null;
}

type LayoutItem = {
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

type SelectedItem = {
  type: 'media' | 'note' | 'decor';
  index: number;
  sourceIndex?: number;
};

type ResizeState = {
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

const CANVAS_MIN_X = 2;
const CANVAS_MAX_X = 98;
const CANVAS_MIN_Y = 4;
const CANVAS_MAX_Y = 94;
const MAX_COVERAGE = 0.01;
const MAX_CORE_OVERLAP = 0;
const OVERLAP_EPSILON = 0.001;
const RESERVED_PADDING_PCT = 1.4;
const LAYOUT_NUDGE_PCT = 0.8;
const MIN_CORE_GAP_PCT = 2.6;
const MIN_ITEM_GAP_PCT = 0.9;
const TIMELINE_TOP_PCT = 6;
const TIMELINE_BOTTOM_PCT = 90;

type LayoutRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type LayoutConstraints = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  reserved: LayoutRect[];
};

function estimateNoteHeightPct(note: NoteItem, widthPct: number): number {
  const text = formatNoteText(note);
  const charsPerLine = Math.max(10, Math.floor(widthPct * 1.45));
  const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
  const base = 9.2;
  const lineHeight = 4.35;
  return clamp(base + (lines * lineHeight), 14, 68);
}

function estimateMediaHeightPct(caption: string, widthPct: number): number {
  const text = sanitizeAlbumMessageText(caption || '');
  const charsPerLine = Math.max(12, Math.floor(widthPct * 1.6));
  const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
  // Image footprint (4:3) + frame/padding + caption text block.
  const imageHeight = widthPct * 0.76;
  const frameBase = 5.8;
  const captionLineHeight = 3.5;
  return clamp(imageHeight + frameBase + (lines * captionLineHeight), 18, 72);
}

function visibleMediaCaption(caption: string): string {
  return isTranscriptCaption(caption) ? '' : caption;
}

function sizeVariation(seed: string, min: number, max: number): number {
  const hash = hashValue(seed) % 10_000;
  const factor = hash / 10_000;
  return min + ((max - min) * factor);
}

function effectiveRect(item: LayoutItem): LayoutRect {
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

function overlapArea(a: LayoutItem, b: LayoutItem): number {
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

function rectsOverlap(a: LayoutRect, b: LayoutRect): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

function itemWithoutReservedCollision(item: LayoutItem, constraints: LayoutConstraints): LayoutItem {
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

function constrainLayout(item: LayoutItem, constraints: LayoutConstraints): LayoutItem {
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

function constrainEditableLayout(item: LayoutItem, constraints: LayoutConstraints): LayoutItem {
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

function isCoreItem(item: LayoutItem): boolean {
  return item.type === 'media' || item.type === 'note';
}

function minimumWidthFor(item: LayoutItem): number {
  if (item.type === 'media') {
    return 9.5;
  }
  if (item.type === 'note') {
    return 10.5;
  }
  return 3.2;
}

function minimumHeightFor(item: LayoutItem): number {
  if (item.type === 'media') {
    return 9.5;
  }
  if (item.type === 'note') {
    return 8.2;
  }
  return 3.2;
}

function collidesWithReserved(item: LayoutItem, constraints: LayoutConstraints): boolean {
  if (constraints.reserved.length === 0) {
    return false;
  }
  const rect: LayoutRect = { x: item.x, y: item.y, w: item.w, h: item.h };
  return constraints.reserved.some((reserved) => rectsOverlap(rect, reserved));
}

function maximizeCoreItems(items: LayoutItem[], constraints: LayoutConstraints): LayoutItem[] {
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

function forceSeparate(items: LayoutItem[], seed: string, constraints: LayoutConstraints): LayoutItem[] {
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

function enforceNoTouch(items: LayoutItem[], seed: string, constraints: LayoutConstraints): LayoutItem[] {
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

function resolveLayout(items: LayoutItem[], seed: string, constraints: LayoutConstraints): LayoutItem[] {
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

function createFlowOrders(mediaItems: PreparedMediaItem[], notes: NoteItem[], spreadTitle: string): {
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

export function PhotoAlbumStage({
  album,
  spreadIndex,
  zoom,
  contactDisplayName,
  respectSavedPositions = false,
  pageFavorite = false,
  isMediaFavorite,
  isTextFavorite,
  canPrev = false,
  canNext = false,
  onPrev,
  onNext,
  onTogglePageFavorite,
  onToggleMediaFavorite,
  onToggleTextFavorite,
  pageLocked = false,
  albumLocked = false,
  onTogglePageLock,
  onToggleAlbumLock,
  editable = false,
  onMoveMedia,
  onMoveNote,
  onMoveDecor,
  onEditNoteText,
  onEditMediaCaption,
  onEditDecor,
  onDuplicateMedia,
  onDuplicateNote,
  onDuplicateDecor,
  onDeleteMedia,
  onDeleteNote,
  onDeleteDecor,
  onBackToAlbums,
}: PhotoAlbumStageProps) {
  const isLayoutLocked = albumLocked || pageLocked;
  const spread = album.spec?.spreads?.[spreadIndex] || null;
  const mediaItems = React.useMemo(() => {
    try {
      return spreadMedia(album, spreadIndex);
    } catch {
      return [] as PreparedMediaItem[];
    }
  }, [album, spreadIndex]);
  const notes = React.useMemo(() => {
    try {
      return spreadNotes(album, spreadIndex, mediaItems, contactDisplayName);
    } catch {
      return [] as NoteItem[];
    }
  }, [album, spreadIndex, mediaItems, contactDisplayName]);
  const theme = inferAlbumTheme([spread?.title || '', spread?.caption || '', ...notes.map((n) => n.text)].join(' '));
  const decorItems = React.useMemo(() => {
    try {
      return spreadDecor(album, spreadIndex, theme.emojis);
    } catch {
      return [] as DecorItem[];
    }
  }, [album, spreadIndex, theme.emojis]);
  const spreadBackgroundImageUrl = String((spread as { background_image_url?: string } | null)?.background_image_url || '').trim();
  const canvasWidthPx = Math.max(1, Number(album.spec?.dimensions?.width_px || 1400));
  const canvasHeightPx = Math.max(1, Number(album.spec?.dimensions?.height_px || 1050));
  const spreadHeaderLabel = React.useMemo(() => {
    const captured = mediaItems
      .map((item) => item.capturedAtMs)
      .filter((value): value is number => Number.isFinite(value));
    if (captured.length > 0) {
      const date = new Date(Math.min(...captured));
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    return sanitizeAlbumMessageText(spread?.title || 'Untitled Spread');
  }, [mediaItems, spread?.title]);

  const densityCount = notes.length + mediaItems.length;
  const mediaWidthPct = densityCount <= 2
    ? 44
    : densityCount <= 4
      ? 30
      : densityCount <= 8
        ? 22
        : densityCount >= 16
          ? 11
          : densityCount >= 10
            ? 13
            : 16;
  const noteWidthPct = densityCount <= 2
    ? 40
    : densityCount <= 4
      ? 28
      : densityCount <= 8
        ? 20
        : densityCount >= 16
          ? 12
          : densityCount >= 10
            ? 14
            : 17;

  const [viewerTarget, setViewerTarget] = React.useState<ViewerTarget | null>(null);
  const [dragging, setDragging] = React.useState<null | { type: 'media' | 'note' | 'decor'; index: number; sourceIndex?: number }>(null);
  const [resizing, setResizing] = React.useState<ResizeState | null>(null);
  const [selectedItem, setSelectedItem] = React.useState<SelectedItem | null>(null);
  const dragStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const dragMovedRef = React.useRef(false);
  const suppressClickRef = React.useRef(false);
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const scatterRef = React.useRef<HTMLDivElement | null>(null);
  const headerRef = React.useRef<HTMLDivElement | null>(null);
  const [fittedCanvasSize, setFittedCanvasSize] = React.useState<{ width: number; height: number } | null>(null);
  const [reservedHeaderRect, setReservedHeaderRect] = React.useState<LayoutRect | null>(null);

  React.useEffect(() => {
    setViewerTarget(null);
    setDragging(null);
    setResizing(null);
    setSelectedItem(null);
  }, [album.id, spreadIndex]);

  React.useLayoutEffect(() => {
    const scatterEl = scatterRef.current;
    if (!scatterEl || canvasWidthPx <= 0 || canvasHeightPx <= 0) {
      return undefined;
    }

    const updateSize = () => {
      const box = scatterEl.getBoundingClientRect();
      const style = window.getComputedStyle(scatterEl);
      const padX = (parseFloat(style.paddingLeft || '0') || 0) + (parseFloat(style.paddingRight || '0') || 0);
      const padY = (parseFloat(style.paddingTop || '0') || 0) + (parseFloat(style.paddingBottom || '0') || 0);
      const availableW = Math.max(80, box.width - padX);
      const availableH = Math.max(80, box.height - padY);
      let nextWidth = Math.max(80, Math.floor(canvasWidthPx));
      let nextHeight = Math.max(80, Math.floor(canvasHeightPx));

      if (editable) {
        const scale = Math.min(availableW / canvasWidthPx, availableH / canvasHeightPx);
        nextWidth = Math.max(80, Math.floor(canvasWidthPx * scale));
        nextHeight = Math.max(80, Math.floor(canvasHeightPx * scale));
      } else {
        // Viewer mode: fill the available viewport box so preview/fullscreen use full width.
        // Room-map background and items share this same grid, so positions stay aligned.
        nextWidth = Math.max(80, Math.floor(availableW));
        nextHeight = Math.max(80, Math.floor(availableH));
      }
      setFittedCanvasSize((prev) => {
        if (prev && Math.abs(prev.width - nextWidth) < 1 && Math.abs(prev.height - nextHeight) < 1) {
          return prev;
        }
        return { width: nextWidth, height: nextHeight };
      });
    };

    updateSize();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateSize())
      : null;
    observer?.observe(scatterEl);
    window.addEventListener('resize', updateSize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [canvasWidthPx, canvasHeightPx, editable, zoom, spreadIndex, album.id]);

  React.useEffect(() => {
    const measure = () => {
      const headerEl = headerRef.current;
      const canvasEl = canvasRef.current;
      if (!headerEl || !canvasEl) {
        setReservedHeaderRect(null);
        return;
      }
      const headerBox = headerEl.getBoundingClientRect();
      const canvasBox = canvasEl.getBoundingClientRect();
      if (canvasBox.width <= 0 || canvasBox.height <= 0) {
        setReservedHeaderRect(null);
        return;
      }
      const x = ((headerBox.left - canvasBox.left) / canvasBox.width) * 100;
      const y = ((headerBox.top - canvasBox.top) / canvasBox.height) * 100;
      const w = (headerBox.width / canvasBox.width) * 100;
      const h = (headerBox.height / canvasBox.height) * 100;
      const next: LayoutRect = {
        x: clamp(x - RESERVED_PADDING_PCT, CANVAS_MIN_X, CANVAS_MAX_X),
        y: clamp(y - RESERVED_PADDING_PCT, CANVAS_MIN_Y, CANVAS_MAX_Y),
        w: clamp(w + (RESERVED_PADDING_PCT * 2), 0, CANVAS_MAX_X - CANVAS_MIN_X),
        h: clamp(h + (RESERVED_PADDING_PCT * 2), 0, CANVAS_MAX_Y - CANVAS_MIN_Y),
      };
      setReservedHeaderRect(next);
    };

    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    const timer = window.setTimeout(measure, 80);
    return () => {
      window.removeEventListener('resize', onResize);
      window.clearTimeout(timer);
    };
  }, [album.id, spreadIndex, zoom, notes.length, mediaItems.length, decorItems.length]);

  const layoutConstraints = React.useMemo<LayoutConstraints>(() => ({
    minX: CANVAS_MIN_X,
    maxX: CANVAS_MAX_X,
    minY: CANVAS_MIN_Y,
    maxY: CANVAS_MAX_Y,
    reserved: reservedHeaderRect ? [reservedHeaderRect] : [],
  }), [reservedHeaderRect]);

  const layoutByType = React.useMemo(() => {
    try {
      const flow = createFlowOrders(mediaItems, notes, spread?.title || '');
      const estimatedMediaArea = mediaItems.reduce((sum, item) => sum + (mediaWidthPct * estimateMediaHeightPct(item.caption, mediaWidthPct)), 0);
      const estimatedNoteArea = notes.reduce((sum, item) => sum + (noteWidthPct * estimateNoteHeightPct(item, noteWidthPct)), 0);
      const canvasArea = Math.max(1, (CANVAS_MAX_X - CANVAS_MIN_X) * (CANVAS_MAX_Y - CANVAS_MIN_Y));
      const estimatedCoverage = (estimatedMediaArea + estimatedNoteArea) / canvasArea;
      const targetCoverage = densityCount <= 2
        ? 0.9
        : densityCount <= 4
          ? 0.88
          : densityCount <= 8
            ? 0.84
            : densityCount <= 12
              ? 0.82
              : densityCount <= 16
                ? 0.86
                : 0.9;
      const sizeScale = clamp(Math.sqrt(targetCoverage / Math.max(0.0001, estimatedCoverage)), 0.78, 1.75);
      const decorScale = clamp(0.95 + ((sizeScale - 1) * 0.56), 0.85, 1.95);
      const singleMediaSingleNote = mediaItems.length === 1 && notes.length === 1;

      const mediaLayout: LayoutItem[] = mediaItems.map((item, index) => {
        const source = spread?.images?.[item.sourceIndex];
        const flowIndex = flow.mediaOrder.get(index) ?? index;
        const groupIndex = flow.mediaGroup.get(index) ?? 0;
        const groupCenterX = flow.groupCenterXByIndex.get(groupIndex) ?? 50;
        const fallback = positionByFlow(flowIndex, flow.total, groupCenterX, `${album.id}-${spreadIndex}-flow`);
        const hasPinnedPosition = respectSavedPositions && Number.isFinite(Number(source?.x)) && Number.isFinite(Number(source?.y));
        const sourceBaseWidth = Number(source?.w ?? mediaWidthPct);
        const variation = sizeVariation(`${album.id}-${spreadIndex}-media-${item.key}`, densityCount <= 2 ? 0.92 : 0.78, densityCount <= 2 ? 1.18 : 1.28);
        const w = clamp(sourceBaseWidth * sizeScale * variation, 10.5, 46);
        const singleHash = hashValue(`${album.id}-${spreadIndex}-single-media-${item.key}`);
        const singleX = 5 + ((singleHash % 8) * 0.65);
        const singleY = 14 + ((Math.floor(singleHash / 17) % 12) * 0.7);
        const visibleCaption = visibleMediaCaption(item.caption);
        return {
          id: `media-${item.sourceIndex}`,
          type: 'media',
          index,
          sourceIndex: item.sourceIndex,
          pinned: hasPinnedPosition,
          timelineOrder: flowIndex,
          x: hasPinnedPosition ? Number(source?.x) : Number(singleMediaSingleNote ? singleX : fallback.x),
          y: hasPinnedPosition ? Number(source?.y) : Number(singleMediaSingleNote ? singleY : fallback.y),
          w,
          h: (hasPinnedPosition && Number.isFinite(Number((source as any)?.h)))
            ? Number((source as any).h)
            : estimateMediaHeightPct(visibleCaption, w),
          rotation: clamp(Number(source?.rotation ?? (singleMediaSingleNote ? (fallback.rotate - 2) : fallback.rotate)), -8, 8),
        };
      });
      const noteLayout: LayoutItem[] = notes.map((note, index) => {
        const flowIndex = flow.noteOrder.get(index) ?? (mediaItems.length + index);
        const groupIndex = flow.noteGroup.get(index) ?? 0;
        const groupCenterX = flow.groupCenterXByIndex.get(groupIndex) ?? 50;
        const fallback = positionByFlow(flowIndex, flow.total, groupCenterX, `${album.id}-${spreadIndex}-flow`);
        const hasPinnedPosition = respectSavedPositions && Number.isFinite(Number(note.x)) && Number.isFinite(Number(note.y));
        const noteBaseWidth = Number(note.w ?? noteWidthPct);
        const variation = sizeVariation(`${album.id}-${spreadIndex}-note-${note.id}`, densityCount <= 2 ? 0.9 : 0.74, densityCount <= 2 ? 1.2 : 1.32);
        const w = clamp(noteBaseWidth * sizeScale * variation, 11, 48);
        const singleHash = hashValue(`${album.id}-${spreadIndex}-single-note-${note.id}`);
        const singleX = 48 + ((singleHash % 10) * 0.75);
        const singleY = 28 + ((Math.floor(singleHash / 13) % 14) * 0.75);
        return {
          id: `note-${index}`,
          type: 'note',
          index,
          pinned: hasPinnedPosition,
          timelineOrder: flowIndex,
          x: hasPinnedPosition ? Number(note.x) : Number(singleMediaSingleNote ? singleX : fallback.x),
          y: hasPinnedPosition ? Number(note.y) : Number(singleMediaSingleNote ? singleY : fallback.y),
          w,
          h: (hasPinnedPosition && Number.isFinite(Number(note.h)))
            ? Number(note.h)
            : estimateNoteHeightPct(note, w),
          rotation: clamp(Number(note.rotation ?? (singleMediaSingleNote ? (fallback.rotate + 2) : fallback.rotate)), -7, 7),
        };
      });
      const decorLayout: LayoutItem[] = decorItems.map((item, index) => {
        const fallback = positionByDecorScatter(index, Math.max(1, decorItems.length), `${album.id}-${spreadIndex}-decor`);
        const hasPinnedPosition = respectSavedPositions && Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.y));
        const savedSize = Number(item.size ?? 1);
        const variation = sizeVariation(`${album.id}-${spreadIndex}-decor-${item.id}`, 0.72, 1.45);
        const size = clamp(savedSize * decorScale * variation, 0.65, 2.3);
        const footprint = 4.6 * size;
        return {
          id: `decor-${index}`,
          type: 'decor',
          index,
          pinned: hasPinnedPosition,
          x: hasPinnedPosition ? Number(item.x) : Number(fallback.x),
          y: hasPinnedPosition ? Number(item.y) : Number(fallback.y),
          w: footprint,
          h: footprint,
          size,
          rotation: clamp(Number(item.rotation ?? fallback.rotate), -9, 9),
        };
      });

      const baseLayout = [...mediaLayout, ...noteLayout, ...decorLayout];
      const resolved = respectSavedPositions
        ? baseLayout.map((item) => constrainEditableLayout({ ...item }, layoutConstraints))
        : (editable && !isLayoutLocked)
          ? baseLayout.map((item) => constrainEditableLayout({ ...item }, layoutConstraints))
          : resolveLayout(baseLayout, `${album.id}-${spreadIndex}`, layoutConstraints);
      const mediaByIndex = new Map<number, LayoutItem>();
      const noteByIndex = new Map<number, LayoutItem>();
      const decorByIndex = new Map<number, LayoutItem>();
      resolved.forEach((item) => {
        if (item.type === 'media') {
          mediaByIndex.set(item.index, item);
        } else if (item.type === 'note') {
          noteByIndex.set(item.index, item);
        } else {
          decorByIndex.set(item.index, item);
        }
      });
      return { mediaByIndex, noteByIndex, decorByIndex };
    } catch {
      return {
        mediaByIndex: new Map<number, LayoutItem>(),
        noteByIndex: new Map<number, LayoutItem>(),
        decorByIndex: new Map<number, LayoutItem>(),
      };
    }
  }, [
    album.id,
    spread,
    spreadIndex,
    mediaItems,
    notes,
    decorItems,
    mediaWidthPct,
    noteWidthPct,
    densityCount,
    layoutConstraints,
    respectSavedPositions,
    editable,
    isLayoutLocked,
  ]);

  const activeMedia = React.useMemo(() => {
    if (!viewerTarget || viewerTarget.type !== 'media') {
      return null;
    }
    const list = spreadMedia(album, viewerTarget.spreadIndex);
    return list[viewerTarget.itemIndex] || null;
  }, [album, viewerTarget]);

  const activeNote = React.useMemo(() => {
    if (!viewerTarget || viewerTarget.type !== 'note') {
      return null;
    }
    const list = spreadNotes(album, viewerTarget.spreadIndex, spreadMedia(album, viewerTarget.spreadIndex), contactDisplayName);
    const note = list[viewerTarget.itemIndex];
    return note ? formatNoteText(note) : '';
  }, [album, viewerTarget, contactDisplayName]);

  const prevTarget = viewerTarget
    ? (viewerTarget.type === 'media'
      ? findAdjacentSpreadTarget(album, viewerTarget, -1, contactDisplayName)
      : findAdjacentItemTarget(album, viewerTarget, -1, contactDisplayName))
    : null;
  const nextTarget = viewerTarget
    ? (viewerTarget.type === 'media'
      ? findAdjacentSpreadTarget(album, viewerTarget, 1, contactDisplayName)
      : findAdjacentItemTarget(album, viewerTarget, 1, contactDisplayName))
    : null;
  const canFavoriteCurrentPage = album.id > 0 && !album.is_virtual && typeof onTogglePageFavorite === 'function';
  const canFavoriteCurrentMedia = album.id > 0 && !album.is_virtual && typeof onToggleMediaFavorite === 'function' && viewerTarget?.type === 'media' && Boolean(activeMedia);
  const canFavoriteCurrentText = album.id > 0 && !album.is_virtual && typeof onToggleTextFavorite === 'function' && viewerTarget?.type === 'note';
  const activeMediaFavorited = (canFavoriteCurrentMedia && activeMedia && typeof isMediaFavorite === 'function')
    ? isMediaFavorite(viewerTarget?.spreadIndex ?? spreadIndex, activeMedia.sourceIndex)
    : false;
  const activeViewerNote = React.useMemo(() => {
    if (!viewerTarget || viewerTarget.type !== 'note') {
      return null;
    }
    const list = spreadNotes(album, viewerTarget.spreadIndex, spreadMedia(album, viewerTarget.spreadIndex), contactDisplayName);
    return list[viewerTarget.itemIndex] || null;
  }, [album, viewerTarget, contactDisplayName]);
  const activeNoteFavorited = (canFavoriteCurrentText && activeViewerNote && typeof isTextFavorite === 'function' && viewerTarget)
    ? isTextFavorite(viewerTarget.spreadIndex, activeViewerNote.id)
    : false;
  const viewerDateLabel = React.useMemo(() => {
    if (!viewerTarget) {
      return '';
    }
    if (viewerTarget.type === 'media' && activeMedia?.capturedAtMs) {
      return new Date(activeMedia.capturedAtMs).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    const spreadForTarget = album.spec?.spreads?.[viewerTarget.spreadIndex];
    const spreadCaptured = spreadMedia(album, viewerTarget.spreadIndex)
      .map((item) => item.capturedAtMs)
      .filter((value): value is number => Number.isFinite(value));
    if (spreadCaptured.length > 0) {
      return new Date(Math.min(...spreadCaptured)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    return sanitizeAlbumMessageText(spreadForTarget?.title || '');
  }, [activeMedia?.capturedAtMs, album, viewerTarget]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          target.isContentEditable
          || tag === 'INPUT'
          || tag === 'TEXTAREA'
          || tag === 'SELECT'
          || tag === 'BUTTON'
          || tag === 'VIDEO'
        ) {
          return;
        }
      }

      if (event.key === 'ArrowLeft') {
        if (viewerTarget) {
          if (prevTarget) {
            event.preventDefault();
            setViewerTarget(prevTarget);
          }
          return;
        }
        if (canPrev && typeof onPrev === 'function') {
          event.preventDefault();
          onPrev();
        }
        return;
      }

      if (event.key === 'ArrowRight') {
        if (viewerTarget) {
          if (nextTarget) {
            event.preventDefault();
            setViewerTarget(nextTarget);
          }
          return;
        }
        if (canNext && typeof onNext === 'function') {
          event.preventDefault();
          onNext();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [canNext, canPrev, nextTarget, onNext, onPrev, prevTarget, viewerTarget]);

  const applyDragPosition = React.useCallback((clientX: number, clientY: number) => {
    if (!editable || isLayoutLocked || !dragging || resizing) {
      return;
    }
    if (dragStartRef.current) {
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;
      if ((dx * dx) + (dy * dy) > 16) {
        dragMovedRef.current = true;
      }
    }
    const canvasEl = canvasRef.current;
    if (!canvasEl) {
      return;
    }
    const canvas = canvasEl.getBoundingClientRect();
    const currentLayout = dragging.type === 'media'
      ? layoutByType.mediaByIndex.get(dragging.index)
      : dragging.type === 'note'
        ? layoutByType.noteByIndex.get(dragging.index)
        : layoutByType.decorByIndex.get(dragging.index);
    const widthPct = currentLayout?.w ?? 8;
    const heightPct = currentLayout?.h ?? 8;
    const x = ((clientX - canvas.left) / canvas.width) * 100;
    const y = ((clientY - canvas.top) / canvas.height) * 100;
    const baseItem = {
      id: `${dragging.type}-${dragging.index}`,
      type: dragging.type,
      index: dragging.index,
      sourceIndex: dragging.sourceIndex,
      x,
      y,
      w: widthPct,
      h: heightPct,
      rotation: 0,
    } as LayoutItem;
    const constrained = (editable && !isLayoutLocked)
      ? constrainEditableLayout(baseItem, layoutConstraints)
      : constrainLayout(baseItem, layoutConstraints);
    if (Math.abs(constrained.x - (currentLayout?.x ?? constrained.x)) < 0.18 && Math.abs(constrained.y - (currentLayout?.y ?? constrained.y)) < 0.18) {
      return;
    }
    if (dragging.type === 'media' && onMoveMedia) {
      onMoveMedia(dragging.sourceIndex ?? dragging.index, { x: constrained.x, y: constrained.y });
    }
    if (dragging.type === 'note' && onMoveNote) {
      const noteId = notes[dragging.index]?.id || `text-${dragging.index}`;
      onMoveNote(noteId, dragging.index, { x: constrained.x, y: constrained.y });
    }
    if (dragging.type === 'decor' && onMoveDecor) {
      const currentDecor = decorItems[dragging.index];
      onMoveDecor(dragging.index, {
        x: constrained.x,
        y: constrained.y,
        emoji: currentDecor?.emoji,
        size: currentDecor?.size,
        rotation: currentDecor?.rotation,
      });
    }
  }, [editable, isLayoutLocked, dragging, resizing, layoutByType, onMoveDecor, onMoveMedia, onMoveNote, layoutConstraints, decorItems, notes]);

  const applyResizePosition = React.useCallback((clientX: number, clientY: number) => {
    if (!editable || isLayoutLocked || !resizing) {
      return;
    }
    if (dragStartRef.current) {
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;
      if ((dx * dx) + (dy * dy) > 16) {
        dragMovedRef.current = true;
      }
    }
    const canvasEl = canvasRef.current;
    if (!canvasEl) {
      return;
    }
    const canvas = canvasEl.getBoundingClientRect();
    const deltaX = ((clientX - resizing.startClientX) / Math.max(1, canvas.width)) * 100;
    const deltaY = ((clientY - resizing.startClientY) / Math.max(1, canvas.height)) * 100;
    const affectsEast = resizing.direction.includes('e');
    const affectsWest = resizing.direction.includes('w');
    const affectsNorth = resizing.direction.includes('n');
    const affectsSouth = resizing.direction.includes('s');

    let nextX = resizing.startX;
    let nextY = resizing.startY;
    let nextW = resizing.startW;
    let nextH = resizing.startH;

    if (affectsEast) {
      nextW = resizing.startW + deltaX;
    }
    if (affectsWest) {
      nextW = resizing.startW - deltaX;
      nextX = resizing.startX + deltaX;
    }
    if (affectsSouth) {
      nextH = resizing.startH + deltaY;
    }
    if (affectsNorth) {
      nextH = resizing.startH - deltaY;
      nextY = resizing.startY + deltaY;
    }

    const limits = resizing.type === 'media'
      ? { minW: 9.5, maxW: 62, minH: 9.5, maxH: 74 }
      : resizing.type === 'note'
        ? { minW: 10.5, maxW: 58, minH: 8.2, maxH: 72 }
        : { minW: 3.2, maxW: 10.6, minH: 3.2, maxH: 10.6 };

    nextW = clamp(nextW, limits.minW, limits.maxW);
    nextH = clamp(nextH, limits.minH, limits.maxH);

    const baseItem = {
      id: `${resizing.type}-${resizing.index}`,
      type: resizing.type,
      index: resizing.index,
      sourceIndex: resizing.sourceIndex,
      x: nextX,
      y: nextY,
      w: nextW,
      h: nextH,
      rotation: 0,
    } as LayoutItem;
    const constrained = (editable && !isLayoutLocked)
      ? constrainEditableLayout(baseItem, layoutConstraints)
      : constrainLayout(baseItem, layoutConstraints);
    const activeLayout = resizing.type === 'media'
      ? layoutByType.mediaByIndex.get(resizing.index)
      : resizing.type === 'note'
        ? layoutByType.noteByIndex.get(resizing.index)
        : layoutByType.decorByIndex.get(resizing.index);
    const samePosition = Math.abs(constrained.x - (activeLayout?.x ?? constrained.x)) < 0.18
      && Math.abs(constrained.y - (activeLayout?.y ?? constrained.y)) < 0.18;
    const sameSize = Math.abs(constrained.w - (activeLayout?.w ?? constrained.w)) < 0.18
      && Math.abs(constrained.h - (activeLayout?.h ?? constrained.h)) < 0.18;
    if (samePosition && sameSize) {
      return;
    }

    if (resizing.type === 'media' && onMoveMedia) {
      onMoveMedia(resizing.sourceIndex ?? resizing.index, {
        x: constrained.x,
        y: constrained.y,
        w: constrained.w,
        h: constrained.h,
      });
      return;
    }
    if (resizing.type === 'note' && onMoveNote) {
      const noteId = notes[resizing.index]?.id || `text-${resizing.index}`;
      onMoveNote(noteId, resizing.index, {
        x: constrained.x,
        y: constrained.y,
        w: constrained.w,
        h: constrained.h,
      });
      return;
    }
    if (resizing.type === 'decor' && onMoveDecor) {
      const currentDecor = decorItems[resizing.index];
      onMoveDecor(resizing.index, {
        x: constrained.x,
        y: constrained.y,
        size: clamp(constrained.w / 4.6, 0.65, 2.3),
        emoji: currentDecor?.emoji,
        rotation: currentDecor?.rotation,
      });
    }
  }, [editable, isLayoutLocked, layoutConstraints, onMoveDecor, onMoveMedia, onMoveNote, resizing, decorItems, notes, layoutByType]);

  const endDragging = React.useCallback(() => {
    if (dragMovedRef.current) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 180);
    }
    dragMovedRef.current = false;
    dragStartRef.current = null;
    setDragging(null);
    setResizing(null);
  }, []);

  React.useEffect(() => {
    if (!editable || isLayoutLocked || (!dragging && !resizing)) {
      return undefined;
    }
    const onWindowMove = (event: PointerEvent) => {
      if (resizing) {
        applyResizePosition(event.clientX, event.clientY);
      } else {
        applyDragPosition(event.clientX, event.clientY);
      }
    };
    const onWindowUp = () => {
      endDragging();
    };
    window.addEventListener('pointermove', onWindowMove);
    window.addEventListener('pointerup', onWindowUp);
    window.addEventListener('pointercancel', onWindowUp);
    return () => {
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('pointercancel', onWindowUp);
    };
  }, [applyDragPosition, applyResizePosition, dragging, resizing, editable, endDragging, isLayoutLocked]);

  const onItemClick = React.useCallback((item: SelectedItem, viewerType: ViewerType | null) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (editable) {
      setSelectedItem(item);
      return;
    }
    if (viewerType) {
      setViewerTarget({ type: viewerType, spreadIndex, itemIndex: item.index });
    }
  }, [editable, spreadIndex]);

  const selectedNoteText = React.useMemo(() => {
    if (!selectedItem || selectedItem.type !== 'note') {
      return '';
    }
    return notes[selectedItem.index] ? formatNoteText(notes[selectedItem.index]) : '';
  }, [selectedItem, notes]);

  const onViewSelected = React.useCallback(() => {
    if (!selectedItem || selectedItem.type === 'decor') {
      return;
    }
    setViewerTarget({ type: selectedItem.type, spreadIndex, itemIndex: selectedItem.index });
  }, [selectedItem, spreadIndex]);

  const onEditSelected = React.useCallback(() => {
    if (!selectedItem || isLayoutLocked) {
      return;
    }
    if (selectedItem.type === 'media') {
      const media = mediaItems[selectedItem.index];
      if (!media || !onEditMediaCaption) {
        return;
      }
      const next = window.prompt('Edit media caption', media.caption || '');
      if (typeof next === 'string') {
        onEditMediaCaption(selectedItem.sourceIndex ?? selectedItem.index, next.trim());
      }
      return;
    }
    if (selectedItem.type === 'note') {
      if (!onEditNoteText) {
        return;
      }
      const next = window.prompt('Edit text', selectedNoteText);
      if (typeof next === 'string' && next.trim()) {
        onEditNoteText(selectedItem.index, next.trim());
      }
      return;
    }
    if (selectedItem.type === 'decor' && onEditDecor) {
      const current = decorItems[selectedItem.index];
      const nextEmoji = window.prompt('Edit emoji', current?.emoji || '✨');
      if (typeof nextEmoji === 'string' && nextEmoji.trim()) {
        onEditDecor(selectedItem.index, { emoji: nextEmoji.trim() });
      }
    }
  }, [selectedItem, isLayoutLocked, mediaItems, onEditMediaCaption, onEditNoteText, selectedNoteText, onEditDecor, decorItems]);

  const onDuplicateSelected = React.useCallback(() => {
    if (!selectedItem || isLayoutLocked) {
      return;
    }
    if (selectedItem.type === 'media' && onDuplicateMedia) {
      onDuplicateMedia(selectedItem.sourceIndex ?? selectedItem.index);
      return;
    }
    if (selectedItem.type === 'note' && onDuplicateNote) {
      onDuplicateNote(selectedItem.index);
      return;
    }
    if (selectedItem.type === 'decor' && onDuplicateDecor) {
      onDuplicateDecor(selectedItem.index);
    }
  }, [selectedItem, isLayoutLocked, onDuplicateMedia, onDuplicateNote, onDuplicateDecor]);

  const onDeleteSelected = React.useCallback(() => {
    if (!selectedItem || isLayoutLocked) {
      return;
    }
    if (selectedItem.type === 'media' && onDeleteMedia) {
      onDeleteMedia(selectedItem.sourceIndex ?? selectedItem.index);
      setSelectedItem(null);
      return;
    }
    if (selectedItem.type === 'note' && onDeleteNote) {
      onDeleteNote(selectedItem.index);
      setSelectedItem(null);
      return;
    }
    if (selectedItem.type === 'decor' && onDeleteDecor) {
      onDeleteDecor(selectedItem.index);
      setSelectedItem(null);
    }
  }, [selectedItem, isLayoutLocked, onDeleteMedia, onDeleteNote, onDeleteDecor]);

  const renderMediaStyle = (index: number): React.CSSProperties => {
    const placement = layoutByType.mediaByIndex.get(index);
    const widthPct = placement?.w ?? mediaWidthPct;
    const captionFontRem = clamp(0.92 + ((widthPct - 14) * 0.018), 0.92, 1.32);
    return {
      left: `${placement?.x ?? CANVAS_MIN_X}%`,
      top: `${placement?.y ?? CANVAS_MIN_Y}%`,
      width: `${widthPct}%`,
      ['--catn8-caption-font-size' as string]: `${captionFontRem.toFixed(2)}rem`,
      transform: `rotate(${placement?.rotation ?? 0}deg) scale(var(--catn8-card-scale, 1))`,
      zIndex: 8 + (index % 4),
      cursor: editable && !isLayoutLocked ? 'grab' : 'pointer',
      touchAction: editable && !isLayoutLocked ? 'none' : 'auto',
    };
  };

  const renderNoteStyle = (_note: NoteItem, index: number): React.CSSProperties => {
    const placement = layoutByType.noteByIndex.get(index);
    const widthPct = placement?.w ?? noteWidthPct;
    const noteFontRem = clamp(0.95 + ((widthPct - 14) * 0.02), 0.95, 1.42);
    return {
      left: `${placement?.x ?? CANVAS_MIN_X}%`,
      top: `${placement?.y ?? CANVAS_MIN_Y}%`,
      width: `${widthPct}%`,
      ['--catn8-note-font-size' as string]: `${noteFontRem.toFixed(2)}rem`,
      transform: `rotate(${placement?.rotation ?? 0}deg) scale(var(--catn8-card-scale, 1))`,
      zIndex: 20 + (index % 4),
      cursor: editable && !isLayoutLocked ? 'grab' : 'pointer',
      touchAction: editable && !isLayoutLocked ? 'none' : 'auto',
    };
  };

  const renderDecorStyle = (_item: DecorItem, index: number): React.CSSProperties => {
    const placement = layoutByType.decorByIndex.get(index);
    return {
      left: `${placement?.x ?? CANVAS_MIN_X}%`,
      top: `${placement?.y ?? CANVAS_MIN_Y}%`,
      transform: `rotate(${placement?.rotation ?? 0}deg) scale(${placement?.size ?? 1})`,
      zIndex: 2,
      pointerEvents: editable ? 'auto' : 'none',
      touchAction: editable ? 'none' : 'auto',
    };
  };
  // Saved placement coordinates are authored against the base canvas.
  // Keep baseline scale when honoring saved positions so normal view, edit, and fullscreen match.
  const effectiveZoom = respectSavedPositions ? 1 : (editable ? 1 : zoom);
  const scatterStyle: React.CSSProperties = {
    transform: `scale(${effectiveZoom})`,
  };
  const canvasStyle: React.CSSProperties = {
    aspectRatio: `${canvasWidthPx} / ${canvasHeightPx}`,
    ...(fittedCanvasSize ? {
      width: `${fittedCanvasSize.width}px`,
      height: `${fittedCanvasSize.height}px`,
    } : {}),
    ...(spreadBackgroundImageUrl ? {
      backgroundImage: `linear-gradient(rgba(255,255,255,0.1), rgba(255,255,255,0.1)), url(${spreadBackgroundImageUrl})`,
      // Coordinates are normalized to canvas percentages; stretch map to the same 0-100 grid.
      backgroundSize: '100% 100%',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    } : {}),
  };

  return (
    <div className="catn8-scrapbook-stage catn8-scrapbook-stage-user">
      <div ref={scatterRef} className={`catn8-scrapbook-scatter catn8-theme-${theme.name}`} style={scatterStyle}>
        <div className="catn8-scrapbook-corner catn8-scrapbook-corner-tl" aria-hidden="true" />
        <div className="catn8-scrapbook-corner catn8-scrapbook-corner-br" aria-hidden="true" />
        <div className="catn8-scrapbook-tape catn8-scrapbook-tape-top" aria-hidden="true" />
        <div className="catn8-scrapbook-tape catn8-scrapbook-tape-right" aria-hidden="true" />

        <button
          type="button"
          className="catn8-stage-nav catn8-stage-nav-prev"
          onClick={onPrev}
          disabled={!canPrev || typeof onPrev !== 'function'}
          aria-label="Previous spread"
        >
          ‹
        </button>
        <button
          type="button"
          className="catn8-stage-nav catn8-stage-nav-next"
          onClick={onNext}
          disabled={!canNext || typeof onNext !== 'function'}
          aria-label="Next spread"
        >
          ›
        </button>

        {canFavoriteCurrentPage ? (
          <button
            type="button"
            className={pageFavorite ? 'catn8-stage-favorite-toggle catn8-stage-page-favorite-toggle is-active' : 'catn8-stage-favorite-toggle catn8-stage-page-favorite-toggle'}
            onClick={() => onTogglePageFavorite?.(spreadIndex)}
            aria-label={pageFavorite ? 'Remove page from favorites' : 'Add page to favorites'}
            aria-pressed={pageFavorite}
            title={pageFavorite ? 'Favorited page' : 'Favorite this page'}
          >
            {pageFavorite ? '♥' : '♡'}
          </button>
        ) : null}
        {typeof onTogglePageLock === 'function' ? (
          <button
            type="button"
            className={pageLocked ? 'catn8-stage-favorite-toggle is-active catn8-stage-lock-toggle' : 'catn8-stage-favorite-toggle catn8-stage-lock-toggle'}
            onClick={() => onTogglePageLock(spreadIndex)}
            aria-label={pageLocked ? 'Unlock this page' : 'Lock this page'}
            title={pageLocked ? 'Page locked' : 'Lock this page'}
          >
            <LockIcon locked={pageLocked} />
          </button>
        ) : null}
        {typeof onToggleAlbumLock === 'function' ? (
          <button
            type="button"
            className={albumLocked ? 'catn8-stage-favorite-toggle is-active catn8-stage-lock-toggle catn8-stage-album-lock-toggle' : 'catn8-stage-favorite-toggle catn8-stage-lock-toggle catn8-stage-album-lock-toggle'}
            onClick={() => onToggleAlbumLock()}
            aria-label={albumLocked ? 'Unlock this album' : 'Lock this album'}
            title={albumLocked ? 'Album locked' : 'Lock this album'}
          >
            <LockIcon locked={albumLocked} />
          </button>
        ) : null}

        <div ref={headerRef} className="catn8-scrapbook-stage-header">
          {typeof onBackToAlbums === 'function' ? (
            <button
              type="button"
              className="catn8-scrapbook-page-tag catn8-scrapbook-page-tag-button"
              onClick={onBackToAlbums}
            >
              Back to Albums
            </button>
          ) : (
            <span className="catn8-scrapbook-page-tag">Spread {spreadIndex + 1}</span>
          )}
          <h3>{spreadHeaderLabel}</h3>
        </div>

        <div
          ref={canvasRef}
          className="catn8-scatter-canvas"
          style={canvasStyle}
          onPointerUp={endDragging}
          onMouseLeave={() => {
            if (!dragging && !resizing) {
              endDragging();
            }
          }}
        >
          {decorItems.map((item, index) => (
            <span
              key={item.id}
              className="catn8-scatter-emoji"
              style={renderDecorStyle(item, index)}
              onPointerDown={editable && !isLayoutLocked ? (event) => {
                const target = event.target as HTMLElement;
                if (target.closest('button')) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                setSelectedItem({ type: 'decor', index });
                dragStartRef.current = { x: event.clientX, y: event.clientY };
                dragMovedRef.current = false;
                setDragging({ type: 'decor', index });
              } : undefined}
              onClick={() => onItemClick({ type: 'decor', index }, null)}
            >
              {item.emoji}
            </span>
          ))}

          {mediaItems.map((item, index) => {
            const imageSrc = item.src;
            const caption = item.caption;
            const showCaption = Boolean(caption && !isTranscriptCaption(caption));
            const mediaFavorited = typeof isMediaFavorite === 'function'
              ? isMediaFavorite(spreadIndex, item.sourceIndex)
              : false;
            return (
              <figure
                className={selectedItem?.type === 'media' && selectedItem.index === index ? 'catn8-scatter-card catn8-scatter-media is-selected' : 'catn8-scatter-card catn8-scatter-media'}
                key={item.key}
                style={renderMediaStyle(index)}
                onPointerDown={editable && !isLayoutLocked ? (event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest('button') || target.closest('video')) {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedItem({ type: 'media', index, sourceIndex: item.sourceIndex });
                  dragStartRef.current = { x: event.clientX, y: event.clientY };
                  dragMovedRef.current = false;
                  setDragging({ type: 'media', index, sourceIndex: item.sourceIndex });
                } : undefined}
              >
                {typeof onToggleMediaFavorite === 'function' && album.id > 0 && !album.is_virtual ? (
                  <button
                    type="button"
                    className={mediaFavorited ? 'catn8-preview-favorite-toggle is-active' : 'catn8-preview-favorite-toggle'}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleMediaFavorite(spreadIndex, item.sourceIndex);
                    }}
                    aria-label={mediaFavorited ? 'Remove media from favorites' : 'Add media to favorites'}
                    aria-pressed={mediaFavorited}
                    title={mediaFavorited ? 'Favorited media' : 'Favorite this media'}
                  >
                    ♥
                  </button>
                ) : null}
                {isVideoMedia(imageSrc, item.mediaType) ? (
                  <video
                    className="catn8-polaroid-photo catn8-polaroid-video"
                    src={imageSrc}
                    controls
                    preload="metadata"
                    onClick={(event) => {
                      event.stopPropagation();
                      onItemClick({ type: 'media', index, sourceIndex: item.sourceIndex }, 'media');
                    }}
                  />
                ) : (
                  <img
                    className="catn8-polaroid-photo"
                    src={imageSrc}
                    alt={caption || `Memory ${index + 1}`}
                    loading="lazy"
                    onClick={(event) => {
                      event.stopPropagation();
                      onItemClick({ type: 'media', index, sourceIndex: item.sourceIndex }, 'media');
                    }}
                  />
                )}
                {showCaption ? <figcaption className="catn8-polaroid-caption">{caption}</figcaption> : null}
              </figure>
            );
          })}

          {notes.map((note, index) => {
            const display = formatNoteText(note);
            const noteFavorited = typeof isTextFavorite === 'function'
              ? isTextFavorite(spreadIndex, note.id)
              : false;
            return (
              <div
                className={selectedItem?.type === 'note' && selectedItem.index === index ? 'catn8-scatter-card catn8-scatter-note is-selected' : 'catn8-scatter-card catn8-scatter-note'}
                key={note.id}
                style={renderNoteStyle(note, index)}
                onClick={() => onItemClick({ type: 'note', index }, 'note')}
                onPointerDown={editable && !isLayoutLocked ? (event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest('button')) {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedItem({ type: 'note', index });
                  dragStartRef.current = { x: event.clientX, y: event.clientY };
                  dragMovedRef.current = false;
                  setDragging({ type: 'note', index });
                } : undefined}
                onDoubleClick={editable && !isLayoutLocked && onEditNoteText ? () => {
                  const next = window.prompt('Edit text', display);
                  if (typeof next === 'string' && next.trim()) {
                    onEditNoteText(index, next.trim());
                  }
                } : undefined}
              >
                {typeof onToggleTextFavorite === 'function' && album.id > 0 && !album.is_virtual ? (
                  <button
                    type="button"
                    className={noteFavorited ? 'catn8-preview-favorite-toggle catn8-preview-favorite-toggle-note is-active' : 'catn8-preview-favorite-toggle catn8-preview-favorite-toggle-note'}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleTextFavorite(spreadIndex, note.id);
                    }}
                    aria-label={noteFavorited ? 'Remove text from favorites' : 'Add text to favorites'}
                    aria-pressed={noteFavorited}
                    title={noteFavorited ? 'Favorited text' : 'Favorite this text'}
                  >
                    ♥
                  </button>
                ) : null}
                <div className="catn8-scatter-note-inner" style={{ borderColor: theme.borderColor, backgroundColor: theme.accentColor }}>
                  <span className="catn8-scatter-note-emoji">{theme.emojis[index % Math.max(1, theme.emojis.length)] || '✨'}</span>
                  <p>{display}</p>
                </div>
              </div>
            );
          })}

          {editable && selectedItem ? (
            <div className="catn8-item-actions" onClick={(event) => event.stopPropagation()}>
              <span className="catn8-item-actions-label">
                {selectedItem.type === 'media' ? 'Media' : selectedItem.type === 'note' ? 'Text' : 'Decor'}
              </span>
              {selectedItem.type !== 'decor' ? (
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onViewSelected}>View</button>
              ) : null}
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onEditSelected} disabled={isLayoutLocked}>Edit</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onDuplicateSelected} disabled={isLayoutLocked}>Duplicate</button>
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={onDeleteSelected} disabled={isLayoutLocked}>Delete</button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary catn8-close-viewer-btn"
                onClick={() => setSelectedItem(null)}
                aria-label="Close item actions"
                title="Close"
              >
                ×
              </button>
            </div>
          ) : null}

        </div>
      </div>

      {viewerTarget ? (
        <PhotoAlbumElementViewer
          target={viewerTarget}
          activeMedia={activeMedia}
          activeNote={activeNote}
          dateLabel={viewerDateLabel}
          activeMediaFavorite={activeMediaFavorited}
          activeNoteFavorite={activeNoteFavorited}
          prevTarget={prevTarget}
          nextTarget={nextTarget}
          onToggleActiveMediaFavorite={canFavoriteCurrentMedia && activeMedia ? () => {
            onToggleMediaFavorite?.(viewerTarget.spreadIndex, activeMedia.sourceIndex);
          } : undefined}
          onToggleActiveNoteFavorite={canFavoriteCurrentText && activeViewerNote && viewerTarget ? () => {
            onToggleTextFavorite?.(viewerTarget.spreadIndex, activeViewerNote.id);
          } : undefined}
          onClose={() => setViewerTarget(null)}
          onNavigate={setViewerTarget}
        />
      ) : null}
    </div>
  );
}
