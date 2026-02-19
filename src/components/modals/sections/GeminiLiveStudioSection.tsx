import React from 'react';

interface GeminiLiveStudioSectionProps {
  hasMysteryGeminiKey: number;
  mysteryGeminiApiKey: string;
  setMysteryGeminiApiKey: (v: string) => void;
  mysteryGeminiKeyName: string;
  setMysteryGeminiKeyName: (v: string) => void;
  mysteryGeminiProjectName: string;
  setMysteryGeminiProjectName: (v: string) => void;
  mysteryGeminiProjectNumber: string;
  setMysteryGeminiProjectNumber: (v: string) => void;
  busy: boolean;
  lastGeminiLiveTokenTest: string;
  testGeminiLiveToken: () => Promise<void>;
}

export function GeminiLiveStudioSection({
  hasMysteryGeminiKey,
  mysteryGeminiApiKey,
  setMysteryGeminiApiKey,
  mysteryGeminiKeyName,
  setMysteryGeminiKeyName,
  mysteryGeminiProjectName,
  setMysteryGeminiProjectName,
  mysteryGeminiProjectNumber,
  setMysteryGeminiProjectNumber,
  busy,
  lastGeminiLiveTokenTest,
  testGeminiLiveToken
}: GeminiLiveStudioSectionProps) {
  return (
    <div className="border rounded p-3 h-100">
      <div className="fw-semibold mb-2">Mystery: Gemini Live (AI Studio)</div>
      <div className="row g-3">
        <div className="col-12">
          <label className="form-label" htmlFor="mystery-gemini-api-key">API Key {hasMysteryGeminiKey ? '(saved)' : '(not set)'}</label>
          <input
            id="mystery-gemini-api-key"
            className="form-control"
            value={mysteryGeminiApiKey}
            onChange={(e) => setMysteryGeminiApiKey(e.target.value)}
            disabled={busy}
            placeholder={hasMysteryGeminiKey ? 'Enter to replace existing key' : 'Enter API key'}
            autoComplete="off"
          />
          <div className="form-text">This API key is used server-side to mint ephemeral tokens; it is not sent to the browser.</div>
        </div>

        <div className="col-md-6">
          <label className="form-label" htmlFor="mystery-gemini-key-name">Name</label>
          <input
            id="mystery-gemini-key-name"
            className="form-control"
            value={mysteryGeminiKeyName}
            onChange={(e) => setMysteryGeminiKeyName(e.target.value)}
            disabled={busy}
            placeholder="Mystery_Game_Gemini_Live"
            autoComplete="off"
          />
        </div>

        <div className="col-md-6">
          <label className="form-label" htmlFor="mystery-gemini-project-name">Project Name</label>
          <input
            id="mystery-gemini-project-name"
            className="form-control"
            value={mysteryGeminiProjectName}
            onChange={(e) => setMysteryGeminiProjectName(e.target.value)}
            disabled={busy}
            placeholder="projects/928442808422"
            autoComplete="off"
          />
        </div>

        <div className="col-md-6">
          <label className="form-label" htmlFor="mystery-gemini-project-number">Project Number</label>
          <input
            id="mystery-gemini-project-number"
            className="form-control"
            value={mysteryGeminiProjectNumber}
            onChange={(e) => setMysteryGeminiProjectNumber(e.target.value)}
            disabled={busy}
            placeholder="928442808422"
            autoComplete="off"
          />
        </div>

        <div className="col-12">
          <div className="d-flex justify-content-end align-items-center gap-2">
            {lastGeminiLiveTokenTest && (
              <div className="text-muted small">Last result: {lastGeminiLiveTokenTest}</div>
            )}
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy || !hasMysteryGeminiKey} onClick={testGeminiLiveToken}>
              Test Gemini Live token
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
