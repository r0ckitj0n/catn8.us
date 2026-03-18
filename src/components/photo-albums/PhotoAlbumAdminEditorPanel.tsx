import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';
import { PhotoAlbumAdminAssetsCard } from './PhotoAlbumAdminAssetsCard';
import { PhotoAlbumAdminAiCard } from './PhotoAlbumAdminAiCard';
import { PhotoAlbumAdminMetadataCard } from './PhotoAlbumAdminMetadataCard';

interface PhotoAlbumAdminEditorPanelProps {
  busy: boolean;
  album: PhotoAlbum;
  spread: NonNullable<PhotoAlbum['spec']['spreads'][number]> | null;
  pageIndex: number;
  canPrev: boolean;
  canNext: boolean;
  albumLocked: boolean;
  spreadLocked: boolean;
  audit: {
    totalSpreads: number;
    spreadsMissingMedia: number[];
    spreadsMissingText: number[];
    spreadsMissingBoth: number[];
    mediaEntriesMissingSource: number;
    mediaEntriesQuestionableSource: number;
  };
  images: NonNullable<PhotoAlbum['spec']['spreads'][number]['images']>;
  textItems: NonNullable<PhotoAlbum['spec']['spreads'][number]['text_items']>;
  decorItems: Array<{ item: NonNullable<NonNullable<PhotoAlbum['spec']['spreads'][number]['decor_items']>[number]>; index: number }>;
  backgroundTarget: 'page' | 'album';
  aiAssetPrompt: string;
  setBackgroundTarget: React.Dispatch<React.SetStateAction<'page' | 'album'>>;
  setAiAssetPrompt: React.Dispatch<React.SetStateAction<string>>;
  onPrevPage: () => void;
  onNextPage: () => void;
  onToggleAlbumLock: () => void;
  onAlbumChange: (updater: (prev: PhotoAlbum) => PhotoAlbum) => void;
  onGenerateBackground: (scope: 'page' | 'album', prompt?: string) => void;
  onGenerateClipart: (prompt?: string) => void;
  onGenerateAccentImage: (prompt?: string) => void;
  onGenerateCoverFromFavorites: () => void;
  onRedesignPage: () => void;
  onEnsureTextItems: () => void;
}

export function PhotoAlbumAdminEditorPanel({
  busy,
  album,
  spread,
  pageIndex,
  canPrev,
  canNext,
  albumLocked,
  spreadLocked,
  audit,
  images,
  textItems,
  decorItems,
  backgroundTarget,
  aiAssetPrompt,
  setBackgroundTarget,
  setAiAssetPrompt,
  onPrevPage,
  onNextPage,
  onToggleAlbumLock,
  onAlbumChange,
  onGenerateBackground,
  onGenerateClipart,
  onGenerateAccentImage,
  onGenerateCoverFromFavorites,
  onRedesignPage,
  onEnsureTextItems,
}: PhotoAlbumAdminEditorPanelProps) {
  return (
    <div className="catn8-admin-editor-panel">
      <div className="catn8-card p-3 mb-3">
        <h3 className="h6">Album Wiring Audit</h3>
        <div className="small">
          Spreads: {audit.totalSpreads} | Missing media spreads: {audit.spreadsMissingMedia.length} | Missing text spreads: {audit.spreadsMissingText.length} | Missing both: {audit.spreadsMissingBoth.length}
        </div>
        <div className="small text-muted mt-1">
          Empty media refs: {audit.mediaEntriesMissingSource} | Questionable media paths: {audit.mediaEntriesQuestionableSource}
        </div>
        {audit.spreadsMissingBoth.length > 0 ? (
          <div className="form-text">Spreads missing both media and text: {audit.spreadsMissingBoth.slice(0, 20).join(', ')}</div>
        ) : null}
        {audit.spreadsMissingMedia.length > 0 ? (
          <div className="form-text">Spreads missing media: {audit.spreadsMissingMedia.slice(0, 20).join(', ')}</div>
        ) : null}
        {audit.spreadsMissingText.length > 0 ? (
          <div className="form-text">Spreads missing readable text: {audit.spreadsMissingText.slice(0, 20).join(', ')}</div>
        ) : null}
      </div>

      <PhotoAlbumAdminMetadataCard
        busy={busy}
        album={album}
        albumLocked={albumLocked}
        onToggleAlbumLock={onToggleAlbumLock}
        onAlbumChange={onAlbumChange}
      />

      <div className="catn8-card p-3 mb-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h3 className="h6 m-0">Spread Editor</h3>
          <div className="d-flex gap-1">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onPrevPage} disabled={!canPrev}>Prev</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onNextPage} disabled={!canNext}>Next</button>
          </div>
        </div>

        <label className="form-label">Spread Title</label>
        <input
          className="form-control"
          value={spread?.title || ''}
          disabled={busy}
          onChange={(event) => onAlbumChange((prev) => {
            const next = structuredClone(prev);
            if (next.spec.spreads[pageIndex]) {
              next.spec.spreads[pageIndex].title = event.target.value;
            }
            return next;
          })}
        />

        <label className="form-label mt-2">Spread Caption</label>
        <textarea
          className="form-control"
          rows={3}
          value={spread?.caption || ''}
          disabled={busy}
          onChange={(event) => onAlbumChange((prev) => {
            const next = structuredClone(prev);
            if (next.spec.spreads[pageIndex]) {
              next.spec.spreads[pageIndex].caption = event.target.value;
            }
            return next;
          })}
        />
      </div>

      <PhotoAlbumAdminAiCard
        busy={busy}
        spread={spread}
        pageIndex={pageIndex}
        albumLocked={albumLocked}
        spreadLocked={spreadLocked}
        backgroundTarget={backgroundTarget}
        aiAssetPrompt={aiAssetPrompt}
        setBackgroundTarget={setBackgroundTarget}
        setAiAssetPrompt={setAiAssetPrompt}
        onAlbumChange={onAlbumChange}
        onGenerateBackground={onGenerateBackground}
        onGenerateClipart={onGenerateClipart}
        onGenerateAccentImage={onGenerateAccentImage}
        onGenerateCoverFromFavorites={onGenerateCoverFromFavorites}
        onRedesignPage={onRedesignPage}
      />

      <PhotoAlbumAdminAssetsCard
        busy={busy}
        pageIndex={pageIndex}
        images={images}
        textItems={textItems}
        decorItems={decorItems}
        onAlbumChange={onAlbumChange}
        onEnsureTextItems={onEnsureTextItems}
      />
    </div>
  );
}
