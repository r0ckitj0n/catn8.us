import React from 'react';
import { createRoot } from 'react-dom/client';

import { AIVoiceCommunicationModal } from '../components/modals/AIVoiceCommunicationModal';
import { AIConfigModal } from '../components/modals/AIConfigModal';
import { AIImageConfigModal } from '../components/modals/AIImageConfigModal';
import { AccountModal } from '../components/modals/AccountModal';
import { LoginModal } from '../components/modals/LoginModal';
import { ToastOverlay } from '../components/modals/ToastOverlay';
import { AboutPage } from '../components/pages/AboutPage';
import { ActivitiesPage } from '../components/pages/ActivitiesPage';
import { ArcadePage } from '../components/pages/ArcadePage';
import { AsteroidsPage } from '../components/pages/AsteroidsPage';
import { BuildWizardPage } from '../components/pages/BuildWizardPage';
import { ColoringPage } from '../components/pages/ColoringPage';
import { FroggerPage } from '../components/pages/FroggerPage';
import { GamesPage } from '../components/pages/GamesPage';
import { HomePage } from '../components/pages/HomePage';
import { MysteryPage } from '../components/pages/MysteryPage';
import { ResetPage } from '../components/pages/ResetPage';
import { SettingsPage } from '../components/pages/SettingsPage';
import { SheriffStationPage } from '../components/pages/SheriffStationPage';
import { StoriesPage } from '../components/pages/StoriesPage';
import { TetrisPage } from '../components/pages/TetrisPage';
import { VerifyPage } from '../components/pages/VerifyPage';
import { WordsearchPage } from '../components/pages/WordsearchPage';
import { ApiClient } from '../core/ApiClient';
import { UI_STANDARDS_EVENT, applyGlobalUiSettings } from '../core/uiStandards';
import { catn8LocalStorageGet } from '../utils/storageUtils';

import './app.css';

type AppPage =
  | 'home'
  | 'about'
  | 'stories'
  | 'games'
  | 'arcade'
  | 'activities'
  | 'coloring'
  | 'build_wizard'
  | 'login'
  | 'mystery'
  | 'sheriff_station'
  | 'settings'
  | 'wordsearch'
  | 'frogger'
  | 'asteroids'
  | 'tetris'
  | 'verify'
  | 'reset';

type Toast = { tone: 'success' | 'error' | 'info' | 'warning'; message: string } | null;

type Viewer = any;

type SharedLayoutProps = {
  viewer: Viewer;
  isAdmin: boolean;
  onLoginClick: () => void;
  onLogout: () => void;
  onAccountClick: () => void;
  mysteryTitle: string;
};

const BACKGROUND_LAYER_STYLE: React.CSSProperties = {
  background: 'url("/images/homepage_friends.jpg") center / cover no-repeat fixed',
  backgroundImage: 'image-set(url("/images/homepage_friends.webp") type("image/webp"), url("/images/homepage_friends.jpg") type("image/jpeg"))',
};

const SIMPLE_PAGE_COMPONENTS: Partial<Record<AppPage, React.ComponentType<any>>> = {
  home: HomePage,
  about: AboutPage,
  stories: StoriesPage,
  games: GamesPage,
  arcade: ArcadePage,
  activities: ActivitiesPage,
  coloring: ColoringPage,
  wordsearch: WordsearchPage,
  frogger: FroggerPage,
  asteroids: AsteroidsPage,
  tetris: TetrisPage,
};

