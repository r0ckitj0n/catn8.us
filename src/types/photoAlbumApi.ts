import { PhotoAlbumAspectRatio, PhotoAlbumSpec } from './photoAlbumSpec';
import { PhotoAlbumFavoritesPayload } from './photoAlbumFavorites';
import { PhotoAlbum, PhotoAlbumViewerInfo } from './photoAlbumCore';

export interface PhotoAlbumListResponse {
  success: boolean;
  viewer: PhotoAlbumViewerInfo;
  albums: PhotoAlbum[];
  favorites?: PhotoAlbumFavoritesPayload;
}

export interface PhotoAlbumGetResponse {
  success: boolean;
  viewer: PhotoAlbumViewerInfo;
  album: PhotoAlbum | null;
}

export interface PhotoAlbumSaveRequest {
  id?: number;
  title: string;
  summary: string;
  cover_image_url?: string;
  cover_prompt?: string;
  is_active?: number;
  spec: PhotoAlbumSpec;
}

export interface PhotoAlbumAiCreateRequest {
  title: string;
  summary: string;
  memory_era: string;
  mood: string;
  dominant_palette: string;
  scrapbook_materials: string;
  motif_keywords: string;
  camera_style: string;
  aspect_ratio: PhotoAlbumAspectRatio;
  spread_count: number;
  page_turn_style: 'ribbon-tabs' | 'classic-book' | 'spiral-notebook';
  texture_intensity: 'soft' | 'balanced' | 'rich';
}

export interface PhotoAlbumMutationResponse {
  success: boolean;
  album: PhotoAlbum;
}

export interface PhotoAlbumBulkAutoLayoutResponse {
  success: boolean;
  updated_albums?: number;
  failed_albums?: number;
  processed_albums?: number;
  has_more?: boolean;
  next_start_after_id?: number;
}

export interface PhotoAlbumCaptureMessagesResponse {
  success: boolean;
  started?: boolean;
  pid?: number;
  log_file?: string;
}

export interface PhotoAlbumAiBackgroundRequest {
  id: number;
  spread_index: number;
  scope: 'page' | 'album';
  prompt?: string;
}

export interface PhotoAlbumAiSpreadRequest {
  id: number;
  spread_index: number;
  prompt?: string;
}

export interface PhotoAlbumAiCoverFromFavoritesRequest {
  id: number;
}
