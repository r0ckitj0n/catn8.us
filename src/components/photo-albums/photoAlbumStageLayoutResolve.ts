import { hashValue } from './photoAlbumStageNoteUtils';
import {
  LayoutConstraints,
  LayoutItem,
  MAX_CORE_OVERLAP,
  MAX_COVERAGE,
  OVERLAP_EPSILON,
  isCoreItem,
  overlapArea,
} from './photoAlbumStageLayoutTypes';
import { constrainLayout } from './photoAlbumStageLayoutConstraints';
import { enforceNoTouch, forceSeparate, maximizeCoreItems } from './photoAlbumStageLayoutAdjust';

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
          if (i === j || !isCoreItem(resolved[j])) {
            continue;
          }
          const overlap = overlapArea(current, resolved[j]);
          if (!overlap) {
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
