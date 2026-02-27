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

function positionByFlow(index: number, total: number, seed: string): { x: number; y: number; rotate: number } {
  const hash = hashValue(`${seed}-${index}`);
  const cols = total >= 12 ? 4 : total >= 6 ? 3 : 2;
  const rows = Math.max(1, Math.ceil(Math.max(1, total) / cols));
  const row = Math.floor(index / cols);
  const col = index % cols;
  const rowProgress = rows <= 1 ? 0.5 : row / (rows - 1);
  const colWidth = 82 / cols;
  const jitterX = ((hash % 100) / 100 - 0.5) * Math.min(6, colWidth * 0.25);
  const jitterY = (((Math.floor(hash / 100) % 100) / 100) - 0.5) * 4;
  const x = clamp(7 + (col * colWidth) + (colWidth * 0.1) + jitterX, 3, 90);
  const y = clamp(7 + (rowProgress * 78) + jitterY, 4, 90);
  const rotate = ((Math.floor(hash / 19) % 9) - 4);
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
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  size?: number;
};

const CANVAS_MIN_X = 2;
const CANVAS_MAX_X = 98;
const CANVAS_MIN_Y = 4;
const CANVAS_MAX_Y = 94;
const MAX_COVERAGE = 0.1;

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

function constrainLayout(item: LayoutItem): LayoutItem {
  const maxX = Math.max(CANVAS_MIN_X, CANVAS_MAX_X - item.w);
  const maxY = Math.max(CANVAS_MIN_Y, CANVAS_MAX_Y - item.h);
  return {
    ...item,
    x: clamp(item.x, CANVAS_MIN_X, maxX),
    y: clamp(item.y, CANVAS_MIN_Y, maxY),
  };
}

