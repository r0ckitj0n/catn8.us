import React from 'react';

import { PhotoAlbumStageImpl, type PhotoAlbumStageProps } from './PhotoAlbumStageImpl';

export function PhotoAlbumStage(props: PhotoAlbumStageProps) {
  return <PhotoAlbumStageImpl {...props} />;
}
