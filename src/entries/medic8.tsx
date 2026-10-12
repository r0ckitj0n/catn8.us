import React from 'react';
import { createRoot } from 'react-dom/client';

import { ToastOverlay } from '../components/modals/ToastOverlay';
import { LoginModal } from '../components/modals/LoginModal';
import { AccountModal } from '../components/modals/AccountModal';
import { Medic8Page } from '../components/pages/Medic8Page';
import { ApiClient } from '../core/ApiClient';
import './app.css';

type Toast = { tone: 'success' | 'error' | 'info' | 'warning'; message: string } | null;

function Medic8App() {
  const [viewer, setViewer] = React.useState<any>(null);
  const [viewerResolved, setViewerResolved] = React.useState(false);
  const [loginOpen, setLoginOpen] = React.useState(false);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [toast, setToast] = React.useState<Toast>(null);

  const refreshViewer = React.useCallback(async () => {
    try {
      const response = await ApiClient.get('/api/auth/me.php');
      setViewer(response?.user || null);
      return response?.user || null;
    } catch {
      setViewer(null);
      return null;
    } finally {
      setViewerResolved(true);
    }
  }, []);

  React.useEffect(() => {
    void refreshViewer();
  }, [refreshViewer]);

  React.useEffect(() => {
    if (viewerResolved && !viewer) {
      setLoginOpen(true);
    }
  }, [viewer, viewerResolved]);

  const isAdmin = Boolean(
    viewer
    && (Number(viewer.is_admin) === 1 || Number(viewer.is_administrator) === 1 || String(viewer.username || '').toLowerCase() === 'admin'),
  );

  const logout = React.useCallback(async () => {
    try {
      await ApiClient.post('/api/auth/logout.php', {});
    } finally {
      setViewer(null);
    }
  }, []);

  if (!viewerResolved) {
    return <div className="container py-4 text-muted">Loading Medic8…</div>;
  }

  return (
    <>
      <Medic8Page
        viewer={viewer}
        isAdmin={isAdmin}
        onLoginClick={() => setLoginOpen(true)}
        onLogout={() => void logout()}
        onAccountClick={() => setAccountOpen(true)}
        mysteryTitle=""
        onToast={setToast}
      />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onLoggedIn={refreshViewer} onToast={setToast} />
      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} viewer={viewer} onChanged={refreshViewer} onToast={setToast} />
      <ToastOverlay toast={toast} onClose={() => setToast(null)} />
    </>
  );
}

const mount = document.getElementById('catn8-app') as HTMLElement | null;
if (mount) {
  const root = createRoot(mount);
  root.render(<Medic8App />);
}
