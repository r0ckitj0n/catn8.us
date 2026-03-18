import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';

interface PhotoAlbumAdminAiCardProps {
  busy: boolean;
  spread: NonNullable<PhotoAlbum['spec']['spreads'][number]> | null;
  pageIndex: number;
  albumLocked: boolean;
  spreadLocked: boolean;
  backgroundTarget: 'page' | 'album';
  aiAssetPrompt: string;
  setBackgroundTarget: React.Dispatch<React.SetStateAction<'page' | 'album'>>;
  setAiAssetPrompt: React.Dispatch<React.SetStateAction<string>>;
  onAlbumChange: (updater: (prev: PhotoAlbum) => PhotoAlbum) => void;
  onGenerateBackground: (scope: 'page' | 'album', prompt?: string) => void;
  onGenerateClipart: (prompt?: string) => void;
  onGenerateAccentImage: (prompt?: string) => void;
  onGenerateCoverFromFavorites: () => void;
  onRedesignPage: () => void;
}

export function PhotoAlbumAdminAiCard(props: PhotoAlbumAdminAiCardProps) {
  const {
    busy,
    spread,
    pageIndex,
    albumLocked,
    spreadLocked,
    backgroundTarget,
    aiAssetPrompt,
    setBackgroundTarget,
    setAiAssetPrompt,
    onAlbumChange,
    onGenerateBackground,
    onGenerateClipart,
    onGenerateAccentImage,
    onGenerateCoverFromFavorites,
    onRedesignPage,
  } = props;

  return (
    <div className="catn8-card p-3 mb-3">
      <h3 className="h6">AI Tools</h3>
      <label className="form-label">Background Prompt</label>
      <textarea
        className="form-control"
        rows={3}
        value={spread?.background_prompt || ''}
        disabled={busy}
        onChange={(event) => onAlbumChange((prev) => {
          const next = structuredClone(prev);
          if (next.spec.spreads[pageIndex]) {
            next.spec.spreads[pageIndex].background_prompt = event.target.value;
          }
          return next;
        })}
      />
      <div className="row g-2 mt-2">
        <div className="col-md-6">
          <label className="form-label">Background Target</label>
          <select className="form-select" value={backgroundTarget} disabled={busy} onChange={(event) => setBackgroundTarget(event.target.value === 'album' ? 'album' : 'page')}>
            <option value="page">This Page</option>
            <option value="album">Whole Album</option>
          </select>
        </div>
        <div className="col-md-6 d-flex align-items-end">
          <button type="button" className="btn btn-sm btn-outline-primary w-100" disabled={busy || albumLocked || (backgroundTarget === 'page' && spreadLocked)} onClick={() => onGenerateBackground(backgroundTarget, spread?.background_prompt || '')}>
            Generate Background
          </button>
        </div>
      </div>

      <label className="form-label mt-3">AI Asset Prompt (Optional)</label>
      <input className="form-control" value={aiAssetPrompt} disabled={busy} onChange={(event) => setAiAssetPrompt(event.target.value)} placeholder="Example: pressed flowers and vintage tape accents" />

      <div className="d-flex gap-2 flex-wrap mt-2">
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy || albumLocked || spreadLocked} onClick={() => onGenerateClipart(aiAssetPrompt)}>Generate Clipart</button>
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy || albumLocked || spreadLocked} onClick={() => onGenerateAccentImage(aiAssetPrompt)}>Generate Accent Image</button>
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy || albumLocked} onClick={onGenerateCoverFromFavorites}>Generate Cover Page</button>
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy || albumLocked || spreadLocked} onClick={onRedesignPage}>Redesign Page</button>
      </div>
      <div className="form-text mt-2">
        Redesign Page adjusts decorative/layout accents only and preserves existing text/media content.
      </div>
    </div>
  );
}
