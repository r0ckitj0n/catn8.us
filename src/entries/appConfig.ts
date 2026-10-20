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
import { Celebr8ActivityDetailPage } from '../components/pages/Celebr8ActivityDetailPage';
import { Celebr8Page } from '../components/pages/Celebr8Page';
import { Celebr8PartyPage } from '../components/pages/Celebr8PartyPage';
import { Celebr8TemplatesPage } from '../components/pages/Celebr8TemplatesPage';
import { Medic8Page } from '../components/pages/Medic8Page';
import { Tabul8Page } from '../components/pages/Tabul8Page';
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
  | 'celebr8_activity_detail'
  | 'tabul8'
  | 'medic8'
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
  celebr8_activity_detail: Celebr8ActivityDetailPage,
  tabul8: Tabul8Page,
  medic8: Medic8Page,
  illumin8: ColoringPage,
  loc8: WordsearchPage,
  photo_m8: PhotoAlbumsPage,
  frogger: FroggerPage,
  asteroids: AsteroidsPage,
  tetris: TetrisPage,
};

const SUBSITE_DNS_TO_SLUG: Record<string, string> = {
  elucid8: 'elucid8',
  activ8: 'activ8',
  recre8: 'recre8',
  illumin8: 'illumin8',
  stimul8: 'stimul8',
  narr8: 'narr8',
  loc8: 'loc8',
  investig8: 'investig8',
  'sheriff-station': 'sheriff_station',
  fabric8: 'fabric8',
  'photo-m8': 'photo-m8',
  accumul8: 'accumul8',
  valid8: 'valid8',
  celebr8: 'celebr8',
  tabul8: 'tabul8',
  medic8: 'medic8',
  litig8: 'litig8',
};

function currentSubsiteSlug(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const host = (window.location.hostname || '').toLowerCase();
  if (!host.endsWith('.catn8.us')) {
    return null;
  }
  const label = host.slice(0, -'.catn8.us'.length);
  if (!label || label === 'www' || label.includes('.')) {
    return null;
  }
  return SUBSITE_DNS_TO_SLUG[label] || null;
}

/** Same-origin path-only redirect target from ?redirect= (blocks open redirects). */
export function getLoginRedirectTarget(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = new URLSearchParams(window.location.search).get('redirect') || '';
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || raw.includes(':')) {
    return null;
  }

  try {
    const resolved = new URL(raw, window.location.origin);
    if (resolved.origin !== window.location.origin) {
      return null;
    }
    let path = resolved.pathname;
    const slug = currentSubsiteSlug();
    // On product hosts, /{slug}/... login targets collapse to host-relative paths.
    if (slug) {
      const prefix = `/${slug}`;
      if (path === prefix || path === `${prefix}/`) {
        path = '/';
      } else if (path.startsWith(`${prefix}/`)) {
        path = path.slice(prefix.length) || '/';
      }
    }
    // Path + query + hash only; never return a full absolute URL to assign/replace.
    return `${path}${resolved.search}${resolved.hash}`;
  } catch {
    return null;
  }
}
