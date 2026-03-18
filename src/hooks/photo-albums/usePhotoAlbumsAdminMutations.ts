import React from 'react';

import { ApiClient } from '../../core/ApiClient';
import {
  PhotoAlbumCaptureMessagesResponse,
  PhotoAlbumMutationResponse,
} from '../../types/photoAlbums';
import { PhotoAlbumsMutationsArgs } from './photoAlbumMutationTypes';

export function usePhotoAlbumsAdminMutations(args: PhotoAlbumsMutationsArgs) {
  const {
    isAdmin,
    albums,
    adminDraft,
    selectedAlbum,
    pageIndex,
    setBusy,
    setAdminDraft,
    loadAlbums,
    toast,
  } = args;

  const autoLayoutAlbum = React.useCallback(async () => {
    const album = adminDraft || selectedAlbum;
    if (!isAdmin || !album || !album.id || album.is_virtual) {
      return;
    }

    setBusy(true);
    try {
      const res = await ApiClient.post<PhotoAlbumMutationResponse>('/api/photo_albums.php?action=auto_layout', {
        id: album.id,
      });
      if (res?.album) {
        setAdminDraft(res.album);
      }
      toast('success', 'Auto layout applied and saved');
      await loadAlbums({ silent: true });
    } catch (error: any) {
      toast('error', error?.message || 'Failed to auto layout album');
    } finally {
      setBusy(false);
    }
  }, [adminDraft, isAdmin, loadAlbums, selectedAlbum, setAdminDraft, setBusy, toast]);

  const autoLayoutCurrentSpread = React.useCallback(async () => {
    const album = adminDraft || selectedAlbum;
    if (!isAdmin || !album || !album.id || album.is_virtual) {
      return;
    }
    setBusy(true);
    try {
      const res = await ApiClient.post<PhotoAlbumMutationResponse>('/api/photo_albums.php?action=auto_layout_spread', {
        id: album.id,
        spread_index: pageIndex,
      });
      if (res?.album) {
        setAdminDraft(res.album);
      }
      toast('success', `Auto layout applied to spread ${pageIndex + 1}`);
      await loadAlbums({ silent: true });
    } catch (error: any) {
      toast('error', error?.message || 'Failed to auto layout spread');
    } finally {
      setBusy(false);
    }
  }, [adminDraft, isAdmin, loadAlbums, pageIndex, selectedAlbum, setAdminDraft, setBusy, toast]);

  const autoLayoutAllUnlocked = React.useCallback(async () => {
    if (!isAdmin) {
      return;
    }
    const proceed = window.confirm(
      'Warning: This will reorganize any/all text and media on all pages in every album that is not locked. Continue?',
    );
    if (!proceed) {
      return;
    }
    setBusy(true);
    try {
      const unlockedAlbums = albums.filter((album) => Number(album?.id || 0) > 0 && Number(album?.is_locked || 0) !== 1 && !album?.is_virtual);
      let updated = 0;
      let failed = 0;

      for (const album of unlockedAlbums) {
        try {
          const res = await ApiClient.post<PhotoAlbumMutationResponse>('/api/photo_albums.php?action=auto_layout', {
            id: Number(album.id),
          });
          if (res?.album?.id) {
            updated += 1;
          } else {
            failed += 1;
          }
        } catch {
          failed += 1;
        }
      }

      if (failed > 0) {
        toast('warning', `Auto layout updated ${updated} album${updated === 1 ? '' : 's'}; ${failed} failed. Check server logs for details.`);
      } else {
        toast('success', `Auto layout complete for ${updated} album${updated === 1 ? '' : 's'}`);
      }
      await loadAlbums();
    } catch (error: any) {
      toast('error', error?.message || 'Failed to auto layout all albums');
    } finally {
      setBusy(false);
    }
  }, [albums, isAdmin, loadAlbums, setBusy, toast]);

  const captureNewMessages = React.useCallback(async () => {
    if (!isAdmin) {
      return;
    }
    const isLocalHost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    );
    if (!isLocalHost) {
      const localCommand = 'cd ~/Documents/Websites/catn8.us && bash scripts/import_photos.sh';
      window.prompt('Run this command on your local machine:', localCommand);
      toast('info', 'Run the command in your local terminal to capture new messages.');
      return;
    }
    setBusy(true);
    try {
      const res = await ApiClient.post<PhotoAlbumCaptureMessagesResponse>('/api/photo_albums.php?action=capture_new_messages', {});
      const pid = Number(res?.pid || 0);
      if (pid > 0) {
        toast('success', `Capture started (PID ${pid}).`);
      } else {
        toast('success', 'Capture started.');
      }
    } catch (error: any) {
      const status = Number(error?.status || 0);
      if (status === 409) {
        toast('info', error?.message || 'Capture process is already running');
      } else {
        toast('error', error?.message || 'Failed to start message capture');
      }
    } finally {
      setBusy(false);
    }
  }, [isAdmin, setBusy, toast]);

  const toggleAlbumLock = React.useCallback(async (id: number, isLocked: boolean) => {
    if (!isAdmin || id <= 0) {
      return;
    }
    setBusy(true);
    try {
      const res = await ApiClient.post<PhotoAlbumMutationResponse>('/api/photo_albums.php?action=toggle_album_lock', {
        id,
        is_locked: isLocked ? 1 : 0,
      });
      if (res?.album) {
        setAdminDraft((prev) => {
          if (!prev || prev.id !== id) {
            return prev;
          }
          return res.album;
        });
      }
      toast('success', isLocked ? 'Album locked' : 'Album unlocked');
      await loadAlbums({ silent: true });
    } catch (error: any) {
      toast('error', error?.message || 'Failed to update album lock');
    } finally {
      setBusy(false);
    }
  }, [isAdmin, loadAlbums, setAdminDraft, setBusy, toast]);

  const toggleSpreadLock = React.useCallback(async (id: number, spreadIndex: number, isLocked: boolean) => {
    if (!isAdmin || id <= 0 || spreadIndex < 0) {
      return;
    }
    setBusy(true);
    try {
      const res = await ApiClient.post<PhotoAlbumMutationResponse>('/api/photo_albums.php?action=toggle_spread_lock', {
        id,
        spread_index: spreadIndex,
        is_locked: isLocked ? 1 : 0,
      });
      if (res?.album) {
        setAdminDraft((prev) => {
          if (!prev || prev.id !== id) {
            return prev;
          }
          return res.album;
        });
      }
      toast('success', isLocked ? 'Page locked' : 'Page unlocked');
      await loadAlbums({ silent: true });
    } catch (error: any) {
      toast('error', error?.message || 'Failed to update page lock');
    } finally {
      setBusy(false);
    }
  }, [isAdmin, loadAlbums, setAdminDraft, setBusy, toast]);

  return {
    autoLayoutAlbum,
    autoLayoutCurrentSpread,
    autoLayoutAllUnlocked,
    captureNewMessages,
    toggleAlbumLock,
    toggleSpreadLock,
  };
}
