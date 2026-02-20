import React from 'react';

import { WebpImage } from '../common/WebpImage';
import './NavBar.css';

interface NavBarProps {
  active: string;
  viewer: any;
  isAdmin: boolean;
  onLoginClick: () => void;
  onLogout: () => void;
  onAccountClick: () => void;
  mysteryTitle?: string;
}

export function NavBar({ active, viewer, isAdmin, onLoginClick, onLogout, onAccountClick, mysteryTitle }: NavBarProps) {
  const isAuthed = Boolean(viewer && viewer.id);
  const isAdministrator = (
    Boolean(isAdmin)
    || Number(viewer?.is_admin || 0) === 1
    || Number(viewer?.is_administrator || 0) === 1
    || String(viewer?.username || '').toLowerCase() === 'admin'
  );
  const isInAdministratorGroup = Number(viewer?.is_administrator || 0) === 1;
  const isMysteryGameUser = Number(viewer?.is_mystery_game_user || 0) === 1;
  const isWordsearchUser = Number(viewer?.is_wordsearch_user || 0) === 1;
  const isBuildWizardUser = Number(viewer?.is_build_wizard_user || 0) === 1;
  const canUseBuildWizard = isAuthed && (isAdministrator || isBuildWizardUser);

  const links = [
    { key: 'about', href: 'about.php', label: 'About' },
    { key: 'activities', href: 'activities.php', label: 'Activities' },
    { key: 'arcade', href: 'arcade.php', label: 'Arcade' },
    { key: 'coloring', href: 'coloring.php', label: 'Coloring' },
    { key: 'games', href: 'games.php', label: 'Games' },
    { key: 'stories', href: 'stories.php', label: 'Stories' },
    ...(isAuthed && isWordsearchUser ? [{ key: 'wordsearch', href: 'wordsearch.php', label: 'Word Search' }] : []),
  ];
  const shortcutItems: Array<{
    key: string;
    label: string;
    href?: string;
    buttonClassName?: string;
    onClick?: () => void;
    title?: string;
    iconClassName?: string;
  }> = [
    ...links.map((l) => ({ key: l.key, label: l.label, href: l.href })),
    ...(isAuthed && isMysteryGameUser
      ? [{ key: 'mystery', label: 'Mystery Game', href: 'mystery.php' }]
      : []),
    ...(canUseBuildWizard
      ? [{ key: 'build_wizard', label: 'Build Wizard', href: 'build-wizard.php' }]
      : []),
    ...((active === 'mystery' || active === 'sheriff_station') && isAuthed && isAdministrator
      ? [
          {
            key: 'dossier',
            label: 'Dossier',
            onClick: () => (window as any).catn8_open_dossier?.(),
            title: 'Open Dossier',
            buttonClassName: 'nav-link btn btn-link border-0 text-info opacity-75',
            iconClassName: 'bi bi-person-badge-fill me-1',
          },
          {
            key: 'lab',
            label: 'Lab',
            onClick: () => (window as any).catn8_open_crime_lab?.(),
            title: 'Open Crime Lab',
            buttonClassName: 'nav-link btn btn-link border-0 text-info opacity-75',
            iconClassName: 'bi bi-microscope me-1',
          },
        ]
      : []),
  ].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <nav className="navbar navbar-expand-lg navbar-light sticky-top">
      <div className="container">
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav catn8-nav-shortcuts me-auto">
            <li className="nav-item">
              <a className={"nav-link navbar-home-link" + (active === 'home' ? ' active' : '')} href="/">Home</a>
            </li>
            {shortcutItems.map((item) => (
              <li className="nav-item" key={item.key}>
                {item.href ? (
                  <a className={"nav-link" + (active === item.key ? ' active' : '')} href={item.href}>
                    {item.label}
                  </a>
                ) : (
                  <button
                    type="button"
                    className={item.buttonClassName || 'nav-link btn btn-link border-0'}
                    onClick={item.onClick}
                    title={item.title}
                  >
                    {item.iconClassName ? <i className={item.iconClassName}></i> : null}
                    {item.label}
                  </button>
                )}
              </li>
            ))}
            {isAuthed && mysteryTitle ? (
              <li className="nav-item">
                <span className="nav-link text-muted opacity-75 catn8-nav-mystery-title">
                  {mysteryTitle}
                </span>
              </li>
            ) : null}
          </ul>
          <ul className="navbar-nav catn8-nav-account ms-auto">
            <li className="nav-item">
              <a className="navbar-brand catn8-nav-logo-link" href="/">
                <WebpImage src="images/catn8_logo.svg" alt="catn8.us Logo" />
              </a>
            </li>
            {isAuthed ? (
              <li className="nav-item">
                <a
                  className="nav-link"
                  href="account.php"
                  onClick={(e) => {
                    if (typeof onAccountClick === 'function') {
                      e.preventDefault();
                      onAccountClick();
                    }
                  }}
                >
                  {viewer.username}
                </a>
              </li>
            ) : (
              <li className="nav-item">
                <a
                  className={"nav-link catn8-login-link" + (active === 'login' ? ' active' : '')}
                  href="login.php"
                  onClick={(e) => {
                    if (typeof onLoginClick === 'function') {
                      e.preventDefault();
                      onLoginClick();
                    }
                  }}
                >
                  Login
                </a>
              </li>
            )}
            {isAuthed && isInAdministratorGroup ? (
              <li className="nav-item">
                <a className={"nav-link" + (active === 'settings' ? ' active' : '')} href="settings.php">
                  Settings
                </a>
              </li>
            ) : null}
            {isAuthed ? (
              <li className="nav-item">
                <a
                  className="nav-link"
                  href="logout.php"
                  onClick={(e) => {
                    if (typeof onLogout === 'function') {
                      e.preventDefault();
                      onLogout();
                    }
                  }}
                >
                  Logout
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </nav>
  );
}
