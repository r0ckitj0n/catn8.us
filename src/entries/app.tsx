import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeText, formatTestResult } from '../utils/textUtils';
import { catn8LocalStorageGet, catn8LocalStorageSet } from '../utils/storageUtils';
import { ToastOverlay } from '../components/modals/ToastOverlay';
import { AIVoiceCommunicationModal } from '../components/modals/AIVoiceCommunicationModal';
import { DeployConfigModal } from '../components/modals/DeployConfigModal';
import { DbConfigModal } from '../components/modals/DbConfigModal';
import { AIImageConfigModal } from '../components/modals/AIImageConfigModal';
import { EmailConfigModal } from '../components/modals/EmailConfigModal';
import { UserAccountsModal } from '../components/modals/UserAccountsModal';
import { GroupMembershipsModal } from '../components/modals/GroupMembershipsModal';
import { SiteAppearanceModal } from '../components/modals/SiteAppearanceModal';
import { AuthPolicyModal } from '../components/modals/AuthPolicyModal';
import { LoginModal } from '../components/modals/LoginModal';
import { AIConfigModal } from '../components/modals/AIConfigModal';
import { AccountModal } from '../components/modals/AccountModal';
import { WordsearchPrintModal } from '../components/modals/WordsearchPrintModal';
import { ManagePuzzlesModal } from '../components/modals/ManagePuzzlesModal';
import { PuzzleManagerModal } from '../components/modals/PuzzleManagerModal';
import { TopicManagerModal } from '../components/modals/TopicManagerModal';
import { WordsearchSettingsModal } from '../components/modals/WordsearchSettingsModal';
import { StoryModal } from '../components/modals/StoryModal';
import { PageLayout } from '../components/layout/PageLayout';
import { FilterBar } from '../components/layout/FilterBar';
import { HomePage } from '../components/pages/HomePage';
import { MysteryPage } from '../components/pages/MysteryPage';
import { AboutPage } from '../components/pages/AboutPage';
import { StoriesPage } from '../components/pages/StoriesPage';
import { ArcadePage } from '../components/pages/ArcadePage';
import { GamesPage } from '../components/pages/GamesPage';
import { ActivitiesPage } from '../components/pages/ActivitiesPage';
import { BuildWizardPage } from '../components/pages/BuildWizardPage';
import { VerifyPage } from '../components/pages/VerifyPage';
import { ResetPage } from '../components/pages/ResetPage';
import { WordsearchPage } from '../components/pages/WordsearchPage';
import { SettingsPage } from '../components/pages/SettingsPage';
import { SheriffStationPage } from '../components/pages/SheriffStationPage';
import { FroggerPage } from '../components/pages/FroggerPage';
import { AsteroidsPage } from '../components/pages/AsteroidsPage';
import { TetrisPage } from '../components/pages/TetrisPage';
import { aiGetModelChoices, AI_PROVIDER_CHOICES } from '../utils/aiUtils';
import { pickWordsForPage, buildWordSearch, generateWordsearchQuickFacts } from '../utils/wordsearchUtils';
import { createRoot } from 'react-dom/client';
import './app.css';

import stories from '../data/stories.json';
import arcade from '../data/arcade.json';
import games from '../data/games.json';
import { createBootstrapModal, isBootstrapModalReady } from '../core/bootstrapModal';
import { ApiClient } from '../core/ApiClient';
import { GeminiProvider } from '../core/ai/GeminiProvider';

