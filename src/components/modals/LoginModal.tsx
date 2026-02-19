import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { IToast } from '../../types/common';
import { useLogin } from './hooks/useLogin';
import { LoginForm } from './sections/LoginForm';
import { SignupForm } from './sections/SignupForm';

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
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const state = useLogin(onClose, onLoggedIn, onToast);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) {
      modal.show();
    } else {
      modal.hide();
    }
  }, [open, modalApiRef]);

  React.useEffect(() => {
    if (open) {
      state.setError('');
      state.setMessage('');
    }
  }, [open, state.setError, state.setMessage]);

  return (
    <>
      <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Account</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
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
        </div>
      </div>

      <ForgotPasswordModal open={state.forgotOpen} onClose={() => state.setForgotOpen(false)} />
    </>
  );
}
