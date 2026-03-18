import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';
import { AlbumTheme } from '../../utils/photoAlbumThemes';
import { ChronologicalGroup } from './photoAlbumChronology';
import { formatNoteText, isTranscriptCaption, isVideoMedia } from './photoAlbumStageEngine';

interface PhotoAlbumChronologyGroupProps {
  album: PhotoAlbum;
  group: ChronologicalGroup;
  groupIndex: number;
  editable: boolean;
  theme: AlbumTheme;
  isMediaFavorite?: (spreadIndex: number, mediaSourceIndex: number) => boolean;
  isTextFavorite?: (spreadIndex: number, textItemId: string) => boolean;
  onOpenNote: (spreadIndex: number, itemIndex: number) => void;
  onOpenMedia: (spreadIndex: number, itemIndex: number) => void;
  onToggleMediaFavorite?: (spreadIndex: number, mediaSourceIndex: number) => void;
  onToggleTextFavorite?: (spreadIndex: number, textItemId: string) => void;
  onDeleteMedia?: (spreadIndex: number, mediaSourceIndex: number) => void;
  onDeleteText?: (spreadIndex: number, textItemId: string) => void;
}

export function PhotoAlbumChronologyGroup({
  album,
  group,
  groupIndex,
  editable,
  theme,
  isMediaFavorite,
  isTextFavorite,
  onOpenNote,
  onOpenMedia,
  onToggleMediaFavorite,
  onToggleTextFavorite,
  onDeleteMedia,
  onDeleteText,
}: PhotoAlbumChronologyGroupProps) {
  return (
    <section className="catn8-photo-albums-chron-group" aria-label={group.label || `Timeline group ${groupIndex + 1}`}>
      <div className="catn8-photo-albums-chron-group-header">
        <span className="catn8-photo-albums-chron-group-chip">{group.label || `Moment ${groupIndex + 1}`}</span>
      </div>
      <div className="catn8-photo-albums-chron-group-row">
        <div className="catn8-photo-albums-chron-column">
          <div className="catn8-photo-albums-chron-column-header">
            <h4>Texts</h4>
            <span>{group.texts.length}</span>
          </div>
          <div className="catn8-photo-albums-chron-stack">
            {group.texts.map((entry, index) => {
              const display = formatNoteText(entry.note);
              const noteFavorited = typeof isTextFavorite === 'function'
                ? isTextFavorite(entry.spreadIndex, entry.note.id)
                : false;
              return (
                <article
                  key={entry.key}
                  className="catn8-photo-albums-chron-card catn8-photo-albums-chron-card--text catn8-scatter-card catn8-scatter-note"
                  onClick={() => onOpenNote(entry.spreadIndex, entry.itemIndex)}
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
                  {editable && typeof onDeleteText === 'function' ? (
                    <button
                      type="button"
                      className="catn8-preview-delete-toggle catn8-preview-delete-toggle-note"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteText(entry.spreadIndex, entry.note.id);
                      }}
                      aria-label="Delete text"
                      title="Delete text"
                    >
                      🗑️
                    </button>
                  ) : null}
                  <div className="catn8-photo-albums-chron-meta">
                    <span>{entry.dateLabel}</span>
                  </div>
                  <div className="catn8-scatter-note-inner" style={{ borderColor: theme.borderColor, backgroundColor: theme.accentColor }}>
                    <span className="catn8-scatter-note-emoji">{theme.emojis[(groupIndex + index) % Math.max(1, theme.emojis.length)] || '✨'}</span>
                    <p>{display}</p>
                  </div>
                </article>
              );
            })}
            {group.texts.length === 0 ? (
              <div className="catn8-photo-albums-chron-empty">No text messages in this moment.</div>
            ) : null}
          </div>
        </div>

        <div className="catn8-photo-albums-chron-column">
          <div className="catn8-photo-albums-chron-column-header">
            <h4>Photos</h4>
            <span>{group.media.length}</span>
          </div>
          <div className="catn8-photo-albums-chron-stack">
            {group.media.map((entry, index) => {
              const showCaption = Boolean(entry.caption && !isTranscriptCaption(entry.caption));
              const mediaFavorited = typeof isMediaFavorite === 'function'
                ? isMediaFavorite(entry.spreadIndex, entry.sourceIndex)
                : false;
              return (
                <figure
                  key={entry.key}
                  className="catn8-photo-albums-chron-card catn8-photo-albums-chron-card--media catn8-scatter-card catn8-scatter-media"
                  onClick={() => onOpenMedia(entry.spreadIndex, entry.itemIndex)}
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
                  {editable && typeof onDeleteMedia === 'function' ? (
                    <button
                      type="button"
                      className="catn8-preview-delete-toggle"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteMedia(entry.spreadIndex, entry.sourceIndex);
                      }}
                      aria-label="Delete media"
                      title="Delete media"
                    >
                      🗑️
                    </button>
                  ) : null}
                  <div className="catn8-photo-albums-chron-meta">
                    <span>{entry.dateLabel}</span>
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
            {group.media.length === 0 ? (
              <div className="catn8-photo-albums-chron-empty">No photos in this moment.</div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
