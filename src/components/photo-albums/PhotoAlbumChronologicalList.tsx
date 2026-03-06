import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';
import { inferAlbumTheme } from '../../utils/photoAlbumText';
import { PhotoAlbumElementViewer } from './PhotoAlbumElementViewer';
import { NoteItem, formatNoteText, isTranscriptCaption, parseClockToMinutes, spreadMedia, spreadNotes } from './photoAlbumStageEngine';
import { usePhotoAlbumStageViewer } from './hooks/usePhotoAlbumStageViewer';

interface PhotoAlbumChronologicalListProps {
  album: PhotoAlbum;
  contactDisplayName?: string;
  isMediaFavorite?: (spreadIndex: number, mediaSourceIndex: number) => boolean;
  isTextFavorite?: (spreadIndex: number, textItemId: string) => boolean;
  onToggleMediaFavorite?: (spreadIndex: number, mediaSourceIndex: number) => void;
  onToggleTextFavorite?: (spreadIndex: number, textItemId: string) => void;
}

type ChronologicalTextEntry = {
  key: string;
  spreadIndex: number;
  itemIndex: number;
  note: NoteItem;
  dateLabel: string;
  spreadLabel: string;
  sortMs?: number;
  sortMinutes?: number;
};

type ChronologicalMediaEntry = {
  key: string;
  spreadIndex: number;
  itemIndex: number;
  sourceIndex: number;
  src: string;
  mediaType?: 'image' | 'video';
  caption: string;
  dateLabel: string;
  spreadLabel: string;
  sortMs?: number;
};

function formatListDateLabel(value?: number, fallback?: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  return fallback || '';
}

function compareOptionalNumbers(a?: number, b?: number): number {
  const aValid = typeof a === 'number' && Number.isFinite(a);
  const bValid = typeof b === 'number' && Number.isFinite(b);
  if (aValid && bValid) {
    return a! - b!;
  }
  if (aValid) {
    return -1;
  }
  if (bValid) {
    return 1;
  }
  return 0;
}

function isVideoMedia(src: string, mediaType?: string): boolean {
  if (mediaType === 'video') {
    return true;
  }
  return /\.(mov|mp4|m4v|3gp|avi|mkv|webm)(\?.*)?$/i.test(src || '');
}

