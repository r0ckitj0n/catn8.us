import React from 'react';

interface LoginFormProps {
  busy: boolean;
  loginUsername: string;
  setLoginUsername: (val: string) => void;
  loginPassword: string;
  setLoginPassword: (val: string) => void;
  setForgotOpen: (val: boolean) => void;
  submitLogin: (e: React.FormEvent) => Promise<void>;
}

export function LoginForm({
  busy, loginUsername, setLoginUsername, loginPassword, setLoginPassword, setForgotOpen, submitLogin
}: LoginFormProps) {
  return (
    <form id="loginForm" onSubmit={submitLogin}>
      <div className="mb-3">
        <label className="form-label" htmlFor="username">Username</label>
        <input
          className="form-control"
          type="text"
          id="username"
          name="username"
          autoComplete="username"
          value={loginUsername}
          onChange={(e) => setLoginUsername(e.target.value)}
          disabled={busy}
          required
        />
      </div>
      <div className="mb-2">
        <label className="form-label" htmlFor="password">Password</label>
        <input
          className="form-control"
          type="password"
          id="password"
          name="password"
          autoComplete="current-password"
          value={loginPassword}
          onChange={(e) => setLoginPassword(e.target.value)}
          disabled={busy}
          required
        />
      </div>
      <div className="mb-3">
        <button
          type="button"
          className="btn btn-link p-0"
          onClick={() => setForgotOpen(true)}
          disabled={busy}
        >
          Forgot password?
        </button>
      </div>
      <button id="loginButton" type="submit" className="btn btn-primary w-100" disabled={busy}>
        Sign in
      </button>
    </form>
  );
}
