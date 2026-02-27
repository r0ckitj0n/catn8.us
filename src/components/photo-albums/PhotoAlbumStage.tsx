import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';
import { inferAlbumTheme, sanitizeAlbumMessageText, splitAlbumMessages } from '../../utils/photoAlbumText';
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
}

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

const BASE_ANCHORS = [
  { top: 8, left: 6 },
  { top: 14, left: 41 },
  { top: 24, left: 70 },
  { top: 38, left: 12 },
  { top: 44, left: 48 },
  { top: 58, left: 72 },
  { top: 66, left: 22 },
  { top: 76, left: 56 },
  { top: 30, left: 28 },
  { top: 52, left: 4 },
];

function seededScatterStyle(seed: string, index: number, width: number, zBoost = 0): React.CSSProperties {
  const base = BASE_ANCHORS[index % BASE_ANCHORS.length];
  const hash = hashValue(`${seed}-${index}`);
  const topJitter = (hash % 9) - 4;
  const leftJitter = ((Math.floor(hash / 10)) % 13) - 6;
  const rotate = ((Math.floor(hash / 100)) % 18) - 9;
  const top = Math.min(86, Math.max(4, base.top + topJitter));
  const left = Math.min(84, Math.max(2, base.left + leftJitter));
  return {
    top: `${top}%`,
    left: `${left}%`,
    width: `${width}px`,
    transform: `rotate(${rotate}deg) scale(var(--catn8-card-scale, 1))`,
    zIndex: 5 + (index % 5) + zBoost,
  };
}

function uniqueMessages(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const cleaned = sanitizeAlbumMessageText(value);
    if (!cleaned) {
      continue;
    }
    const key = cleaned.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function spreadMessages(album: PhotoAlbum, targetSpreadIndex: number): string[] {
  const spread = album.spec?.spreads?.[targetSpreadIndex];
  const images = Array.isArray(spread?.images) ? spread.images : [];
  return uniqueMessages([
    ...splitAlbumMessages(spread?.caption || ''),
    ...images.map((image) => splitAlbumMessages(image.memory_text || image.caption || '')).flat(),
  ]);
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
    const caption = sanitizeAlbumMessageText(image.caption || image.memory_text || `Memory ${index + 1}`);
    list.push({
      key: `${album.id}-${targetSpreadIndex}-${index}-${src}`,
      src,
      mediaType: image.media_type,
      caption,
    });
  });
  return list;
}

function findAdjacentTarget(album: PhotoAlbum, current: ViewerTarget, direction: -1 | 1): ViewerTarget | null {
  const spreads = Array.isArray(album.spec?.spreads) ? album.spec.spreads : [];
  const itemListAt = (type: ViewerType, sidx: number): number => (type === 'media' ? spreadMedia(album, sidx).length : spreadMessages(album, sidx).length);

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
}: PhotoAlbumStageProps) {
  const spread = album.spec.spreads[spreadIndex] || null;
  const images = spreadMedia(album, spreadIndex);
  const messages = spreadMessages(album, spreadIndex);
  const theme = inferAlbumTheme([spread?.title || '', spread?.caption || '', ...messages].join(' '));
  const totalCards = images.length + messages.length;
  const mediaWidth = totalCards >= 20 ? 150 : totalCards >= 14 ? 180 : totalCards >= 9 ? 210 : 250;
  const noteWidth = totalCards >= 20 ? 180 : totalCards >= 14 ? 200 : 230;

  const [viewerTarget, setViewerTarget] = React.useState<ViewerTarget | null>(null);

  React.useEffect(() => {
    setViewerTarget(null);
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
    const list = spreadMessages(album, viewerTarget.spreadIndex);
    return list[viewerTarget.itemIndex] || '';
  }, [album, viewerTarget]);

  const prevTarget = viewerTarget ? findAdjacentTarget(album, viewerTarget, -1) : null;
  const nextTarget = viewerTarget ? findAdjacentTarget(album, viewerTarget, 1) : null;

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
          <span className="catn8-scrapbook-page-tag">Spread {spreadIndex + 1}</span>
          <h3>{sanitizeAlbumMessageText(spread?.title || 'Untitled Spread')}</h3>
        </div>

        <div className="catn8-scatter-emoji-row" aria-hidden="true">
          {theme.emojis.map((emoji, index) => (
            <span key={`${emoji}-${index}`} className="catn8-scatter-emoji">{emoji}</span>
          ))}
        </div>

        <div className="catn8-scatter-canvas">
          {images.map((item, index) => {
            const imageSrc = item.src;
            const caption = item.caption;
            return (
              <figure
                className="catn8-scatter-card catn8-scatter-media"
                key={item.key}
                style={seededScatterStyle(item.key, index, mediaWidth)}
                onClick={() => setViewerTarget({ type: 'media', spreadIndex, itemIndex: index })}
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

          {messages.map((message, index) => {
            const key = `${album.id}-${spreadIndex}-msg-${index}-${message.slice(0, 24)}`;
            return (
              <div
                className="catn8-scatter-card catn8-scatter-note"
                key={key}
                style={seededScatterStyle(key, index + images.length, noteWidth, 3)}
                onClick={() => setViewerTarget({ type: 'note', spreadIndex, itemIndex: index })}
              >
                <div className="catn8-scatter-note-inner" style={{ borderColor: theme.borderColor, backgroundColor: theme.accentColor }}>
                  <span className="catn8-scatter-note-emoji">{theme.emojis[index % theme.emojis.length]}</span>
                  <p>{message}</p>
                </div>
              </div>
            );
          })}

          {images.length === 0 ? (
            <div className="catn8-scatter-empty" style={seededScatterStyle(`${album.id}-${spreadIndex}-no-media`, 0, 260, 2)}>
              No photo/video linked on this spread yet.
            </div>
          ) : null}

          {messages.length === 0 ? (
            <div className="catn8-scatter-empty" style={seededScatterStyle(`${album.id}-${spreadIndex}-no-text`, 1, 260, 2)}>
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
