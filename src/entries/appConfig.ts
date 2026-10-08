import React from 'react';

import { AboutPage } from '../components/pages/AboutPage';
import { ActivitiesPage } from '../components/pages/ActivitiesPage';
import { ArcadePage } from '../components/pages/ArcadePage';
import { AsteroidsPage } from '../components/pages/AsteroidsPage';
import { ColoringPage } from '../components/pages/ColoringPage';
import { FroggerPage } from '../components/pages/FroggerPage';
import { GamesPage } from '../components/pages/GamesPage';
import { HomePage } from '../components/pages/HomePage';
import { PhotoAlbumsPage } from '../components/pages/PhotoAlbumsPage';
import { StoriesPage } from '../components/pages/StoriesPage';
import { TetrisPage } from '../components/pages/TetrisPage';
import { Celebr8ActivitiesPage } from '../components/pages/Celebr8ActivitiesPage';
import { Celebr8Page } from '../components/pages/Celebr8Page';
import { Celebr8PartyPage } from '../components/pages/Celebr8PartyPage';
import { Celebr8TemplatesPage } from '../components/pages/Celebr8TemplatesPage';
import { Valid8Page } from '../components/pages/Valid8Page';
import { WordsearchPage } from '../components/pages/WordsearchPage';

export type AppPage =
  | 'home'
  | 'elucid8'
  | 'narr8'
  | 'stimul8'
  | 'recre8'
  | 'activ8'
  | 'accumul8'
  | 'valid8'
  | 'celebr8'
  | 'celebr8_party'
  | 'celebr8_templates'
  | 'celebr8_activities'
  | 'illumin8'
  | 'fabric8'
  | 'login'
  | 'investig8'
  | 'photo_m8'
  | 'sheriff_station'
  | 'settings'
  | 'loc8'
  | 'frogger'
  | 'asteroids'
  | 'tetris'
  | 'verify'
  | 'reset';

export type Viewer = any;

export type SharedLayoutProps = {
  viewer: Viewer;
  isAdmin: boolean;
  onLoginClick: () => void;
  onLogout: () => void;
  onAccountClick: () => void;
  mysteryTitle: string;
};

export const BACKGROUND_LAYER_STYLE: React.CSSProperties = {
  background: 'url("/images/homepage_friends.png") center / cover no-repeat fixed',
  backgroundImage: 'image-set(url("/images/homepage_friends.webp") type("image/webp"), url("/images/homepage_friends.png") type("image/png"))',
};

export const SIMPLE_PAGE_COMPONENTS: Partial<Record<AppPage, React.ComponentType<any>>> = {
  home: HomePage,
  elucid8: AboutPage,
  narr8: StoriesPage,
  stimul8: GamesPage,
  recre8: ArcadePage,
  activ8: ActivitiesPage,
  valid8: Valid8Page,
  celebr8: Celebr8Page,
  celebr8_party: Celebr8PartyPage,
  celebr8_templates: Celebr8TemplatesPage,
  celebr8_activities: Celebr8ActivitiesPage,
  illumin8: ColoringPage,
  loc8: WordsearchPage,
  photo_m8: PhotoAlbumsPage,
  frogger: FroggerPage,
  asteroids: AsteroidsPage,
  tetris: TetrisPage,
};

export function getLoginRedirectTarget(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = new URLSearchParams(window.location.search).get('redirect') || '';
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return null;
  }

  return raw;
}
