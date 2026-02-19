import React from 'react';
import { AiLooseObject } from '../../../types/common';
import { aiImageDefaultParams } from '../../../utils/aiImageUtils';

interface AIImageParamsSectionProps {
  config: any;
  setConfig: React.Dispatch<React.SetStateAction<any>>;
  paramOptions: any;
  providerKey: string;
  busy: boolean;
}

export function AIImageParamsSection({ config, setConfig, paramOptions, providerKey, busy }: AIImageParamsSectionProps) {
  return (
    <div className="border rounded p-3 mb-3">
      <div className="fw-semibold mb-2">Image Parameters</div>
      <div className="row g-3">
        <div className="col-12">
          <label className="form-label" htmlFor="ai-image-param-preset">Image Preset</label>
          <select
            id="ai-image-param-preset"
            className="form-select"
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              const next =
                v === 'standard'
                  ? aiImageDefaultParams(config.provider, config.model)
                  : v === 'hq'
                    ? { ...aiImageDefaultParams(config.provider, config.model), quality: providerKey === 'openai' ? 'hd' : 'high' }
                    : v === 'wide'
                      ? { ...aiImageDefaultParams(config.provider, config.model), size: '1536x1024', aspect_ratio: '16:9' }
                      : { ...aiImageDefaultParams(config.provider, config.model), size: '1024x1536', aspect_ratio: '9:16' };
              setConfig((c: any) => ({ ...c, params: { ...(c.params || {}), ...next } }));
            }}
            disabled={busy}
          >
            <option value="">Select a preset…</option>
            <option value="standard">Standard</option>
            <option value="hq">High quality</option>
            <option value="wide">Wide</option>
            <option value="tall">Tall</option>
          </select>
        </div>

        {paramOptions.size ? (
          <div className="col-md-4">
            <label className="form-label" htmlFor="ai-image-param-size">Size</label>
            <select
              id="ai-image-param-size"
              className="form-select"
              value={String((config.params as AiLooseObject).size || '')}
              onChange={(e) => setConfig((c: any) => ({ ...c, params: { ...(c.params || {}), size: e.target.value } }))}
              disabled={busy}
            >
              {paramOptions.size.map((v: string) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        ) : null}

        {paramOptions.aspect_ratio ? (
          <div className="col-md-4">
            <label className="form-label" htmlFor="ai-image-param-aspect">Aspect Ratio</label>
            <select
              id="ai-image-param-aspect"
              className="form-select"
              value={String((config.params as AiLooseObject).aspect_ratio || '')}
              onChange={(e) => setConfig((c: any) => ({ ...c, params: { ...(c.params || {}), aspect_ratio: e.target.value } }))}
              disabled={busy}
            >
              {paramOptions.aspect_ratio.map((v: string) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="col-md-4">
          <label className="form-label" htmlFor="ai-image-param-quality">Quality</label>
          <select
            id="ai-image-param-quality"
            className="form-select"
            value={String((config.params as AiLooseObject).quality || '')}
            onChange={(e) => setConfig((c: any) => ({ ...c, params: { ...(c.params || {}), quality: e.target.value } }))}
            disabled={busy}
          >
            {paramOptions.quality.map((v: string) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <div className="col-md-4">
          <label className="form-label" htmlFor="ai-image-param-style">Style</label>
          <select
            id="ai-image-param-style"
            className="form-select"
            value={String((config.params as AiLooseObject).style || '')}
            onChange={(e) => setConfig((c: any) => ({ ...c, params: { ...(c.params || {}), style: e.target.value } }))}
            disabled={busy}
          >
            {paramOptions.style.map((v: string) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <div className="col-md-4">
          <label className="form-label" htmlFor="ai-image-param-n">Images</label>
          <select
            id="ai-image-param-n"
            className="form-select"
            value={String((config.params as AiLooseObject).n ?? 1)}
            onChange={(e) => setConfig((c: any) => ({ ...c, params: { ...(c.params || {}), n: Number(e.target.value) } }))}
            disabled={busy}
          >
            {paramOptions.n.map((v: number) => (
              <option key={v} value={String(v)}>{String(v)}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
