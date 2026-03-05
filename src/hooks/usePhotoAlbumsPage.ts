import { IToast } from '../types/common';

import { usePhotoAlbumsPageController } from './usePhotoAlbumsPageController';

export function usePhotoAlbumsPage(
  viewer: any,
  onToast?: (toast: IToast) => void,
) {
  return usePhotoAlbumsPageController(viewer, onToast);
}
