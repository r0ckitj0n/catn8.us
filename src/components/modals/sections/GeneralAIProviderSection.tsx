import React from 'react';
import { AI_PROVIDER_CHOICES, aiGetModelChoices } from '../../../utils/aiUtils';

interface GeneralAIProviderSectionProps {
  config: any;
  setConfig: React.Dispatch<React.SetStateAction<any>>;
  modelChoices: any[];
  providerKey: string;
  busy: boolean;
  refreshModelChoices: () => Promise<void>;
  isRefreshingModels: boolean;
  modelChoicesSource: 'catalog' | 'live';
}

export function GeneralAIProviderSection({
  config,
  setConfig,
  modelChoices,
  providerKey,
  busy,
  refreshModelChoices,
  isRefreshingModels,
  modelChoicesSource
}: GeneralAIProviderSectionProps) {
  return (
    <div className="border rounded p-3 mb-3">
      <div className="fw-semibold mb-2">General AI Provider</div>
      <div className="row g-3">
        <div className="col-md-6">
          <label className="form-label" htmlFor="ai-provider">Provider</label>
          <select
            id="ai-provider"
            className="form-select"
            value={config.provider}
            onChange={(e) => {
              const nextProvider = e.target.value;
              const choices = aiGetModelChoices(nextProvider);
              const nextModel = choices.length ? String(choices[0].value || '') : '';
              setConfig((c: any) => ({
                ...c,
                provider: nextProvider,
                model: nextModel,
                base_url: '',
                location: '',
                provider_config: {},
              }));
            }}
            disabled={busy}
          >
            {AI_PROVIDER_CHOICES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-6">
          <div className="d-flex justify-content-between align-items-center gap-2">
            <label className="form-label mb-0" htmlFor="ai-model">Model</label>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => void refreshModelChoices()}
              disabled={busy || isRefreshingModels}
            >
              {isRefreshingModels ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          <datalist id="ai-model-options">
            {modelChoices.map((m) => (
              <option key={m.value} value={m.value} />
            ))}
          </datalist>
          <input
            id="ai-model"
            className="form-control"
            value={String(config.model || '')}
            onChange={(e) => setConfig((c: any) => ({ ...c, model: e.target.value }))}
            disabled={busy}
            list="ai-model-options"
            placeholder={modelChoices.length ? String(modelChoices[0].value || '') : 'Enter model id…'}
          />
          <div className="form-text">
            Source: {modelChoicesSource === 'live' ? 'Live provider list' : 'Built-in catalog'}. Pick a preset or type an exact model id.
          </div>
        </div>

        <div className="col-12">
          {(providerKey === 'openai' || providerKey === 'together_ai' || providerKey === 'fireworks_ai') && (
            <>
              <label className="form-label" htmlFor="ai-base-url">Base URL{providerKey === 'openai' ? ' (optional)' : ''}</label>
              <input
                id="ai-base-url"
                className="form-control"
                value={config.base_url}
                onChange={(e) => setConfig((c: any) => ({ ...c, base_url: e.target.value }))}
                disabled={busy}
                placeholder=""
              />
            </>
          )}
        </div>

        {providerKey === 'google_vertex_ai' && (
          <div className="col-md-6">
            <label className="form-label" htmlFor="ai-location">Location</label>
            <input
              id="ai-location"
              className="form-control"
              list="ai-location-options"
              value={config.location}
              onChange={(e) => setConfig((c: any) => ({ ...c, location: e.target.value }))}
              disabled={busy}
              placeholder="global"
            />
          </div>
        )}

        {providerKey === 'azure_openai' && (
          <>
            <div className="col-12">
              <label className="form-label" htmlFor="ai-azure-endpoint">Endpoint</label>
              <input
                id="ai-azure-endpoint"
                className="form-control"
                value={String(config?.provider_config?.azure_endpoint || '')}
                onChange={(e) =>
                  setConfig((c: any) => ({
                    ...c,
                    provider_config: { ...(c.provider_config || {}), azure_endpoint: e.target.value },
                  }))
                }
                disabled={busy}
                placeholder="https://{resource}.openai.azure.com"
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="ai-azure-deployment">Deployment</label>
              <input
                id="ai-azure-deployment"
                className="form-control"
                value={String(config?.provider_config?.azure_deployment || '')}
                onChange={(e) =>
                  setConfig((c: any) => ({
                    ...c,
                    provider_config: { ...(c.provider_config || {}), azure_deployment: e.target.value },
                  }))
                }
                disabled={busy}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="ai-azure-api-version">API Version</label>
              <input
                id="ai-azure-api-version"
                className="form-control"
                value={String(config?.provider_config?.azure_api_version || '')}
                onChange={(e) =>
                  setConfig((c: any) => ({
                    ...c,
                    provider_config: { ...(c.provider_config || {}), azure_api_version: e.target.value },
                  }))
                }
                disabled={busy}
              />
            </div>
          </>
        )}

        {providerKey === 'aws_bedrock' && (
          <div className="col-12">
            <label className="form-label" htmlFor="ai-aws-region">Region</label>
            <input
              id="ai-aws-region"
              className="form-control"
              value={String(config?.provider_config?.aws_region || '')}
              onChange={(e) =>
                setConfig((c: any) => ({
                  ...c,
                  provider_config: { ...(c.provider_config || {}), aws_region: e.target.value },
                }))
              }
              disabled={busy}
              placeholder="us-east-1"
            />
          </div>
        )}
      </div>
    </div>
  );
}
