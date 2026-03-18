import { clamp } from './photoAlbumStageNoteUtils';
import {
  LAYOUT_NUDGE_PCT,
  LayoutConstraints,
  LayoutItem,
  LayoutRect,
  rectsOverlap,
} from './photoAlbumStageLayoutTypes';

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
