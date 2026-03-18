import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';
import { auditPhotoAlbum } from '../../utils/photoAlbumAudit';
import { sanitizeAlbumMessageText, splitAlbumMessages, toAlbumDisplayName } from '../../utils/photoAlbumText';
import { PhotoAlbumAdminEditorPanel } from './PhotoAlbumAdminEditorPanel';
import { PhotoAlbumAdminModalHeader } from './PhotoAlbumAdminModalHeader';
import { PhotoAlbumAdminPreviewPanel } from './PhotoAlbumAdminPreviewPanel';
import { PhotoAlbumAdminModalProps } from './photoAlbumAdminModalTypes';
import { usePhotoAlbumAdminPreviewActions } from './usePhotoAlbumAdminPreviewActions';

export function PhotoAlbumAdminModal(props: PhotoAlbumAdminModalProps) {
  const {
    open,
    busy,
    hasUnsavedChanges,
    album,
    pageIndex,
    zoom,
    canPrev,
    canNext,
    pageFavorite = false,
    isMediaFavorite,
    isTextFavorite,
    onPrevPage,
    onNextPage,
    onTogglePageFavorite,
    onToggleMediaFavorite,
    onToggleTextFavorite,
    onFullscreenPreview,
    onClose,
    onSave,
    onAutoLayout,
    onAutoLayoutAllUnlocked,
    onAutoLayoutSpread,
    onToggleAlbumLock,
    onToggleSpreadLock,
    onDelete,
    onGenerateBackground,
    onGenerateClipart,
    onGenerateAccentImage,
    onGenerateCoverFromFavorites,
    onRedesignPage,
    onAlbumChange,
    viewMode = 'album',
    onSetViewMode,
  } = props;

  const spread = album?.spec.spreads[pageIndex] || null;
  const images = Array.isArray(spread?.images) ? spread.images : [];
  const audit = React.useMemo(() => {
    if (!album) {
      return {
        totalSpreads: 0,
        spreadsMissingMedia: [] as number[],
        spreadsMissingText: [] as number[],
        spreadsMissingBoth: [] as number[],
        mediaEntriesMissingSource: 0,
        mediaEntriesQuestionableSource: 0,
      };
    }
    return auditPhotoAlbum(album);
  }, [album]);
  const textItems = Array.isArray(spread?.text_items) ? spread.text_items : [];
  const albumLocked = Number(album?.is_locked || 0) === 1;
  const spreadLocked = Number(spread?.is_locked || 0) === 1;
  const decorItems = (Array.isArray(spread?.decor_items) ? spread.decor_items : [])
    .map((item, index) => ({ item, index }))
    .filter((entry) => Boolean(entry.item && typeof entry.item === 'object'));
  const [backgroundTarget, setBackgroundTarget] = React.useState<'page' | 'album'>('page');
  const [aiAssetPrompt, setAiAssetPrompt] = React.useState('');

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.classList.add('catn8-admin-modal-open');
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.classList.remove('catn8-admin-modal-open');
    };
  }, [open]);

  const ensureTextItems = React.useCallback(() => {
    if (!album) {
      return;
    }
    onAlbumChange((prev) => {
      const next = structuredClone(prev);
      const target = next.spec.spreads[pageIndex];
      if (!target) {
        return prev;
      }
      if (Array.isArray(target.text_items) && target.text_items.length > 0) {
        return next;
      }
      const lines = sanitizeAlbumMessageText(target.caption || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      target.text_items = lines.map((line, index) => ({
        id: `note-${Date.now()}-${index}`,
        text: line,
      }));
      return next;
    });
  }, [album, onAlbumChange, pageIndex]);

  const hydrateTextItems = React.useCallback((targetSpread: NonNullable<PhotoAlbum['spec']['spreads'][number]>) => {
    if (Array.isArray(targetSpread.text_items) && targetSpread.text_items.length > 0) {
      targetSpread.text_items = targetSpread.text_items.map((item, index) => {
        if (!item || typeof item !== 'object') {
          return {
            id: `text-${index}`,
            text: '',
          };
        }
        const stableId = String(item.id || '').trim() || `text-${index}`;
        return {
          ...item,
          id: stableId,
        };
      });
      return;
    }
    const lines = splitAlbumMessages(targetSpread.caption || '').map((line) => line.trim()).filter(Boolean);
    targetSpread.text_items = lines.map((line, index) => ({
      id: `note-${Date.now()}-${index}`,
      text: line,
    }));
  }, []);

  const previewActions = usePhotoAlbumAdminPreviewActions({
    onAlbumChange,
    pageIndex,
    hydrateTextItems,
  });

  if (!open || !album) {
    return null;
  }

  return (
    <div className="catn8-admin-modal-overlay" role="dialog" aria-modal="true">
      <div className="catn8-admin-modal-shell">
        <PhotoAlbumAdminModalHeader
          busy={busy}
          hasUnsavedChanges={hasUnsavedChanges}
          albumLocked={albumLocked}
          spreadLocked={spreadLocked}
          viewMode={viewMode}
          onSetViewMode={onSetViewMode}
          onFullscreenPreview={onFullscreenPreview}
          onAutoLayout={onAutoLayout}
          onAutoLayoutAllUnlocked={onAutoLayoutAllUnlocked}
          onAutoLayoutSpread={onAutoLayoutSpread}
          onToggleSpreadLock={() => onToggleSpreadLock(!spreadLocked)}
          onDelete={onDelete}
          onSave={onSave}
          onClose={onClose}
        />

        <div className="catn8-admin-modal-body">
          <PhotoAlbumAdminEditorPanel
            busy={busy}
            album={album}
            spread={spread}
            pageIndex={pageIndex}
            canPrev={canPrev}
            canNext={canNext}
            albumLocked={albumLocked}
            spreadLocked={spreadLocked}
            audit={audit}
            images={images}
            textItems={textItems}
            decorItems={decorItems}
            backgroundTarget={backgroundTarget}
            aiAssetPrompt={aiAssetPrompt}
            setBackgroundTarget={setBackgroundTarget}
            setAiAssetPrompt={setAiAssetPrompt}
            onPrevPage={onPrevPage}
            onNextPage={onNextPage}
            onToggleAlbumLock={() => onToggleAlbumLock(!albumLocked)}
            onAlbumChange={onAlbumChange}
            onGenerateBackground={onGenerateBackground}
            onGenerateClipart={onGenerateClipart}
            onGenerateAccentImage={onGenerateAccentImage}
            onGenerateCoverFromFavorites={onGenerateCoverFromFavorites}
            onRedesignPage={onRedesignPage}
            onEnsureTextItems={ensureTextItems}
          />

          <PhotoAlbumAdminPreviewPanel
            album={album}
            viewMode={viewMode}
            pageIndex={pageIndex}
            zoom={zoom}
            canPrev={canPrev}
            canNext={canNext}
            pageFavorite={pageFavorite}
            albumLocked={albumLocked}
            spreadLocked={spreadLocked}
            isMediaFavorite={isMediaFavorite}
            isTextFavorite={isTextFavorite}
            onPrevPage={onPrevPage}
            onNextPage={onNextPage}
            onTogglePageFavorite={onTogglePageFavorite}
            onToggleMediaFavorite={onToggleMediaFavorite}
            onToggleTextFavorite={onToggleTextFavorite}
            onToggleSpreadLock={() => onToggleSpreadLock(!spreadLocked)}
            onClose={onClose}
            onDeleteListMedia={previewActions.deleteListMedia}
            onDeleteListText={previewActions.deleteListText}
            onMoveMedia={previewActions.moveMedia}
            onMoveNote={previewActions.moveNote}
            onMoveDecor={previewActions.moveDecor}
            onEditNoteText={previewActions.editNoteText}
            onEditMediaCaption={previewActions.editMediaCaption}
            onEditDecor={previewActions.editDecor}
            onDuplicateMedia={previewActions.duplicateMedia}
            onDuplicateNote={previewActions.duplicateNote}
            onDuplicateDecor={previewActions.duplicateDecor}
            onDeleteMedia={previewActions.deleteMedia}
            onDeleteNote={previewActions.deleteNote}
            onDeleteDecor={previewActions.deleteDecor}
          />
        </div>
      </div>
    </div>
  );
}
