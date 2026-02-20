import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import { StandardizedIconSetting } from '../../types/uiStandards';
import { StandardIcon } from '../common/StandardIcon';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import {
  loadStandardizedIconSettings,
  saveStandardizedIconSettings,
  notifyUiStandardsChanged,
} from '../../core/uiStandards';
import { DEFAULT_STANDARDIZED_ICON_SETTINGS } from '../../data/standardizedIcons';

interface StandardizedIconsModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
}

export function StandardizedIconsModal({ open, onClose, onToast }: StandardizedIconsModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [icons, setIcons] = React.useState<StandardizedIconSetting[]>(() => loadStandardizedIconSettings());
  const cleanSnapshotRef = React.useRef('');

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  React.useEffect(() => {
    if (!open) return;
    const loaded = loadStandardizedIconSettings();
    setIcons(loaded);
    cleanSnapshotRef.current = JSON.stringify(loaded);
  }, [open]);

  const isDirty = React.useMemo(() => JSON.stringify(icons) !== cleanSnapshotRef.current, [icons]);

  const onSave = () => {
    saveStandardizedIconSettings(icons);
    notifyUiStandardsChanged();
    cleanSnapshotRef.current = JSON.stringify(icons);
    onToast?.({ tone: 'success', message: 'Standardized icon list saved.' });
  };

  const onReset = () => {
    setIcons(DEFAULT_STANDARDIZED_ICON_SETTINGS);
  };

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Standardized Icons</h5>
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
            <p className="text-muted mb-3">Manage the shared icon catalog used by catn8.us controls (excluding Mystery).</p>
            <div className="d-flex justify-content-end mb-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onReset}>Reset Defaults</button>
            </div>
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Icon</th>
                    <th>Key</th>
                    <th>Label</th>
                    <th>Keywords</th>
                    <th>Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {icons.map((icon, index) => (
                    <tr key={icon.key}>
                      <td>
                        <span className="catn8-icon-library-preview" title={icon.label}>
                          <StandardIcon iconKey={icon.key} className="catn8-icon-library-glyph" />
                        </span>
                      </td>
                      <td><code>{icon.key}</code></td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={icon.label}
                          onChange={(e) => {
                            const next = [...icons];
                            next[index] = { ...next[index], label: e.target.value };
                            setIcons(next);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={icon.keywords.join(', ')}
                          onChange={(e) => {
                            const keywords = e.target.value.split(',').map((keyword) => keyword.trim()).filter(Boolean);
                            const next = [...icons];
                            next[index] = { ...next[index], keywords };
                            setIcons(next);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={icon.enabled}
                          onChange={(e) => {
                            const next = [...icons];
                            next[index] = { ...next[index], enabled: e.target.checked };
                            setIcons(next);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
