import React from 'react';

import { usePhotoAlbumsAiMutations } from './photo-albums/usePhotoAlbumsAiMutations';
import { usePhotoAlbumsAdminMutations } from './photo-albums/usePhotoAlbumsAdminMutations';
import { usePhotoAlbumsCrudMutations } from './photo-albums/usePhotoAlbumsCrudMutations';
import { PhotoAlbumsMutationsArgs } from './photo-albums/photoAlbumMutationTypes';

export function usePhotoAlbumsMutations(args: PhotoAlbumsMutationsArgs) {
  const crudMutations = usePhotoAlbumsCrudMutations(args);
  const adminMutations = usePhotoAlbumsAdminMutations(args);
  const aiMutations = usePhotoAlbumsAiMutations(args);

  return {
    ...crudMutations,
    ...adminMutations,
    ...aiMutations,
  };
}
