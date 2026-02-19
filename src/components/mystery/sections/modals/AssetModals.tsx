import React from 'react';
import { LocationsModal } from '../../modals/LocationsModal';
import { WeaponsModal } from '../../modals/WeaponsModal';
import { MotivesModal } from '../../modals/MotivesModal';

import { AssetLibraryModal } from '../../modals/AssetLibraryModal';
import { CharacterLibraryModal } from '../../modals/CharacterLibraryModal';
import { MasterAssetDetailsModal } from '../../modals/MasterAssetDetailsModal';
import { MasterDeleteConfirmModal } from '../../modals/MasterDeleteConfirmModal';
import { MasterAssetJsonModal } from '../../modals/MasterAssetJsonModal';
import { JsonPreviewModal } from '../../modals/JsonPreviewModal';
import { IMasterAssets, IMysteryModals, IMysteryStateDarkroom } from '../../../../types/mysteryHooks';

interface AssetModalsProps {
  isAdmin: boolean;
  busy: boolean;
  mysteryId: string | number;
  darkroom: IMysteryStateDarkroom;
  masterAssets: IMasterAssets;
  modalRefs: any;
  showMysteryToast: (t: any) => void;
  onOpenAiImageConfig: () => void;
  showModalNow: IMysteryModals['showModalNow'];
  transitionToModal: IMysteryModals['transitionToModal'];
}

