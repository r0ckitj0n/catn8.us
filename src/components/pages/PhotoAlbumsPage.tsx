import React from 'react';

import { usePhotoAlbumsPage } from '../../hooks/usePhotoAlbumsPage';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { PageLayout } from '../layout/PageLayout';
import { PhotoAlbumCreateModal } from '../modals/PhotoAlbumCreateModal';

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
  const selectedSpread = state.selectedSpread;

  return (
    <PageLayout page="photo_albums" title="Photo Albums" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className="section catn8-photo-albums-page">
        <div className="container">
          <div className="catn8-photo-albums-hero catn8-card">
            <h1 className="section-title mb-2">Photo Albums</h1>
            <p className="lead mb-0">Scrapbook-style memory albums with page switching, zoom controls, and downloadable keepsakes.</p>
          </div>

          {state.loading ? <div className="catn8-card p-4 mt-3">Loading albums...</div> : null}

          {!state.loading ? (
            <div className="catn8-photo-albums-layout mt-3">
              <aside className="catn8-photo-albums-sidebar catn8-card">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h2 className="h5 m-0">Album Shelf</h2>
                  {state.isAdmin ? (
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => state.setShowCreateModal(true)}>
                      Create Photo Album
                    </button>
                  ) : null}
                </div>

                <div className="catn8-album-shelf-list">
                  {state.albums.map((album) => (
                    <button
                      key={album.id}
                      type="button"
                      className={album.id === state.selectedId ? 'catn8-album-shelf-item is-active' : 'catn8-album-shelf-item'}
                      onClick={() => state.setSelectedId(album.id)}
                    >
                      <div className="catn8-album-shelf-thumb" style={{ backgroundImage: album.cover_image_url ? `url(${album.cover_image_url})` : undefined }} />
                      <div className="catn8-album-shelf-meta">
                        <strong>{album.title}</strong>
                        <span>{album.spec?.style_guide?.memory_era || 'Memories'}</span>
                      </div>
                    </button>
                  ))}

                  {state.albums.length === 0 ? <div className="text-muted small">No albums yet.</div> : null}
                </div>
              </aside>

              <div className="catn8-photo-albums-main">
                {selectedAlbum ? (
                  <>
                    <div className="catn8-album-toolbar catn8-card">
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

                    <div className="catn8-scrapbook-viewer catn8-card" style={{ transform: `scale(${state.zoom})` }}>
                      <div className="catn8-scrapbook-page-left">
                        <div className="catn8-scrapbook-page-tag">Spread {state.pageIndex + 1} / {state.totalSpreads}</div>
                        <h3>{selectedSpread?.title || 'Untitled Spread'}</h3>
                        <p>{selectedSpread?.caption || 'This spread is ready for your photos and notes.'}</p>
                        <div className="catn8-scrapbook-chip-row">
                          {(selectedAlbum.spec?.style_guide?.materials || []).slice(0, 3).map((material) => (
                            <span key={material} className="catn8-scrapbook-chip">{material}</span>
                          ))}
                        </div>
                      </div>
                      <div className="catn8-scrapbook-page-right">
                        <div className="catn8-polaroid-grid">
                          {Array.from({ length: Math.max(1, Number(selectedSpread?.photo_slots || 3)) }).map((_, idx) => (
                            <div className="catn8-polaroid" key={`${selectedAlbum.id}-${state.pageIndex}-${idx}`}>
                              <div className="catn8-polaroid-photo" />
                              <div className="catn8-polaroid-caption">Memory #{idx + 1}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {state.isAdmin ? (
                      <div className="catn8-album-admin catn8-card mt-3">
                        <h3 className="h5">Admin Album Menu</h3>
                        <div className="row g-2">
                          <div className="col-md-4">
                            <label className="form-label">Title</label>
                            <input className="form-control" value={state.adminTitle} onChange={(e) => state.setAdminTitle(e.target.value)} disabled={state.busy} />
                          </div>
                          <div className="col-md-8">
                            <label className="form-label">Summary</label>
                            <input className="form-control" value={state.adminSummary} onChange={(e) => state.setAdminSummary(e.target.value)} disabled={state.busy} />
                          </div>
                        </div>
                        <div className="d-flex gap-2 mt-3">
                          <button type="button" className="btn btn-primary" onClick={state.saveAdminEdits} disabled={state.busy}>Update Photo Album</button>
                          <button type="button" className="btn btn-outline-danger" onClick={state.deleteSelectedAlbum} disabled={state.busy}>Delete Photo Album</button>
                          <button type="button" className="btn btn-outline-secondary" onClick={() => state.setShowCreateModal(true)} disabled={state.busy}>Create Photo Album</button>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="catn8-card p-4">No photo albums available yet.</div>
                )}
              </div>
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
    </PageLayout>
  );
}
