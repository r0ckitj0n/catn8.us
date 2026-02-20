import React from 'react';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { ApiClient } from '../../core/ApiClient';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import { CustomCssSettings } from '../../types/uiStandards';
import { DEFAULT_CUSTOM_CSS_SETTINGS } from '../../data/standardizedIcons';
import { applyCustomCssSettings, applyGlobalUiSettings, notifyUiStandardsChanged, sanitizeCustomCssSettings } from '../../core/uiStandards';

interface SiteAppearanceModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
  page: string;
}

type AppearanceTokens = {
  brand_primary: string;
  brand_secondary: string;
  action_fg: string;
};

export function SiteAppearanceModal({ open, onClose, onToast, page }: SiteAppearanceModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [tokens, setTokens] = React.useState<AppearanceTokens>({ brand_primary: '#9b59b6', brand_secondary: '#2ecc71', action_fg: '#ffffff' });
  const [cssSettings, setCssSettings] = React.useState<CustomCssSettings>(DEFAULT_CUSTOM_CSS_SETTINGS);
  const cleanSnapshotRef = React.useRef('');

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  React.useEffect(() => {
    if (!open) return;
    setBusy(true);
    setError('');
    setMessage('');
    ApiClient.get('/api/settings/appearance.php')
      .then((res) => {
        const t = res?.tokens || {};
        const nextTokens = {
          brand_primary: String(t.brand_primary || '#9b59b6'),
          brand_secondary: String(t.brand_secondary || '#2ecc71'),
          action_fg: String(t.action_fg || '#ffffff'),
        };
        const nextCssSettings = sanitizeCustomCssSettings(t);
        setTokens(nextTokens);
        setCssSettings(nextCssSettings);
        cleanSnapshotRef.current = JSON.stringify({ nextTokens, nextCssSettings });
      })
      .catch((e) => setError(e?.message || 'Failed to load appearance settings'))
      .finally(() => setBusy(false));
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    applyCustomCssSettings(cssSettings, page);
  }, [open, cssSettings, page]);

  React.useEffect(() => {
    if (open) return;
    try {
      const parsed = JSON.parse(String(cleanSnapshotRef.current || '{}'));
      const baseline = sanitizeCustomCssSettings(parsed?.nextCssSettings || {});
      applyCustomCssSettings(baseline, page);
    } catch (_err) {
      applyGlobalUiSettings(page);
    }
  }, [open, page]);

  React.useEffect(() => {
    if (!error) return;
    if (typeof onToast === 'function') onToast({ tone: 'error', message: String(error) });
    setError('');
  }, [error, onToast]);

  React.useEffect(() => {
    if (!message) return;
    if (typeof onToast === 'function') onToast({ tone: 'success', message: String(message) });
    setMessage('');
  }, [message, onToast]);

  const isDirty = React.useMemo(() => {
    return String(cleanSnapshotRef.current || '') !== JSON.stringify({ nextTokens: tokens, nextCssSettings: cssSettings });
  }, [tokens, cssSettings]);

  const saveSvg = (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4.5a1 1 0 0 0-.293-.707l-2.5-2.5A1 1 0 0 0 11.5 1H2zm1 1h8v4H3V2zm0 6h10v6H3V8zm2 1v4h6V9H5z"
      />
    </svg>
  );

  const save = async (e: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await ApiClient.post('/api/settings/appearance.php', {
        ...tokens,
        ...cssSettings,
      });
      notifyUiStandardsChanged();
      applyCustomCssSettings(cssSettings, page);
      setMessage('Saved. Refresh the page if you don\'t see changes immediately.');
      cleanSnapshotRef.current = JSON.stringify({ nextTokens: tokens, nextCssSettings: cssSettings });
    } catch (err: any) {
      setError(err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const resetDefaults = async () => {
    const nextCssSettings = { ...DEFAULT_CUSTOM_CSS_SETTINGS };
    setCssSettings(nextCssSettings);
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await ApiClient.post('/api/settings/appearance.php', {
        ...tokens,
        ...nextCssSettings,
      });
      notifyUiStandardsChanged();
      applyCustomCssSettings(nextCssSettings, page);
      cleanSnapshotRef.current = JSON.stringify({ nextTokens: tokens, nextCssSettings });
      setMessage('Global style settings reset to defaults.');
    } catch (err: any) {
      setError(err?.message || 'Reset failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Site Appearance</h5>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className={'btn btn-sm btn-primary catn8-dirty-save' + (isDirty ? ' catn8-dirty-save--visible' : '')}
                onClick={save}
                disabled={busy || !isDirty}
                aria-label="Save"
                title={isDirty ? 'Save changes' : 'No changes to save'}
              >
                {saveSvg}
                <span className="ms-1">Save</span>
              </button>
              <ModalCloseIconButton />
            </div>
          </div>
          <div className="modal-body">
            <form onSubmit={save}>
              <div className="mb-3">
                <label className="form-label" htmlFor="appearance-brand-primary">Primary brand color</label>
                <input
                  className="form-control form-control-color"
                  type="color"
                  id="appearance-brand-primary"
                  value={tokens.brand_primary}
                  onChange={(e) => setTokens((t) => ({ ...t, brand_primary: e.target.value }))}
                  disabled={busy}
                />
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="appearance-brand-secondary">Secondary brand color</label>
                <input
                  className="form-control form-control-color"
                  type="color"
                  id="appearance-brand-secondary"
                  value={tokens.brand_secondary}
                  onChange={(e) => setTokens((t) => ({ ...t, brand_secondary: e.target.value }))}
                  disabled={busy}
                />
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="appearance-action-fg">Button text color</label>
                <input
                  className="form-control form-control-color"
                  type="color"
                  id="appearance-action-fg"
                  value={tokens.action_fg}
                  onChange={(e) => setTokens((t) => ({ ...t, action_fg: e.target.value }))}
                  disabled={busy}
                />
              </div>

              <div className="d-flex gap-2 mb-3">
                <button type="button" className="btn btn-primary" disabled>
                  Primary button
                </button>
                <button type="button" className="btn btn-secondary" disabled>
                  Secondary button
                </button>
              </div>

              <hr />
              <p className="text-muted mb-3">Global style controls (all pages except Mystery).</p>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="css-button-radius">Button radius ({cssSettings.button_radius_px}px)</label>
                  <input id="css-button-radius" className="form-range" type="range" min={6} max={24} step={1} value={cssSettings.button_radius_px} onChange={(e) => setCssSettings((prev) => ({ ...prev, button_radius_px: Number(e.target.value) }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="css-panel-radius">Panel radius ({cssSettings.panel_radius_px}px)</label>
                  <input id="css-panel-radius" className="form-range" type="range" min={8} max={28} step={1} value={cssSettings.panel_radius_px} onChange={(e) => setCssSettings((prev) => ({ ...prev, panel_radius_px: Number(e.target.value) }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="css-hover-lift">Hover lift ({cssSettings.hover_lift_px}px)</label>
                  <input id="css-hover-lift" className="form-range" type="range" min={0} max={10} step={1} value={cssSettings.hover_lift_px} onChange={(e) => setCssSettings((prev) => ({ ...prev, hover_lift_px: Number(e.target.value) }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="css-hover-scale">Hover scale ({cssSettings.hover_scale_pct}%)</label>
                  <input id="css-hover-scale" className="form-range" type="range" min={100} max={106} step={1} value={cssSettings.hover_scale_pct} onChange={(e) => setCssSettings((prev) => ({ ...prev, hover_scale_pct: Number(e.target.value) }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="css-surface-alpha">Surface alpha ({cssSettings.surface_alpha_pct}%)</label>
                  <input id="css-surface-alpha" className="form-range" type="range" min={86} max={100} step={1} value={cssSettings.surface_alpha_pct} onChange={(e) => setCssSettings((prev) => ({ ...prev, surface_alpha_pct: Number(e.target.value) }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="css-surface-blur">Surface blur ({cssSettings.surface_blur_px}px)</label>
                  <input id="css-surface-blur" className="form-range" type="range" min={0} max={18} step={1} value={cssSettings.surface_blur_px} onChange={(e) => setCssSettings((prev) => ({ ...prev, surface_blur_px: Number(e.target.value) }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="css-transition-ms">Motion speed ({cssSettings.transition_ms}ms)</label>
                  <input id="css-transition-ms" className="form-range" type="range" min={100} max={360} step={10} value={cssSettings.transition_ms} onChange={(e) => setCssSettings((prev) => ({ ...prev, transition_ms: Number(e.target.value) }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="css-focus-ring">Focus ring color</label>
                  <input id="css-focus-ring" className="form-control form-control-color" type="color" value={cssSettings.focus_ring_color} onChange={(e) => setCssSettings((prev) => ({ ...prev, focus_ring_color: e.target.value }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="css-icon-button-size">Icon button size ({cssSettings.icon_button_size_px}px)</label>
                  <input id="css-icon-button-size" className="form-range" type="range" min={28} max={44} step={1} value={cssSettings.icon_button_size_px} onChange={(e) => setCssSettings((prev) => ({ ...prev, icon_button_size_px: Number(e.target.value) }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="css-content-max-width">Content width ({cssSettings.content_max_width_px}px)</label>
                  <input id="css-content-max-width" className="form-range" type="range" min={960} max={1920} step={20} value={cssSettings.content_max_width_px} onChange={(e) => setCssSettings((prev) => ({ ...prev, content_max_width_px: Number(e.target.value) }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="css-base-font-size">Base font size ({cssSettings.base_font_size_px}px)</label>
                  <input id="css-base-font-size" className="form-range" type="range" min={14} max={20} step={1} value={cssSettings.base_font_size_px} onChange={(e) => setCssSettings((prev) => ({ ...prev, base_font_size_px: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="d-flex justify-content-end mt-3">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void resetDefaults()} disabled={busy}>Reset style defaults</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
