import React from 'react';
import { AiLooseObject } from '../../../types/common';

interface GeneralAISecretsSectionProps {
  providerKey: string;
  hasSecrets: Record<string, AiLooseObject>;
  secretsByProvider: Record<string, AiLooseObject>;
  setSecretsByProvider: React.Dispatch<React.SetStateAction<Record<string, AiLooseObject>>>;
  busy: boolean;
}

export function GeneralAISecretsSection({
  providerKey,
  hasSecrets,
  secretsByProvider,
  setSecretsByProvider,
  busy
}: GeneralAISecretsSectionProps) {
  const providerHas = hasSecrets[providerKey] || {};
  const providerSecrets = secretsByProvider[providerKey] || {};

  return (
    <>
      {(providerKey === 'openai' || providerKey === 'anthropic' || providerKey === 'google_ai_studio' || 
        providerKey === 'azure_openai' || providerKey === 'together_ai' || 
        providerKey === 'fireworks_ai' || providerKey === 'huggingface') && (
        <div className="col-12 mb-3">
          <label className="form-label" htmlFor="ai-provider-api-key">
            {providerKey === 'huggingface' ? 'API Token' : 'API Key'} {providerHas.api_key ? '(saved)' : '(not set)'}
          </label>
          <input
            id="ai-provider-api-key"
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

      {providerKey === 'google_vertex_ai' && (
        <div className="col-12 mb-3">
          <label className="form-label" htmlFor="ai-provider-service-account">
            Service Account JSON {providerHas.service_account_json ? '(saved)' : '(not set)'}
          </label>
          <textarea
            id="ai-provider-service-account"
            className="form-control"
            rows={6}
            value={String(providerSecrets.service_account_json || '')}
            onChange={(e) =>
              setSecretsByProvider((all) => ({
                ...all,
                [providerKey]: { ...(all[providerKey] || {}), service_account_json: e.target.value },
              }))
            }
            disabled={busy}
            spellCheck={false}
          />
        </div>
      )}

      {providerKey === 'aws_bedrock' && (
        <>
          <div className="col-md-6 mb-3">
            <label className="form-label" htmlFor="ai-aws-access-key-id">
              AWS Access Key ID {providerHas.aws_access_key_id ? '(saved)' : '(not set)'}
            </label>
            <input
              id="ai-aws-access-key-id"
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
          <div className="col-md-6 mb-3">
            <label className="form-label" htmlFor="ai-aws-secret-access-key">
              AWS Secret Access Key {providerHas.aws_secret_access_key ? '(saved)' : '(not set)'}
            </label>
            <input
              id="ai-aws-secret-access-key"
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
          <div className="col-12 mb-3">
            <label className="form-label" htmlFor="ai-aws-session-token">
              AWS Session Token {providerHas.aws_session_token ? '(saved)' : '(not set)'}
            </label>
            <input
              id="ai-aws-session-token"
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
    </>
  );
}
