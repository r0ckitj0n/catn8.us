import React from 'react';
import './PageLayout.css';
import { NavBar } from './NavBar';

interface PageLayoutProps {
  page: string;
  title?: string;
  children: React.ReactNode;
  viewer?: any;
  isAdmin?: boolean;
  onLoginClick?: () => void;
  onLogout?: () => void;
  onAccountClick?: () => void;
  mysteryTitle?: string;
}

export function PageLayout({ page, title, children, viewer, isAdmin = false, onLoginClick, onLogout, onAccountClick, mysteryTitle }: PageLayoutProps) {
  const pathname = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
  const p = String(pathname || '').toLowerCase();
  const hideNav = (
    p === '/mystery.php'
    || p.startsWith('/mystery.php/')
    || p === '/mystery'
    || p.startsWith('/mystery/')
    || p === '/sheriff_station.php'
    || p === '/sheriff_station'
  );

  return (
    <div className="catn8-page" data-page={page} data-title={title || ''}>
      {hideNav ? null : (
        <NavBar 
          active={page} 
          viewer={viewer} 
          isAdmin={isAdmin}
          onLoginClick={onLoginClick || (() => {})} 
          onLogout={onLogout || (() => {})} 
          onAccountClick={onAccountClick || (() => {})} 
          mysteryTitle={mysteryTitle}
        />
      )}
      {children}
    </div>
  );
}
