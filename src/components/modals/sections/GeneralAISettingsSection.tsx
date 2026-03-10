import React from 'react';

interface GeneralAISettingsSectionProps {
  temperature: number;
  setTemperature: (v: number) => void;
  busy: boolean;
  isDirty: boolean;
  lastAiProviderTest: string;
  testAiProvider: () => Promise<void>;
  save: () => Promise<void>;
}

export function GeneralAISettingsSection({
  temperature,
  setTemperature,
  busy,
  isDirty,
  lastAiProviderTest,
  testAiProvider,
  save
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
        <div className="form-text">Lower values are usually better for extraction and statement parsing.</div>
      </div>

      <div className="col-md-8 d-flex align-items-end justify-content-end">
        <div className="d-flex flex-column align-items-md-end gap-2 w-100">
          <div className="small text-muted">
            Test checks the currently saved configuration. Save first if you changed a key, model, or endpoint.
          </div>
          {lastAiProviderTest ? <div className="text-muted small">Last result: {lastAiProviderTest}</div> : null}
          <div className="d-flex align-items-center gap-2">
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !isDirty}>
              Save current settings
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={testAiProvider} disabled={busy}>
            Test provider
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
