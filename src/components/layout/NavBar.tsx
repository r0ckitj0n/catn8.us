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
  const isMysteryGameUser = Number(viewer?.is_mystery_game_user || 0) === 1;
  const isWordsearchUser = Number(viewer?.is_wordsearch_user || 0) === 1;
  const isBuildWizardUser = Number(viewer?.is_build_wizard_user || 0) === 1;
  const canUseBuildWizard = isAuthed && (isAdministrator || isBuildWizardUser);

  const links = [
    { key: 'about', href: 'about.php', label: 'About' },
    { key: 'stories', href: 'stories.php', label: 'Stories' },
    { key: 'games', href: 'games.php', label: 'Games' },
    { key: 'arcade', href: 'arcade.php', label: 'Arcade' },
    { key: 'activities', href: 'activities.php', label: 'Activities' },
    ...(isAuthed && isWordsearchUser ? [{ key: 'wordsearch', href: 'wordsearch.php', label: 'Word Search' }] : []),
  ];

  return (
    <nav className="navbar navbar-expand-lg navbar-light sticky-top">
      <div className="container">
        <a className={"nav-link navbar-home-link" + (active === 'home' ? ' active' : '')} href="/">Home</a>
        <a className="navbar-brand" href="/">
          <WebpImage src="images/catn8_logo.svg" alt="catn8.us Logo" />
        </a>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            {links.map((l) => (
              <li className="nav-item" key={l.key}>
                <a className={"nav-link" + (active === l.key ? ' active' : '')} href={l.href}>
                  {l.label}
                </a>
              </li>
            ))}
            {isAuthed && isMysteryGameUser ? (
              <li className="nav-item">
                <a className={"nav-link" + (active === 'mystery' ? ' active' : '')} href="mystery.php">
                  Mystery Game
                </a>
              </li>
            ) : null}
            {canUseBuildWizard ? (
              <li className="nav-item">
                <a className={"nav-link" + (active === 'build_wizard' ? ' active' : '')} href="build-wizard.php">
                  Build Wizard
                </a>
              </li>
            ) : null}
            {isAuthed && isAdministrator ? (
              <>
                <li className="nav-item">
                  <a className={"nav-link" + (active === 'settings' ? ' active' : '')} href="settings.php">
                    Settings
                  </a>
                </li>
                {(active === 'mystery' || active === 'sheriff_station') && (
                  <>
                    <li className="nav-item">
                      <button 
                        type="button" 
                        className="nav-link btn btn-link border-0 text-info opacity-75"
                        onClick={() => (window as any).catn8_open_dossier?.()}
                        title="Open Dossier"
                      >
                        <i className="bi bi-person-badge-fill me-1"></i> Dossier
                      </button>
                    </li>
                    <li className="nav-item">
                      <button 
                        type="button" 
                        className="nav-link btn btn-link border-0 text-info opacity-75"
                        onClick={() => (window as any).catn8_open_crime_lab?.()}
                        title="Open Crime Lab"
                      >
                        <i className="bi bi-microscope me-1"></i> Lab
                      </button>
                    </li>
                  </>
                )}
              </>
            ) : null}
            {isAuthed && mysteryTitle && (
              <li className="nav-item">
                <span className="nav-link text-muted opacity-75 catn8-nav-mystery-title">
                  {mysteryTitle}
                </span>
              </li>
            )}
            {isAuthed ? (
              <>
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
              </>
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
          </ul>
        </div>
      </div>
    </nav>
  );
}
