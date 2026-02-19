import React from 'react';
import { IMysteryState, IMasterAssets, IMysterySettingsFull, IMysteryPageModals, IMysteryModals, IMysteryStateDarkroom } from '../../../../types/mysteryHooks';
import { IToast } from '../../../../types/common';
import { CrimeLabModal } from '../../modals/CrimeLabModal';
import { MysteryPickerModal } from '../../modals/MysteryPickerModal';
import { AdminSettingsModals } from './AdminSettingsModals';
import { AdminGameModals } from './AdminGameModals';

interface AdminModalsProps {
  isAdmin: boolean;
  busy: boolean;
  mysteryState: IMysteryState;
  darkroom: IMysteryStateDarkroom;
  masterAssets: IMasterAssets;
  settings: IMysterySettingsFull;
  modalState: IMysteryPageModals['state'];
  modalRefs: IMysteryPageModals['refs'];
  modalActions: IMysteryPageModals['actions'];
  onOpenAiConfig: () => void;
  onOpenAiVoiceConfig: () => void;
  onOpenAiImageConfig: () => void;
  showMysteryToast: (t: IToast) => void;
  showModalNow: IMysteryModals['showModalNow'];
  transitionToModal: IMysteryModals['transitionToModal'];
}

/**
 * AdminModals - Refactored Main Orchestrator
 * COMPLIANCE: File size < 250 lines
 */
export function AdminModals(props: AdminModalsProps) {
  return (
    <>
      <CrimeLabModal
        modalRef={props.modalRefs.crimeLabRef}
        isAdmin={props.isAdmin}
        mysteryId={props.mysteryState.mysteryId}
        busy={props.busy}
        onOpenAssetLibrary={() => props.showModalNow(props.modalRefs.assetLibraryRef, props.modalRefs.assetLibraryApiRef, props.modalState.setAssetLibraryOpen)}
        onOpenCharacterLibrary={() => props.showModalNow(props.modalRefs.characterLibraryRef, props.modalRefs.characterLibraryApiRef, props.modalState.setCharacterLibraryOpen)}
        onOpenCaseMgmt={() => props.showModalNow(props.modalRefs.caseMgmtRef, props.modalRefs.caseMgmtApiRef, props.modalState.setCaseMgmtOpen)}
        onOpenCommunications={() => props.showModalNow(props.modalRefs.mysterySettingsRef, props.modalRefs.mysterySettingsApiRef, props.modalState.setMysterySettingsOpen)}
        onOpenDarkroom={() => props.showModalNow(props.modalRefs.toolsRef, props.modalRefs.toolsApiRef, props.modalState.setToolsOpen)}
        onOpenLocations={() => props.showModalNow(props.modalRefs.locationsModalRef, props.modalRefs.locationsModalApiRef, props.modalState.setLocationsModalOpen)}
        onOpenMotives={() => props.showModalNow(props.modalRefs.motivesModalRef, props.modalRefs.motivesModalApiRef, props.modalState.setMotivesModalOpen)}
        onOpenStories={() => props.showModalNow(props.modalRefs.storiesModalRef, props.modalRefs.storiesModalApiRef, props.modalState.setStoriesModalOpen)}
        onOpenWeapons={() => props.showModalNow(props.modalRefs.weaponsModalRef, props.modalRefs.weaponsModalApiRef, props.modalState.setWeaponsModalOpen)}
        showMysteryToast={props.showMysteryToast}
      />

      <MysteryPickerModal
        modalRef={props.modalRefs.mysteryPickerRef}
        busy={props.busy}
        isAdmin={props.isAdmin}
        mysteryPickerList={props.mysteryState.mysteryPickerList}
        mysteryPickerSelectedId={props.mysteryState.mysteryPickerSelectedId}
        setMysteryPickerSelectedId={props.mysteryState.setMysteryPickerSelectedId}
        mysteryPickerAdminOpen={props.mysteryState.mysteryPickerAdminOpen}
        setMysteryPickerAdminOpen={props.mysteryState.setMysteryPickerAdminOpen}
        mysteryAdminCreateTitle={props.mysteryState.mysteryAdminCreateTitle}
        setMysteryAdminCreateTitle={props.mysteryState.setMysteryAdminCreateTitle}
        mysteryAdminCreateSlug={props.mysteryState.mysteryAdminCreateSlug}
        setMysteryAdminCreateSlug={props.mysteryState.setMysteryAdminCreateSlug}
        mysteryAdminEditTitle={props.mysteryState.mysteryAdminEditTitle}
        setMysteryAdminEditTitle={props.mysteryState.setMysteryAdminEditTitle}
        mysteryAdminEditSlug={props.mysteryState.mysteryAdminEditSlug}
        setMysteryAdminEditSlug={props.mysteryState.setMysteryAdminEditSlug}
        mysteryAdminEditArchived={props.mysteryState.mysteryAdminEditArchived}
        setMysteryAdminEditArchived={props.mysteryState.setMysteryAdminEditArchived}
        mysteryAdminDeleteArmed={props.mysteryState.mysteryAdminDeleteArmed}
        setMysteryAdminDeleteArmed={props.mysteryState.setMysteryAdminDeleteArmed}
        importDefaultMystery={props.mysteryState.importDefaultMystery}
        createMysteryFromPicker={props.mysteryState.createMysteryFromPicker}
        refreshMysteryPickerList={props.mysteryState.loadMysteries}
        saveMysteryFromPicker={props.mysteryState.saveMysteryFromPicker}
        deleteMysteryFromPicker={props.mysteryState.deleteMysteryFromPicker}
        isPersistent={!props.mysteryState.mysteryId}
        confirmMysterySelection={props.modalActions.confirmMysterySelect} 
      />

      <AdminSettingsModals 
        busy={props.busy}
        isAdmin={props.isAdmin}
        settings={props.settings}
        masterAssets={props.masterAssets}
        modalState={props.modalState}
        modalRefs={props.modalRefs}
        onOpenAiVoiceConfig={props.onOpenAiVoiceConfig}
        onOpenAiImageConfig={props.onOpenAiImageConfig}
      />

      <AdminGameModals 
        busy={props.busy}
        isAdmin={props.isAdmin}
        mysteryState={props.mysteryState}
        darkroom={props.darkroom}
        masterAssets={props.masterAssets}
        modalState={props.modalState}
        modalRefs={props.modalRefs}
        modalActions={props.modalActions}
        onOpenAiConfig={props.onOpenAiConfig}
        showModalNow={props.showModalNow}
        transitionToModal={props.transitionToModal}
      />
    </>
  );
}
