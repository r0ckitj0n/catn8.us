import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import { CustomCssSettings } from '../../types/uiStandards';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import {
  loadCustomCssSettings,
  saveCustomCssSettings,
  notifyUiStandardsChanged,
  applyCustomCssSettings,
  applyGlobalUiSettings,
} from '../../core/uiStandards';
import { DEFAULT_CUSTOM_CSS_SETTINGS } from '../../data/standardizedIcons';

interface CustomCssSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
  page: string;
}

export function CustomCssSettingsModal({ open, onClose, onToast, page }: CustomCssSettingsModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [settings, setSettings] = React.useState<CustomCssSettings>(() => loadCustomCssSettings());
  const cleanSnapshotRef = React.useRef('');

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  React.useEffect(() => {
    if (!open) return;
    const loaded = loadCustomCssSettings();
    setSettings(loaded);
    cleanSnapshotRef.current = JSON.stringify(loaded);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    applyCustomCssSettings(settings, page);
  }, [settings, open, page]);

  React.useEffect(() => {
    if (open) return;
    applyGlobalUiSettings(page);
  }, [open, page]);

  const isDirty = React.useMemo(() => JSON.stringify(settings) !== cleanSnapshotRef.current, [settings]);

  const onSave = () => {
    saveCustomCssSettings(settings);
    notifyUiStandardsChanged();
    applyCustomCssSettings(settings, page);
    cleanSnapshotRef.current = JSON.stringify(settings);
    onToast?.({ tone: 'success', message: 'Custom CSS settings saved.' });
  };

  const onReset = () => {
    setSettings(DEFAULT_CUSTOM_CSS_SETTINGS);
    saveCustomCssSettings(DEFAULT_CUSTOM_CSS_SETTINGS);
    notifyUiStandardsChanged();
    applyCustomCssSettings(DEFAULT_CUSTOM_CSS_SETTINGS, page);
    onToast?.({ tone: 'info', message: 'Custom CSS settings reset to defaults.' });
  };

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Custom CSS Settings</h5>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className={'btn btn-sm btn-primary catn8-dirty-save' + (isDirty ? ' catn8-dirty-save--visible' : '')}
                onClick={onSave}
                disabled={!isDirty}
              >
                Save
              </button>
              <ModalCloseIconButton />
            </div>
          </div>
          <div className="modal-body">
            <p className="text-muted mb-3">Global styling controls for all catn8.us pages except Mystery.</p>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="css-button-radius">Button radius ({settings.button_radius_px}px)</label>
                <input id="css-button-radius" className="form-range" type="range" min={6} max={22} step={1} value={settings.button_radius_px} onChange={(e) => setSettings((prev) => ({ ...prev, button_radius_px: Number(e.target.value) }))} />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="css-panel-radius">Panel radius ({settings.panel_radius_px}px)</label>
                <input id="css-panel-radius" className="form-range" type="range" min={8} max={28} step={1} value={settings.panel_radius_px} onChange={(e) => setSettings((prev) => ({ ...prev, panel_radius_px: Number(e.target.value) }))} />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="css-hover-lift">Hover lift ({settings.hover_lift_px}px)</label>
                <input id="css-hover-lift" className="form-range" type="range" min={0} max={8} step={1} value={settings.hover_lift_px} onChange={(e) => setSettings((prev) => ({ ...prev, hover_lift_px: Number(e.target.value) }))} />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="css-hover-scale">Hover scale ({settings.hover_scale_pct}%)</label>
                <input id="css-hover-scale" className="form-range" type="range" min={100} max={106} step={1} value={settings.hover_scale_pct} onChange={(e) => setSettings((prev) => ({ ...prev, hover_scale_pct: Number(e.target.value) }))} />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="css-surface-alpha">Surface alpha ({settings.surface_alpha_pct}%)</label>
                <input id="css-surface-alpha" className="form-range" type="range" min={88} max={100} step={1} value={settings.surface_alpha_pct} onChange={(e) => setSettings((prev) => ({ ...prev, surface_alpha_pct: Number(e.target.value) }))} />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="css-surface-blur">Surface blur ({settings.surface_blur_px}px)</label>
                <input id="css-surface-blur" className="form-range" type="range" min={0} max={16} step={1} value={settings.surface_blur_px} onChange={(e) => setSettings((prev) => ({ ...prev, surface_blur_px: Number(e.target.value) }))} />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="css-transition-ms">Motion speed ({settings.transition_ms}ms)</label>
                <input id="css-transition-ms" className="form-range" type="range" min={100} max={320} step={10} value={settings.transition_ms} onChange={(e) => setSettings((prev) => ({ ...prev, transition_ms: Number(e.target.value) }))} />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="css-focus-ring">Focus ring color</label>
                <input id="css-focus-ring" className="form-control form-control-color" type="color" value={settings.focus_ring_color} onChange={(e) => setSettings((prev) => ({ ...prev, focus_ring_color: e.target.value }))} />
              </div>
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onReset}>Reset Defaults</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
