import React from 'react';

type AlbumViewMode = 'album' | 'list';

interface PhotoAlbumsPageChromeState {
  loading: boolean;
  busy: boolean;
  isAdmin: boolean;
  showAlbumViewer: boolean;
  showAdminModal: boolean;
  showCreateModal: boolean;
  selectedAlbum: { id?: number } | null;
  viewerAlbum: { id?: number } | null;
  openAlbum: (albumId: number, mode?: 'view' | 'edit', initialPageIndex?: number) => void;
  closeAlbumViewer: () => void;
  closeAdminModal: () => void;
  setShowCreateModal: React.Dispatch<React.SetStateAction<boolean>>;
}

interface UsePhotoAlbumsPageChromeArgs {
  state: PhotoAlbumsPageChromeState;
}

export function usePhotoAlbumsPageChrome({ state }: UsePhotoAlbumsPageChromeArgs) {
  const [viewMode, setViewMode] = React.useState<AlbumViewMode>('list');
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const listScrollYRef = React.useRef<number | null>(null);
  const prevShowCreateModalRef = React.useRef(false);
  const prevShowAdminModalRef = React.useRef(false);

  const captureListScrollPosition = React.useCallback(() => {
    listScrollYRef.current = Math.max(
      0,
      Number(window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0),
    );
  }, []);

  const restoreListScrollPosition = React.useCallback(() => {
    const targetScrollY = listScrollYRef.current;
    if (targetScrollY === null) {
      return;
    }
    listScrollYRef.current = null;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: targetScrollY, left: 0, behavior: 'auto' });
      });
    });
  }, []);

  React.useEffect(() => {
    const handleFs = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  React.useEffect(() => {
    const shouldHideChrome = isFullscreen && state.showAlbumViewer;
    document.body.classList.toggle('catn8-photo-albums-fullscreen', shouldHideChrome);
    return () => {
      document.body.classList.remove('catn8-photo-albums-fullscreen');
    };
  }, [isFullscreen, state.showAlbumViewer]);

  React.useEffect(() => {
    if (!state.showAlbumViewer && !state.showAdminModal) {
      setViewMode('list');
    }
  }, [state.showAdminModal, state.showAlbumViewer]);

  React.useEffect(() => {
    const shouldFitPreview = state.showAlbumViewer && !isFullscreen;
    document.body.classList.toggle('catn8-photo-albums-viewer-open', shouldFitPreview);
    const updateNavbarHeight = () => {
      const navbar = document.querySelector('.navbar.sticky-top') as HTMLElement | null;
      const navbarHeight = navbar ? Math.max(0, Math.round(navbar.getBoundingClientRect().height)) : 0;
      document.body.style.setProperty('--catn8-navbar-height', `${navbarHeight}px`);
    };
    if (shouldFitPreview) {
      updateNavbarHeight();
      window.addEventListener('resize', updateNavbarHeight);
    }
    return () => {
      document.body.classList.remove('catn8-photo-albums-viewer-open');
      document.body.style.removeProperty('--catn8-navbar-height');
      window.removeEventListener('resize', updateNavbarHeight);
    };
  }, [state.showAlbumViewer, isFullscreen]);

  React.useEffect(() => {
    const wasOpen = prevShowCreateModalRef.current;
    if (!wasOpen && state.showCreateModal && !state.showAlbumViewer && !state.showAdminModal) {
      captureListScrollPosition();
    }
    if (wasOpen && !state.showCreateModal && !state.showAlbumViewer) {
      restoreListScrollPosition();
    }
    prevShowCreateModalRef.current = state.showCreateModal;
  }, [captureListScrollPosition, restoreListScrollPosition, state.showAdminModal, state.showAlbumViewer, state.showCreateModal]);

  React.useEffect(() => {
    const wasOpen = prevShowAdminModalRef.current;
    if (wasOpen && !state.showAdminModal && !state.showAlbumViewer) {
      restoreListScrollPosition();
    }
    prevShowAdminModalRef.current = state.showAdminModal;
  }, [restoreListScrollPosition, state.showAdminModal, state.showAlbumViewer]);

  const openAlbum = React.useCallback(async (
    albumId: number,
    mode: 'view' | 'edit' = 'view',
    initialPageIndex?: number,
    nextViewMode: AlbumViewMode = 'list',
  ) => {
    if (!state.showAlbumViewer && !state.showAdminModal) {
      captureListScrollPosition();
    }
    setViewMode(nextViewMode);
    state.openAlbum(albumId, mode, initialPageIndex);
    if (state.isAdmin || mode === 'edit') {
      return;
    }
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // fullscreen can be blocked by browser context
    }
  }, [captureListScrollPosition, state]);

  const closeViewer = React.useCallback(async () => {
    state.closeAlbumViewer();
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // no-op
      }
    }
    restoreListScrollPosition();
  }, [restoreListScrollPosition, state]);

  const closeTopmostLayer = React.useCallback(async () => {
    if (state.showCreateModal) {
      state.setShowCreateModal(false);
      return;
    }
    if (state.showAdminModal) {
      state.closeAdminModal();
      return;
    }
    if (state.showAlbumViewer) {
      await closeViewer();
    }
  }, [closeViewer, state]);

  const openCreateModal = React.useCallback(() => {
    if (!state.showAlbumViewer && !state.showAdminModal) {
      captureListScrollPosition();
    }
    state.setShowCreateModal(true);
  }, [captureListScrollPosition, state]);

  const enterFullscreen = React.useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // fullscreen can be blocked by browser context
    }
  }, []);

  return {
    viewMode,
    isFullscreen,
    isAlbumViewerOpen: !state.loading && state.showAlbumViewer && Boolean(state.viewerAlbum),
    setAlbumViewMode: setViewMode,
    openAlbum,
    closeViewer,
    closeTopmostLayer,
    openCreateModal,
    enterFullscreen,
  };
}

export type { AlbumViewMode };
