import React from 'react';

import { IToast } from '../../types/common';
import {
  PhotoAlbum,
  PhotoAlbumAiCreateRequest,
} from '../../types/photoAlbums';

export interface PhotoAlbumsMutationsArgs {
  isAdmin: boolean;
  albums: PhotoAlbum[];
  createForm: PhotoAlbumAiCreateRequest;
  defaultCreateForm: PhotoAlbumAiCreateRequest;
  adminDraft: PhotoAlbum | null;
  selectedAlbum: PhotoAlbum | null;
  pageIndex: number;
  setBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCreateModal: React.Dispatch<React.SetStateAction<boolean>>;
  setCreateForm: React.Dispatch<React.SetStateAction<PhotoAlbumAiCreateRequest>>;
  setSelectedId: React.Dispatch<React.SetStateAction<number>>;
  setShowAdminModal: React.Dispatch<React.SetStateAction<boolean>>;
  setAdminDraft: React.Dispatch<React.SetStateAction<PhotoAlbum | null>>;
  setShowAlbumViewer: React.Dispatch<React.SetStateAction<boolean>>;
  loadAlbums: (options?: { silent?: boolean }) => Promise<void>;
  toast: (tone: IToast['tone'], message: string) => void;
}

export interface DeleteAlbumArgs {
  id: number;
  title?: string;
}
