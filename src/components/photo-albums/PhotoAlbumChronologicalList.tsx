import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';
import { inferAlbumTheme } from '../../utils/photoAlbumText';
import { PhotoAlbumChronologyGroup } from './PhotoAlbumChronologyGroup';
import { PhotoAlbumElementViewer } from './PhotoAlbumElementViewer';
import { buildPhotoAlbumChronology } from './photoAlbumChronology';
import { usePhotoAlbumStageViewer } from './hooks/usePhotoAlbumStageViewer';

interface PhotoAlbumChronologicalListProps {
  album: PhotoAlbum;
  contactDisplayName?: string;
  editable?: boolean;
  isMediaFavorite?: (spreadIndex: number, mediaSourceIndex: number) => boolean;
  isTextFavorite?: (spreadIndex: number, textItemId: string) => boolean;
  onToggleMediaFavorite?: (spreadIndex: number, mediaSourceIndex: number) => void;
  onToggleTextFavorite?: (spreadIndex: number, textItemId: string) => void;
  onDeleteMedia?: (spreadIndex: number, mediaSourceIndex: number) => void;
  onDeleteText?: (spreadIndex: number, textItemId: string) => void;
}

export function PhotoAlbumChronologicalList({
  album,
  contactDisplayName,
  editable = false,
  isMediaFavorite,
  isTextFavorite,
  onToggleMediaFavorite,
  onToggleTextFavorite,
  onDeleteMedia,
  onDeleteText,
}: PhotoAlbumChronologicalListProps) {
  const viewer = usePhotoAlbumStageViewer({
    album,
    spreadIndex: 0,
    contactDisplayName,
    canPrev: false,
    canNext: false,
  });

  const theme = React.useMemo(() => inferAlbumTheme(`${album.title} ${album.summary}`), [album.summary, album.title]);

  const chronology = React.useMemo(() => buildPhotoAlbumChronology(album, contactDisplayName), [album, contactDisplayName]);

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
            <span>{chronology.texts} texts</span>
            <span>{chronology.media} photos</span>
          </div>
        </div>

          <div className="catn8-photo-albums-chron-grid catn8-photo-albums-chron-grid--timeline">
            {chronology.groups.map((group, groupIndex) => (
              <PhotoAlbumChronologyGroup
                key={group.key}
                album={album}
                group={group}
                groupIndex={groupIndex}
                editable={editable}
                theme={theme}
                isMediaFavorite={isMediaFavorite}
                isTextFavorite={isTextFavorite}
                onOpenNote={(spreadIndex, itemIndex) => viewer.setViewerTarget({ type: 'note', spreadIndex, itemIndex })}
                onOpenMedia={(spreadIndex, itemIndex) => viewer.setViewerTarget({ type: 'media', spreadIndex, itemIndex })}
                onToggleMediaFavorite={onToggleMediaFavorite}
                onToggleTextFavorite={onToggleTextFavorite}
                onDeleteMedia={onDeleteMedia}
                onDeleteText={onDeleteText}
              />
            ))}

          {chronology.groups.length === 0 ? (
            <>
              <div className="catn8-photo-albums-chron-empty">No text messages are available in this album.</div>
              <div className="catn8-photo-albums-chron-empty">No photos are available in this album.</div>
            </>
          ) : null}
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
