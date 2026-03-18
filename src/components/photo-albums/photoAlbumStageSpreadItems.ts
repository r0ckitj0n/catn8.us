import { PhotoAlbum } from '../../types/photoAlbums';
import { formatAlbumCaption, splitAlbumMessages } from '../../utils/photoAlbumText';
import { PreparedMediaItem } from './types';
import {
  isMessageLikeLine,
  NoteItem,
  parseSpeakerLine,
  resolveContactSpeaker,
  shouldHideNoteText,
} from './photoAlbumStageNoteUtils';
import { positionByDecorScatter, positionByFlow } from './photoAlbumStagePositions';

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
    if (!parsed.body || !isMessageLikeLine(line)) {
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
