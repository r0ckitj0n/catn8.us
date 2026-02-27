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
  onMoveDecor?: (index: number, patch: { x: number; y: number }) => void;
  onEditNoteText?: (index: number, nextText: string) => void;
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
  side?: 'left' | 'right';
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

function positionByChronology(index: number, total: number, seed: string, side: 'left' | 'right' | 'full'): { x: number; y: number; rotate: number } {
  const hash = hashValue(`${seed}-${index}`);
  const progress = total <= 1 ? 0.5 : index / (total - 1);
  const y = clamp(6 + progress * 80 + ((hash % 5) - 2), 4, 90);
  const rotate = ((Math.floor(hash / 10) % 12) - 6);
  if (side === 'left') {
    return { x: clamp(8 + (Math.floor(hash / 100) % 28), 4, 38), y, rotate };
  }
  if (side === 'right') {
    return { x: clamp(58 + (Math.floor(hash / 100) % 30), 56, 90), y, rotate };
  }
  return { x: clamp(10 + (Math.floor(hash / 100) % 76), 4, 90), y, rotate };
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
  const spreadTextItems = Array.isArray(spread?.text_items) ? spread.text_items : [];
  if (spreadTextItems.length > 0) {
    return spreadTextItems
      .map((item, index) => {
        const parsed = parseSpeakerLine(item.text || '');
        return {
          id: item.id || `${album.id}-${targetSpreadIndex}-text-${index}`,
          text: parsed.body,
          speaker: (item.speaker as 'Jon' | 'Trinity' | undefined) || parsed.speaker,
          time: item.time || parsed.time,
          x: item.x,
          y: item.y,
          w: item.w,
          rotation: item.rotation,
          side: item.side,
        } as NoteItem;
      })
      .filter((item) => item.text);
  }

  const imageTextSet = new Set<string>();
  for (const mediaItem of media) {
    splitAlbumMessages(mediaItem.caption).forEach((line) => imageTextSet.add(line.toLowerCase()));
  }

  const rawLines = splitAlbumMessages(spread?.caption || '');
  const dedup = new Set<string>();
  const notes: NoteItem[] = [];
  rawLines.forEach((line, index) => {
    const parsed = parseSpeakerLine(line);
    if (!parsed.body) {
      return;
    }
    const canonical = `${parsed.speaker}:${parsed.time || ''}:${parsed.body}`.toLowerCase();
    if (dedup.has(canonical)) {
      return;
    }
    if (imageTextSet.has(line.toLowerCase()) || imageTextSet.has(parsed.body.toLowerCase())) {
      return;
    }
    dedup.add(canonical);
    notes.push({
      id: `${album.id}-${targetSpreadIndex}-note-${index}`,
      text: parsed.body,
      speaker: parsed.speaker,
      time: parsed.time,
    });
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
    const pos = positionByChronology(index, 6, `${album.id}-${targetSpreadIndex}-decor`, 'full');
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
  onBackToAlbums,
}: PhotoAlbumStageProps) {
  const spread = album.spec.spreads[spreadIndex] || null;
  const mediaItems = React.useMemo(() => spreadMedia(album, spreadIndex), [album, spreadIndex]);
  const notes = React.useMemo(() => spreadNotes(album, spreadIndex, mediaItems), [album, spreadIndex, mediaItems]);
  const theme = inferAlbumTheme([spread?.title || '', spread?.caption || '', ...notes.map((n) => n.text)].join(' '));
  const decorItems = React.useMemo(() => spreadDecor(album, spreadIndex, theme.emojis), [album, spreadIndex, theme.emojis]);

  const mediaWidthPct = notes.length + mediaItems.length >= 16 ? 14 : notes.length + mediaItems.length >= 10 ? 18 : 22;
  const noteWidthPct = notes.length >= 12 ? 16 : notes.length >= 8 ? 18 : 22;

  const firstSpeaker = notes.find((note) => note.speaker !== 'Unknown')?.speaker || 'Jon';
  const leftSpeaker: 'Jon' | 'Trinity' = firstSpeaker === 'Trinity' ? 'Trinity' : 'Jon';

  const [viewerTarget, setViewerTarget] = React.useState<ViewerTarget | null>(null);
  const [dragging, setDragging] = React.useState<null | { type: 'media' | 'note' | 'decor'; index: number }>(null);

  React.useEffect(() => {
    setViewerTarget(null);
    setDragging(null);
  }, [album.id, spreadIndex]);

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

  const onMouseMove = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!editable || !dragging) {
      return;
    }
    const canvas = event.currentTarget.getBoundingClientRect();
    const x = clamp(((event.clientX - canvas.left) / canvas.width) * 100, 2, 92);
    const y = clamp(((event.clientY - canvas.top) / canvas.height) * 100, 3, 92);
    if (dragging.type === 'media' && onMoveMedia) {
      onMoveMedia(dragging.index, { x, y });
    }
    if (dragging.type === 'note' && onMoveNote) {
      onMoveNote(dragging.index, { x, y });
    }
    if (dragging.type === 'decor' && onMoveDecor) {
      onMoveDecor(dragging.index, { x, y });
    }
  }, [editable, dragging, onMoveDecor, onMoveMedia, onMoveNote]);

  const renderMediaStyle = (index: number): React.CSSProperties => {
    const source = spread?.images?.[index];
    const seed = `${album.id}-${spreadIndex}-media-${index}`;
    const fallback = positionByChronology(index, Math.max(1, mediaItems.length), seed, 'full');
    const x = clamp(Number(source?.x ?? fallback.x), 2, 92 - mediaWidthPct);
    const y = clamp(Number(source?.y ?? fallback.y), 4, 90);
    const rotation = Number(source?.rotation ?? fallback.rotate);
    const w = clamp(Number(source?.w ?? mediaWidthPct), 12, 26);
    return {
      left: `${x}%`,
      top: `${y}%`,
      width: `${w}%`,
      transform: `rotate(${rotation}deg) scale(var(--catn8-card-scale, 1))`,
      zIndex: 8 + (index % 4),
    };
  };

  const renderNoteStyle = (note: NoteItem, index: number): React.CSSProperties => {
    const side: 'left' | 'right' = note.side || (note.speaker === leftSpeaker ? 'left' : 'right');
    const seed = `${album.id}-${spreadIndex}-note-${index}`;
    const fallback = positionByChronology(index, Math.max(1, notes.length), seed, side);
    const x = clamp(Number(note.x ?? fallback.x), side === 'left' ? 2 : 52, side === 'left' ? 42 : 92 - noteWidthPct);
    const y = clamp(Number(note.y ?? fallback.y), 4, 90);
    const rotation = Number(note.rotation ?? fallback.rotate);
    const w = clamp(Number(note.w ?? noteWidthPct), 14, 28);
    return {
      left: `${x}%`,
      top: `${y}%`,
      width: `${w}%`,
      transform: `rotate(${rotation}deg) scale(var(--catn8-card-scale, 1))`,
      zIndex: 20 + (index % 4),
    };
  };

  const renderDecorStyle = (item: DecorItem, index: number): React.CSSProperties => {
    const seed = `${album.id}-${spreadIndex}-decor-${index}`;
    const fallback = positionByChronology(index, Math.max(1, decorItems.length), seed, 'full');
    const x = clamp(Number(item.x ?? fallback.x), 2, 94);
    const y = clamp(Number(item.y ?? fallback.y), 3, 92);
    const rotation = Number(item.rotation ?? fallback.rotate);
    const size = clamp(Number(item.size ?? 1), 0.75, 1.4);
    return {
      left: `${x}%`,
      top: `${y}%`,
      transform: `rotate(${rotation}deg) scale(${size})`,
      zIndex: 2,
      pointerEvents: editable ? 'auto' : 'none',
    };
  };

  return (
    <div className="catn8-scrapbook-stage catn8-scrapbook-stage-user">
      <div className={`catn8-scrapbook-scatter catn8-theme-${theme.name}`} style={{ transform: `scale(${zoom})` }}>
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

        <div className="catn8-scrapbook-stage-header">
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
          className="catn8-scatter-canvas"
          onMouseMove={onMouseMove}
          onMouseUp={() => setDragging(null)}
          onMouseLeave={() => setDragging(null)}
        >
          {decorItems.map((item, index) => (
            <span
              key={item.id}
              className="catn8-scatter-emoji"
              style={renderDecorStyle(item, index)}
              onMouseDown={editable ? () => setDragging({ type: 'decor', index }) : undefined}
            >
              {item.emoji}
            </span>
          ))}

          {mediaItems.map((item, index) => {
            const imageSrc = item.src;
            const caption = item.caption;
            return (
              <figure
                className="catn8-scatter-card catn8-scatter-media"
                key={item.key}
                style={renderMediaStyle(index)}
                onClick={() => setViewerTarget({ type: 'media', spreadIndex, itemIndex: index })}
                onMouseDown={editable ? () => setDragging({ type: 'media', index }) : undefined}
              >
                {isVideoMedia(imageSrc, item.mediaType) ? (
                  <video className="catn8-polaroid-photo catn8-polaroid-video" src={imageSrc} controls preload="metadata" />
                ) : (
                  <img className="catn8-polaroid-photo" src={imageSrc} alt={caption || `Memory ${index + 1}`} loading="lazy" />
                )}
                <figcaption className="catn8-polaroid-caption">{caption || 'Memory'}</figcaption>
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
                onClick={() => setViewerTarget({ type: 'note', spreadIndex, itemIndex: index })}
                onDoubleClick={editable && onEditNoteText ? () => {
                  const next = window.prompt('Edit text', display);
                  if (typeof next === 'string' && next.trim()) {
                    onEditNoteText(index, next.trim());
                  }
                } : undefined}
                onMouseDown={editable ? () => setDragging({ type: 'note', index }) : undefined}
              >
                <div className="catn8-scatter-note-inner" style={{ borderColor: theme.borderColor, backgroundColor: theme.accentColor }}>
                  <span className="catn8-scatter-note-emoji">{theme.emojis[index % theme.emojis.length]}</span>
                  <p>{display}</p>
                </div>
              </div>
            );
          })}

          {mediaItems.length === 0 ? (
            <div className="catn8-scatter-empty" style={{ left: '8%', top: '20%', width: '28%' }}>
              No photo/video linked on this spread yet.
            </div>
          ) : null}

          {notes.length === 0 ? (
            <div className="catn8-scatter-empty" style={{ left: '58%', top: '20%', width: '28%' }}>
              No readable text found on this spread.
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
