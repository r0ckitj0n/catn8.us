import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { getLoginRedirectTarget } from '../../../entries/appConfig';
import { AuthMfaChallengeResponse, AuthMfaResendResponse, AuthMfaVerifyRequest } from '../../../types/authMfa';
import { IToast } from '../../../types/common';

function readLoginFields(form: HTMLFormElement | null, fallbackUser: string, fallbackPass: string): {
  username: string;
  password: string;
} {
  if (!form) {
    return { username: fallbackUser, password: fallbackPass };
  }
  const fd = new FormData(form);
  const username = String(fd.get('username') ?? fallbackUser).trim();
  // Prefer the live DOM value so password-manager autofill (which often skips onChange) is honored.
  const passwordInput = form.elements.namedItem('password');
  const domPassword = passwordInput instanceof HTMLInputElement ? passwordInput.value : '';
  const password = (domPassword || String(fd.get('password') ?? fallbackPass) || fallbackPass);
  return { username, password };
}

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
  const [mfaRequired, setMfaRequired] = React.useState(false);
  const [mfaEmailMasked, setMfaEmailMasked] = React.useState('');
  const [mfaError, setMfaError] = React.useState('');
  const [trustDevice, setTrustDevice] = React.useState(false);

  const submitLogin = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const form = e.currentTarget instanceof HTMLFormElement ? e.currentTarget : null;
      const { username, password } = readLoginFields(form, loginUsername, loginPassword);
      if (username !== loginUsername) setLoginUsername(username);
      if (password !== loginPassword) setLoginPassword(password);
      if (!username || !password) {
        throw new Error('Username and password are required');
      }
      const loginRes = await ApiClient.post<AuthMfaChallengeResponse>('/api/auth/login.php', { username, password });
      if (loginRes?.mfa_required) {
        setMfaEmailMasked(String(loginRes.email_masked || ''));
        setMfaError(loginRes.email_sent === false ? (loginRes.error || 'We could not email a verification code.') : '');
        setMfaRequired(true);
        return;
      }

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
      const redirectTarget = getLoginRedirectTarget();
      if (redirectTarget) {
        window.location.assign(redirectTarget);
        return;
      }
      onClose();
    } catch (err: any) {
      const payload = err?.payload as AuthMfaChallengeResponse | undefined;
      if (payload?.mfa_required) {
        setMfaEmailMasked(String(payload.email_masked || ''));
        setMfaError(payload.error || err?.message || 'We could not email a verification code.');
        setMfaRequired(true);
        return;
      }
      const msg = err?.message || 'Login failed';
      setError(msg);
      onToast({ tone: 'error', title: 'Login failed', message: msg });
    } finally {
      setBusy(false);
    }
  }, [loginUsername, loginPassword, onLoggedIn, onToast, onClose]);

  const finishLogin = React.useCallback(async () => {
    let u = null;
    if (typeof onLoggedIn === 'function') {
      u = await onLoggedIn();
    }
    if (!u || !u.id) {
      const msg = 'Login succeeded, but your session was not detected. Please refresh the page and try again.';
      setMfaError(msg);
      onToast({ tone: 'error', title: 'Login incomplete', message: msg });
      return;
    }
    setMfaRequired(false);
    setMessage('Logged in.');
    onToast({ tone: 'success', title: 'Login successful', message: 'You are now logged in.' });
    const redirectTarget = getLoginRedirectTarget();
    if (redirectTarget) {
      window.location.assign(redirectTarget);
      return;
    }
    onClose();
  }, [onClose, onLoggedIn, onToast]);

  const submitMfa = React.useCallback(async (code: string) => {
    setBusy(true);
    setMfaError('');
    try {
      const body: AuthMfaVerifyRequest = { code, trust_device: trustDevice };
      await ApiClient.post<AuthMfaChallengeResponse>('/api/auth/mfa_verify.php', body);
      await finishLogin();
    } catch (err: any) {
      setMfaError(err?.message || 'That code is incorrect.');
    } finally {
      setBusy(false);
    }
  }, [finishLogin, trustDevice]);

  const resendMfa = React.useCallback(async () => {
    setBusy(true);
    setMfaError('');
    try {
      const res = await ApiClient.post<AuthMfaResendResponse>('/api/auth/mfa_resend.php', {});
      if (res?.email_masked) setMfaEmailMasked(res.email_masked);
    } catch (err: any) {
      setMfaError(err?.message || 'Could not resend the code');
    } finally {
      setBusy(false);
    }
  }, []);

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
    mfaRequired, mfaEmailMasked, mfaError, trustDevice, setTrustDevice,
    submitLogin, submitSignup, submitMfa, resendMfa
  };
}
