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
  const formRef = React.useRef<HTMLFormElement>(null);

  // Password managers often fill the password without firing onChange. Sync DOM → React
  // so controlled values do not wipe the autofilled password on the next username render.
  React.useEffect(() => {
    const form = formRef.current;
    if (!form) return undefined;
    const sync = () => {
      const userEl = form.elements.namedItem('username');
      const passEl = form.elements.namedItem('password');
      if (userEl instanceof HTMLInputElement && userEl.value && userEl.value !== loginUsername) {
        setLoginUsername(userEl.value);
      }
      if (passEl instanceof HTMLInputElement && passEl.value && passEl.value !== loginPassword) {
        setLoginPassword(passEl.value);
      }
    };
    sync();
    const t1 = window.setTimeout(sync, 50);
    const t2 = window.setTimeout(sync, 300);
    form.addEventListener('input', sync);
    form.addEventListener('change', sync);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      form.removeEventListener('input', sync);
      form.removeEventListener('change', sync);
    };
  }, [loginUsername, loginPassword, setLoginUsername, setLoginPassword]);

  return (
    <form id="loginForm" ref={formRef} method="post" action="/api/auth/login.php" autoComplete="on" onSubmit={submitLogin}>
      <div className="mb-3">
        <label className="form-label" htmlFor="login-username">Username</label>
        <input
          className="form-control"
          type="text"
          id="login-username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={loginUsername}
          onChange={(e) => {
            setLoginUsername(e.target.value);
            const passEl = e.currentTarget.form?.elements.namedItem('password');
            if (passEl instanceof HTMLInputElement && passEl.value && !loginPassword) {
              setLoginPassword(passEl.value);
            }
          }}
          disabled={busy}
          required
        />
      </div>
      <div className="mb-2">
        <label className="form-label" htmlFor="login-password">Password</label>
        <input
          className="form-control"
          type="password"
          id="login-password"
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
