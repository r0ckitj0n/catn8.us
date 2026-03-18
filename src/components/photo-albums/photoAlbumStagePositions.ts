import { clamp, hashValue } from './photoAlbumStageNoteUtils';

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
