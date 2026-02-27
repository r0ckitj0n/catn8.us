import React from 'react';

import { usePhotoAlbumsPage } from '../../hooks/usePhotoAlbumsPage';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { PageLayout } from '../layout/PageLayout';
import { PhotoAlbumCreateModal } from '../modals/PhotoAlbumCreateModal';
import { PhotoAlbumAdminModal } from '../photo-albums/PhotoAlbumAdminModal';
import { PhotoAlbumStage } from '../photo-albums/PhotoAlbumStage';

import './PhotoAlbumsPage.css';

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function PhotoAlbumsPage({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle, onToast }: AppShellPageProps) {
  const state = usePhotoAlbumsPage(viewer, onToast);
  const selectedAlbum = state.selectedAlbum;

  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    const handleFs = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

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
      <section className="section catn8-photo-albums-page">
        <div className="container">
          {state.loading ? <div className="catn8-card p-4 mt-3">Loading albums...</div> : null}

          {!state.loading && !state.showAlbumViewer ? (
            <div className="catn8-card catn8-photo-albums-list-shell">
              <div className="catn8-photo-albums-list-header">
                <div>
                  <h1 className="section-title mb-1">Photo Albums</h1>
                  <p className="mb-0">Choose an album to open it. Admins open an editable scrapbook modal; Photo Albums users open fullscreen view.</p>
                </div>
                {state.isAdmin ? (
                  <button type="button" className="btn btn-primary" onClick={() => state.setShowCreateModal(true)}>
                    Create Photo Album
                  </button>
                ) : null}
              </div>

              <div className="catn8-photo-albums-card-grid">
                {state.albums.map((album) => (
                  <button
                    key={album.id}
                    type="button"
                    className="catn8-photo-album-card"
                    onClick={() => {
                      void openAlbum(album.id);
                    }}
                  >
                    <div className="catn8-photo-album-card-image" style={{ backgroundImage: album.cover_image_url ? `url(${album.cover_image_url})` : undefined }} />
                    <div className="catn8-photo-album-card-body">
                      <h2>{album.title}</h2>
                      <p>{album.summary || 'No summary yet.'}</p>
                    </div>
                  </button>
                ))}
                {state.albums.length === 0 ? <div className="catn8-card p-4">No photo albums available yet.</div> : null}
              </div>
            </div>
          ) : null}

          {!state.loading && state.showAlbumViewer && selectedAlbum ? (
            <div className={isFullscreen ? 'catn8-photo-albums-main is-fullscreen' : 'catn8-photo-albums-main'}>
              <div className={isFullscreen ? 'catn8-album-toolbar catn8-card is-fullscreen' : 'catn8-album-toolbar catn8-card'}>
                <div>
                  <h2 className="h4 mb-1">{selectedAlbum.title}</h2>
                  <div className="small text-muted">{selectedAlbum.summary}</div>
                </div>
                <div className="catn8-album-controls">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={state.prevPage} disabled={!state.canPrev}>Prev Page</button>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={state.nextPage} disabled={!state.canNext}>Next Page</button>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => state.adjustZoom(-1)}>-</button>
                  <span className="catn8-zoom-label">{Math.round(state.zoom * 100)}%</span>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => state.adjustZoom(1)}>+</button>
                  <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => void closeViewer()}>
                    {isFullscreen ? 'Exit Fullscreen' : 'Back to Albums'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => downloadDataUrl(selectedAlbum.cover_image_url, `${selectedAlbum.slug}-cover.png`)}
                    disabled={!selectedAlbum.cover_image_url}
                  >
                    Download Cover
                  </button>
                </div>
              </div>

              <PhotoAlbumStage
                album={selectedAlbum}
                spreadIndex={state.pageIndex}
                zoom={state.zoom}
                canPrev={state.canPrev}
                canNext={state.canNext}
                onPrev={state.prevPage}
                onNext={state.nextPage}
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
        album={state.adminDraft}
        pageIndex={state.pageIndex}
        zoom={state.zoom}
        canPrev={state.canPrev}
        canNext={state.canNext}
        onPrevPage={state.prevPage}
        onNextPage={state.nextPage}
        onFullscreenPreview={() => { void openAdminFullscreenPreview(); }}
        onClose={state.closeAdminModal}
        onSave={state.saveAdminEdits}
        onDelete={state.deleteSelectedAlbum}
        onAlbumChange={state.updateAdminDraft}
      />
    </PageLayout>
  );
}
