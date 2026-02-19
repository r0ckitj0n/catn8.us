import React from 'react';
import { IMysteryState, IMasterAssets, IMysteryPageModals, IMysterySettingsFull } from '../../../../types/mysteryHooks';
import { MysterySettingsModal } from '../../modals/MysterySettingsModal';

interface AdminSettingsModalsProps {
  busy: boolean;
  isAdmin: boolean;
  settings: IMysterySettingsFull;
  masterAssets: IMasterAssets;
  modalState: IMysteryPageModals['state'];
  modalRefs: IMysteryPageModals['refs'];
  onOpenAiVoiceConfig: () => void;
  onOpenAiImageConfig: () => void;
}

export function AdminSettingsModals({
  busy, isAdmin, settings, masterAssets, modalState, modalRefs, onOpenAiVoiceConfig, onOpenAiImageConfig
}: AdminSettingsModalsProps) {
  return (
    <>
      <MysterySettingsModal
        modalRef={modalRefs.mysterySettingsRef}
        busy={busy}
        isAdmin={isAdmin}
        isMysterySettingsDirty={settings.mysterySettingsDraft !== JSON.stringify(settings.mysterySettingsObj, null, 2)}
        mysterySettingsObj={settings.mysterySettingsObj}
        mysterySettingsUpdatedAt={settings.mysterySettingsUpdatedAt}
        mysterySettingsTab={settings.mysterySettingsTab}
        setMysterySettingsTab={settings.setMysterySettingsTab}
        filteredTtsVoices={settings.ttsVoices}
        voiceMapRowIds={settings.voiceMapRowIds}
        voiceIdToCharacters={settings.voiceIdToCharacters}
        accentDraftByVoiceId={{}} // TODO: Handle accent drafts if needed
        setAccentDraftByVoiceId={() => {}}
        newVoiceMapId={''}
        setNewVoiceMapId={() => {}}
        voiceIdSuggestions={settings.voiceIdSuggestions}
        saveMysterySettingsObject={settings.saveMysterySettingsObject}
        loadMysterySettings={settings.loadMysterySettings}
        onOpenAiVoiceConfig={onOpenAiVoiceConfig}
        loadAgentProfiles={settings.loadAgentProfiles}
        addMissingVoiceIdsFromCharacters={settings.addMissingVoiceIdsFromCharacters}
        autoAssignVoiceMapBestMatchAndSave={settings.autoAssignVoiceMapBestMatchAndSave}
        addVoiceMapEntry={settings.addVoiceMapEntry}
        deleteVoiceMapEntry={settings.deleteVoiceMapEntry}
        toggleVoiceMapLock={settings.toggleVoiceMapLock}
        updateVoiceMapEntry={settings.updateVoiceMapEntry}
        setAccentPreferenceForVoiceId={async () => {}}
        openMysterySettingsEditor={settings.openMysterySettingsEditor}
        getActiveVoiceMap={settings.getActiveVoiceMap}
        describeVoiceTier={(name) => name.includes('Studio') ? 'Studio' : 'Neural'}
        saveSvg={<i className="bi bi-save" />}
        cogSvg={<i className="bi bi-gear" />}
        lockSvg={<i className="bi bi-lock" />}
        unlockSvg={<i className="bi bi-unlock" />}
      />
    </>
  );
}
