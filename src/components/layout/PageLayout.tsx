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
    p === '/investig8.php'
    || p.startsWith('/investig8.php/')
    || p === '/investig8'
    || p.startsWith('/investig8/')
    || p === '/accumul8.php'
    || p.startsWith('/accumul8.php/')
    || p === '/accumul8'
    || p.startsWith('/accumul8/')
    || p === '/sheriff_station.php'
    || p === '/sheriff_station'
    || p === '/photo-m8.php'
    || p.startsWith('/photo-m8.php/')
    || p === '/photo-m8'
    || p.startsWith('/photo-m8/')
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
