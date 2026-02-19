import React from 'react';

interface GeneralAISettingsSectionProps {
  temperature: number;
  setTemperature: (v: number) => void;
  busy: boolean;
  lastAiProviderTest: string;
  testAiProvider: () => Promise<void>;
}

export function GeneralAISettingsSection({
  temperature,
  setTemperature,
  busy,
  lastAiProviderTest,
  testAiProvider
}: GeneralAISettingsSectionProps) {
  return (
    <div className="row g-3 align-items-end mb-3">
      <div className="col-md-4">
        <label className="form-label" htmlFor="ai-temperature">Temperature</label>
        <input
          id="ai-temperature"
          className="form-control"
          type="number"
          step="0.05"
          min="0"
          max="2"
          value={String(temperature)}
          onChange={(e) => setTemperature(Number(e.target.value))}
          disabled={busy}
        />
      </div>

      <div className="col-md-8 d-flex align-items-end justify-content-end">
        <div className="d-flex align-items-center gap-2">
          {lastAiProviderTest ? (
            <div className="text-muted small">Last result: {lastAiProviderTest}</div>
          ) : null}
          <button type="button" className="btn btn-outline-secondary" onClick={testAiProvider} disabled={busy}>
            Test provider
          </button>
        </div>
      </div>
    </div>
  );
}
