export type ViewerType = 'media' | 'note';

export interface ViewerTarget {
  spreadIndex: number;
  itemIndex: number;
  type: ViewerType;
}

export interface PreparedMediaItem {
  key: string;
  src: string;
  mediaType?: 'image' | 'video';
  caption: string;
}
