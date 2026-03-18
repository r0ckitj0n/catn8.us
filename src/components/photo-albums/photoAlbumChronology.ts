import { PhotoAlbum } from '../../types/photoAlbums';
import { NoteItem, parseClockToMinutes, spreadMedia, spreadNotes } from './photoAlbumStageEngine';

export type ChronologicalTextEntry = {
  kind: 'text';
  key: string;
  spreadIndex: number;
  itemIndex: number;
  note: NoteItem;
  dateLabel: string;
  effectiveMs?: number;
  sortMinutes?: number;
};

export type ChronologicalMediaEntry = {
  kind: 'media';
  key: string;
  spreadIndex: number;
  itemIndex: number;
  sourceIndex: number;
  src: string;
  mediaType?: 'image' | 'video';
  caption: string;
  dateLabel: string;
  effectiveMs?: number;
};

export type ChronologicalEntry = ChronologicalTextEntry | ChronologicalMediaEntry;

export type ChronologicalGroup = {
  key: string;
  label: string;
  texts: ChronologicalTextEntry[];
  media: ChronologicalMediaEntry[];
};

function formatListDateLabel(value?: number): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  return '';
}

function compareOptionalNumbers(a?: number, b?: number): number {
  const aValid = typeof a === 'number' && Number.isFinite(a);
  const bValid = typeof b === 'number' && Number.isFinite(b);
  if (aValid && bValid) {
    return a - b;
  }
  if (aValid) {
    return -1;
  }
  if (bValid) {
    return 1;
  }
  return 0;
}

function combineDateAndMinutes(baseMs?: number, minutes?: number | null): number | undefined {
  if (typeof baseMs !== 'number' || !Number.isFinite(baseMs) || typeof minutes !== 'number' || !Number.isFinite(minutes)) {
    return baseMs;
  }
  const base = new Date(baseMs);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  base.setHours(hours, mins, 0, 0);
  return base.getTime();
}

function buildGroups(entries: ChronologicalEntry[]): ChronologicalGroup[] {
  const groups = new Map<string, ChronologicalGroup>();
  const order: string[] = [];

  entries.forEach((entry, index) => {
    const key = entry.dateLabel || `undated-${entry.spreadIndex}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key: `${key}-${index}`,
        label: entry.dateLabel || 'Undated',
        texts: [],
        media: [],
      });
      order.push(key);
    }
    const group = groups.get(key)!;
    if (entry.kind === 'text') {
      group.texts.push(entry);
    } else {
      group.media.push(entry);
    }
  });

  return order.map((key) => groups.get(key)!);
}

export function buildPhotoAlbumChronology(album: PhotoAlbum, contactDisplayName?: string) {
  const spreads = Array.isArray(album.spec?.spreads) ? album.spec.spreads : [];
  const entries: ChronologicalEntry[] = [];
  let totalTexts = 0;
  let totalMedia = 0;

  spreads.forEach((spread, spreadIndex) => {
    const spreadMediaItems = spreadMedia(album, spreadIndex);
    const spreadNotesItems = spreadNotes(album, spreadIndex, spreadMediaItems, contactDisplayName);
    const spreadDateMs = spreadMediaItems
      .map((item) => item.capturedAtMs)
      .find((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const dateLabel = formatListDateLabel(spreadDateMs);

    spreadNotesItems.forEach((note, itemIndex) => {
      const noteMinutes = parseClockToMinutes(note.time);
      entries.push({
        kind: 'text',
        key: `${spreadIndex}-${note.id}-${itemIndex}`,
        spreadIndex,
        itemIndex,
        note,
        dateLabel,
        effectiveMs: combineDateAndMinutes(spreadDateMs, noteMinutes),
        sortMinutes: noteMinutes ?? undefined,
      });
      totalTexts += 1;
    });

    spreadMediaItems.forEach((item, itemIndex) => {
      entries.push({
        kind: 'media',
        key: item.key,
        spreadIndex,
        itemIndex,
        sourceIndex: item.sourceIndex,
        src: item.src,
        mediaType: item.mediaType,
        caption: item.caption,
        dateLabel,
        effectiveMs: item.capturedAtMs ?? spreadDateMs,
      });
      totalMedia += 1;
    });
  });

  entries.sort((a, b) => (
    compareOptionalNumbers(a.effectiveMs, b.effectiveMs)
    || ('sortMinutes' in a || 'sortMinutes' in b ? compareOptionalNumbers(('sortMinutes' in a ? a.sortMinutes : undefined), ('sortMinutes' in b ? b.sortMinutes : undefined)) : 0)
    || (a.spreadIndex - b.spreadIndex)
    || (a.itemIndex - b.itemIndex)
    || a.kind.localeCompare(b.kind)
  ));

  return {
    groups: buildGroups(entries),
    texts: totalTexts,
    media: totalMedia,
  };
}