function App({ page }: { page: AppPage }) {
  const [loginOpen, setLoginOpen] = React.useState(page === 'login');
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [aiImageOpen, setAiImageOpen] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);
  const [aiVoiceOpen, setAiVoiceOpen] = React.useState(false);
  const [viewer, setViewer] = React.useState<Viewer>(null);
  const [toast, setToast] = React.useState<Toast>(null);
  const [mysteryTitle, setMysteryTitle] = React.useState(() => catn8LocalStorageGet('catn8_mystery_title') || '');

  const isAdmin = React.useMemo(() => {
    if (!viewer) {
      return false;
    }
    return (
      Number(viewer.is_admin) === 1
      || Number(viewer.is_administrator) === 1
      || String(viewer.username).toLowerCase() === 'admin'
    );
  }, [viewer]);

  React.useEffect(() => {
    const isNoirPage = page === 'mystery' || page === 'sheriff_station';
    document.documentElement.classList.toggle('catn8-noir-mode', isNoirPage);
    document.body.classList.toggle('catn8-noir-mode', isNoirPage);
  }, [page]);

  React.useEffect(() => {
    applyGlobalUiSettings(page);
    const onUiStandardsChange = () => applyGlobalUiSettings(page);
    window.addEventListener(UI_STANDARDS_EVENT, onUiStandardsChange);
    return () => window.removeEventListener(UI_STANDARDS_EVENT, onUiStandardsChange);
  }, [page]);

  React.useEffect(() => {
    const onBackdropClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.classList) {
        return;
      }

      const isBackdrop = target.classList.contains('modal-backdrop');
      const modalTarget = target.closest('.modal') as HTMLElement | null;
      const clickedInsideDialog = Boolean(target.closest('.modal-dialog'));
      const isModalOverlayClick = Boolean(
        !isBackdrop
        && modalTarget
        && (modalTarget.classList.contains('show') || modalTarget.classList.contains('showing'))
        && !clickedInsideDialog,
      );

      if (!isBackdrop && !isModalOverlayClick) {
        return;
      }

      const openModals = Array.from(document.querySelectorAll('.modal.show, .modal.showing')) as HTMLElement[];
      if (!openModals.length) {
        return;
      }

      const topModal = openModals
        .slice()
        .sort((a, b) => Number(getComputedStyle(a).zIndex || 0) - Number(getComputedStyle(b).zIndex || 0))
        .pop();

      if (!topModal) {
        return;
      }

      const modalClass = (window as any).bootstrap?.Modal;
      const instance = modalClass?.getInstance(topModal);
      if (instance && typeof instance.hide === 'function') {
        instance.hide();
        return;
      }

      topModal.classList.remove('show');
    };

    document.addEventListener('click', onBackdropClickCapture, true);
    return () => document.removeEventListener('click', onBackdropClickCapture, true);
  }, []);

  const refreshViewer = React.useCallback(async () => {
    try {
      const response = await ApiClient.get('/api/auth/me.php');
      const user = response?.user || null;
      setViewer(user);
      return user;
    } catch (error) {
      console.error('[App] failed to refresh viewer', error);
      setViewer(null);
      return null;
    }
  }, []);

  React.useEffect(() => {
    void refreshViewer();
  }, [refreshViewer]);

  const logout = React.useCallback(async () => {
    try {
      await ApiClient.post('/api/auth/logout.php', {});
    } catch (error) {
      console.error('[App] logout request failed', error);
    } finally {
      setViewer(null);
    }
  }, []);

  const sharedProps = React.useMemo<SharedLayoutProps>(() => ({
    viewer,
    isAdmin,
    onLoginClick: () => setLoginOpen(true),
    onLogout: () => void logout(),
    onAccountClick: () => setAccountOpen(true),
    mysteryTitle,
  }), [viewer, isAdmin, logout, mysteryTitle]);

  const content = React.useMemo(() => {
    const SimplePage = SIMPLE_PAGE_COMPONENTS[page];
    if (SimplePage) {
      return <SimplePage {...sharedProps} onToast={setToast} />;
    }

    if (page === 'build_wizard') {
      return <BuildWizardPage {...sharedProps} onToast={setToast} />;
    }

    if (page === 'mystery') {
      return (
        <MysteryPage
          {...sharedProps}
          onToast={setToast}
          isAdmin={isAdmin}
          onOpenAiImageConfig={() => setAiImageOpen(true)}
          onOpenAiConfig={() => setAiOpen(true)}
          onOpenAiVoiceConfig={() => setAiVoiceOpen(true)}
          onMysteryTitleChange={setMysteryTitle}
          refreshViewer={refreshViewer}
        />
      );
    }

    if (page === 'sheriff_station') {
      return (
        <SheriffStationPage
          {...sharedProps}
          isAdmin={isAdmin}
          onToast={setToast}
          onOpenAiImageConfig={() => setAiImageOpen(true)}
          onOpenAiConfig={() => setAiOpen(true)}
          onOpenAiVoiceConfig={() => setAiVoiceOpen(true)}
          mysteryTitle={mysteryTitle}
        />
      );
    }

    if (page === 'settings') {
      return (
        <SettingsPage
          {...sharedProps}
          page={page}
          onOpenAiImageConfig={() => setAiImageOpen(true)}
          onOpenAiConfig={() => setAiOpen(true)}
          onOpenAiVoiceCommunication={() => setAiVoiceOpen(true)}
          onToast={setToast}
        />
      );
    }

    if (page === 'verify') {
      return <VerifyPage onToast={setToast} mysteryTitle={mysteryTitle} />;
    }

    if (page === 'reset') {
      return <ResetPage onToast={setToast} mysteryTitle={mysteryTitle} />;
    }

    return <HomePage {...sharedProps} />;
  }, [page, sharedProps, isAdmin, refreshViewer, mysteryTitle]);

  return (
    <>
      <div className="catn8-background-image-layer" style={BACKGROUND_LAYER_STYLE} aria-hidden="true" />
      {content}
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onLoggedIn={refreshViewer} onToast={setToast} />
      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} viewer={viewer} onChanged={refreshViewer} onToast={setToast} />
      <ToastOverlay toast={toast} onClose={() => setToast(null)} />
      <AIImageConfigModal open={aiImageOpen} onClose={() => setAiImageOpen(false)} onToast={setToast} />
      <AIConfigModal open={aiOpen} onClose={() => setAiOpen(false)} onToast={setToast} />
      <AIVoiceCommunicationModal open={aiVoiceOpen} onClose={() => setAiVoiceOpen(false)} onToast={setToast} viewer={viewer} />
    </>
  );
}

const mount = document.getElementById('catn8-app') as HTMLElement | null;
if (mount) {
  const page = (mount.dataset.page || 'home') as AppPage;
  const windowWithRoot = window as typeof window & { __catn8_react_root?: ReturnType<typeof createRoot> };
  const root = windowWithRoot.__catn8_react_root || createRoot(mount);
  windowWithRoot.__catn8_react_root = root;
  root.render(<App page={page} />);

  const hot = (import.meta as any)?.hot;
  if (hot) {
    hot.accept(() => {
      try {
        const nextPage = (mount.dataset.page || 'home') as AppPage;
        (windowWithRoot.__catn8_react_root || root).render(<App page={nextPage} />);
      } catch (error) {
        console.error('[App] HMR re-render failed', error);
      }
    });
  }
}
