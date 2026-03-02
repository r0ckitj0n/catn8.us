import React from 'react';

import { usePhotoAlbumsPage } from '../../hooks/usePhotoAlbumsPage';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { toAlbumDisplayName, toPhotoAlbumDisplaySummary, toPhotoAlbumDisplayTitle } from '../../utils/photoAlbumText';
import { PageLayout } from '../layout/PageLayout';
import { PhotoAlbumCreateModal } from '../modals/PhotoAlbumCreateModal';
import { PhotoAlbumAdminModal } from '../photo-albums/PhotoAlbumAdminModal';
import { PhotoAlbumStage } from '../photo-albums/PhotoAlbumStage';

import './PhotoAlbumsPage.css';

export function PhotoAlbumsPage({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle, onToast }: AppShellPageProps) {
  const state = usePhotoAlbumsPage(viewer, onToast);
  const selectedAlbum = state.selectedAlbum;
  const selectedAlbumSummary = toPhotoAlbumDisplaySummary(selectedAlbum?.summary || '');
  const selectedAlbumId = Number(selectedAlbum?.id || 0);
  const selectedPageFavorite = selectedAlbumId > 0 ? state.isPageFavorite(selectedAlbumId, state.pageIndex) : false;
  const isAlbumViewerOpen = !state.loading && state.showAlbumViewer && Boolean(selectedAlbum);

  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    const handleFs = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  React.useEffect(() => {
    const shouldHideChrome = isFullscreen && state.showAlbumViewer;
    document.body.classList.toggle('catn8-photo-albums-fullscreen', shouldHideChrome);
    return () => {
      document.body.classList.remove('catn8-photo-albums-fullscreen');
    };
  }, [isFullscreen, state.showAlbumViewer]);

  const openAlbum = React.useCallback(async (albumId: number) => {
    state.openAlbum(albumId);
    if (state.isAdmin) {
      return;
    }
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // fullscreen can be blocked by browser context
    }
  }, [state]);

  const closeViewer = React.useCallback(async () => {
    state.closeAlbumViewer();
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // no-op
      }
    }
  }, [state]);

  const openAdminFullscreenPreview = React.useCallback(async () => {
    state.openSelectedInViewer();
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // fullscreen can be blocked by browser context
    }
  }, [state]);

  return (
    <PageLayout page="photo_albums" title="Photo Albums" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className={isAlbumViewerOpen ? 'section catn8-photo-albums-page catn8-photo-albums-page--viewer' : 'section catn8-photo-albums-page'}>
        <div className={isAlbumViewerOpen ? 'container catn8-photo-albums-container--viewer' : 'container'}>
          {state.loading ? <div className="catn8-card p-4 mt-3">Loading albums...</div> : null}

          {!state.loading && !state.showAlbumViewer ? (
            <div className="catn8-card catn8-photo-albums-list-shell">
              <div className="catn8-photo-albums-list-header">
                <div>
                  <h1 className="section-title mb-1">Photo Albums</h1>
                  <p className="mb-0">Choose an album to open it.</p>
                </div>
                {state.isAdmin ? (
                  <button type="button" className="btn btn-primary" onClick={() => state.setShowCreateModal(true)}>
                    Create Photo Album
                  </button>
                ) : null}
              </div>

              <div className="catn8-photo-albums-card-grid">
                {state.albums.map((album) => {
                  const displayTitle = toPhotoAlbumDisplayTitle(album.title);
                  const displaySummary = toPhotoAlbumDisplaySummary(album.summary);
                  const isVirtual = Boolean(album.is_virtual);
                  return (
                  <article key={album.id} className="catn8-photo-album-card">
                    <button
                      type="button"
                      className="catn8-photo-album-card-open"
                      onClick={() => {
                        void openAlbum(album.id);
                      }}
                      aria-label={`Open album ${displayTitle}`}
                    />
                    <div className="catn8-photo-album-card-image" style={{ backgroundImage: album.cover_image_url ? `url(${album.cover_image_url})` : undefined }} />
                    <div className="catn8-photo-album-card-body">
                      <h2>{displayTitle}</h2>
                      {isVirtual ? <div className="catn8-photo-album-template-badge">Template</div> : null}
                      <p>{displaySummary || 'No summary yet.'}</p>
                    </div>
                    {state.isAdmin && !isVirtual ? (
                      <button
                        type="button"
                        className="catn8-photo-album-card-delete"
                        onClick={() => {
                          void state.deleteAlbumById({ id: album.id, title: displayTitle });
                        }}
                        aria-label={`Delete album ${displayTitle}`}
                        title="Delete album"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          focusable="false"
                        >
                          <path
                            d="M9 3h6l1 2h5v2H3V5h5l1-2Zm-3 6h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9Zm4 2v8h2v-8h-2Zm4 0v8h2v-8h-2Z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    ) : null}
                  </article>
                  );
                })}
                {state.albums.length === 0 ? <div className="catn8-card p-4">No photo albums available yet.</div> : null}
              </div>
            </div>
          ) : null}

          {!state.loading && state.showAlbumViewer && selectedAlbum ? (
            <div className={isFullscreen ? 'catn8-photo-albums-main catn8-photo-albums-main--viewer is-fullscreen' : 'catn8-photo-albums-main catn8-photo-albums-main--viewer'}>
              {!isFullscreen ? (
                <div className="catn8-album-toolbar catn8-card">
                  <div className="catn8-album-toolbar-title-row">
                    <h2 className="h4 mb-0">{toPhotoAlbumDisplayTitle(selectedAlbum.title)}</h2>
                    {selectedAlbumSummary ? <div className="small text-muted">{selectedAlbumSummary}</div> : null}
                  </div>
                  <div className="catn8-album-controls">
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => { void openAdminFullscreenPreview(); }}>
                      Full Screen
                    </button>
                    <a className="btn btn-sm btn-outline-secondary" href="https://catn8.us">
                      Home
                    </a>
                  </div>
                </div>
              ) : null}

              <PhotoAlbumStage
                album={selectedAlbum}
                spreadIndex={state.pageIndex}
                zoom={state.zoom}
                contactDisplayName={toAlbumDisplayName(selectedAlbum.created_by_username || '')}
                canPrev={state.canPrev}
                canNext={state.canNext}
                onPrev={state.prevPage}
                onNext={state.nextPage}
                pageFavorite={selectedPageFavorite}
                isMediaFavorite={(spreadIndex, mediaSourceIndex) => state.isMediaFavorite(selectedAlbum.id, spreadIndex, mediaSourceIndex)}
                isTextFavorite={(spreadIndex, textItemId) => state.isTextFavorite(selectedAlbum.id, spreadIndex, textItemId)}
                onTogglePageFavorite={(spreadIndex) => { void state.togglePageFavorite(selectedAlbum.id, spreadIndex); }}
                onToggleMediaFavorite={(spreadIndex, mediaSourceIndex) => { void state.toggleMediaFavorite(selectedAlbum.id, spreadIndex, mediaSourceIndex); }}
                onToggleTextFavorite={(spreadIndex, textItemId) => { void state.toggleTextFavorite(selectedAlbum.id, spreadIndex, textItemId); }}
                onBackToAlbums={() => { void closeViewer(); }}
              />
            </div>
          ) : null}
        </div>
      </section>

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
        onFullscreenPreview={() => { void openAdminFullscreenPreview(); }}
        onClose={state.closeAdminModal}
        onSave={state.saveAdminEdits}
        onDelete={state.deleteSelectedAlbum}
        onAlbumChange={state.updateAdminDraft}
      />
    </PageLayout>
  );
}
