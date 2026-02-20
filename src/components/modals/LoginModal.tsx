import React from 'react';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { IToast } from '../../types/common';
import { useLogin } from './hooks/useLogin';
import { LoginForm } from './sections/LoginForm';
import { SignupForm } from './sections/SignupForm';
import './LoginModal.css';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onLoggedIn: () => Promise<any>;
  onToast: (toast: IToast) => void;
}

/**
 * LoginModal - Refactored Component
 * COMPLIANCE: File size < 250 lines
 */
export function LoginModal({ open, onClose, onLoggedIn, onToast }: LoginModalProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const state = useLogin(onClose, onLoggedIn, onToast);

  const updatePosition = React.useCallback(() => {
    if (!open) return;
    const trigger = document.querySelector('.catn8-login-link') as HTMLElement | null;
    const panel = panelRef.current;
    if (!panel || !trigger) {
      setPosition(null);
      return;
    }

    const gap = 8;
    const minEdge = 8;
    const viewportWidth = window.innerWidth;
    const panelWidth = panel.offsetWidth || 420;
    const rect = trigger.getBoundingClientRect();
    const idealLeft = rect.right - panelWidth;
    const maxLeft = Math.max(minEdge, viewportWidth - panelWidth - minEdge);
    const left = Math.min(Math.max(minEdge, idealLeft), maxLeft);
    const top = Math.max(minEdge, rect.bottom + gap);

    setPosition({ top, left });
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    updatePosition();
    const raf = window.requestAnimationFrame(updatePosition);
    const onWindowChange = () => updatePosition();
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    };
  }, [open, updatePosition]);

  React.useEffect(() => {
    if (open) {
      state.setError('');
      state.setMessage('');
    }
  }, [open, state.setError, state.setMessage]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const panel = panelRef.current;
      const trigger = document.querySelector('.catn8-login-link') as HTMLElement | null;
      if (panel?.contains(target)) return;
      if (trigger?.contains(target)) return;
      onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open, onClose]);

  if (!open) {
    return <ForgotPasswordModal open={state.forgotOpen} onClose={() => state.setForgotOpen(false)} />;
  }

  return (
    <>
      <div
        ref={panelRef}
        className="catn8-login-panel card shadow"
        role="dialog"
        aria-modal="false"
        aria-label="Account"
        style={position ? { top: `${position.top}px`, left: `${position.left}px` } : { top: '72px', right: '8px' }}
      >
        <div className="card-header d-flex align-items-center justify-content-between">
          <h5 className="mb-0">Account</h5>
          <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
        </div>
        <div className="card-body">
          {state.error && <div className="alert alert-danger">{state.error}</div>}
          {state.message && <div className="alert alert-success">{state.message}</div>}

          <ul className="nav nav-tabs" role="tablist">
            <li className="nav-item" role="presentation">
              <button
                className={'nav-link' + (state.activeTab === 'login' ? ' active' : '')}
                type="button"
                role="tab"
                onClick={() => state.setActiveTab('login')}
              >
                Login
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button
                className={'nav-link' + (state.activeTab === 'signup' ? ' active' : '')}
                type="button"
                role="tab"
                onClick={() => state.setActiveTab('signup')}
              >
                Create Account
              </button>
            </li>
          </ul>

          <div className="pt-3">
            {state.activeTab === 'login' ? (
              <LoginForm
                busy={state.busy}
                loginUsername={state.loginUsername}
                setLoginUsername={state.setLoginUsername}
                loginPassword={state.loginPassword}
                setLoginPassword={state.setLoginPassword}
                setForgotOpen={state.setForgotOpen}
                submitLogin={state.submitLogin}
              />
            ) : (
              <SignupForm
                busy={state.busy}
                signupUsername={state.signupUsername}
                setSignupUsername={state.setSignupUsername}
                signupEmail={state.signupEmail}
                setSignupEmail={state.setSignupEmail}
                signupPassword={state.signupPassword}
                setSignupPassword={state.setSignupPassword}
                signupPassword2={state.signupPassword2}
                setSignupPassword2={state.setSignupPassword2}
                submitSignup={state.submitSignup}
              />
            )}
          </div>
        </div>
      </div>

      <ForgotPasswordModal open={state.forgotOpen} onClose={() => state.setForgotOpen(false)} />
    </>
  );
}
