import React from 'react';

import { usePhotoAlbumsPage } from '../../hooks/usePhotoAlbumsPage';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { toAlbumDisplayName, toPhotoAlbumDisplaySummary, toPhotoAlbumDisplayTitle } from '../../utils/photoAlbumText';
import { WebpImage } from '../common/WebpImage';
import { PageLayout } from '../layout/PageLayout';
import { PhotoAlbumCreateModal } from '../modals/PhotoAlbumCreateModal';
import { PhotoAlbumAdminModal } from '../photo-albums/PhotoAlbumAdminModal';
import { LockIcon } from '../photo-albums/LockIcon';
import { PhotoAlbumStage } from '../photo-albums/PhotoAlbumStage';

import './PhotoAlbumsPage.css';

export function PhotoAlbumsPage({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle, onToast }: AppShellPageProps) {
  const state = usePhotoAlbumsPage(viewer, onToast);
  const selectedAlbum = state.selectedAlbum;
  const viewerAlbum = state.viewerAlbum || selectedAlbum;
  const selectedAlbumId = Number(selectedAlbum?.id || 0);
  const viewerAlbumSummary = toPhotoAlbumDisplaySummary(viewerAlbum?.summary || '');
  const viewerAlbumId = Number(viewerAlbum?.id || 0);
  const selectedPageFavorite = selectedAlbumId > 0 ? state.isPageFavorite(selectedAlbumId, state.pageIndex) : false;
  const viewerPageFavorite = viewerAlbumId > 0 ? state.isPageFavorite(viewerAlbumId, state.pageIndex) : false;
  const viewerAlbumLocked = Number(viewerAlbum?.is_locked || 0) === 1;
  const viewerPageLocked = Number(viewerAlbum?.spec?.spreads?.[state.pageIndex]?.is_locked || 0) === 1;
  const isAlbumViewerOpen = !state.loading && state.showAlbumViewer && Boolean(viewerAlbum);

  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const listScrollYRef = React.useRef<number | null>(null);
  const prevShowCreateModalRef = React.useRef(false);
  const prevShowAdminModalRef = React.useRef(false);

  const captureListScrollPosition = React.useCallback(() => {
    listScrollYRef.current = Math.max(
      0,
      Number(window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0),
    );
  }, []);

  const restoreListScrollPosition = React.useCallback(() => {
    const targetScrollY = listScrollYRef.current;
    if (targetScrollY === null) {
      return;
    }
    listScrollYRef.current = null;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: targetScrollY, left: 0, behavior: 'auto' });
      });
    });
  }, []);

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

  React.useEffect(() => {
    const shouldFitPreview = state.showAlbumViewer && !isFullscreen;
    document.body.classList.toggle('catn8-photo-albums-viewer-open', shouldFitPreview);
    const updateNavbarHeight = () => {
      const navbar = document.querySelector('.navbar.sticky-top') as HTMLElement | null;
      const navbarHeight = navbar ? Math.max(0, Math.round(navbar.getBoundingClientRect().height)) : 0;
      document.body.style.setProperty('--catn8-navbar-height', `${navbarHeight}px`);
    };
    if (shouldFitPreview) {
      updateNavbarHeight();
      window.addEventListener('resize', updateNavbarHeight);
    }
    return () => {
      document.body.classList.remove('catn8-photo-albums-viewer-open');
      document.body.style.removeProperty('--catn8-navbar-height');
      window.removeEventListener('resize', updateNavbarHeight);
    };
  }, [state.showAlbumViewer, isFullscreen]);

  React.useEffect(() => {
    const wasOpen = prevShowCreateModalRef.current;
    if (!wasOpen && state.showCreateModal && !state.showAlbumViewer && !state.showAdminModal) {
      captureListScrollPosition();
    }
    if (wasOpen && !state.showCreateModal && !state.showAlbumViewer) {
      restoreListScrollPosition();
    }
    prevShowCreateModalRef.current = state.showCreateModal;
  }, [captureListScrollPosition, restoreListScrollPosition, state.showAdminModal, state.showAlbumViewer, state.showCreateModal]);

  React.useEffect(() => {
    const wasOpen = prevShowAdminModalRef.current;
    if (wasOpen && !state.showAdminModal && !state.showAlbumViewer) {
      restoreListScrollPosition();
    }
    prevShowAdminModalRef.current = state.showAdminModal;
  }, [restoreListScrollPosition, state.showAdminModal, state.showAlbumViewer]);

  const openAlbum = React.useCallback(async (albumId: number, mode: 'view' | 'edit' = 'view', initialPageIndex?: number) => {
    if (!state.showAlbumViewer && !state.showAdminModal) {
      captureListScrollPosition();
    }
    state.openAlbum(albumId, mode, initialPageIndex);
    if (state.isAdmin || mode === 'edit') {
      return;
    }
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // fullscreen can be blocked by browser context
    }
  }, [captureListScrollPosition, state]);

  const closeViewer = React.useCallback(async () => {
    state.closeAlbumViewer();
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // no-op
      }
    }
    restoreListScrollPosition();
  }, [restoreListScrollPosition, state]);

  const closeTopmostLayer = React.useCallback(async () => {
    if (state.showCreateModal) {
      state.setShowCreateModal(false);
      return;
    }
    if (state.showAdminModal) {
      state.closeAdminModal();
      return;
    }
    if (state.showAlbumViewer) {
      await closeViewer();
    }
  }, [closeViewer, state]);

  const openCreateModal = React.useCallback(() => {
    if (!state.showAlbumViewer && !state.showAdminModal) {
      captureListScrollPosition();
    }
    state.setShowCreateModal(true);
  }, [captureListScrollPosition, state]);

  const enterFullscreen = React.useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // fullscreen can be blocked by browser context
    }
  }, []);

  return (
    <PageLayout page="photo_albums" title="Photo M8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className={isAlbumViewerOpen ? 'section catn8-photo-albums-page catn8-photo-albums-page--viewer' : 'section catn8-photo-albums-page'}>
        <div className={isAlbumViewerOpen ? 'container catn8-photo-albums-container--viewer' : 'container'}>
          {state.loading ? <div className="catn8-card p-4 mt-3">Loading albums...</div> : null}

          {!state.loading && !state.showAlbumViewer ? (
            <div className="catn8-card catn8-photo-albums-list-shell">
              <div className="catn8-photo-albums-list-header">
                <div className="catn8-photo-albums-list-header-row">
                  <div>
                    <h1 className="section-title mb-1">Photo M8</h1>
                    <p className="mb-0">Choose an album to open it.</p>
                  </div>
                  <a className="catn8-photo-albums-logo-link" href="https://catn8.us" aria-label="Go to catn8.us">
                    <WebpImage className="catn8-photo-albums-logo" src="/images/catn8_logo.png" finalFallbackSrc="/images/catn8_logo.svg" alt="catn8.us Logo" />
                  </a>
                  {state.isAdmin ? (
                    <div className="d-flex gap-2 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        disabled={state.busy}
                        onClick={() => { void state.captureNewMessages(); }}
                      >
                        Capture New Messages
                      </button>
                      <button type="button" className="btn btn-primary" onClick={openCreateModal}>
                        Create Photo Album
                      </button>
                    </div>
                  ) : null}
                </div>
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
                      <div className="catn8-photo-album-card-admin-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary catn8-photo-album-card-edit"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void openAlbum(album.id, 'edit');
                          }}
                          aria-label={`Edit album ${displayTitle}`}
                          title="Edit album"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={Number(album.is_locked || 0) === 1 ? 'catn8-photo-album-card-lock is-active' : 'catn8-photo-album-card-lock'}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void state.toggleAlbumLock(album.id, Number(album.is_locked || 0) !== 1);
                          }}
                          aria-label={Number(album.is_locked || 0) === 1 ? `Unlock album ${displayTitle}` : `Lock album ${displayTitle}`}
                          title={Number(album.is_locked || 0) === 1 ? 'Unlock album' : 'Lock album'}
                        >
                          <LockIcon locked={Number(album.is_locked || 0) === 1} />
                        </button>
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
                      </div>
                    ) : null}
                  </article>
                  );
                })}
                {state.albums.length === 0 ? <div className="catn8-card p-4">No photo albums available yet.</div> : null}
              </div>
            </div>
          ) : null}

          {!state.loading && state.showAlbumViewer && viewerAlbum ? (
            <div className={isFullscreen ? 'catn8-photo-albums-main catn8-photo-albums-main--viewer is-fullscreen' : 'catn8-photo-albums-main catn8-photo-albums-main--viewer'}>
              {!isFullscreen ? (
                <div className="catn8-album-toolbar catn8-card">
                  <div className="catn8-album-toolbar-title-row">
                    <h2 className="h4 mb-0">{toPhotoAlbumDisplayTitle(viewerAlbum.title)}</h2>
                    {viewerAlbumSummary ? <div className="small text-muted">{viewerAlbumSummary}</div> : null}
                  </div>
                  <div className="catn8-album-controls">
                    {state.isAdmin ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => {
                          if (viewerAlbum?.id) {
                            void openAlbum(viewerAlbum.id, 'edit', state.pageIndex);
                          }
                        }}
                      >
                        Edit Album
                      </button>
                    ) : null}
                    {state.isAdmin ? (
                      <button
                        type="button"
                        className={viewerAlbumLocked ? 'btn btn-sm catn8-lock-text-toggle is-active' : 'btn btn-sm catn8-lock-text-toggle'}
                        onClick={() => {
                          if (viewerAlbum?.id) {
                            void state.toggleAlbumLock(viewerAlbum.id, !viewerAlbumLocked);
                          }
                        }}
                      >
                        {viewerAlbumLocked ? 'Unlock Album' : 'Lock Album'}
                      </button>
                    ) : null}
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => { void enterFullscreen(); }}>
                      Full Screen
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary catn8-close-viewer-btn"
                      aria-label="Close album viewer"
                      title="Close"
                      onClick={() => { void closeTopmostLayer(); }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ) : null}

              <PhotoAlbumStage
                album={viewerAlbum}
                spreadIndex={state.pageIndex}
                zoom={state.zoom}
                contactDisplayName={toAlbumDisplayName(viewerAlbum.created_by_username || '')}
                respectSavedPositions
                canPrev={state.canPrev}
                canNext={state.canNext}
                onPrev={state.prevPage}
                onNext={state.nextPage}
                pageFavorite={viewerPageFavorite}
                isMediaFavorite={(spreadIndex, mediaSourceIndex) => state.isMediaFavorite(viewerAlbum.id, spreadIndex, mediaSourceIndex)}
                isTextFavorite={(spreadIndex, textItemId) => state.isTextFavorite(viewerAlbum.id, spreadIndex, textItemId)}
                onTogglePageFavorite={(spreadIndex) => { void state.togglePageFavorite(viewerAlbum.id, spreadIndex); }}
                onToggleMediaFavorite={(spreadIndex, mediaSourceIndex) => { void state.toggleMediaFavorite(viewerAlbum.id, spreadIndex, mediaSourceIndex); }}
                onToggleTextFavorite={(spreadIndex, textItemId) => { void state.toggleTextFavorite(viewerAlbum.id, spreadIndex, textItemId); }}
                pageLocked={viewerPageLocked}
                albumLocked={viewerAlbumLocked}
                onTogglePageLock={state.isAdmin ? (spreadIndex) => { void state.toggleSpreadLock(viewerAlbum.id, spreadIndex, !viewerPageLocked); } : undefined}
                onBackToAlbums={() => { void closeViewer(); }}
              />
            </div>
          ) : null}
        </div>
      </section>

      {state.busy ? (
        <div className="catn8-photo-albums-busy-overlay" role="status" aria-live="polite" aria-label="Photo albums action in progress">
          <div className="catn8-photo-albums-busy-card">
            <WebpImage
              className="catn8-photo-albums-busy-logo"
              src="/images/catn8_logo.webp"
              finalFallbackSrc="/images/catn8_logo.svg"
              alt=""
              aria-hidden="true"
            />
            <div className="catn8-photo-albums-busy-text">Working on your album layout...</div>
          </div>
        </div>
      ) : null}

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
        onFullscreenPreview={() => { void enterFullscreen(); }}
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
