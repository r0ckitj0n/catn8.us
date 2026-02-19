import React from 'react';

interface SignupFormProps {
  busy: boolean;
  signupUsername: string;
  setSignupUsername: (val: string) => void;
  signupEmail: string;
  setSignupEmail: (val: string) => void;
  signupPassword: string;
  setSignupPassword: (val: string) => void;
  signupPassword2: string;
  setSignupPassword2: (val: string) => void;
  submitSignup: (e: React.FormEvent) => Promise<void>;
}

export function SignupForm({
  busy, signupUsername, setSignupUsername, signupEmail, setSignupEmail,
  signupPassword, setSignupPassword, signupPassword2, setSignupPassword2, submitSignup
}: SignupFormProps) {
  return (
    <form onSubmit={submitSignup}>
      <div className="mb-3">
        <label className="form-label" htmlFor="signup-username">Username</label>
        <input
          className="form-control"
          type="text"
          id="signup-username"
          name="username"
          autoComplete="username"
          value={signupUsername}
          onChange={(e) => setSignupUsername(e.target.value)}
          disabled={busy}
          required
        />
      </div>
      <div className="mb-3">
        <label className="form-label" htmlFor="signup-email">Email</label>
        <input
          className="form-control"
          type="email"
          id="signup-email"
          name="email"
          autoComplete="email"
          value={signupEmail}
          onChange={(e) => setSignupEmail(e.target.value)}
          disabled={busy}
          required
        />
      </div>
      <div className="mb-3">
        <label className="form-label" htmlFor="signup-password">Password</label>
        <input
          className="form-control"
          type="password"
          id="signup-password"
          name="new-password"
          autoComplete="new-password"
          value={signupPassword}
          onChange={(e) => setSignupPassword(e.target.value)}
          disabled={busy}
          required
        />
      </div>
      <div className="mb-3">
        <label className="form-label" htmlFor="signup-password2">Confirm Password</label>
        <input
          className="form-control"
          type="password"
          id="signup-password2"
          autoComplete="new-password"
          value={signupPassword2}
          onChange={(e) => setSignupPassword2(e.target.value)}
          disabled={busy}
          required
        />
      </div>
      <button type="submit" className="btn btn-primary w-100" disabled={busy}>
        Create account
      </button>
    </form>
  );
}