function App({ page }) {
  const [loginOpen, setLoginOpen] = React.useState(page === 'login');
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [viewer, setViewer] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [aiImageOpen, setAiImageOpen] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);
  const [aiVoiceOpen, setAiVoiceOpen] = React.useState(false);
  const [mysteryTitle, setMysteryTitle] = React.useState(() => {
    const saved = catn8LocalStorageGet('catn8_mystery_title');
    return saved || '';
  });

  const isAdmin = React.useMemo(() => {
    if (!viewer) return false;
    return (
      Number(viewer.is_admin) === 1 || 
      Number(viewer.is_administrator) === 1 ||
      String(viewer.username).toLowerCase() === 'admin'
    );
  }, [viewer]);

  React.useEffect(() => {
    const isNoir = page === 'mystery' || page === 'sheriff_station';
    if (isNoir) {
      document.documentElement.classList.add('catn8-noir-mode');
      document.body.classList.add('catn8-noir-mode');
    } else {
      document.documentElement.classList.remove('catn8-noir-mode');
      document.body.classList.remove('catn8-noir-mode');
    }
  }, [page]);

  const openLogin = React.useCallback(() => setLoginOpen(true), []);
  const closeLogin = React.useCallback(() => setLoginOpen(false), []);
  const openAccount = React.useCallback(() => setAccountOpen(true), []);
  const closeAccount = React.useCallback(() => setAccountOpen(false), []);

  React.useEffect(() => {
    const onBackdropClickCapture = (e: any) => {
      try {
        const target = e?.target as HTMLElement | null;
        if (!target || !target.classList) return;

        const isBackdrop = target.classList.contains('modal-backdrop');

        const modalTarget = (target.closest('.modal') as HTMLElement | null);
        const clickedInsideDialog = Boolean(target.closest('.modal-dialog'));
        const isModalOverlayClick = Boolean(
          !isBackdrop
            && modalTarget
            && (modalTarget.classList.contains('show') || modalTarget.classList.contains('showing'))
            && !clickedInsideDialog,
        );

        if (!isBackdrop && !isModalOverlayClick) return;

        const open = Array.from(document.querySelectorAll('.modal.show, .modal.showing')) as HTMLElement[];
        if (!open.length) return;

        const top = open
          .slice()
          .sort((a, b) => {
            let az = 0;
            let bz = 0;
            try {
              az = Number(getComputedStyle(a).zIndex || 0);
            } catch (_err) {}
            try {
              bz = Number(getComputedStyle(b).zIndex || 0);
            } catch (_err) {}
            if (az !== bz) return az - bz;
            const aSeq = Number((a as any)?.dataset?.catn8OpenSeq || 0);
            const bSeq = Number((b as any)?.dataset?.catn8OpenSeq || 0);
            return aSeq - bSeq;
          })
          .pop();

        if (!top) return;

        try {
          const Modal = (window as any).bootstrap?.Modal;
          const inst = Modal?.getInstance(top);
          if (inst && typeof inst.hide === 'function') {
            inst.hide();
            return;
          }
        } catch (_err) {}

        try {
          top.classList.remove('show');
        } catch (_err) {}
      } catch (_err) {}
    };

    document.addEventListener('click', onBackdropClickCapture, true);
    return () => document.removeEventListener('click', onBackdropClickCapture, true);
  }, []);

  const showToast = React.useCallback((t) => {
    setToast(t || null);
  }, []);

  const refreshViewer = React.useCallback(async () => {
    console.log('[App] refreshViewer: START');
    try {
      const res = await ApiClient.get('/api/auth/me.php');
      console.log('[App] refreshViewer: API result:', res);
      const u = res?.user || null;
      console.log('[App] refreshViewer: setting viewer to:', u);
      setViewer(u);
      return u;
    } catch (err) {
      console.error('[App] refreshViewer: FAILED', err);
      setViewer(null);
      return null;
    }
  }, []);

  React.useEffect(() => {
    console.log('[App] Initial mount refreshViewer');
    refreshViewer();
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await ApiClient.post('/api/auth/logout.php', {});
    } catch (_e) {
      // ignore
    } finally {
      setViewer(null);
    }
  }, []);

  const layoutProps = React.useMemo(() => ({ 
    viewer, 
    isAdmin,
    onLoginClick: openLogin, 
    onLogout: logout, 
    onAccountClick: openAccount,
    mysteryTitle
  }), [viewer, isAdmin, openLogin, logout, openAccount, mysteryTitle]);

  const handleOpenAiImageConfig = React.useCallback(() => setAiImageOpen(true), []);
  const handleOpenAiConfig = React.useCallback(() => setAiOpen(true), []);
  const handleOpenAiVoiceConfig = React.useCallback(() => setAiVoiceOpen(true), []);
  const handleCloseLogin = React.useCallback(() => setLoginOpen(false), []);
  const handleCloseAccount = React.useCallback(() => setAccountOpen(false), []);
  const handleCloseAiImageConfig = React.useCallback(() => setAiImageOpen(false), []);
  const handleCloseAiConfig = React.useCallback(() => setAiOpen(false), []);
  const handleCloseAiVoiceConfig = React.useCallback(() => setAiVoiceOpen(false), []);
  const handleCloseToast = React.useCallback(() => setToast(null), []);

  let content = <HomePage {...layoutProps} />;
  if (page === 'about') content = <AboutPage {...layoutProps} />;
  if (page === 'stories') content = <StoriesPage {...layoutProps} />;
  if (page === 'games') content = <GamesPage {...layoutProps} />;
  if (page === 'arcade') content = <ArcadePage {...layoutProps} />;
  if (page === 'activities') content = <ActivitiesPage {...layoutProps} />;
  if (page === 'build_wizard') content = <BuildWizardPage {...layoutProps} onToast={showToast} />;
  if (page === 'login') content = <HomePage {...layoutProps} />;
  if (page === 'mystery') content = (
    <MysteryPage 
      {...layoutProps} 
      isAdmin={isAdmin}
      onToast={showToast} 
      onOpenAiImageConfig={handleOpenAiImageConfig} 
      onOpenAiConfig={handleOpenAiConfig} 
      onOpenAiVoiceConfig={handleOpenAiVoiceConfig} 
      onMysteryTitleChange={setMysteryTitle} 
      refreshViewer={refreshViewer}
    />
  );
  if (page === 'sheriff_station') content = (
    <SheriffStationPage 
      {...layoutProps} 
      isAdmin={isAdmin}
      onToast={showToast} 
      onOpenAiImageConfig={handleOpenAiImageConfig} 
      onOpenAiConfig={handleOpenAiConfig} 
      onOpenAiVoiceConfig={handleOpenAiVoiceConfig} 
      mysteryTitle={mysteryTitle} 
    />
  );
  if (page === 'settings') content = (
    <SettingsPage 
      {...layoutProps} 
      onOpenAiImageConfig={handleOpenAiImageConfig} 
      onOpenAiConfig={handleOpenAiConfig} 
      onOpenAiVoiceCommunication={handleOpenAiVoiceConfig} 
      onToast={showToast} 
    />
  );
  if (page === 'wordsearch') content = <WordsearchPage {...layoutProps} onToast={showToast} />;
  if (page === 'frogger') content = <FroggerPage {...layoutProps} />;
  if (page === 'asteroids') content = <AsteroidsPage {...layoutProps} />;
  if (page === 'tetris') content = <TetrisPage {...layoutProps} />;
  if (page === 'verify') content = <VerifyPage onToast={showToast} mysteryTitle={mysteryTitle} />;
  if (page === 'reset') content = <ResetPage onToast={showToast} mysteryTitle={mysteryTitle} />;

  return (
    <>
      {content}
      <LoginModal open={loginOpen} onClose={handleCloseLogin} onLoggedIn={refreshViewer} onToast={showToast} />
      <AccountModal open={accountOpen} onClose={handleCloseAccount} viewer={viewer} onChanged={refreshViewer} onToast={showToast} />
      <ToastOverlay toast={toast} onClose={handleCloseToast} />
      <AIImageConfigModal open={aiImageOpen} onClose={handleCloseAiImageConfig} onToast={showToast} />
      <AIConfigModal open={aiOpen} onClose={handleCloseAiConfig} onToast={showToast} />
      <AIVoiceCommunicationModal open={aiVoiceOpen} onClose={handleCloseAiVoiceConfig} onToast={showToast} viewer={viewer} />
    </>
  );
}

const mount = document.getElementById('catn8-app') as HTMLElement | null;
if (mount) {
  const page = mount.dataset.page || 'home';

  const w = window as any;
  const existingRoot = w.__catn8_react_root || null;
  const root = existingRoot || createRoot(mount);
  w.__catn8_react_root = root;
  root.render(<App page={page} />);

  try {
    if ((import.meta as any).hot) {
      (import.meta as any).hot.accept(() => {
        try {
          const p = mount.dataset.page || 'home';
          (w.__catn8_react_root || root).render(<App page={p} />);
        } catch (err) {
          console.error('catn8 HMR rerender failed', err);
        }
      });
    }
  } catch (_err) {}
}
