import React from 'react';

import { usePhotoAlbumsPage } from '../../hooks/usePhotoAlbumsPage';
import { usePhotoAlbumsPageChrome } from '../../hooks/photo-albums/usePhotoAlbumsPageChrome';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { PageLayout } from '../layout/PageLayout';
import { PhotoAlbumCreateModal } from '../modals/PhotoAlbumCreateModal';
import { PhotoAlbumAdminModal } from '../photo-albums/PhotoAlbumAdminModal';
import { PhotoAlbumsBusyOverlay } from '../photo-albums/PhotoAlbumsBusyOverlay';
import { PhotoAlbumsListShell } from '../photo-albums/PhotoAlbumsListShell';
import { PhotoAlbumViewerShell } from '../photo-albums/PhotoAlbumViewerShell';

import './PhotoAlbumsPage.css';

export function PhotoAlbumsPage({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle, onToast }: AppShellPageProps) {
  const state = usePhotoAlbumsPage(viewer, onToast);
  const selectedAlbum = state.selectedAlbum;
  const viewerAlbum = state.viewerAlbum || selectedAlbum;
  const selectedAlbumId = Number(selectedAlbum?.id || 0);
  const viewerAlbumId = Number(viewerAlbum?.id || 0);
  const selectedPageFavorite = selectedAlbumId > 0 ? state.isPageFavorite(selectedAlbumId, state.pageIndex) : false;
  const viewerPageFavorite = viewerAlbumId > 0 ? state.isPageFavorite(viewerAlbumId, state.pageIndex) : false;
  const viewerAlbumLocked = Number(viewerAlbum?.is_locked || 0) === 1;
  const viewerPageLocked = Number(viewerAlbum?.spec?.spreads?.[state.pageIndex]?.is_locked || 0) === 1;
  const chrome = usePhotoAlbumsPageChrome({ state });

  return (
    <PageLayout page="photo_m8" title="PHOTO M8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className={chrome.isAlbumViewerOpen ? 'section catn8-photo-albums-page catn8-photo-albums-page--viewer' : 'section catn8-photo-albums-page'}>
        <div className={chrome.isAlbumViewerOpen ? 'container catn8-photo-albums-container--viewer' : 'container'}>
          {state.loading ? <div className="catn8-card p-4 mt-3">Loading albums...</div> : null}

          {!state.loading && !state.showAlbumViewer ? (
            <PhotoAlbumsListShell
              albums={state.albums}
              busy={state.busy}
              isAdmin={state.isAdmin}
              onOpenAlbum={(albumId) => { void chrome.openAlbum(albumId, 'view', undefined, 'list'); }}
              onEditAlbum={(albumId) => { void chrome.openAlbum(albumId, 'edit', undefined, 'album'); }}
              onToggleAlbumLock={(albumId, isLocked) => { void state.toggleAlbumLock(albumId, isLocked); }}
              onDeleteAlbum={(albumId, title) => { void state.deleteAlbumById({ id: albumId, title }); }}
              onCaptureNewMessages={() => { void state.captureNewMessages(); }}
              onCreatePhotoAlbum={chrome.openCreateModal}
            />
          ) : null}

          {!state.loading && state.showAlbumViewer && viewerAlbum ? (
            <PhotoAlbumViewerShell
              album={viewerAlbum}
              isAdmin={state.isAdmin}
              isFullscreen={chrome.isFullscreen}
              viewMode={chrome.viewMode}
              pageIndex={state.pageIndex}
              zoom={state.zoom}
              canPrev={state.canPrev}
              canNext={state.canNext}
              pageFavorite={viewerPageFavorite}
              albumLocked={viewerAlbumLocked}
              pageLocked={viewerPageLocked}
              isMediaFavorite={(spreadIndex, mediaSourceIndex) => state.isMediaFavorite(viewerAlbum.id, spreadIndex, mediaSourceIndex)}
              isTextFavorite={(spreadIndex, textItemId) => state.isTextFavorite(viewerAlbum.id, spreadIndex, textItemId)}
              onPrevPage={state.prevPage}
              onNextPage={state.nextPage}
              onSetViewMode={chrome.setAlbumViewMode}
              onEditAlbum={() => {
                if (viewerAlbum.id) {
                  void chrome.openAlbum(viewerAlbum.id, 'edit', state.pageIndex, chrome.viewMode);
                }
              }}
              onToggleAlbumLock={() => {
                if (viewerAlbum.id) {
                  void state.toggleAlbumLock(viewerAlbum.id, !viewerAlbumLocked);
                }
              }}
              onEnterFullscreen={() => { void chrome.enterFullscreen(); }}
              onClose={() => { void chrome.closeTopmostLayer(); }}
              onTogglePageFavorite={(spreadIndex) => { void state.togglePageFavorite(viewerAlbum.id, spreadIndex); }}
              onToggleMediaFavorite={(spreadIndex, mediaSourceIndex) => { void state.toggleMediaFavorite(viewerAlbum.id, spreadIndex, mediaSourceIndex); }}
              onToggleTextFavorite={(spreadIndex, textItemId) => { void state.toggleTextFavorite(viewerAlbum.id, spreadIndex, textItemId); }}
              onTogglePageLock={state.isAdmin ? (spreadIndex) => { void state.toggleSpreadLock(viewerAlbum.id, spreadIndex, !viewerPageLocked); } : undefined}
            />
          ) : null}
        </div>
      </section>

      {state.busy ? <PhotoAlbumsBusyOverlay /> : null}

      <PhotoAlbumCreateModal
        open={state.showCreateModal}
        busy={state.busy}
        value={state.createForm}
        onChange={state.setCreateForm}
        onClose={() => state.setShowCreateModal(false)}
        onCreate={state.createWithAi}
      />

      <PhotoAlbumAdminModal
        open={state.showAdminModal}
        busy={state.busy}
        hasUnsavedChanges={state.hasUnsavedAdminChanges}
        album={state.adminDraft}
        viewMode={chrome.viewMode}
        onSetViewMode={chrome.setAlbumViewMode}
        pageIndex={state.pageIndex}
        zoom={state.zoom}
        canPrev={state.canPrev}
        canNext={state.canNext}
        pageFavorite={selectedPageFavorite}
        isMediaFavorite={(spreadIndex, mediaSourceIndex) => selectedAlbumId > 0 && state.isMediaFavorite(selectedAlbumId, spreadIndex, mediaSourceIndex)}
        isTextFavorite={(spreadIndex, textItemId) => selectedAlbumId > 0 && state.isTextFavorite(selectedAlbumId, spreadIndex, textItemId)}
        onPrevPage={state.prevPage}
        onNextPage={state.nextPage}
        onTogglePageFavorite={(spreadIndex) => {
          if (selectedAlbumId > 0) {
            void state.togglePageFavorite(selectedAlbumId, spreadIndex);
          }
        }}
        onToggleMediaFavorite={(spreadIndex, mediaSourceIndex) => {
          if (selectedAlbumId > 0) {
            void state.toggleMediaFavorite(selectedAlbumId, spreadIndex, mediaSourceIndex);
          }
        }}
        onToggleTextFavorite={(spreadIndex, textItemId) => {
          if (selectedAlbumId > 0) {
            void state.toggleTextFavorite(selectedAlbumId, spreadIndex, textItemId);
          }
        }}
        onFullscreenPreview={() => { void chrome.enterFullscreen(); }}
        onClose={state.closeAdminModal}
        onSave={state.saveAdminEdits}
        onAutoLayout={state.autoLayoutAlbum}
        onAutoLayoutAllUnlocked={state.autoLayoutAllUnlocked}
        onAutoLayoutSpread={state.autoLayoutCurrentSpread}
        onToggleAlbumLock={(isLocked) => {
          if (selectedAlbumId > 0) {
            void state.toggleAlbumLock(selectedAlbumId, isLocked);
          }
        }}
        onToggleSpreadLock={(isLocked) => {
          if (selectedAlbumId > 0) {
            void state.toggleSpreadLock(selectedAlbumId, state.pageIndex, isLocked);
          }
        }}
        onDelete={state.deleteSelectedAlbum}
        onGenerateBackground={(scope, prompt) => {
          void state.generateAiBackground(scope, prompt);
        }}
        onGenerateClipart={(prompt) => {
          void state.generateAiClipart(prompt);
        }}
        onGenerateAccentImage={(prompt) => {
          void state.generateAiAccentImage(prompt);
        }}
        onGenerateCoverFromFavorites={() => {
          void state.generateAiCoverFromFavorites();
        }}
        onRedesignPage={() => {
          void state.redesignAiSpread();
        }}
        onAlbumChange={state.updateAdminDraft}
      />
    </PageLayout>
  );
}
