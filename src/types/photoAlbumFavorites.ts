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
