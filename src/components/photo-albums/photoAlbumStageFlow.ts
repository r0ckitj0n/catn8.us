import { PreparedMediaItem } from './types';
import { hashValue, isTranscriptCaption, NoteItem, parseClockToMinutes } from './photoAlbumStageNoteUtils';

export function visibleMediaCaption(caption: string): string {
  return isTranscriptCaption(caption) ? '' : caption;
}

export function sizeVariation(seed: string, min: number, max: number): number {
  const hash = hashValue(seed) % 10_000;
  const factor = hash / 10_000;
  return min + ((max - min) * factor);
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
  const groupKeysForX = [...groupKeys].sort((a, b) => hashValue(`gx-${a}`) - hashValue(`gx-${b}`));
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

  return {
    mediaOrder,
    noteOrder,
    mediaGroup,
    noteGroup,
    groupCenterXByIndex,
    total: Math.max(1, timeline.length),
    totalGroups: Math.max(1, groupKeys.length),
  };
}
