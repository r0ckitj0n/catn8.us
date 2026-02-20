import React from 'react';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast, IViewer } from '../../types/common';
import { useAIConfig } from './hooks/useAIConfig';
import { useAIImageConfig } from './hooks/useAIImageConfig';
import { useAIVoiceCommunication } from './hooks/useAIVoiceCommunication';
import { GeneralAIProviderSection } from './sections/GeneralAIProviderSection';
import { GeneralAISettingsSection } from './sections/GeneralAISettingsSection';
import { GeneralAISecretsSection } from './sections/GeneralAISecretsSection';
import { AIImageParamsSection } from './sections/AIImageParamsSection';
import { AIImageProviderSection } from './sections/AIImageProviderSection';
import { AIImageSecretsSection } from './sections/AIImageSecretsSection';
import { GcpServiceAccountSection } from './sections/GcpServiceAccountSection';
import { GeminiLiveStudioSection } from './sections/GeminiLiveStudioSection';
import { TtsDefaultsSection } from './sections/TtsDefaultsSection';

export type AIConfigurationTab = 'general' | 'voice' | 'image';

interface AIConfigurationModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
  viewer?: IViewer | null;
  initialTab?: AIConfigurationTab;
}

const saveSvg = (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4.5a1 1 0 0 0-.293-.707l-2.5-2.5A1 1 0 0 0 11.5 1H2zm1 1h8v4H3V2zm0 6h10v6H3V8zm2 1v4h6V9H5z"
    />
  </svg>
);

