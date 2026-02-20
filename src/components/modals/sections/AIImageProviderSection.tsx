import React from 'react';
import { AI_IMAGE_PROVIDER_CHOICES, aiImageGetModelChoices, aiImageDefaultParams } from '../../../utils/aiImageUtils';

interface AIImageProviderSectionProps {
  config: any;
  setConfig: React.Dispatch<React.SetStateAction<any>>;
  modelChoices: any[];
  providerKey: string;
  busy: boolean;
  lastAiImageProviderTest: string;
  testAiImageProvider: () => Promise<void>;
  refreshModelChoices: () => Promise<void>;
  isRefreshingModels: boolean;
  modelChoicesSource: 'catalog' | 'live';
}

export function AIImageProviderSection({
  config,
  setConfig,
  modelChoices,
  providerKey,
  busy,
  lastAiImageProviderTest,
  testAiImageProvider,
  refreshModelChoices,
  isRefreshingModels,
  modelChoicesSource
}: AIImageProviderSectionProps) {
  return (
    <div className="border rounded p-3 mb-3">
      <div className="d-flex justify-content-between align-items-end gap-2 mb-2">
        <div className="fw-semibold">Provider</div>
        <div className="d-flex align-items-center gap-2">
          {lastAiImageProviderTest ? (
            <div className="text-muted small">Last result: {lastAiImageProviderTest}</div>
          ) : null}
          <button type="button" className="btn btn-outline-secondary" onClick={testAiImageProvider} disabled={busy}>
            Test saved config
          </button>
        </div>
      </div>
      <div className="row g-3">
        <div className="col-md-6">
          <label className="form-label" htmlFor="ai-image-provider">Provider</label>
          <select
            id="ai-image-provider"
            className="form-select"
            value={config.provider}
            onChange={(e) => {
              const nextProvider = e.target.value;
              const choices = aiImageGetModelChoices(nextProvider);
              const nextModel = choices.length ? String(choices[0].value || '') : '';
              setConfig((c: any) => ({
                ...c,
                provider: nextProvider,
                model: nextModel,
                params: aiImageDefaultParams(nextProvider, nextModel),
                provider_config: {},
              }));
            }}
            disabled={busy}
          >
            {AI_IMAGE_PROVIDER_CHOICES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-6">
          <div className="d-flex justify-content-between align-items-center gap-2">
            <label className="form-label mb-0" htmlFor="ai-image-model">Model</label>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => void refreshModelChoices()}
              disabled={busy || isRefreshingModels}
            >
              {isRefreshingModels ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          <select
            id="ai-image-model"
            className="form-select"
            value={config.model}
            onChange={(e) => {
              const nextModel = e.target.value;
              setConfig((c: any) => ({ ...c, model: nextModel }));
            }}
            disabled={busy || !modelChoices.length}
          >
            {modelChoices.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <div className="form-text">
            Source: {modelChoicesSource === 'live' ? 'Live provider list' : 'Built-in catalog'}
          </div>
        </div>

        {(providerKey === 'openai' || providerKey === 'together_ai' || providerKey === 'fireworks_ai') ? (
          <div className="col-12">
            <label className="form-label" htmlFor="ai-image-base-url">Base URL</label>
            <input
              id="ai-image-base-url"
              className="form-control"
              value={config.base_url}
              onChange={(e) => setConfig((c: any) => ({ ...c, base_url: e.target.value }))}
              disabled={busy}
              placeholder=""
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
