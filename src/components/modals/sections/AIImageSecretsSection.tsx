import React from 'react';
import { AiLooseObject } from '../../../types/common';
import { VertexImageGenerator } from '../VertexImageGenerator';

interface AIImageSecretsSectionProps {
  providerKey: string;
  config: any;
  setConfig: React.Dispatch<React.SetStateAction<any>>;
  hasSecrets: Record<string, AiLooseObject>;
  secretsByProvider: Record<string, AiLooseObject>;
  setSecretsByProvider: React.Dispatch<React.SetStateAction<Record<string, AiLooseObject>>>;
  lastAiImageLocationRefTest: string;
  setLastAiImageLocationRefTest: React.Dispatch<React.SetStateAction<string>>;
  busy: boolean;
  setBusy: React.Dispatch<React.SetStateAction<boolean>>;
  onToast?: (toast: any) => void;
}

export function AIImageSecretsSection({
  providerKey,
  config,
  setConfig,
  hasSecrets,
  secretsByProvider,
  setSecretsByProvider,
  lastAiImageLocationRefTest,
  setLastAiImageLocationRefTest,
  busy,
  setBusy,
  onToast
}: AIImageSecretsSectionProps) {
  const providerHas = hasSecrets[providerKey] || {};
  const providerSecrets = secretsByProvider[providerKey] || {};

  return (
    <div className="border rounded p-3 mb-3">
      <div className="fw-semibold mb-2">Provider Configuration & Secrets</div>
      <div className="row g-3">
        {providerKey === 'azure_openai' && (
          <>
            <div className="col-12">
              <label className="form-label" htmlFor="ai-image-azure-endpoint">Endpoint</label>
              <input
                id="ai-image-azure-endpoint"
                className="form-control"
                value={String((config.provider_config as AiLooseObject).azure_endpoint || '')}
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
              <label className="form-label" htmlFor="ai-image-azure-deployment">Deployment</label>
              <input
                id="ai-image-azure-deployment"
                className="form-control"
                value={String((config.provider_config as AiLooseObject).azure_deployment || '')}
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
              <label className="form-label" htmlFor="ai-image-azure-api-version">API Version</label>
              <input
                id="ai-image-azure-api-version"
                className="form-control"
                value={String((config.provider_config as AiLooseObject).azure_api_version || '')}
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

        {providerKey === 'google_vertex_ai' && (
          <VertexImageGenerator
            busy={busy}
            setBusy={setBusy}
            config={config}
            setConfig={setConfig}
            providerKey={providerKey}
            providerHas={providerHas}
            providerSecrets={providerSecrets}
            setSecretsByProvider={setSecretsByProvider}
            lastAiImageLocationRefTest={lastAiImageLocationRefTest}
            setLastAiImageLocationRefTest={setLastAiImageLocationRefTest}
            onToast={onToast}
          />
        )}

        {providerKey === 'aws_bedrock' && (
          <>
            <div className="col-12">
              <label className="form-label" htmlFor="ai-image-aws-region">Region</label>
              <input
                id="ai-image-aws-region"
                className="form-control"
                value={String((config.provider_config as AiLooseObject).aws_region || '')}
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
            <div className="col-md-6">
              <label className="form-label" htmlFor="ai-image-aws-access-key-id">
                AWS Access Key ID {providerHas.aws_access_key_id ? '(saved)' : '(not set)'}
              </label>
              <input
                id="ai-image-aws-access-key-id"
                className="form-control"
                value={String(providerSecrets.aws_access_key_id || '')}
                onChange={(e) =>
                  setSecretsByProvider((all) => ({
                    ...all,
                    [providerKey]: { ...(all[providerKey] || {}), aws_access_key_id: e.target.value },
                  }))
                }
                disabled={busy}
                autoComplete="off"
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="ai-image-aws-secret-access-key">
                AWS Secret Access Key {providerHas.aws_secret_access_key ? '(saved)' : '(not set)'}
              </label>
              <input
                id="ai-image-aws-secret-access-key"
                className="form-control"
                value={String(providerSecrets.aws_secret_access_key || '')}
                onChange={(e) =>
                  setSecretsByProvider((all) => ({
                    ...all,
                    [providerKey]: { ...(all[providerKey] || {}), aws_secret_access_key: e.target.value },
                  }))
                }
                disabled={busy}
                autoComplete="off"
              />
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="ai-image-aws-session-token">
                AWS Session Token {providerHas.aws_session_token ? '(saved)' : '(not set)'}
              </label>
              <input
                id="ai-image-aws-session-token"
                className="form-control"
                value={String(providerSecrets.aws_session_token || '')}
                onChange={(e) =>
                  setSecretsByProvider((all) => ({
                    ...all,
                    [providerKey]: { ...(all[providerKey] || {}), aws_session_token: e.target.value },
                  }))
                }
                disabled={busy}
                autoComplete="off"
              />
            </div>
          </>
        )}

        {(providerKey === 'openai' || providerKey === 'azure_openai' || providerKey === 'together_ai' || 
          providerKey === 'fireworks_ai' || providerKey === 'stability_ai' || 
          providerKey === 'replicate' || providerKey === 'huggingface') && (
          <div className="col-12">
            <label className="form-label" htmlFor="ai-image-provider-api-key">
              {providerKey === 'replicate' || providerKey === 'huggingface' ? 'API Token' : 'API Key'}
              {providerHas.api_key ? ' (saved)' : ' (not set)'}
            </label>
            <input
              id="ai-image-provider-api-key"
              className="form-control"
              value={String(providerSecrets.api_key || '')}
              onChange={(e) =>
                setSecretsByProvider((all) => ({
                  ...all,
                  [providerKey]: { ...(all[providerKey] || {}), api_key: e.target.value },
                }))
              }
              disabled={busy}
              placeholder={providerHas.api_key ? 'Enter to replace existing token' : 'Enter token'}
              autoComplete="off"
            />
          </div>
        )}
      </div>
    </div>
  );
}
