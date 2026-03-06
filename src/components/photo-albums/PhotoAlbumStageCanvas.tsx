import React from 'react';

import { LockIcon } from './LockIcon';
import { DecorItem, NoteItem, SelectedItem } from './photoAlbumStageEngine';
import { PreparedMediaItem, ViewerType } from './types';
import { PhotoAlbumStageSelectedActions } from './PhotoAlbumStageSelectedActions';

export function PhotoAlbumStageCanvas({
  scatterRef,
  canvasRef,
  headerRef,
  scatterStyle,
  canvasStyle,
  themeName,
  spreadIndex,
  spreadHeaderLabel,
  themeBorderColor,
  themeAccentColor,
  themeEmojis,
  canPrev,
  canNext,
  onPrev,
  onNext,
  canFavoriteCurrentPage,
  pageFavorite,
  onTogglePageFavorite,
  pageLocked,
  albumLocked,
  onTogglePageLock,
  onToggleAlbumLock,
  onBackToAlbums,
  editable,
  isLayoutLocked,
  dragging,
  resizing,
  endDragging,
  decorItems,
  mediaItems,
  notes,
  selectedItem,
  isMediaFavorite,
  isTextFavorite,
  albumId,
  albumIsVirtual,
  onToggleMediaFavorite,
  onToggleTextFavorite,
  onEditNoteText,
  onDecorPointerDown,
  onMediaPointerDown,
  onNotePointerDown,
  onItemClick,
  renderDecorStyle,
  renderMediaStyle,
  renderNoteStyle,
  formatNoteText,
  isTranscriptCaption,
  isVideoMedia,
  selectedItemActionsStyle,
  onViewSelected,
  onEditSelected,
  onDuplicateSelected,
  onDeleteSelected,
  onClearSelected,
}: {
  scatterRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  headerRef: React.RefObject<HTMLDivElement | null>;
  scatterStyle: React.CSSProperties;
  canvasStyle: React.CSSProperties;
  themeName: string;
  spreadIndex: number;
  spreadHeaderLabel: string;
  themeBorderColor: string;
  themeAccentColor: string;
  themeEmojis: string[];
  canPrev: boolean;
  canNext: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  canFavoriteCurrentPage: boolean;
  pageFavorite: boolean;
  onTogglePageFavorite?: (spreadIndex: number) => void;
  pageLocked: boolean;
  albumLocked: boolean;
  onTogglePageLock?: (spreadIndex: number) => void;
  onToggleAlbumLock?: () => void;
  onBackToAlbums?: () => void;
  editable: boolean;
  isLayoutLocked: boolean;
  dragging: unknown;
  resizing: unknown;
  endDragging: () => void;
  decorItems: DecorItem[];
  mediaItems: PreparedMediaItem[];
  notes: NoteItem[];
  selectedItem: SelectedItem | null;
  isMediaFavorite?: (spreadIndex: number, mediaSourceIndex: number) => boolean;
  isTextFavorite?: (spreadIndex: number, textItemId: string) => boolean;
  albumId: number;
  albumIsVirtual: boolean;
  onToggleMediaFavorite?: (spreadIndex: number, mediaSourceIndex: number) => void;
  onToggleTextFavorite?: (spreadIndex: number, textItemId: string) => void;
  onEditNoteText?: (index: number, nextText: string) => void;
  onDecorPointerDown: (index: number, event: React.PointerEvent<HTMLElement>) => void;
  onMediaPointerDown: (index: number, sourceIndex: number, event: React.PointerEvent<HTMLElement>) => void;
  onNotePointerDown: (index: number, event: React.PointerEvent<HTMLElement>) => void;
  onItemClick: (item: SelectedItem, viewerType: ViewerType | null) => void;
  renderDecorStyle: (item: DecorItem, index: number) => React.CSSProperties;
  renderMediaStyle: (index: number) => React.CSSProperties;
  renderNoteStyle: (note: NoteItem, index: number) => React.CSSProperties;
  formatNoteText: (note: NoteItem) => string;
  isTranscriptCaption: (text: string) => boolean;
  isVideoMedia: (src: string, mediaType?: string) => boolean;
  selectedItemActionsStyle?: React.CSSProperties;
  onViewSelected: () => void;
  onEditSelected: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onClearSelected: () => void;
}) {
  return (
    <div className="catn8-scrapbook-stage catn8-scrapbook-stage-user">
      <div ref={scatterRef} className={`catn8-scrapbook-scatter catn8-theme-${themeName}`} style={scatterStyle}>
        <div className="catn8-scrapbook-corner catn8-scrapbook-corner-tl" aria-hidden="true" />
        <div className="catn8-scrapbook-corner catn8-scrapbook-corner-br" aria-hidden="true" />
        <div className="catn8-scrapbook-tape catn8-scrapbook-tape-top" aria-hidden="true" />
        <div className="catn8-scrapbook-tape catn8-scrapbook-tape-right" aria-hidden="true" />

        <button type="button" className="catn8-stage-nav catn8-stage-nav-prev" onClick={onPrev} disabled={!canPrev || typeof onPrev !== 'function'} aria-label="Previous spread">‹</button>
        <button type="button" className="catn8-stage-nav catn8-stage-nav-next" onClick={onNext} disabled={!canNext || typeof onNext !== 'function'} aria-label="Next spread">›</button>

        {canFavoriteCurrentPage ? (
          <button type="button" className={pageFavorite ? 'catn8-stage-favorite-toggle catn8-stage-page-favorite-toggle is-active' : 'catn8-stage-favorite-toggle catn8-stage-page-favorite-toggle'} onClick={() => onTogglePageFavorite?.(spreadIndex)} aria-label={pageFavorite ? 'Remove page from favorites' : 'Add page to favorites'} aria-pressed={pageFavorite} title={pageFavorite ? 'Favorited page' : 'Favorite this page'}>{pageFavorite ? '♥' : '♡'}</button>
        ) : null}

        {typeof onTogglePageLock === 'function' ? (
          <button type="button" className={pageLocked ? 'catn8-stage-favorite-toggle is-active catn8-stage-lock-toggle' : 'catn8-stage-favorite-toggle catn8-stage-lock-toggle'} onClick={() => onTogglePageLock(spreadIndex)} aria-label={pageLocked ? 'Unlock this page' : 'Lock this page'} title={pageLocked ? 'Page locked' : 'Lock this page'}><LockIcon locked={pageLocked} /></button>
        ) : null}

        {typeof onToggleAlbumLock === 'function' ? (
          <button type="button" className={albumLocked ? 'catn8-stage-favorite-toggle is-active catn8-stage-lock-toggle catn8-stage-album-lock-toggle' : 'catn8-stage-favorite-toggle catn8-stage-lock-toggle catn8-stage-album-lock-toggle'} onClick={() => onToggleAlbumLock()} aria-label={albumLocked ? 'Unlock this album' : 'Lock this album'} title={albumLocked ? 'Album locked' : 'Lock this album'}><LockIcon locked={albumLocked} /></button>
        ) : null}

        <div ref={headerRef} className="catn8-scrapbook-stage-header">
          {typeof onBackToAlbums === 'function' ? (
            <button type="button" className="catn8-scrapbook-page-tag catn8-scrapbook-page-tag-button" onClick={onBackToAlbums}>Back to Albums</button>
          ) : (
            <span className="catn8-scrapbook-page-tag">Spread {spreadIndex + 1}</span>
          )}
          <h3>{spreadHeaderLabel}</h3>
        </div>

        <div ref={canvasRef} className="catn8-scatter-canvas" style={canvasStyle} onPointerUp={endDragging} onMouseLeave={() => { if (!dragging && !resizing) { endDragging(); } }}>
          {decorItems.map((item, index) => (
            <span key={item.id} className="catn8-scatter-emoji" style={renderDecorStyle(item, index)} onPointerDown={editable && !isLayoutLocked ? (event) => onDecorPointerDown(index, event) : undefined} onClick={() => onItemClick({ type: 'decor', index }, null)}>{item.emoji}</span>
          ))}

          {mediaItems.map((item, index) => {
            const caption = item.caption;
            const showCaption = Boolean(caption && !isTranscriptCaption(caption));
            const mediaFavorited = typeof isMediaFavorite === 'function' ? isMediaFavorite(spreadIndex, item.sourceIndex) : false;
            return (
              <figure
                className={selectedItem?.type === 'media' && selectedItem.index === index ? 'catn8-scatter-card catn8-scatter-media is-selected' : 'catn8-scatter-card catn8-scatter-media'}
                key={item.key}
                style={renderMediaStyle(index)}
                draggable={false}
                onDragStart={(event) => event.preventDefault()}
                onPointerDown={editable && !isLayoutLocked ? (event) => onMediaPointerDown(index, item.sourceIndex, event) : undefined}
              >
                {typeof onToggleMediaFavorite === 'function' && albumId > 0 && !albumIsVirtual ? (
                  <button type="button" className={mediaFavorited ? 'catn8-preview-favorite-toggle is-active' : 'catn8-preview-favorite-toggle'} onClick={(event) => { event.stopPropagation(); onToggleMediaFavorite(spreadIndex, item.sourceIndex); }} aria-label={mediaFavorited ? 'Remove media from favorites' : 'Add media to favorites'} aria-pressed={mediaFavorited} title={mediaFavorited ? 'Favorited media' : 'Favorite this media'}>♥</button>
                ) : null}
                {editable && !isLayoutLocked && typeof onDeleteMedia === 'function' ? (
                  <button
                    type="button"
                    className="catn8-preview-delete-toggle"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteMedia(item.sourceIndex);
                    }}
                    aria-label="Delete media"
                    title="Delete media"
                  >
                    🗑️
                  </button>
                ) : null}
                {isVideoMedia(item.src, item.mediaType) ? (
                  <video className="catn8-polaroid-photo catn8-polaroid-video" src={item.src} controls preload="metadata" onClick={(event) => { event.stopPropagation(); onItemClick({ type: 'media', index, sourceIndex: item.sourceIndex }, 'media'); }} onDragStart={(event) => event.preventDefault()} />
                ) : (
                  <img className="catn8-polaroid-photo" src={item.src} alt={caption || `Memory ${index + 1}`} loading="lazy" draggable={false} onDragStart={(event) => event.preventDefault()} onClick={(event) => { event.stopPropagation(); onItemClick({ type: 'media', index, sourceIndex: item.sourceIndex }, 'media'); }} />
                )}
                {showCaption ? <figcaption className="catn8-polaroid-caption">{caption}</figcaption> : null}
              </figure>
            );
          })}

          {notes.map((note, index) => {
            const display = formatNoteText(note);
            const noteFavorited = typeof isTextFavorite === 'function' ? isTextFavorite(spreadIndex, note.id) : false;
            return (
              <div
                className={selectedItem?.type === 'note' && selectedItem.index === index ? 'catn8-scatter-card catn8-scatter-note is-selected' : 'catn8-scatter-card catn8-scatter-note'}
                key={note.id}
                style={renderNoteStyle(note, index)}
                draggable={false}
                onDragStart={(event) => event.preventDefault()}
                onClick={() => onItemClick({ type: 'note', index }, 'note')}
                onPointerDown={editable && !isLayoutLocked ? (event) => onNotePointerDown(index, event) : undefined}
                onDoubleClick={editable && !isLayoutLocked && onEditNoteText ? () => { const next = window.prompt('Edit text', display); if (typeof next === 'string' && next.trim()) { onEditNoteText(index, next.trim()); } } : undefined}
              >
                {typeof onToggleTextFavorite === 'function' && albumId > 0 && !albumIsVirtual ? (
                  <button type="button" className={noteFavorited ? 'catn8-preview-favorite-toggle catn8-preview-favorite-toggle-note is-active' : 'catn8-preview-favorite-toggle catn8-preview-favorite-toggle-note'} onClick={(event) => { event.stopPropagation(); onToggleTextFavorite(spreadIndex, note.id); }} aria-label={noteFavorited ? 'Remove text from favorites' : 'Add text to favorites'} aria-pressed={noteFavorited} title={noteFavorited ? 'Favorited text' : 'Favorite this text'}>♥</button>
                ) : null}
                {editable && !isLayoutLocked && typeof onDeleteNote === 'function' ? (
                  <button
                    type="button"
                    className="catn8-preview-delete-toggle catn8-preview-delete-toggle-note"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteNote(index);
                    }}
                    aria-label="Delete text"
                    title="Delete text"
                  >
                    🗑️
                  </button>
                ) : null}
                <div className="catn8-scatter-note-inner" style={{ borderColor: themeBorderColor, backgroundColor: themeAccentColor }}>
                  <span className="catn8-scatter-note-emoji">{themeEmojis[index % Math.max(1, themeEmojis.length)] || '✨'}</span>
                  <p>{display}</p>
                </div>
              </div>
            );
          })}

          <PhotoAlbumStageSelectedActions
            editable={editable}
            selectedItem={selectedItem}
            selectedItemActionsStyle={selectedItemActionsStyle}
            isLayoutLocked={isLayoutLocked}
            onViewSelected={onViewSelected}
            onEditSelected={onEditSelected}
            onDuplicateSelected={onDuplicateSelected}
            onDeleteSelected={onDeleteSelected}
            onClearSelected={onClearSelected}
          />
        </div>
      </div>
    </div>
  );
}
