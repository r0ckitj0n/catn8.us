import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';
import { formatAlbumCaption, inferAlbumTheme, sanitizeAlbumMessageText, splitAlbumMessages } from '../../utils/photoAlbumText';
import { PhotoAlbumElementViewer } from './PhotoAlbumElementViewer';
import { PreparedMediaItem, ViewerTarget, ViewerType } from './types';

interface PhotoAlbumStageProps {
  album: PhotoAlbum;
  spreadIndex: number;
  zoom: number;
  canPrev?: boolean;
  canNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  editable?: boolean;
  onMoveMedia?: (index: number, patch: { x: number; y: number }) => void;
  onMoveNote?: (index: number, patch: { x: number; y: number }) => void;
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
  speaker: 'Jon' | 'Trinity' | 'Unknown';
  time?: string;
  x?: number;
  y?: number;
  w?: number;
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

function parseSpeakerLine(line: string): { speaker: 'Jon' | 'Trinity' | 'Unknown'; time?: string; body: string } {
  const cleaned = sanitizeAlbumMessageText(line);
  const withAlias = cleaned.replace(/^Contact\s*:/i, 'Trinity:');
  const rich = withAlias.match(/^(Jon|Trinity)\s*(?:\(([0-9]{1,2}:[0-9]{2}\s*[AP]M)\)|\[([0-9]{1,2}:[0-9]{2}\s*[AP]M)\])?\s*:\s*(.+)$/i);
  if (rich) {
    const speaker = rich[1].toLowerCase() === 'jon' ? 'Jon' : 'Trinity';
    const time = (rich[2] || rich[3] || '').trim() || undefined;
    return { speaker, time, body: sanitizeAlbumMessageText(rich[4] || '') };
  }
  const basic = withAlias.match(/^(Jon|Trinity)\s*:\s*(.+)$/i);
  if (basic) {
    const speaker = basic[1].toLowerCase() === 'jon' ? 'Jon' : 'Trinity';
    return { speaker, body: sanitizeAlbumMessageText(basic[2] || '') };
  }
  return { speaker: 'Unknown', body: withAlias };
}

function formatNoteText(note: NoteItem): string {
  const timePart = note.time ? ` (${note.time})` : '';
  return `${note.speaker}${timePart}: ${note.text}`;
}

function isMessageLikeLine(line: string): boolean {
  return /^(Jon|Trinity|Contact|Unknown)\s*(?:\([0-9]{1,2}:[0-9]{2}\s*[AP]M\)|\[[0-9]{1,2}:[0-9]{2}\s*[AP]M\])?\s*:/i.test(sanitizeAlbumMessageText(line));
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

function spreadNotes(album: PhotoAlbum, targetSpreadIndex: number, media: PreparedMediaItem[]): NoteItem[] {
  const spread = album.spec?.spreads?.[targetSpreadIndex];
  const dedup = new Set<string>();
  const addUniqueNote = (note: NoteItem, out: NoteItem[]) => {
    const canonical = `${note.speaker}:${note.time || ''}:${note.text}`.toLowerCase();
    if (!canonical.trim() || dedup.has(canonical)) {
      return;
    }
    dedup.add(canonical);
    out.push(note);
  };

  const mediaNotes = media.flatMap((mediaItem, mediaIndex) => (
    splitAlbumMessages(mediaItem.caption)
      .map((line, lineIndex) => {
        if (!isMessageLikeLine(line)) {
          return null;
        }
        const parsed = parseSpeakerLine(line);
        if (!parsed.body) {
          return null;
        }
        const fullText = `${parsed.speaker}${parsed.time ? ` (${parsed.time})` : ''}: ${parsed.body}`;
        if (shouldHideNoteText(fullText)) {
          return null;
        }
        return {
          id: `${album.id}-${targetSpreadIndex}-media-note-${mediaIndex}-${lineIndex}`,
          text: parsed.body,
          speaker: parsed.speaker,
          time: parsed.time,
        } as NoteItem;
      })
      .filter((item): item is NoteItem => Boolean(item))
  ));

  const spreadTextItems = Array.isArray(spread?.text_items) ? spread.text_items : [];
  if (spreadTextItems.length > 0) {
    const notes = spreadTextItems
      .map((item, index) => {
        const parsed = parseSpeakerLine(item.text || '');
        const fullText = `${(item.speaker as string) || parsed.speaker}${parsed.time ? ` (${parsed.time})` : ''}: ${parsed.body}`;
        if (shouldHideNoteText(fullText)) {
          return null;
        }
        return {
          id: item.id || `${album.id}-${targetSpreadIndex}-text-${index}`,
          text: parsed.body,
          speaker: (item.speaker as 'Jon' | 'Trinity' | undefined) || parsed.speaker,
          time: item.time || parsed.time,
          x: item.x,
          y: item.y,
          w: item.w,
          rotation: item.rotation,
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
    const parsed = parseSpeakerLine(line);
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
      id: `${album.id}-${targetSpreadIndex}-note-${index}`,
      text: parsed.body,
      speaker: parsed.speaker,
      time: parsed.time,
    }, notes);
  });
  return notes;
}

function spreadDecor(album: PhotoAlbum, targetSpreadIndex: number, emojiPool: string[]): DecorItem[] {
  const spread = album.spec?.spreads?.[targetSpreadIndex];
  const existing = Array.isArray(spread?.decor_items) ? spread.decor_items : [];
  if (existing.length > 0) {
    return existing.map((item, idx) => ({
      id: item.id || `${album.id}-${targetSpreadIndex}-decor-${idx}`,
      emoji: item.emoji || emojiPool[idx % emojiPool.length] || '✨',
      x: item.x,
      y: item.y,
      size: item.size,
      rotation: item.rotation,
    }));
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

function findAdjacentTarget(album: PhotoAlbum, current: ViewerTarget, direction: -1 | 1): ViewerTarget | null {
  const spreads = Array.isArray(album.spec?.spreads) ? album.spec.spreads : [];
  const itemListAt = (type: ViewerType, sidx: number): number => {
    const media = spreadMedia(album, sidx);
    const notes = spreadNotes(album, sidx, media);
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

type LayoutItem = {
  id: string;
  type: 'media' | 'note' | 'decor';
  index: number;
  sourceIndex?: number;
  pinned?: boolean;
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

const CANVAS_MIN_X = 2;
const CANVAS_MAX_X = 98;
const CANVAS_MIN_Y = 4;
const CANVAS_MAX_Y = 94;
const MAX_COVERAGE = 0.01;
const MAX_CORE_OVERLAP = 0;
const OVERLAP_EPSILON = 0.001;
const RESERVED_PADDING_PCT = 1.4;
const LAYOUT_NUDGE_PCT = 0.8;

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
  const charsPerLine = Math.max(12, Math.floor(widthPct * 2.4));
  const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
  const base = 7.8;
  const lineHeight = 3.5;
  return clamp(base + (lines * lineHeight), 12, 54);
}

function estimateMediaHeightPct(caption: string, widthPct: number): number {
  const text = sanitizeAlbumMessageText(caption || '');
  const charsPerLine = Math.max(14, Math.floor(widthPct * 2.6));
  const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
  // Image footprint (4:3) + frame/padding + caption text block.
  const imageHeight = widthPct * 0.76;
  const frameBase = 4.2;
  const captionLineHeight = 2.8;
  return clamp(imageHeight + frameBase + (lines * captionLineHeight), 15, 66);
}

function overlapArea(a: LayoutItem, b: LayoutItem): number {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
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
  const maxX = Math.max(constraints.minX, constraints.maxX - item.w);
  const maxY = Math.max(constraints.minY, constraints.maxY - item.h);
  const bounded = {
    ...item,
    x: clamp(item.x, constraints.minX, maxX),
    y: clamp(item.y, constraints.minY, maxY),
  };
  return itemWithoutReservedCollision(bounded, constraints);
}

function isCoreItem(item: LayoutItem): boolean {
  return item.type === 'media' || item.type === 'note';
}

function resolveLayout(items: LayoutItem[], seed: string, constraints: LayoutConstraints): LayoutItem[] {
  const resolved = items.map((item) => constrainLayout({ ...item }, constraints));
  for (let pass = 0; pass < 72; pass += 1) {
    let changed = false;
    for (let i = 0; i < resolved.length; i += 1) {
      const current = resolved[i];
      const currentPushFactor = current.pinned ? 0.18 : 1;
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

  return resolved;
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
  canPrev = false,
  canNext = false,
  onPrev,
  onNext,
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
  const spread = album.spec.spreads[spreadIndex] || null;
  const mediaItems = React.useMemo(() => spreadMedia(album, spreadIndex), [album, spreadIndex]);
  const notes = React.useMemo(() => spreadNotes(album, spreadIndex, mediaItems), [album, spreadIndex, mediaItems]);
  const theme = inferAlbumTheme([spread?.title || '', spread?.caption || '', ...notes.map((n) => n.text)].join(' '));
  const decorItems = React.useMemo(() => spreadDecor(album, spreadIndex, theme.emojis), [album, spreadIndex, theme.emojis]);

  const densityCount = notes.length + mediaItems.length;
  const mediaWidthPct = densityCount >= 16 ? 11 : densityCount >= 10 ? 13 : 16;
  const noteWidthPct = densityCount >= 16 ? 12 : densityCount >= 10 ? 14 : 17;

  const [viewerTarget, setViewerTarget] = React.useState<ViewerTarget | null>(null);
  const [dragging, setDragging] = React.useState<null | { type: 'media' | 'note' | 'decor'; index: number; sourceIndex?: number }>(null);
  const [selectedItem, setSelectedItem] = React.useState<SelectedItem | null>(null);
  const dragStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const dragMovedRef = React.useRef(false);
  const suppressClickRef = React.useRef(false);
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const headerRef = React.useRef<HTMLDivElement | null>(null);
  const [reservedHeaderRect, setReservedHeaderRect] = React.useState<LayoutRect | null>(null);

  React.useEffect(() => {
    setViewerTarget(null);
    setDragging(null);
    setSelectedItem(null);
  }, [album.id, spreadIndex]);

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
    const flow = createFlowOrders(mediaItems, notes, spread?.title || '');
    const estimatedMediaArea = mediaItems.reduce((sum, item) => sum + (mediaWidthPct * estimateMediaHeightPct(item.caption, mediaWidthPct)), 0);
    const estimatedNoteArea = notes.reduce((sum, item) => sum + (noteWidthPct * estimateNoteHeightPct(item, noteWidthPct)), 0);
    const canvasArea = Math.max(1, (CANVAS_MAX_X - CANVAS_MIN_X) * (CANVAS_MAX_Y - CANVAS_MIN_Y));
    const estimatedCoverage = (estimatedMediaArea + estimatedNoteArea) / canvasArea;
    const targetCoverage = densityCount <= 5 ? 0.9 : densityCount <= 10 ? 0.94 : densityCount <= 16 ? 0.98 : 1.02;
    const sizeScale = clamp(Math.sqrt(targetCoverage / Math.max(0.0001, estimatedCoverage)), 0.92, 2.8);
    const decorScale = clamp(0.95 + ((sizeScale - 1) * 0.56), 0.85, 1.95);

    const mediaLayout: LayoutItem[] = mediaItems.map((item, index) => {
      const source = spread?.images?.[item.sourceIndex];
      const flowIndex = flow.mediaOrder.get(index) ?? index;
      const groupIndex = flow.mediaGroup.get(index) ?? 0;
      const groupCenterX = flow.groupCenterXByIndex.get(groupIndex) ?? 50;
      const fallback = positionByFlow(flowIndex, flow.total, groupCenterX, `${album.id}-${spreadIndex}-flow`);
      const hasPinnedPosition = Number.isFinite(Number(source?.x)) && Number.isFinite(Number(source?.y));
      const sourceBaseWidth = Number(source?.w ?? mediaWidthPct);
      const w = clamp(sourceBaseWidth * sizeScale, 12, 48);
      return {
        id: `media-${item.sourceIndex}`,
        type: 'media',
        index,
        sourceIndex: item.sourceIndex,
        pinned: hasPinnedPosition,
        x: Number(source?.x ?? fallback.x),
        y: Number(source?.y ?? fallback.y),
        w,
        h: estimateMediaHeightPct(item.caption, w),
        rotation: clamp(Number(source?.rotation ?? fallback.rotate), -8, 8),
      };
    });
    const noteLayout: LayoutItem[] = notes.map((note, index) => {
      const flowIndex = flow.noteOrder.get(index) ?? (mediaItems.length + index);
      const groupIndex = flow.noteGroup.get(index) ?? 0;
      const groupCenterX = flow.groupCenterXByIndex.get(groupIndex) ?? 50;
      const fallback = positionByFlow(flowIndex, flow.total, groupCenterX, `${album.id}-${spreadIndex}-flow`);
      const hasPinnedPosition = Number.isFinite(Number(note.x)) && Number.isFinite(Number(note.y));
      const noteBaseWidth = Number(note.w ?? noteWidthPct);
      const w = clamp(noteBaseWidth * sizeScale, 13, 52);
      return {
        id: `note-${index}`,
        type: 'note',
        index,
        pinned: hasPinnedPosition,
        x: Number(note.x ?? fallback.x),
        y: Number(note.y ?? fallback.y),
        w,
        h: estimateNoteHeightPct(note, w),
        rotation: clamp(Number(note.rotation ?? fallback.rotate), -7, 7),
      };
    });
    const decorLayout: LayoutItem[] = decorItems.map((item, index) => {
      const fallback = positionByDecorScatter(index, Math.max(1, decorItems.length), `${album.id}-${spreadIndex}-decor`);
      const hasPinnedPosition = Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.y));
      const savedSize = Number(item.size ?? 1);
      const size = clamp(savedSize * decorScale, 0.85, 2.2);
      const footprint = 4.6 * size;
      return {
        id: `decor-${index}`,
        type: 'decor',
        index,
        pinned: hasPinnedPosition,
        x: Number(item.x ?? fallback.x),
        y: Number(item.y ?? fallback.y),
        w: footprint,
        h: footprint,
        size,
        rotation: clamp(Number(item.rotation ?? fallback.rotate), -9, 9),
      };
    });

    const resolved = resolveLayout([...mediaLayout, ...noteLayout, ...decorLayout], `${album.id}-${spreadIndex}`, layoutConstraints);
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
  }, [album.id, spread, spreadIndex, mediaItems, notes, decorItems, mediaWidthPct, noteWidthPct, densityCount, layoutConstraints]);

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
    const list = spreadNotes(album, viewerTarget.spreadIndex, spreadMedia(album, viewerTarget.spreadIndex));
    const note = list[viewerTarget.itemIndex];
    return note ? formatNoteText(note) : '';
  }, [album, viewerTarget]);

  const prevTarget = viewerTarget ? findAdjacentTarget(album, viewerTarget, -1) : null;
  const nextTarget = viewerTarget ? findAdjacentTarget(album, viewerTarget, 1) : null;

  const applyDragPosition = React.useCallback((clientX: number, clientY: number) => {
    if (!editable || !dragging) {
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
    const x = clamp(((clientX - canvas.left) / canvas.width) * 100, CANVAS_MIN_X, CANVAS_MAX_X - widthPct);
    const y = clamp(((clientY - canvas.top) / canvas.height) * 100, CANVAS_MIN_Y, CANVAS_MAX_Y - heightPct);
    const constrained = constrainLayout({
      id: `${dragging.type}-${dragging.index}`,
      type: dragging.type,
      index: dragging.index,
      sourceIndex: dragging.sourceIndex,
      x,
      y,
      w: widthPct,
      h: heightPct,
      rotation: 0,
    }, layoutConstraints);
    if (dragging.type === 'media' && onMoveMedia) {
      onMoveMedia(dragging.sourceIndex ?? dragging.index, { x: constrained.x, y: constrained.y });
    }
    if (dragging.type === 'note' && onMoveNote) {
      onMoveNote(dragging.index, { x: constrained.x, y: constrained.y });
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
  }, [editable, dragging, layoutByType, onMoveDecor, onMoveMedia, onMoveNote, layoutConstraints, decorItems]);

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
  }, []);

  React.useEffect(() => {
    if (!editable || !dragging) {
      return undefined;
    }
    const onWindowMove = (event: MouseEvent) => {
      applyDragPosition(event.clientX, event.clientY);
    };
    const onWindowUp = () => {
      endDragging();
    };
    window.addEventListener('mousemove', onWindowMove);
    window.addEventListener('mouseup', onWindowUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMove);
      window.removeEventListener('mouseup', onWindowUp);
    };
  }, [applyDragPosition, dragging, editable, endDragging]);

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
    if (!selectedItem) {
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
  }, [selectedItem, mediaItems, onEditMediaCaption, onEditNoteText, selectedNoteText, onEditDecor, decorItems]);

