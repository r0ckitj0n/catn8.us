export type PhotoAlbumAspectRatio = '4:3' | '3:2' | '16:9' | '1:1';

export interface PhotoAlbumSpec {
  schema_version: 'catn8_scrapbook_spec_v1';
  dimensions: {
    width_px: number;
    height_px: number;
    aspect_ratio: PhotoAlbumAspectRatio;
    safe_margin_px: number;
    bleed_px: number;
  };
  controls: {
    page_turn_style: 'ribbon-tabs' | 'classic-book' | 'spiral-notebook';
    zoom: {
      min: number;
      max: number;
      step: number;
      initial: number;
    };
    downloads: {
      allow_cover_download: boolean;
      allow_page_download: boolean;
      formats: string[];
      default_format: string;
    };
  };
  style_guide: {
    memory_era: string;
    mood: string;
    palette: string[];
    materials: string[];
    motifs: string[];
    scrapbook_feel: string;
  };
  spreads: Array<{
    spread_number: number;
    title: string;
    caption: string;
    is_locked?: boolean;
    default_contact_label?: string;
    photo_slots: number;
    embellishments: string[];
    background_prompt: string;
    background_image_url?: string;
    text_items?: Array<{
      id: string;
      text: string;
      speaker?: string;
      time?: string;
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      rotation?: number;
      border_color?: string;
      bg_color?: string;
      side?: 'left' | 'right';
    }>;
    note_layout?: Record<string, {
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      rotation?: number;
    }>;
    decor_items?: Array<{
      id: string;
      emoji: string;
      x?: number;
      y?: number;
      size?: number;
      rotation?: number;
    }>;
    images?: Array<{
      src: string;
      media_type?: 'image' | 'video';
      display_src?: string;
      original_src?: string;
      live_video_src?: string;
      live_photo_available?: boolean;
      captured_at?: string;
      source_filename?: string;
      caption?: string;
      memory_text?: string;
      speaker_label?: string;
      speaker_handle_id?: string;
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      rotation?: number;
      border_color?: string;
    }>;
  }>;
}

export interface PhotoAlbum {
  id: number;
  title: string;
  slug: string;
  summary: string;
  cover_image_url: string;
  cover_prompt: string;
  is_active: number;
  created_by_user_id: number;
  created_by_username?: string;
  created_at: string;
  updated_at: string;
  is_locked?: number;
  spec: PhotoAlbumSpec;
  is_virtual?: boolean;
  virtual_kind?: 'favorite_media' | 'favorite_pages' | 'favorite_text';
}

export interface PhotoAlbumViewerInfo {
  can_view: boolean;
  is_admin: boolean;
  is_photo_albums_user: boolean;
  is_photo_albums_admin?: boolean;
}

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

export interface PhotoAlbumFavoritePage {
  album_id: number;
  spread_index: number;
}

export interface PhotoAlbumFavoriteMedia {
  album_id: number;
  spread_index: number;
  media_source_index: number;
}

export interface PhotoAlbumFavoriteText {
  album_id: number;
  spread_index: number;
  text_item_id: string;
}

export interface PhotoAlbumFavoritesPayload {
  pages: PhotoAlbumFavoritePage[];
  media: PhotoAlbumFavoriteMedia[];
  text: PhotoAlbumFavoriteText[];
}

export interface PhotoAlbumFavoriteMutationResponse {
  success: boolean;
  favorites: PhotoAlbumFavoritesPayload;
}
