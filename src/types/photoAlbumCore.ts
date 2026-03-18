import { PhotoAlbumSpec } from './photoAlbumSpec';

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
