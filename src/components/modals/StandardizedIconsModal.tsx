import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import { EmojiAssetChoice, StandardizedIconSetting, StandardizedIconSettingsResponse } from '../../types/uiStandards';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { WebpImage } from '../common/WebpImage';
import { DEFAULT_STANDARDIZED_ICON_SETTINGS, EMOJI_ASSET_CATALOG } from '../../data/standardizedIcons';
import { ApiClient } from '../../core/ApiClient';
import {
  notifyUiStandardsChanged,
  replaceStandardizedIconSettings,
} from '../../core/uiStandards';

interface StandardizedIconsModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
}

export function StandardizedIconsModal({ open, onClose, onToast }: StandardizedIconsModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [icons, setIcons] = React.useState<StandardizedIconSetting[]>([]);
  const [emojiCatalog, setEmojiCatalog] = React.useState<EmojiAssetChoice[]>(EMOJI_ASSET_CATALOG);
  const [busy, setBusy] = React.useState(false);
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
    ApiClient.get<StandardizedIconSettingsResponse>('/api/settings/icon_buttons.php')
      .then((res) => {
        const loadedIcons = Array.isArray(res?.settings) ? res.settings : DEFAULT_STANDARDIZED_ICON_SETTINGS;
        const loadedCatalog = Array.isArray(res?.emoji_catalog) && res.emoji_catalog.length ? res.emoji_catalog : EMOJI_ASSET_CATALOG;
        setIcons(loadedIcons);
        setEmojiCatalog(loadedCatalog);
        cleanSnapshotRef.current = JSON.stringify(loadedIcons);
      })
      .catch((error) => {
        onToast?.({ tone: 'error', message: String(error?.message || 'Failed to load icon button settings') });
      })
      .finally(() => setBusy(false));
  }, [onToast, open]);

  const isDirty = React.useMemo(() => JSON.stringify(icons) !== cleanSnapshotRef.current, [icons]);

  const onSave = async () => {
    setBusy(true);
    try {
      const res = await ApiClient.post<StandardizedIconSettingsResponse>('/api/settings/icon_buttons.php', {
        settings: icons,
      });
      const saved = Array.isArray(res?.settings) ? res.settings : icons;
      setIcons(saved);
      replaceStandardizedIconSettings(saved);
      notifyUiStandardsChanged();
      cleanSnapshotRef.current = JSON.stringify(saved);
      onToast?.({ tone: 'success', message: 'Icon button settings saved.' });
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'Failed to save icon button settings') });
    } finally {
      setBusy(false);
    }
  };

  const onReset = () => {
    setIcons(DEFAULT_STANDARDIZED_ICON_SETTINGS);
  };

  const onFieldChange = (index: number, patch: Partial<StandardizedIconSetting>) => {
    setIcons((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Icon Buttons</h5>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className={'btn btn-sm btn-primary catn8-dirty-save' + (isDirty ? ' catn8-dirty-save--visible' : '')}
                onClick={onSave}
                disabled={!isDirty || busy}
              >
                Save
              </button>
              <ModalCloseIconButton />
            </div>
          </div>
          <div className="modal-body">
            <p className="text-muted mb-3">
              Manage the emoji asset used for each shared icon button on catn8.us. Source graphics are Twemoji raster assets with WebP preferred and PNG fallback.
            </p>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <a href="/dist/emojis/twemoji/LICENSE-GRAPHICS.txt" target="_blank" rel="noreferrer">Twemoji graphics license</a>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onReset} disabled={busy}>
                Reset Defaults
              </button>
            </div>
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Preview</th>
                    <th>Key</th>
                    <th>Label</th>
                    <th>Emoji Asset</th>
                    <th>Keywords</th>
                  </tr>
                </thead>
                <tbody>
                  {icons.map((icon, index) => (
                    <tr key={icon.key}>
                      <td>
                        <span className="catn8-icon-library-preview" title={`${icon.label} ${icon.emoji}`}>
                          <WebpImage src={icon.asset_path} alt="" className="catn8-icon-library-glyph" />
                        </span>
                      </td>
                      <td><code>{icon.key}</code></td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={icon.label}
                          onChange={(e) => onFieldChange(index, { label: e.target.value })}
                          disabled={busy}
                        />
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={icon.codepoint}
                          onChange={(e) => {
                            const nextAsset = emojiCatalog.find((item) => item.codepoint === e.target.value);
                            if (!nextAsset) return;
                            onFieldChange(index, {
                              emoji: nextAsset.emoji,
                              codepoint: nextAsset.codepoint,
                              asset_path: nextAsset.asset_path,
                              source_name: 'Twemoji',
                            });
                          }}
                          disabled={busy}
                        >
                          {emojiCatalog.map((asset) => (
                            <option key={asset.id} value={asset.codepoint}>
                              {asset.emoji} {asset.label}
                            </option>
                          ))}
                        </select>
                        <div className="small text-muted mt-1">{icon.asset_path}</div>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={icon.keywords.join(', ')}
                          onChange={(e) => {
                            const keywords = e.target.value
                              .split(',')
                              .map((keyword) => keyword.trim())
                              .filter(Boolean);
                            onFieldChange(index, { keywords });
                          }}
                          disabled={busy}
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
