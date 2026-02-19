import React from 'react';
import { ApiClient } from '../../core/ApiClient';
import { AiLooseObject, IToast } from '../../types/common';
import { formatTestResult } from '../../utils/textUtils';
import { catn8LocalStorageSet } from '../../utils/storageUtils';

interface VertexImageGeneratorProps {
  busy: boolean;
  setBusy: (b: boolean) => void;
  config: any;
  setConfig: (c: any) => void;
  providerKey: string;
  providerHas: any;
  providerSecrets: any;
  setSecretsByProvider: (s: any) => void;
  lastAiImageLocationRefTest: string;
  setLastAiImageLocationRefTest: (t: string) => void;
  onToast?: (toast: IToast) => void;
}

export function VertexImageGenerator({
  busy,
  setBusy,
  config,
  setConfig,
  providerKey,
  providerHas,
  providerSecrets,
  setSecretsByProvider,
  lastAiImageLocationRefTest,
  setLastAiImageLocationRefTest,
  onToast,
}: VertexImageGeneratorProps) {
  const LS_AI_IMAGE_LOCATION_REF_TEST = 'catn8.last_test.ai_image.location_ref';

  async function testAiImageLocationReference() {
    if (busy) return;

    setLastAiImageLocationRefTest('Running…');
    setBusy(true);
    try {
      const res = await ApiClient.get('/api/settings/ai_image_location_test.php');
      const method = String(res?.method || '').trim();
      const q = String(res?.q || '').trim();
      const bytes = Number(res?.bytes || 0);

      const details = `${method || 'provider'}${q ? ` — ${q}` : ''}${bytes ? ` — ${bytes} bytes` : ''}`;

      const next = formatTestResult('success', details);
      setLastAiImageLocationRefTest(next);
      catn8LocalStorageSet(LS_AI_IMAGE_LOCATION_REF_TEST, next);
      if (onToast) onToast({ tone: 'success', message: `Location reference test OK${method ? ` (${method})` : ''}${q ? ` — ${q}` : ''}${bytes ? ` — ${bytes} bytes` : ''}` });
    } catch (e: any) {
      const next = formatTestResult('failure', String(e?.message || e || 'Failed'));
      setLastAiImageLocationRefTest(next);
      catn8LocalStorageSet(LS_AI_IMAGE_LOCATION_REF_TEST, next);
      if (onToast) onToast({ tone: 'error', message: String(e?.message || e || 'Failed to test location reference') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="col-md-6">
        <label className="form-label" htmlFor="ai-image-gcp-project-id">GCP project ID</label>
        <input
          id="ai-image-gcp-project-id"
          className="form-control"
          value={String((config.provider_config as AiLooseObject).gcp_project_id || '')}
          onChange={(e) =>
            setConfig((c: any) => ({
              ...c,
              provider_config: { ...(c.provider_config || {}), gcp_project_id: e.target.value },
            }))
          }
          disabled={busy}
          placeholder="my-project-id"
        />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor="ai-image-gcp-region">GCP region</label>
        <input
          id="ai-image-gcp-region"
          className="form-control"
          value={String((config.provider_config as AiLooseObject).gcp_region || '')}
          onChange={(e) =>
            setConfig((c: any) => ({
              ...c,
              provider_config: { ...(c.provider_config || {}), gcp_region: e.target.value },
            }))
          }
          disabled={busy}
          placeholder="us-central1"
        />
      </div>

      <div className="col-12">
        <label className="form-label" htmlFor="ai-image-provider-service-account">
          Service Account JSON
          {providerHas.service_account_json ? ' (saved)' : ' (not set)'}
        </label>
        <textarea
          id="ai-image-provider-service-account"
          className="form-control"
          rows={6}
          value={String(providerSecrets.service_account_json || '')}
          onChange={(e) =>
            setSecretsByProvider((all: any) => ({
              ...(all || {}),
              [providerKey]: { ...((all || {})[providerKey] || {}), service_account_json: e.target.value },
            }))
          }
          disabled={busy}
          spellCheck={false}
        />
      </div>

      <div className="col-12">
        <div className="border rounded p-3">
          <div className="d-flex justify-content-between align-items-end gap-2 mb-2">
            <div className="fw-semibold">Location Reference</div>
            <div className="d-flex align-items-center gap-2">
              {lastAiImageLocationRefTest ? (
                <div className="text-muted small">Last result: {lastAiImageLocationRefTest}</div>
              ) : null}
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={testAiImageLocationReference} disabled={busy}>
                Test provider
              </button>
            </div>
          </div>
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label" htmlFor="ai-image-location-reference-model">Location reference model</label>
              <input
                id="ai-image-location-reference-model"
                className="form-control"
                value={String((config.provider_config as AiLooseObject).location_reference_model || '')}
                onChange={(e) =>
                  setConfig((c: any) => ({
                    ...c,
                    provider_config: { ...(c.provider_config || {}), location_reference_model: e.target.value },
                  }))
                }
                disabled={busy}
                placeholder="imagen-3.0-capability-001"
              />
              <div className="form-text">Used when transforming a real location photo into a noir crime scene via Imagen edit (REFERENCE_TYPE_RAW).</div>
            </div>

            <div className="col-md-6">
              <label className="form-label" htmlFor="ai-image-google-places-key">Google Places API key {Number(providerHas.google_places_api_key || 0) ? '(saved)' : '(not set)'}</label>
              <input
                id="ai-image-google-places-key"
                className="form-control"
                value={String(providerSecrets.google_places_api_key || '')}
                onChange={(e) => setSecretsByProvider((all: any) => ({
                  ...(all || {}),
                  [providerKey]: { ...(all?.[providerKey] || {}), google_places_api_key: e.target.value },
                }))}
                disabled={busy}
                placeholder={Number(providerHas.google_places_api_key || 0) ? 'Enter to replace existing key' : 'Enter API key'}
                autoComplete="off"
              />
              <div className="form-text">Used server-side to retrieve a real reference photo for location-based image generation.</div>
            </div>

            <div className="col-md-6">
              <label className="form-label" htmlFor="ai-image-google-streetview-key">Google Street View API key {Number(providerHas.google_street_view_api_key || 0) ? '(saved)' : '(not set)'}</label>
              <input
                id="ai-image-google-streetview-key"
                className="form-control"
                value={String(providerSecrets.google_street_view_api_key || '')}
                onChange={(e) => setSecretsByProvider((all: any) => ({
                  ...(all || {}),
                  [providerKey]: { ...(all?.[providerKey] || {}), google_street_view_api_key: e.target.value },
                }))}
                disabled={busy}
                placeholder={Number(providerHas.google_street_view_api_key || 0) ? 'Enter to replace existing key' : 'Enter API key'}
                autoComplete="off"
              />
              <div className="form-text">Optional fallback if Places photos are unavailable.</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