export function AssetModals({
  isAdmin,
  busy,
  mysteryId,
  darkroom,
  masterAssets,
  modalRefs,
  showMysteryToast,
  onOpenAiImageConfig,
  showModalNow,
  transitionToModal
}: AssetModalsProps) {
  const trashSvg = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>;
  const pencilSvg = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>;
  const lockSvg = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>;
  const unlockSvg = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>;

  return (
    <>
      <AssetLibraryModal
        modalRef={modalRefs.assetLibraryRef}
        busy={busy}
        isAdmin={isAdmin}
        mysteryId={mysteryId}
        masterCharacters={masterAssets.masterCharacters}
        masterLocations={masterAssets.masterLocations}
        masterWeapons={masterAssets.masterWeapons}
        masterMotives={masterAssets.masterMotives}
        newMasterCharacter={masterAssets.newMasterCharacter}
        setNewMasterCharacter={masterAssets.setNewMasterCharacter}
        newMasterLocation={masterAssets.newMasterLocation}
        setNewMasterLocation={masterAssets.setNewMasterLocation}
        newMasterWeapon={masterAssets.newMasterWeapon}
        setNewMasterWeapon={masterAssets.setNewMasterWeapon}
        newMasterMotive={masterAssets.newMasterMotive}
        setNewMasterMotive={masterAssets.setNewMasterMotive}
        masterAssetsIncludeArchived={masterAssets.masterAssetsIncludeArchived}
        setMasterAssetsIncludeArchived={masterAssets.setMasterAssetsIncludeArchived}
        loadMasterCharacters={masterAssets.loadMasterCharacters}
        loadMasterLocations={masterAssets.loadMasterLocations}
        loadMasterWeapons={masterAssets.loadMasterWeapons}
        loadMasterMotives={masterAssets.loadMasterMotives}
        upsertMasterCharacter={masterAssets.upsertMasterCharacter}
        upsertMasterLocation={masterAssets.upsertMasterLocation}
        upsertMasterWeapon={masterAssets.upsertMasterWeapon}
        upsertMasterMotive={masterAssets.upsertMasterMotive}
        archiveMasterAsset={masterAssets.archiveMasterAsset}
        setMasterAssetRegenLock={masterAssets.setMasterAssetRegenLock}
        needsCleanup={masterAssets.needsCleanup}
        needsLinkImport={masterAssets.needsLinkImport}
        checkMaintenanceNeeded={masterAssets.checkMaintenanceNeeded}
        openMasterAssetDetails={(opts) => {
          masterAssets.openMasterAssetDetails(opts);
          showModalNow(modalRefs.masterAssetDetailsRef, modalRefs.masterAssetDetailsApiRef, masterAssets.setMasterAssetDetailsOpen);
        }}
        requestMasterAssetDelete={masterAssets.requestMasterAssetDelete}
        backfillMasterAssetColumnsFromJson={masterAssets.backfillMasterAssetColumnsFromJson}
        cleanupMasterOnlyFieldsForMystery={masterAssets.cleanupMasterOnlyFieldsForMystery}
        linkAndImportCaseDetailsForMystery={masterAssets.linkAndImportCaseDetailsForMystery}
        getMasterAssetNameDraft={masterAssets.getMasterAssetNameDraft}
        updateMasterAssetNameDraft={masterAssets.updateMasterAssetNameDraft}
        saveMasterAssetInlineName={masterAssets.saveMasterAssetInlineName}
        trashSvg={trashSvg}
        pencilSvg={pencilSvg}
        lockSvg={lockSvg}
        unlockSvg={unlockSvg}
      />

      <CharacterLibraryModal
        modalRef={modalRefs.characterLibraryRef}
        busy={busy}
        isAdmin={isAdmin}
        mysteryId={mysteryId}
        masterCharacters={masterAssets.masterCharacters}
        newMasterCharacter={masterAssets.newMasterCharacter}
        setNewMasterCharacter={masterAssets.setNewMasterCharacter}
        masterAssetsIncludeArchived={masterAssets.masterAssetsIncludeArchived}
        setMasterAssetsIncludeArchived={masterAssets.setMasterAssetsIncludeArchived}
        loadMasterCharacters={masterAssets.loadMasterCharacters}
        upsertMasterCharacter={masterAssets.upsertMasterCharacter}
        archiveMasterAsset={masterAssets.archiveMasterAsset}
        setMasterAssetRegenLock={masterAssets.setMasterAssetRegenLock}
        openMasterAssetDetails={(opts) => {
          masterAssets.openMasterAssetDetails(opts);
          showModalNow(modalRefs.masterAssetDetailsRef, modalRefs.masterAssetDetailsApiRef, masterAssets.setMasterAssetDetailsOpen);
        }}
        requestMasterAssetDelete={masterAssets.requestMasterAssetDelete}
        getMasterAssetNameDraft={masterAssets.getMasterAssetNameDraft}
        updateMasterAssetNameDraft={masterAssets.updateMasterAssetNameDraft}
        saveMasterAssetInlineName={masterAssets.saveMasterAssetInlineName}
        trashSvg={trashSvg}
        pencilSvg={pencilSvg}
        lockSvg={lockSvg}
        unlockSvg={unlockSvg}
      />

      <MasterAssetDetailsModal
        modalRef={modalRefs.masterAssetDetailsRef}
        busy={busy}
        isAdmin={isAdmin}
        masterAssetDetailsItem={masterAssets.masterAssetDetailsItem}
        masterAssetDetailsType={masterAssets.masterAssetDetailsType}
        masterAssetDetailsName={masterAssets.masterAssetDetailsName}
        setMasterAssetDetailsName={masterAssets.setMasterAssetDetailsName}
        masterAssetDetailsSlug={masterAssets.masterAssetDetailsSlug}
        setMasterAssetDetailsSlug={masterAssets.setMasterAssetDetailsSlug}
        masterAssetDetailsFields={masterAssets.masterAssetDetailsFields}
        setMasterAssetDetailsFields={masterAssets.setMasterAssetDetailsFields}
        masterAssetDetailsRapport={masterAssets.masterAssetDetailsRapport}
        setMasterAssetDetailsRapport={masterAssets.setMasterAssetDetailsRapport}
        masterAssetDetailsFavorites={masterAssets.masterAssetDetailsFavorites}
        setMasterAssetDetailsFavorites={masterAssets.setMasterAssetDetailsFavorites}
        voiceProfiles={masterAssets.voiceProfiles}
        isMasterAssetDetailsDirty={masterAssets.isMasterAssetDetailsDirty}
        masterCharacterImageUrl={masterAssets.masterCharacterImageUrl}
        masterCharacterMugshotUrl={masterAssets.masterCharacterMugshotUrl}
        masterCharacterIrUrls={masterAssets.masterCharacterIrUrls}
        masterCharacterIrIndex={masterAssets.masterCharacterIrIndex}
        setMasterCharacterIrIndex={masterAssets.setMasterCharacterIrIndex}
        masterCharacterIrEmotions={masterAssets.masterCharacterIrEmotions}
        masterCharacterIrEmotionEnabled={masterAssets.masterCharacterIrEmotionEnabled}
        setMasterCharacterIrEmotionEnabled={masterAssets.setMasterCharacterIrEmotionEnabled}
        masterCharacterMissingRequiredImageFields={masterAssets.masterCharacterMissingRequiredImageFields}
        loadMasterCharacterDeposition={masterAssets.loadMasterCharacterDeposition}
        masterCharacterDepositionText={masterAssets.masterCharacterDepositionText}
        masterCharacterDepositionUpdatedAt={masterAssets.masterCharacterDepositionUpdatedAt}
        masterCharacterDepositionError={masterAssets.masterCharacterDepositionError}
        masterCharacterDepositionBusy={masterAssets.masterCharacterDepositionBusy}
        scenarioId={masterAssets.scenarioId}
        caseId={masterAssets.caseId}
        masterCharacterScenarioEntityId={masterAssets.masterCharacterScenarioEntityId}
        enqueueSpecificJob={masterAssets.enqueueSpecificJob}
        openJsonPreview={masterAssets.openJsonPreview}
        saveMasterAssetDetails={masterAssets.saveMasterAssetDetails}
        generateMasterAssetContent={masterAssets.generateMasterAssetContent}
        clearMasterAssetFields={masterAssets.clearMasterAssetFields}
        openMasterAssetDerivedJson={masterAssets.openMasterAssetDerivedJson}
        updateMasterAssetDetailsDataObject={masterAssets.updateMasterAssetDetailsDataObject}
        toggleMasterAssetFieldLock={masterAssets.toggleMasterAssetFieldLock}
        isMasterAssetFieldLocked={masterAssets.isMasterAssetFieldLocked}
        onOpenAiImageConfig={onOpenAiImageConfig}
        uploadMasterCharacterImage={masterAssets.uploadMasterCharacterImage}
        deleteMasterCharacterImage={masterAssets.deleteMasterCharacterImage}
        openMasterCharacterImagePrompt={masterAssets.openMasterCharacterImagePrompt}
        generateMasterCharacterImages={masterAssets.generateMasterCharacterImages}
        generateAllMissingMasterCharacterImages={masterAssets.generateAllMissingMasterCharacterImages}
        uploadMasterAssetImage={masterAssets.uploadMasterAssetImage}
        generateMasterAssetPrimaryImage={masterAssets.generateMasterAssetPrimaryImage}
        deleteMasterAssetPrimaryImage={masterAssets.deleteMasterAssetPrimaryImage}
        archiveMasterAsset={masterAssets.archiveMasterAsset}
        resetMasterAssetDetails={masterAssets.resetMasterAssetDetails}
        getMasterAssetDataObject={masterAssets.getMasterAssetDataObject}
        masterAssetDetailsDataText={masterAssets.masterAssetDetailsDataText}
        saveSvg={<i className="bi bi-save" />}
        cogSvg={<i className="bi bi-gear" />}
        lockSvg={lockSvg}
        unlockSvg={unlockSvg}
        trashSvg={trashSvg}
        pencilSvg={pencilSvg}
      />

      <MasterDeleteConfirmModal
        modalRef={modalRefs.masterDeleteConfirmRef}
        busy={busy}
        isAdmin={isAdmin}
        pendingMasterDelete={masterAssets.pendingMasterDelete}
        confirmMasterAssetDelete={masterAssets.confirmMasterAssetDelete}
      />

      <MasterAssetJsonModal
        modalRef={modalRefs.masterAssetJsonRef}
        masterAssetJsonTitle={masterAssets.masterAssetJsonTitle}
        masterAssetJsonText={masterAssets.masterAssetJsonText}
        copyMasterAssetJsonText={async () => {
          try {
            await navigator.clipboard.writeText(masterAssets.masterAssetJsonText);
            showMysteryToast({ tone: 'success', message: 'Copied to clipboard.' });
          } catch (e) {
            showMysteryToast({ tone: 'error', message: 'Failed to copy.' });
          }
        }}
      />

      <JsonPreviewModal
        modalRef={modalRefs.jsonPreviewRef}
        jsonPreviewTitle={masterAssets.jsonPreviewTitle}
        jsonPreviewText={masterAssets.jsonPreviewText}
      />

      <LocationsModal 
        modalRef={modalRefs.locationsModalRef}
        isAdmin={isAdmin}
        caseId={masterAssets.caseId}
        busy={busy}
        showMysteryToast={showMysteryToast}
      />

      <WeaponsModal 
        modalRef={modalRefs.weaponsModalRef}
        isAdmin={isAdmin}
        mysteryId={mysteryId}
        caseId={masterAssets.caseId}
        busy={busy}
        showMysteryToast={showMysteryToast}
      />

      <MotivesModal 
        modalRef={modalRefs.motivesModalRef}
        isAdmin={isAdmin}
        mysteryId={mysteryId}
        caseId={masterAssets.caseId}
        busy={busy}
        showMysteryToast={showMysteryToast}
      />
    </>
  );
}