export function AIConfigurationModal({ open, onClose, onToast, initialTab = 'general' }: AIConfigurationModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [tab, setTab] = React.useState<AIConfigurationTab>(initialTab);

  const generalState = useAIConfig(open, onToast);
  const imageState = useAIImageConfig(open, onToast);
  const voiceState = useAIVoiceCommunication(open, onToast);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  React.useEffect(() => {
    if (!open) return;
    setTab(initialTab);
  }, [open, initialTab]);

  const activeBusy = tab === 'general' ? generalState.busy : tab === 'voice' ? voiceState.busy : imageState.busy;
  const activeDirty = tab === 'general' ? generalState.isDirty : tab === 'voice' ? voiceState.isDirty : imageState.isDirty;

  const handleSave = React.useCallback(async () => {
    if (tab === 'general') {
      await generalState.save();
      return;
    }
    if (tab === 'voice') {
      await voiceState.save();
      return;
    }
    await imageState.save();
  }, [tab, generalState, voiceState, imageState]);

  return (
    <div className="modal fade catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">AI Configuration</h5>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className={'btn btn-sm btn-primary catn8-dirty-save' + (activeDirty ? ' catn8-dirty-save--visible' : '')}
                onClick={() => void handleSave()}
                disabled={activeBusy || !activeDirty}
                aria-label="Save"
                title={activeDirty ? 'Save changes' : 'No changes to save'}
              >
                {saveSvg}
                <span className="ms-1">Save</span>
              </button>
              <ModalCloseIconButton />
            </div>
          </div>

          <div className="modal-body">
            <ul className="nav nav-tabs mb-3" role="tablist">
              <li className="nav-item" role="presentation">
                <button type="button" className={`nav-link${tab === 'general' ? ' active' : ''}`} onClick={() => setTab('general')}>
                  General
                </button>
              </li>
              <li className="nav-item" role="presentation">
                <button type="button" className={`nav-link${tab === 'voice' ? ' active' : ''}`} onClick={() => setTab('voice')}>
                  Voice
                </button>
              </li>
              <li className="nav-item" role="presentation">
                <button type="button" className={`nav-link${tab === 'image' ? ' active' : ''}`} onClick={() => setTab('image')}>
                  Image
                </button>
              </li>
            </ul>

            {tab === 'general' ? (
              <form onSubmit={(e) => { e.preventDefault(); void generalState.save(); }}>
                <datalist id="ai-location-options">
                  <option value="global" />
                  <option value="us-central1" />
                  <option value="us-east1" />
                  <option value="us-west1" />
                  <option value="europe-west4" />
                </datalist>

                <GeneralAIProviderSection
                  config={generalState.config}
                  setConfig={generalState.setConfig}
                  modelChoices={generalState.modelChoices}
                  providerKey={generalState.providerKey}
                  busy={generalState.busy}
                  refreshModelChoices={generalState.refreshModelChoices}
                  isRefreshingModels={generalState.isRefreshingModels}
                  modelChoicesSource={generalState.modelChoicesSource}
                />

                <div className="border rounded p-3 mb-3">
                  <GeneralAISettingsSection
                    temperature={generalState.config.temperature}
                    setTemperature={(v) => generalState.setConfig(prev => ({ ...prev, temperature: v }))}
                    busy={generalState.busy}
                    lastAiProviderTest={generalState.lastAiProviderTest}
                    testAiProvider={generalState.testAiProvider}
                  />

                  <GeneralAISecretsSection
                    providerKey={generalState.providerKey}
                    hasSecrets={generalState.hasSecrets}
                    secretsByProvider={generalState.secretsByProvider}
                    setSecretsByProvider={generalState.setSecretsByProvider}
                    busy={generalState.busy}
                  />

                  <div className="col-12 mt-3">
                    <label className="form-label" htmlFor="ai-system-prompt">System Prompt</label>
                    <textarea
                      id="ai-system-prompt"
                      className="form-control"
                      rows={6}
                      value={generalState.config.system_prompt}
                      onChange={(e) => generalState.setConfig(prev => ({ ...prev, system_prompt: e.target.value }))}
                      disabled={generalState.busy}
                      placeholder="(stub)"
                    />
                  </div>
                </div>
              </form>
            ) : null}

            {tab === 'voice' ? (
              <form onSubmit={(e) => { e.preventDefault(); void voiceState.save(); }}>
                <div className="row g-3">
                  <div className="col-xl-4 col-lg-6">
                    <GcpServiceAccountSection
                      hasMysteryServiceAccount={voiceState.hasMysteryServiceAccount}
                      mysteryServiceAccountJson={voiceState.mysteryServiceAccountJson}
                      setMysteryServiceAccountJson={voiceState.setMysteryServiceAccountJson}
                      busy={voiceState.busy}
                      lastGcpServiceAccountTest={voiceState.lastGcpServiceAccountTest}
                      testMysteryGcpServiceAccount={voiceState.testMysteryGcpServiceAccount}
                    />
                  </div>

                  <div className="col-xl-4 col-lg-6">
                    <GeminiLiveStudioSection
                      hasMysteryGeminiKey={voiceState.hasMysteryGeminiKey}
                      mysteryGeminiApiKey={voiceState.mysteryGeminiApiKey}
                      setMysteryGeminiApiKey={voiceState.setMysteryGeminiApiKey}
                      mysteryGeminiKeyName={voiceState.mysteryGeminiKeyName}
                      setMysteryGeminiKeyName={voiceState.setMysteryGeminiKeyName}
                      mysteryGeminiProjectName={voiceState.mysteryGeminiProjectName}
                      setMysteryGeminiProjectName={voiceState.setMysteryGeminiProjectName}
                      mysteryGeminiProjectNumber={voiceState.mysteryGeminiProjectNumber}
                      setMysteryGeminiProjectNumber={voiceState.setMysteryGeminiProjectNumber}
                      busy={voiceState.busy}
                      lastGeminiLiveTokenTest={voiceState.lastGeminiLiveTokenTest}
                      testGeminiLiveToken={voiceState.testGeminiLiveToken}
                    />
                  </div>

                  <div className="col-xl-4 col-lg-12">
                    <TtsDefaultsSection
                      ttsVoiceMapActive={voiceState.ttsVoiceMapActive}
                      setTtsVoiceMapActive={voiceState.setTtsVoiceMapActive}
                      ttsOutputFormat={voiceState.ttsOutputFormat}
                      setTtsOutputFormat={voiceState.setTtsOutputFormat}
                      ttsLanguageCode={voiceState.ttsLanguageCode}
                      setTtsLanguageCode={voiceState.setTtsLanguageCode}
                      ttsVoiceName={voiceState.ttsVoiceName}
                      setTtsVoiceName={voiceState.setTtsVoiceName}
                      ttsSpeakingRate={voiceState.ttsSpeakingRate}
                      setTtsSpeakingRate={voiceState.setTtsSpeakingRate}
                      ttsPitch={voiceState.ttsPitch}
                      setTtsPitch={voiceState.setTtsPitch}
                      busy={voiceState.busy}
                    />
                  </div>
                </div>
              </form>
            ) : null}

            {tab === 'image' ? (
              <form onSubmit={(e) => { e.preventDefault(); void imageState.save(); }}>
                <div className="row g-3">
                  <div className="col-lg-6">
                    <AIImageParamsSection
                      config={imageState.config}
                      setConfig={imageState.setConfig}
                      paramOptions={imageState.paramOptions}
                      providerKey={imageState.providerKey}
                      busy={imageState.busy}
                    />
                    <AIImageProviderSection
                      config={imageState.config}
                      setConfig={imageState.setConfig}
                      modelChoices={imageState.modelChoices}
                      providerKey={imageState.providerKey}
                      busy={imageState.busy}
                      lastAiImageProviderTest={imageState.lastAiImageProviderTest}
                      testAiImageProvider={imageState.testAiImageProvider}
                      refreshModelChoices={imageState.refreshModelChoices}
                      isRefreshingModels={imageState.isRefreshingModels}
                      modelChoicesSource={imageState.modelChoicesSource}
                    />
                  </div>
                  <div className="col-lg-6">
                    <AIImageSecretsSection
                      providerKey={imageState.providerKey}
                      config={imageState.config}
                      setConfig={imageState.setConfig}
                      hasSecrets={imageState.hasSecrets}
                      secretsByProvider={imageState.secretsByProvider}
                      setSecretsByProvider={imageState.setSecretsByProvider}
                      lastAiImageLocationRefTest={imageState.lastAiImageLocationRefTest}
                      setLastAiImageLocationRefTest={imageState.setLastAiImageLocationRefTest}
                      busy={imageState.busy}
                      setBusy={imageState.setBusy}
                      onToast={onToast}
                      testAiImageProviderDraft={imageState.testAiImageProviderDraft}
                    />
                  </div>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