  const onDuplicateSelected = React.useCallback(() => {
    if (!selectedItem) {
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
  }, [selectedItem, onDuplicateMedia, onDuplicateNote, onDuplicateDecor]);

  const onDeleteSelected = React.useCallback(() => {
    if (!selectedItem) {
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
  }, [selectedItem, onDeleteMedia, onDeleteNote, onDeleteDecor]);

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
    };
  };

  return (
    <div className="catn8-scrapbook-stage catn8-scrapbook-stage-user">
      <div className={`catn8-scrapbook-scatter catn8-theme-${theme.name}`} style={{ transform: `scale(${zoom})` }}>
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
          <h3>{sanitizeAlbumMessageText(spread?.title || 'Untitled Spread')}</h3>
        </div>

        <div
          ref={canvasRef}
          className="catn8-scatter-canvas"
          onMouseUp={endDragging}
          onMouseLeave={endDragging}
        >
          {decorItems.map((item, index) => (
            <span
              key={item.id}
              className="catn8-scatter-emoji"
              style={renderDecorStyle(item, index)}
              onClick={() => onItemClick({ type: 'decor', index }, null)}
            >
              {editable ? (
                <button
                  type="button"
                  className="catn8-drag-handle catn8-drag-handle-emoji"
                  aria-label="Drag decor item"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    dragStartRef.current = { x: event.clientX, y: event.clientY };
                    dragMovedRef.current = false;
                    setDragging({ type: 'decor', index });
                  }}
                  onClick={(event) => event.stopPropagation()}
                >
                  ⠿
                </button>
              ) : null}
              {item.emoji}
            </span>
          ))}

          {mediaItems.map((item, index) => {
            const imageSrc = item.src;
            const caption = item.caption;
            const showCaption = Boolean(caption && !isTranscriptCaption(caption));
            return (
              <figure
                className="catn8-scatter-card catn8-scatter-media"
                key={item.key}
                style={renderMediaStyle(index)}
                onClick={() => onItemClick({ type: 'media', index, sourceIndex: item.sourceIndex }, 'media')}
              >
                {editable ? (
                  <button
                    type="button"
                    className="catn8-drag-handle"
                    aria-label="Drag media item"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      dragStartRef.current = { x: event.clientX, y: event.clientY };
                      dragMovedRef.current = false;
                      setDragging({ type: 'media', index, sourceIndex: item.sourceIndex });
                    }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    ⠿
                  </button>
                ) : null}
                {isVideoMedia(imageSrc, item.mediaType) ? (
                  <video className="catn8-polaroid-photo catn8-polaroid-video" src={imageSrc} controls preload="metadata" />
                ) : (
                  <img className="catn8-polaroid-photo" src={imageSrc} alt={caption || `Memory ${index + 1}`} loading="lazy" />
                )}
                {showCaption ? <figcaption className="catn8-polaroid-caption">{caption}</figcaption> : null}
              </figure>
            );
          })}

          {notes.map((note, index) => {
            const display = formatNoteText(note);
            return (
              <div
                className="catn8-scatter-card catn8-scatter-note"
                key={note.id}
                style={renderNoteStyle(note, index)}
                onClick={() => onItemClick({ type: 'note', index }, 'note')}
                onDoubleClick={editable && onEditNoteText ? () => {
                  const next = window.prompt('Edit text', display);
                  if (typeof next === 'string' && next.trim()) {
                    onEditNoteText(index, next.trim());
                  }
                } : undefined}
              >
                {editable ? (
                  <button
                    type="button"
                    className="catn8-drag-handle"
                    aria-label="Drag note item"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      dragStartRef.current = { x: event.clientX, y: event.clientY };
                      dragMovedRef.current = false;
                      setDragging({ type: 'note', index });
                    }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    ⠿
                  </button>
                ) : null}
                <div className="catn8-scatter-note-inner" style={{ borderColor: theme.borderColor, backgroundColor: theme.accentColor }}>
                  <span className="catn8-scatter-note-emoji">{theme.emojis[index % theme.emojis.length]}</span>
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
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onEditSelected}>Edit</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onDuplicateSelected}>Duplicate</button>
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={onDeleteSelected}>Delete</button>
              <button type="button" className="btn btn-sm btn-dark" onClick={() => setSelectedItem(null)}>Close</button>
            </div>
          ) : null}

        </div>
      </div>

      {viewerTarget ? (
        <PhotoAlbumElementViewer
          target={viewerTarget}
          activeMedia={activeMedia}
          activeNote={activeNote}
          prevTarget={prevTarget}
          nextTarget={nextTarget}
          onClose={() => setViewerTarget(null)}
          onNavigate={setViewerTarget}
        />
      ) : null}
    </div>
  );
}
