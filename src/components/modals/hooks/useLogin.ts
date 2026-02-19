import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IToast } from '../../../types/common';

export function useLogin(
  onClose: () => void,
  onLoggedIn: () => Promise<any>,
  onToast: (toast: IToast) => void
) {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [loginUsername, setLoginUsername] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');
  const [signupUsername, setSignupUsername] = React.useState('');
  const [signupEmail, setSignupEmail] = React.useState('');
  const [signupPassword, setSignupPassword] = React.useState('');
  const [signupPassword2, setSignupPassword2] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [forgotOpen, setForgotOpen] = React.useState(false);

  const submitLogin = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await ApiClient.post('/api/auth/login.php', { username: loginUsername, password: loginPassword });

      let u = null;
      if (typeof onLoggedIn === 'function') {
        u = await onLoggedIn();
      }

      if (!u || !u.id) {
        const msg = 'Login succeeded, but your session was not detected. Please refresh the page and try again.';
        setError(msg);
        onToast({ tone: 'error', title: 'Login incomplete', message: msg });
        return;
      }

      setMessage('Logged in.');
      onToast({ tone: 'success', title: 'Login successful', message: 'You are now logged in.' });
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Login failed';
      setError(msg);
      onToast({ tone: 'error', title: 'Login failed', message: msg });
    } finally {
      setBusy(false);
    }
  }, [loginUsername, loginPassword, onLoggedIn, onToast, onClose]);

  const submitSignup = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (signupPassword !== signupPassword2) {
        throw new Error('Passwords do not match');
      }
      const res = await ApiClient.post('/api/auth/register.php', { username: signupUsername, email: signupEmail, password: signupPassword });
      const status = res?.status || '';
      if (status === 'pending_admin_approval') {
        setMessage('Account created and pending admin approval.');
      } else if (status === 'verification_required') {
        setMessage('Account created. Check your email for a verification link.');
      } else {
        setMessage('Account created.');
      }
      setActiveTab('login');
    } catch (err: any) {
      setError(err?.message || 'Sign up failed');
    } finally {
      setBusy(false);
    }
  }, [signupUsername, signupEmail, signupPassword, signupPassword2]);

  return {
    activeTab, setActiveTab,
    loginUsername, setLoginUsername,
    loginPassword, setLoginPassword,
    signupUsername, setSignupUsername,
    signupEmail, setSignupEmail,
    signupPassword, setSignupPassword,
    signupPassword2, setSignupPassword2,
    busy, message, error, setError, setMessage,
    forgotOpen, setForgotOpen,
    submitLogin, submitSignup
  };
}
