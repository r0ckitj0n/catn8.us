import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';
import { inferAlbumTheme, sanitizeAlbumMessageText, splitAlbumMessages } from '../../utils/photoAlbumText';

interface PhotoAlbumStageProps {
  album: PhotoAlbum;
  spreadIndex: number;
  zoom: number;
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
    transform: `rotate(${rotate}deg)`,
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

export function PhotoAlbumStage({ album, spreadIndex, zoom }: PhotoAlbumStageProps) {
  const spread = album.spec.spreads[spreadIndex] || null;
  const images = Array.isArray(spread?.images) ? spread.images : [];

  const messages = uniqueMessages([
    ...splitAlbumMessages(spread?.caption || ''),
    ...images.map((image) => splitAlbumMessages(image.memory_text || image.caption || '')).flat(),
  ]);

  const theme = inferAlbumTheme([spread?.title || '', spread?.caption || '', ...messages].join(' '));

  return (
    <div className="catn8-scrapbook-stage catn8-scrapbook-stage-user">
      <div className={`catn8-scrapbook-scatter catn8-theme-${theme.name}`} style={{ transform: `scale(${zoom})` }}>
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
          {images.map((image, index) => {
            const mediaKey = `${album.id}-${spreadIndex}-${index}-${image.src || image.display_src || 'media'}`;
            const imageSrc = image.display_src || image.src;
            const caption = sanitizeAlbumMessageText(image.caption || image.memory_text || 'Memory');
            return (
              <figure
                className="catn8-scatter-card catn8-scatter-media"
                key={mediaKey}
                style={seededScatterStyle(mediaKey, index, 250)}
              >
                {imageSrc ? (
                  isVideoMedia(imageSrc, image.media_type) ? (
                    <video className="catn8-polaroid-photo catn8-polaroid-video" src={imageSrc} controls preload="metadata" />
                  ) : (
                    <img className="catn8-polaroid-photo" src={imageSrc} alt={caption || `Memory ${index + 1}`} loading="lazy" />
                  )
                ) : (
                  <div className="catn8-polaroid-photo is-placeholder" />
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
                style={seededScatterStyle(key, index + images.length, 230, 3)}
              >
                <div className="catn8-scatter-note-inner" style={{ borderColor: theme.borderColor, backgroundColor: theme.accentColor }}>
                  <span className="catn8-scatter-note-emoji">{theme.emojis[index % theme.emojis.length]}</span>
                  <p>{message}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
