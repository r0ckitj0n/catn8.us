import React from 'react';
import { IMysteryState, IInterrogation, IMysteryPageModals, IMysteryModals } from '../../../../types/mysteryHooks';
import { InterrogationModal } from '../../modals/InterrogationModal';
import { SuspectsModal } from '../../modals/SuspectsModal';
import { RapSheetModal } from '../../modals/RapSheetModal';
import { EvidenceStudyModal } from '../../modals/EvidenceStudyModal';
import { InterrogationLogsModal } from '../../modals/InterrogationLogsModal';
import { DepositionsModal } from '../../modals/DepositionsModal';
import { PlayerLocationVisitModal } from '../../modals/PlayerLocationVisitModal';

interface InvestigationModalsProps {
  isAdmin: boolean;
  busy: boolean;
  mysteryState: IMysteryState;
  interrogation: IInterrogation;
  modalState: IMysteryPageModals['state'];
  modalRefs: IMysteryPageModals['refs'];
  showModalNow: IMysteryModals['showModalNow'];
  transitionToModal: IMysteryModals['transitionToModal'];
}

export function InvestigationModals({
  isAdmin,
  busy,
  mysteryState,
  interrogation,
  modalState,
  modalRefs,
  showModalNow,
  transitionToModal
}: InvestigationModalsProps) {
  return (
    <>
      <SuspectsModal
        modalRef={modalRefs.suspectsModalRef}
        busy={busy}
        scenarioCast={mysteryState.scenarioCast}
        onInterrogate={(id, name, agentId) => {
          interrogation.setInterrogationEntityId(Number(id));
          interrogation.setInterrogationEntityName(name);
          interrogation.setInterrogationAgentId(Number(agentId));
          transitionToModal(
            modalRefs.suspectsModalRef,
            modalRefs.interrogationRef,
            modalRefs.interrogationApiRef,
            modalState.setInterrogationOpen
          );
        }}
        onViewRapSheet={(id, name) => {
          interrogation.setInterrogationEntityId(Number(id));
          interrogation.setInterrogationEntityName(name);
          transitionToModal(
            modalRefs.suspectsModalRef,
            modalRefs.rapSheetRef,
            modalRefs.rapSheetApiRef,
            modalState.setRapSheetOpen
          );
          // Load the rap sheet data
          mysteryState.loadRapSheet(Number(mysteryState.scenarioId), Number(id));
        }}
      />

      <InterrogationModal
        modalRef={modalRefs.interrogationRef}
        interrogationEntityName={interrogation.interrogationEntityName}
        interrogationImageUrlFinal={interrogation.interrogationImageUrlFinal}
        interrogationTypedQuestion={interrogation.interrogationTypedQuestion}
        setInterrogationTypedQuestion={interrogation.setInterrogationTypedQuestion}
        interrogationStatus={interrogation.interrogationStatus}
        interrogationInputText={interrogation.interrogationInputText}
        interrogationOutputText={interrogation.interrogationOutputText}
        interrogationTypedAudioUrl={interrogation.interrogationTypedAudioUrl}
        interrogationTypedAudioRef={interrogation.interrogationTypedAudioRef}
        busy={busy}
        scenarioId={mysteryState.scenarioId}
        interrogationEntityId={interrogation.interrogationEntityId}
        onAskTyped={interrogation.askInterrogationTyped}
        onOpenRapSheet={() => showModalNow(modalRefs.rapSheetRef, modalRefs.rapSheetApiRef, modalState.setRapSheetOpen)}
        onStartStreaming={interrogation.startInterrogationStreaming}
        onStopStreaming={interrogation.stopInterrogationStreaming}
      />

      <RapSheetModal
        modalRef={modalRefs.rapSheetRef}
        rapSheet={mysteryState.rapSheet}
        rapSheetBusy={mysteryState.rapSheetBusy}
        scenarioId={mysteryState.scenarioId}
        interrogationEntityId={interrogation.interrogationEntityId}
        onLoadRapSheet={mysteryState.loadRapSheet}
      />

      <EvidenceStudyModal
        modalRef={modalRefs.evidenceStudyRef}
        isAdmin={isAdmin}
        evidenceList={mysteryState.evidenceList || []}
        busy={busy}
        onGenerateEvidence={() => mysteryState.enqueueSpecificJob({ action: 'generate_evidence', spec: {}, requireScenario: true })}
        onAddNote={(evidenceId, text) => mysteryState.addEvidenceNote(evidenceId, text)}
      />

      <InterrogationLogsModal
        modalRef={modalRefs.interrogationLogsRef}
        logs={mysteryState.conversationEvents || []}
        busy={busy}
      />

      <DepositionsModal
        modalRef={modalRefs.depositionsRef}
        depositions={mysteryState.depositions || []}
        busy={busy}
      />

      <PlayerLocationVisitModal
        modalRef={modalRefs.playerLocationVisitRef}
        caseId={Number(mysteryState.caseId)}
        scenarioId={Number(mysteryState.scenarioId)}
        scenario={mysteryState.scenario}
        onClose={() => {
          if (modalRefs.playerLocationVisitApiRef.current) {
            modalRefs.playerLocationVisitApiRef.current.hide();
          }
          modalState.setPlayerLocationVisitOpen(false);
        }}
      />
    </>
  );
}
