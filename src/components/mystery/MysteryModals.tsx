import React from 'react';
import './MysteryModals.css';
import { IToast } from '../../types/common';
import { 
  IMysteryState, IMasterAssets, IMysterySettingsFull, 
  IMysteryLiveSessions, IInterrogation, IMysteryPageModals,
  IMysteryModals, IMysteryStateDarkroom
} from '../../types/mysteryHooks';
import { InvestigationModals } from './sections/modals/InvestigationModals';
import { AssetModals } from './sections/modals/AssetModals';
import { CaseModals } from './sections/modals/CaseModals';
import { AdminModals } from './sections/modals/AdminModals';
import { CommunicationModals } from './sections/modals/CommunicationModals';
import { CaseFilesModal } from './modals/CaseFilesModal';

interface MysteryModalsProps {
  isAdmin: boolean;
  busy: boolean;
  mysteryState: IMysteryState;
  darkroom: IMysteryStateDarkroom;
  masterAssets: IMasterAssets;
  settings: IMysterySettingsFull;
  liveSessions: IMysteryLiveSessions;
  interrogation: IInterrogation;
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
 * MysteryModals - Refactored Component
 * COMPLIANCE: File size < 250 lines
 */
export function MysteryModals({
  isAdmin,
  busy,
  mysteryState,
  darkroom,
  masterAssets,
  settings,
  liveSessions,
  interrogation,
  modalState,
  modalRefs,
  modalActions,
  onOpenAiConfig,
  onOpenAiVoiceConfig,
  onOpenAiImageConfig,
  showMysteryToast,
  showModalNow,
  transitionToModal,
}: MysteryModalsProps) {
  return (
    <>
      <CaseModals 
        isAdmin={isAdmin}
        busy={busy}
        mysteryState={mysteryState}
        masterAssets={masterAssets}
        modalState={modalState}
        modalRefs={modalRefs}
        modalActions={modalActions}
        onOpenAiConfig={onOpenAiConfig}
        showModalNow={showModalNow}
        transitionToModal={transitionToModal}
      />

      <AssetModals 
        isAdmin={isAdmin}
        busy={busy}
        mysteryId={mysteryState.mysteryId}
        darkroom={darkroom}
        masterAssets={masterAssets}
        modalRefs={modalRefs}
        showMysteryToast={showMysteryToast}
        onOpenAiImageConfig={onOpenAiImageConfig}
        showModalNow={showModalNow}
        transitionToModal={transitionToModal}
      />

      <InvestigationModals 
        isAdmin={isAdmin}
        busy={busy}
        mysteryState={mysteryState}
        interrogation={interrogation}
        modalState={modalState}
        modalRefs={modalRefs}
        showModalNow={showModalNow}
        transitionToModal={transitionToModal}
      />

      <AdminModals 
        isAdmin={isAdmin}
        busy={busy}
        mysteryState={mysteryState}
        darkroom={darkroom}
        masterAssets={masterAssets}
        settings={settings}
        modalState={modalState}
        modalRefs={modalRefs}
        modalActions={modalActions}
        onOpenAiConfig={onOpenAiConfig}
        onOpenAiVoiceConfig={onOpenAiVoiceConfig}
        onOpenAiImageConfig={onOpenAiImageConfig}
        showMysteryToast={showMysteryToast}
        showModalNow={showModalNow} // Pass showModalNow to AdminModals
        transitionToModal={transitionToModal}
      />

      <CommunicationModals 
        busy={busy}
        liveSessions={liveSessions}
        modalRefs={modalRefs}
      />

      <CaseFilesModal
        modalRef={modalRefs.caseFilesRef}
        backstoryText={mysteryState.backstoryDetails?.backstory_text || ''}
        coldHardFacts={mysteryState.coldHardFacts || ''}
        busy={busy}
      />
    </>
  );
}
