import { PhotoAlbum } from '../../types/photoAlbums';

export interface PhotoAlbumAdminModalProps {
  open: boolean;
  busy: boolean;
  hasUnsavedChanges: boolean;
  album: PhotoAlbum | null;
  pageIndex: number;
  zoom: number;
  canPrev: boolean;
  canNext: boolean;
  pageFavorite?: boolean;
  isMediaFavorite?: (spreadIndex: number, mediaSourceIndex: number) => boolean;
  isTextFavorite?: (spreadIndex: number, textItemId: string) => boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onTogglePageFavorite?: (spreadIndex: number) => void;
  onToggleMediaFavorite?: (spreadIndex: number, mediaSourceIndex: number) => void;
  onToggleTextFavorite?: (spreadIndex: number, textItemId: string) => void;
  onFullscreenPreview: () => void;
  onClose: () => void;
  onSave: () => void;
  onAutoLayout: () => void;
  onAutoLayoutAllUnlocked: () => void;
  onAutoLayoutSpread: () => void;
  onToggleAlbumLock: (isLocked: boolean) => void;
  onToggleSpreadLock: (isLocked: boolean) => void;
  onDelete: () => void;
  onGenerateBackground: (scope: 'page' | 'album', prompt?: string) => void;
  onGenerateClipart: (prompt?: string) => void;
  onGenerateAccentImage: (prompt?: string) => void;
  onGenerateCoverFromFavorites: () => void;
  onRedesignPage: () => void;
  onAlbumChange: (updater: (prev: PhotoAlbum) => PhotoAlbum) => void;
  viewMode?: 'album' | 'list';
  onSetViewMode?: (nextMode: 'album' | 'list') => void | Promise<void>;
}

export interface PhotoAlbumAdminModalHeaderProps {
  busy: boolean;
  hasUnsavedChanges: boolean;
  albumLocked: boolean;
  spreadLocked: boolean;
  viewMode: 'album' | 'list';
  onSetViewMode?: (nextMode: 'album' | 'list') => void | Promise<void>;
  onFullscreenPreview: () => void;
  onAutoLayout: () => void;
  onAutoLayoutAllUnlocked: () => void;
  onAutoLayoutSpread: () => void;
  onToggleSpreadLock: () => void;
  onDelete: () => void;
  onSave: () => void;
  onClose: () => void;
}
