import React from 'react';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import {
  buildWizardTokenLabel,
  DEFAULT_BUILD_WIZARD_DROPDOWN_SETTINGS,
  fetchBuildWizardDropdownSettings,
  saveBuildWizardDropdownSettings,
} from '../../core/buildWizardDropdownSettings';
import { IBuildWizardDropdownSettings } from '../../types/buildWizardDropdowns';
import { IToast } from '../../types/common';

interface BuildWizardDropdownManagerModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
}

function normalizeManualToken(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');
}

export function BuildWizardDropdownManagerModal({
  open,
  onClose,
  onToast,
}: BuildWizardDropdownManagerModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [busy, setBusy] = React.useState(false);
  const [settings, setSettings] = React.useState<IBuildWizardDropdownSettings>(DEFAULT_BUILD_WIZARD_DROPDOWN_SETTINGS);
  const [drafts, setDrafts] = React.useState<Record<'document_kinds' | 'permit_statuses' | 'purchase_units', string>>({
    document_kinds: '',
    permit_statuses: '',
    purchase_units: '',
  });

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setBusy(true);
    void fetchBuildWizardDropdownSettings()
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        setSettings(loaded);
      })
      .catch((err: any) => {
        if (cancelled) {
          return;
        }
        onToast?.({ tone: 'error', message: err?.message || 'Failed to load Build Wizard dropdown settings' });
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, onToast]);

  const updateListItem = React.useCallback((key: keyof IBuildWizardDropdownSettings, index: number, nextValue: string) => {
    const token = normalizeManualToken(nextValue);
    setSettings((prev) => {
      const list = [...prev[key]];
      if (index < 0 || index >= list.length) {
        return prev;
      }
      list[index] = token;
      return {
        ...prev,
        [key]: list,
      };
    });
  }, []);

  const removeListItem = React.useCallback((key: keyof IBuildWizardDropdownSettings, index: number) => {
    setSettings((prev) => {
      const list = prev[key].filter((_, i) => i !== index);
      return {
        ...prev,
        [key]: list,
      };
    });
  }, []);

  const addListItem = React.useCallback((key: keyof IBuildWizardDropdownSettings) => {
    const token = normalizeManualToken(drafts[key]);
    if (!token) {
      onToast?.({ tone: 'warning', message: 'Enter a value to add.' });
      return;
    }

    setSettings((prev) => {
      if (prev[key].includes(token)) {
        onToast?.({ tone: 'info', message: 'That option already exists.' });
        return prev;
      }
      return {
        ...prev,
        [key]: [...prev[key], token],
      };
    });

    setDrafts((prev) => ({ ...prev, [key]: '' }));
  }, [drafts, onToast]);

  const save = React.useCallback(async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const saved = await saveBuildWizardDropdownSettings(settings);
      setSettings(saved);
      onToast?.({ tone: 'success', message: 'Build Wizard dropdown settings saved.' });
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to save Build Wizard dropdown settings' });
    } finally {
      setBusy(false);
    }
  }, [busy, settings, onToast]);

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Dropdown Manager</h5>
            <ModalCloseIconButton />
          </div>
          <div className="modal-body">
            <p className="text-muted mb-3">Manage Build Wizard static dropdown options. Values are stored as lowercase tokens.</p>

            {([
              { key: 'document_kinds', title: 'Document Kind options', emptyLabel: 'Select kind' },
              { key: 'permit_statuses', title: 'Permit Status options', emptyLabel: 'Select status' },
              { key: 'purchase_units', title: 'Purchase Unit options', emptyLabel: 'Select unit' },
            ] as const).map((section) => (
              <div className="catn8-card p-2 mb-3" key={section.key}>
                <div className="fw-bold mb-2">{section.title}</div>
                <div className="d-flex flex-column gap-2">
                  {settings[section.key].map((value, index) => {
                    if (value === '') {
                      return null;
                    }
                    return (
                      <div className="d-flex gap-2" key={`${section.key}-${index}`}>
                        <input
                          className="form-control"
                          value={value}
                          onChange={(e) => updateListItem(section.key, index, e.target.value)}
                          disabled={busy}
                        />
                        <button
                          type="button"
                          className="btn btn-outline-danger"
                          onClick={() => removeListItem(section.key, index)}
                          disabled={busy}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="small text-muted mt-2">Display preview: {settings[section.key].filter(Boolean).map((v) => buildWizardTokenLabel(v, section.emptyLabel)).join(', ') || '(none)'}</div>
                <div className="d-flex gap-2 mt-2">
                  <input
                    className="form-control"
                    value={drafts[section.key]}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [section.key]: e.target.value }))}
                    placeholder="new_option"
                    disabled={busy}
                  />
                  <button type="button" className="btn btn-outline-primary" onClick={() => addListItem(section.key)} disabled={busy}>
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="modal-footer d-flex justify-content-between">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setSettings(DEFAULT_BUILD_WIZARD_DROPDOWN_SETTINGS)}
              disabled={busy}
            >
              Reset to Defaults
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving...' : 'Save Dropdowns'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