function resolveLayout(items: LayoutItem[], seed: string): LayoutItem[] {
  const resolved = items.map((item) => constrainLayout({ ...item }));
  for (let pass = 0; pass < 36; pass += 1) {
    let changed = false;
    for (let i = 0; i < resolved.length; i += 1) {
      const current = resolved[i];
      for (let j = 0; j < i; j += 1) {
        const placed = resolved[j];
        const overlap = overlapArea(current, placed);
        if (!overlap) {
          continue;
        }
        const currentCoverage = overlap / Math.max(1, current.w * current.h);
        const placedCoverage = overlap / Math.max(1, placed.w * placed.h);
        if (currentCoverage <= MAX_COVERAGE && placedCoverage <= MAX_COVERAGE) {
          continue;
        }
        const hash = hashValue(`${seed}-${current.id}-${placed.id}-${pass}-${j}`);
        const driftX = ((hash % 2 === 0) ? 1 : -1) * (2 + (hash % 4));
        const driftY = 2 + (Math.floor(hash / 7) % 4);
        current.x += driftX;
        current.y += driftY;
        const bounded = constrainLayout(current);
        current.x = bounded.x;
        current.y = bounded.y;
        changed = true;
      }
      resolved[i] = constrainLayout(current);
    }
    if (!changed) {
      break;
    }
  }
  return resolved;
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

  const [viewerTarget, setViewerTarget] = React.useState<ViewerTarget | null>(null);
  const [dragging, setDragging] = React.useState<null | { type: 'media' | 'note' | 'decor'; index: number; sourceIndex?: number }>(null);

  React.useEffect(() => {
    setViewerTarget(null);
    setDragging(null);
  }, [album.id, spreadIndex]);

  const layoutByType = React.useMemo(() => {
    const mediaLayout: LayoutItem[] = mediaItems.map((item, index) => {
      const source = spread?.images?.[item.sourceIndex];
      const fallback = positionByFlow(index, Math.max(1, mediaItems.length), `${album.id}-${spreadIndex}-media`);
      const w = clamp(Number(source?.w ?? mediaWidthPct), 12, 26);
      return {
        id: `media-${item.sourceIndex}`,
        type: 'media',
        index,
        sourceIndex: item.sourceIndex,
        x: Number(source?.x ?? fallback.x),
        y: Number(source?.y ?? fallback.y),
        w,
        h: clamp((w * 0.84) + 3.5, 14, 30),
        rotation: clamp(Number(source?.rotation ?? fallback.rotate), -8, 8),
      };
    });
    const noteLayout: LayoutItem[] = notes.map((note, index) => {
      const fallback = positionByFlow(index, Math.max(1, notes.length), `${album.id}-${spreadIndex}-note`);
      const w = clamp(Number(note.w ?? noteWidthPct), 14, 28);
      return {
        id: `note-${index}`,
        type: 'note',
        index,
        x: Number(note.x ?? fallback.x),
        y: Number(note.y ?? fallback.y),
        w,
        h: clamp((w * 0.62) + 2, 10, 26),
        rotation: clamp(Number(note.rotation ?? fallback.rotate), -7, 7),
      };
    });
    const decorLayout: LayoutItem[] = decorItems.map((item, index) => {
      const fallback = positionByDecorScatter(index, Math.max(1, decorItems.length), `${album.id}-${spreadIndex}-decor`);
      const size = clamp(Number(item.size ?? 1), 0.75, 1.4);
      const footprint = 4.6 * size;
      return {
        id: `decor-${index}`,
        type: 'decor',
        index,
        x: Number(item.x ?? fallback.x),
        y: Number(item.y ?? fallback.y),
        w: footprint,
        h: footprint,
        size,
        rotation: clamp(Number(item.rotation ?? fallback.rotate), -9, 9),
      };
    });

    const resolved = resolveLayout([...mediaLayout, ...noteLayout, ...decorLayout], `${album.id}-${spreadIndex}`);
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
  }, [album.id, spread, spreadIndex, mediaItems, notes, decorItems, mediaWidthPct, noteWidthPct]);

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
    const currentLayout = dragging.type === 'media'
      ? layoutByType.mediaByIndex.get(dragging.index)
      : dragging.type === 'note'
        ? layoutByType.noteByIndex.get(dragging.index)
        : layoutByType.decorByIndex.get(dragging.index);
    const widthPct = currentLayout?.w ?? 8;
    const heightPct = currentLayout?.h ?? 8;
    const x = clamp(((event.clientX - canvas.left) / canvas.width) * 100, CANVAS_MIN_X, CANVAS_MAX_X - widthPct);
    const y = clamp(((event.clientY - canvas.top) / canvas.height) * 100, CANVAS_MIN_Y, CANVAS_MAX_Y - heightPct);
    if (dragging.type === 'media' && onMoveMedia) {
      onMoveMedia(dragging.sourceIndex ?? dragging.index, { x, y });
    }
    if (dragging.type === 'note' && onMoveNote) {
      onMoveNote(dragging.index, { x, y });
    }
    if (dragging.type === 'decor' && onMoveDecor) {
      onMoveDecor(dragging.index, { x, y });
    }
  }, [editable, dragging, layoutByType, onMoveDecor, onMoveMedia, onMoveNote]);

  const renderMediaStyle = (index: number): React.CSSProperties => {
    const placement = layoutByType.mediaByIndex.get(index);
    return {
      left: `${placement?.x ?? CANVAS_MIN_X}%`,
      top: `${placement?.y ?? CANVAS_MIN_Y}%`,
      width: `${placement?.w ?? mediaWidthPct}%`,
      transform: `rotate(${placement?.rotation ?? 0}deg) scale(var(--catn8-card-scale, 1))`,
      zIndex: 8 + (index % 4),
    };
  };

  const renderNoteStyle = (_note: NoteItem, index: number): React.CSSProperties => {
    const placement = layoutByType.noteByIndex.get(index);
    return {
      left: `${placement?.x ?? CANVAS_MIN_X}%`,
      top: `${placement?.y ?? CANVAS_MIN_Y}%`,
      width: `${placement?.w ?? noteWidthPct}%`,
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
            >
              {editable ? (
                <button
                  type="button"
                  className="catn8-drag-handle catn8-drag-handle-emoji"
                  aria-label="Drag decor item"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
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
            return (
              <figure
                className="catn8-scatter-card catn8-scatter-media"
                key={item.key}
                style={renderMediaStyle(index)}
                onClick={() => setViewerTarget({ type: 'media', spreadIndex, itemIndex: index })}
              >
                {editable ? (
                  <button
                    type="button"
                    className="catn8-drag-handle"
                    aria-label="Drag media item"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
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
              >
                {editable ? (
                  <button
                    type="button"
                    className="catn8-drag-handle"
                    aria-label="Drag note item"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
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
