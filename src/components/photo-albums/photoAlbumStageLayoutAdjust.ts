import { clamp, hashValue } from './photoAlbumStageNoteUtils';
import {
  LayoutConstraints,
  LayoutItem,
  OVERLAP_EPSILON,
  TIMELINE_BOTTOM_PCT,
  TIMELINE_TOP_PCT,
  isCoreItem,
  overlapArea,
} from './photoAlbumStageLayoutTypes';
import {
  collidesWithReserved,
  constrainLayout,
  minimumHeightFor,
  minimumWidthFor,
} from './photoAlbumStageLayoutConstraints';

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
        if (hasCoreCollision || (next.w * next.h) <= (candidate.w * candidate.h)) {
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
    placed.push(placeItem(item, item.x, preferredY));
  });

  decors.forEach((item) => {
    placed.push(placeItem(item, item.x, item.y));
  });

  const byId = new Map<string, LayoutItem>();
  placed.forEach((item) => byId.set(item.id, item));
  return items.map((item) => byId.get(item.id) || item);
}