export function PhotoAlbumChronologicalList({
  album,
  contactDisplayName,
  isMediaFavorite,
  isTextFavorite,
  onToggleMediaFavorite,
  onToggleTextFavorite,
}: PhotoAlbumChronologicalListProps) {
  const viewer = usePhotoAlbumStageViewer({
    album,
    spreadIndex: 0,
    contactDisplayName,
    canPrev: false,
    canNext: false,
  });

  const theme = React.useMemo(() => inferAlbumTheme(`${album.title} ${album.summary}`), [album.summary, album.title]);

  const chronology = React.useMemo(() => {
    const spreads = Array.isArray(album.spec?.spreads) ? album.spec.spreads : [];
    const texts: ChronologicalTextEntry[] = [];
    const media: ChronologicalMediaEntry[] = [];

    spreads.forEach((spread, spreadIndex) => {
      const spreadMediaItems = spreadMedia(album, spreadIndex);
      const spreadNotesItems = spreadNotes(album, spreadIndex, spreadMediaItems, contactDisplayName);
      const spreadDateMs = spreadMediaItems
        .map((item) => item.capturedAtMs)
        .find((value): value is number => typeof value === 'number' && Number.isFinite(value));
      const spreadLabel = `Spread ${spreadIndex + 1}`;
      const dateLabel = formatListDateLabel(spreadDateMs, spreadLabel);

      spreadNotesItems.forEach((note, itemIndex) => {
        texts.push({
          key: `${spreadIndex}-${note.id}-${itemIndex}`,
          spreadIndex,
          itemIndex,
          note,
          dateLabel,
          spreadLabel,
          sortMs: spreadDateMs,
          sortMinutes: parseClockToMinutes(note.time) ?? undefined,
        });
      });

      spreadMediaItems.forEach((item, itemIndex) => {
        media.push({
          key: item.key,
          spreadIndex,
          itemIndex,
          sourceIndex: item.sourceIndex,
          src: item.src,
          mediaType: item.mediaType,
          caption: item.caption,
          dateLabel,
          spreadLabel,
          sortMs: item.capturedAtMs ?? spreadDateMs,
        });
      });
    });

    texts.sort((a, b) => (
      compareOptionalNumbers(a.sortMs, b.sortMs)
      || compareOptionalNumbers(a.sortMinutes, b.sortMinutes)
      || (a.spreadIndex - b.spreadIndex)
      || (a.itemIndex - b.itemIndex)
    ));

    media.sort((a, b) => (
      compareOptionalNumbers(a.sortMs, b.sortMs)
      || (a.spreadIndex - b.spreadIndex)
      || (a.itemIndex - b.itemIndex)
    ));

    return { texts, media };
  }, [album, contactDisplayName]);

  const canFavoriteCurrentMedia = album.id > 0 && !album.is_virtual && typeof onToggleMediaFavorite === 'function' && viewer.viewerTarget?.type === 'media' && Boolean(viewer.activeMedia);
  const canFavoriteCurrentText = album.id > 0 && !album.is_virtual && typeof onToggleTextFavorite === 'function' && viewer.viewerTarget?.type === 'note' && Boolean(viewer.activeViewerNote);
  const activeMediaFavorited = (canFavoriteCurrentMedia && viewer.activeMedia && typeof isMediaFavorite === 'function')
    ? isMediaFavorite(viewer.viewerTarget!.spreadIndex, viewer.activeMedia.sourceIndex)
    : false;
  const activeNoteFavorited = (canFavoriteCurrentText && viewer.activeViewerNote && typeof isTextFavorite === 'function')
    ? isTextFavorite(viewer.viewerTarget!.spreadIndex, viewer.activeViewerNote.id)
    : false;

  return (
    <>
      <div className="catn8-photo-albums-list-view catn8-card">
        <div className="catn8-photo-albums-list-view-header">
          <div>
            <div className="catn8-scrapbook-page-tag">Chronological View</div>
            <h3 className="mb-0 mt-2">Texts and photos across the full album</h3>
          </div>
          <div className="catn8-photo-albums-list-view-summary">
            <span>{chronology.texts.length} texts</span>
            <span>{chronology.media.length} photos</span>
          </div>
        </div>

        <div className="catn8-photo-albums-chron-grid">
          <section className="catn8-photo-albums-chron-column" aria-label="Text messages">
            <div className="catn8-photo-albums-chron-column-header">
              <h4>Texts</h4>
              <span>{chronology.texts.length}</span>
            </div>
            <div className="catn8-photo-albums-chron-stack">
              {chronology.texts.map((entry, index) => {
                const display = formatNoteText(entry.note);
                const noteFavorited = typeof isTextFavorite === 'function'
                  ? isTextFavorite(entry.spreadIndex, entry.note.id)
                  : false;
                return (
                  <article
                    key={entry.key}
                    className="catn8-photo-albums-chron-card catn8-photo-albums-chron-card--text catn8-scatter-card catn8-scatter-note"
                    onClick={() => viewer.setViewerTarget({ type: 'note', spreadIndex: entry.spreadIndex, itemIndex: entry.itemIndex })}
                  >
                    {typeof onToggleTextFavorite === 'function' && album.id > 0 && !album.is_virtual ? (
                      <button
                        type="button"
                        className={noteFavorited ? 'catn8-preview-favorite-toggle catn8-preview-favorite-toggle-note is-active' : 'catn8-preview-favorite-toggle catn8-preview-favorite-toggle-note'}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleTextFavorite(entry.spreadIndex, entry.note.id);
                        }}
                        aria-label={noteFavorited ? 'Remove text from favorites' : 'Add text to favorites'}
                        aria-pressed={noteFavorited}
                        title={noteFavorited ? 'Favorited text' : 'Favorite this text'}
                      >
                        ♥
                      </button>
                    ) : null}
                    <div className="catn8-photo-albums-chron-meta">
                      <span>{entry.dateLabel}</span>
                      <span>{entry.spreadLabel}</span>
                    </div>
                    <div className="catn8-scatter-note-inner" style={{ borderColor: theme.borderColor, backgroundColor: theme.accentColor }}>
                      <span className="catn8-scatter-note-emoji">{theme.emojis[index % Math.max(1, theme.emojis.length)] || '✨'}</span>
                      <p>{display}</p>
                    </div>
                  </article>
                );
              })}
              {chronology.texts.length === 0 ? (
                <div className="catn8-photo-albums-chron-empty">No text messages are available in this album.</div>
              ) : null}
            </div>
          </section>

          <section className="catn8-photo-albums-chron-column" aria-label="Photos">
            <div className="catn8-photo-albums-chron-column-header">
              <h4>Photos</h4>
              <span>{chronology.media.length}</span>
            </div>
            <div className="catn8-photo-albums-chron-stack">
              {chronology.media.map((entry, index) => {
                const showCaption = Boolean(entry.caption && !isTranscriptCaption(entry.caption));
                const mediaFavorited = typeof isMediaFavorite === 'function'
                  ? isMediaFavorite(entry.spreadIndex, entry.sourceIndex)
                  : false;
                return (
                  <figure
                    key={entry.key}
                    className="catn8-photo-albums-chron-card catn8-photo-albums-chron-card--media catn8-scatter-card catn8-scatter-media"
                    onClick={() => viewer.setViewerTarget({ type: 'media', spreadIndex: entry.spreadIndex, itemIndex: entry.itemIndex })}
                  >
                    {typeof onToggleMediaFavorite === 'function' && album.id > 0 && !album.is_virtual ? (
                      <button
                        type="button"
                        className={mediaFavorited ? 'catn8-preview-favorite-toggle is-active' : 'catn8-preview-favorite-toggle'}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleMediaFavorite(entry.spreadIndex, entry.sourceIndex);
                        }}
                        aria-label={mediaFavorited ? 'Remove media from favorites' : 'Add media to favorites'}
                        aria-pressed={mediaFavorited}
                        title={mediaFavorited ? 'Favorited media' : 'Favorite this media'}
                      >
                        ♥
                      </button>
                    ) : null}
                    <div className="catn8-photo-albums-chron-meta">
                      <span>{entry.dateLabel}</span>
                      <span>{entry.spreadLabel}</span>
                    </div>
                    {isVideoMedia(entry.src, entry.mediaType) ? (
                      <video className="catn8-polaroid-photo catn8-polaroid-video" src={entry.src} controls preload="metadata" onClick={(event) => event.stopPropagation()} />
                    ) : (
                      <img className="catn8-polaroid-photo" src={entry.src} alt={entry.caption || `Photo ${index + 1}`} loading="lazy" />
                    )}
                    {showCaption ? <figcaption className="catn8-polaroid-caption">{entry.caption}</figcaption> : null}
                  </figure>
                );
              })}
              {chronology.media.length === 0 ? (
                <div className="catn8-photo-albums-chron-empty">No photos are available in this album.</div>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      {viewer.viewerTarget ? (
        <PhotoAlbumElementViewer
          target={viewer.viewerTarget}
          activeMedia={viewer.activeMedia}
          activeNote={viewer.activeNote}
          dateLabel={viewer.viewerDateLabel}
          activeMediaFavorite={activeMediaFavorited}
          activeNoteFavorite={activeNoteFavorited}
          prevTarget={viewer.prevTarget}
          nextTarget={viewer.nextTarget}
          onToggleActiveMediaFavorite={canFavoriteCurrentMedia && viewer.activeMedia ? () => {
            onToggleMediaFavorite?.(viewer.viewerTarget!.spreadIndex, viewer.activeMedia!.sourceIndex);
          } : undefined}
          onToggleActiveNoteFavorite={canFavoriteCurrentText && viewer.activeViewerNote ? () => {
            onToggleTextFavorite?.(viewer.viewerTarget!.spreadIndex, viewer.activeViewerNote!.id);
          } : undefined}
          onClose={() => viewer.setViewerTarget(null)}
          onNavigate={viewer.setViewerTarget}
        />
      ) : null}
    </>
  );
}
