import { sanitizeAlbumMessageText } from '../../utils/photoAlbumText';
import { clamp, formatNoteText, NoteItem } from './photoAlbumStageNoteUtils';

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
  const imageHeight = widthPct * 0.76;
  const frameBase = 5.8;
  const captionLineHeight = 3.5;
  return clamp(imageHeight + frameBase + (lines * captionLineHeight), 18, 72);
}

export function isCoreItem(item: LayoutItem): boolean {
  return item.type === 'media' || item.type === 'note';
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

export function rectsOverlap(a: LayoutRect, b: LayoutRect): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
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
