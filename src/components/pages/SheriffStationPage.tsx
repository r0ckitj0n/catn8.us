import React from 'react';
import { PageLayout } from '../layout/PageLayout';
import { useMysteryState } from '../mystery/hooks/useMysteryState';
import { useMysteryToasts } from '../mystery/hooks/useMysteryToasts';
import { useMysteryModals } from '../mystery/hooks/useMysteryModals';
import { useMysteryPageModals } from '../mystery/hooks/useMysteryPageModals';
import { useMysteryLiveSessions } from '../mystery/hooks/useMysteryLiveSessions';
import { useInterrogation } from '../mystery/hooks/useInterrogation';
import { useMasterAssets } from '../mystery/hooks/useMasterAssets';
import { useJobTracking } from '../mystery/hooks/useJobTracking';
import { useMysterySettings } from '../mystery/hooks/useMysterySettings';
import { useMysteryStateDarkroom } from '../mystery/hooks/useMysteryStateDarkroom';
import { SheriffStationView } from '../mystery/SheriffStationView';
import { MysteryModals } from '../mystery/MysteryModals';
import { InvestigationModals } from '../mystery/sections/modals/InvestigationModals';
import { cleanupModalArtifactsIfNoOpenModals } from '../../utils/modalUtils';
import { AppShellPageProps } from '../../types/pages/commonPageProps';

interface SheriffStationPageProps {
  viewer: AppShellPageProps['viewer'];
  isAdmin: boolean;
  onLoginClick: AppShellPageProps['onLoginClick'];
  onLogout: AppShellPageProps['onLogout'];
  onAccountClick: AppShellPageProps['onAccountClick'];
  onToast: any;
  onOpenAiImageConfig: () => void;
  onOpenAiConfig: () => void;
  onOpenAiVoiceConfig: () => void;
  mysteryTitle: AppShellPageProps['mysteryTitle'];
}

export function SheriffStationPage({
  viewer,
  isAdmin,
  onLoginClick,
  onLogout,
  onAccountClick,
  onToast,
  onOpenAiImageConfig,
  onOpenAiConfig,
  onOpenAiVoiceConfig,
  mysteryTitle,
}: SheriffStationPageProps) {
  const isAuthed = React.useMemo(() => Boolean(viewer && viewer.id), [viewer]);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const { showMysteryToast, showVoiceToast } = useMysteryToasts(onToast);
  const { watchJobToast } = useJobTracking(showMysteryToast);
  const mysteryState = useMysteryState(isAuthed, setError, setBusy, showMysteryToast);

  const { showModalNow, transitionToModal } = useMysteryModals(setError, cleanupModalArtifactsIfNoOpenModals);
  const { state: modalState, refs: modalRefs, actions: modalActions } = useMysteryPageModals(
    showModalNow,
    transitionToModal,
    mysteryState.setCaseId,
    mysteryState.confirmMysterySelection
  );

  const masterAssets = useMasterAssets(
    isAdmin,
    mysteryState.mysteryId,
    mysteryState.caseId,
    mysteryState.scenarioId,
    mysteryState.scenarioEntities,
    mysteryState.enqueueSpecificJob,
    mysteryState.watchJobToast,
    showMysteryToast,
    setError,
    setBusy
  );

  const settings = useMysterySettings(isAdmin, mysteryState.mysteryId, masterAssets, showMysteryToast, setError);

  const getActiveVoiceMapProvider = React.useCallback(() => {
    return settings.mysterySettingsObj?.tts?.voice_map_active === 'live' ? 'live' : 'google';
  }, [settings.mysterySettingsObj?.tts?.voice_map_active]);

  const liveSessions = useMysteryLiveSessions({
    scenarioId: mysteryState.scenarioId,
    caseId: mysteryState.caseId,
    showMysteryToast,
    showVoiceToast,
    getActiveVoiceMapProvider,
    setScenarioEntities: mysteryState.setScenarioEntities,
    setError,
    setMessage: () => {},
    setBusy: (val: boolean) => setBusy(val),
  });

  const interrogation = useInterrogation({
    scenarioId: mysteryState.scenarioId,
    showVoiceToast,
    getActiveVoiceMapProvider,
    interviewTtsEnabled: true,
    loadConversationEvents: mysteryState.loadConversationEvents,
    setError,
    setMessage: () => {},
    setBusy: (val: boolean) => setBusy(val),
  });

  const darkroom = useMysteryStateDarkroom(
    isAdmin,
    mysteryState.mysteryId,
    mysteryState.caseId,
    mysteryState.scenarioId,
    setBusy,
    setError,
    showMysteryToast,
    mysteryState.loadJobs,
    settings.getImageStyleSettings,
    settings.mysterySettingsObj,
    settings.setMysterySettingsObj,
    settings.setMysterySettingsDraft,
    settings.setMysterySettingsUpdatedAt,
    masterAssets.openJsonPreview
  );

  const handleOpenGameMgmt = React.useCallback(() => {
    showModalNow(modalRefs.gameMgmtRef, modalRefs.gameMgmtApiRef, modalState.setGameMgmtOpen);
  }, [showModalNow, modalRefs, modalState.setGameMgmtOpen]);

  const handleOpenCrimeLab = React.useCallback(() => {
    showModalNow(modalRefs.crimeLabRef, modalRefs.crimeLabApiRef, modalState.setCrimeLabOpen);
  }, [showModalNow, modalRefs, modalState.setCrimeLabOpen]);

  React.useEffect(() => {
    if (isAdmin) {
      (window as any).catn8_open_dossier = handleOpenGameMgmt;
      (window as any).catn8_open_crime_lab = handleOpenCrimeLab;
    }
    return () => {
      delete (window as any)['catn8_open_dossier'];
      delete (window as any)['catn8_open_crime_lab'];
    };
  }, [isAdmin, handleOpenGameMgmt, handleOpenCrimeLab]);

  React.useEffect(() => {
    if (isAuthed && !mysteryState.caseId && !busy) {
      window.location.href = '/mystery';
    }
  }, [isAuthed, mysteryState.caseId, busy]);

  const activeBriefing = mysteryState.scenario?.briefing_text ||
    mysteryState.scenarios.find((s) => String(s.id) === String(mysteryState.scenarioId))?.briefing_text ||
    (mysteryState.scenarios.length > 0 ? mysteryState.scenarios[0].briefing_text : '') ||
    (mysteryState.selectedCase as any)?.briefing ||
    ((mysteryState.selectedCase?.description && mysteryState.selectedCase.description.length > 20) ? mysteryState.selectedCase.description : '') ||
    '';

  return (
    <PageLayout
      page="sheriff_station"
      title="Sheriff Station"
      viewer={viewer}
      isAdmin={isAdmin}
      onLoginClick={onLoginClick}
      onLogout={onLogout}
      onAccountClick={onAccountClick}
    >
      <section className="section">
        <div className="container">
          <SheriffStationView
            isAdmin={isAdmin}
            caseTitle={mysteryState.scenario?.title || 'Current Case'}
            caseNumber={(() => {
              const currentCaseId = String(mysteryState.caseId);
              const index = mysteryState.cases.findIndex((c) => String(c.id) === currentCaseId);
              return index !== -1 ? index + 1 : undefined;
            })()}
            briefing={activeBriefing}
            onOpenInterrogationRoom={() => {
              showModalNow(modalRefs.suspectsModalRef, modalRefs.suspectsModalApiRef, modalState.setSuspectsModalOpen);
            }}
            onStudyCaseFiles={() => {
              if (mysteryState.scenarioId) mysteryState.loadScenarios(mysteryState.caseId);
              showModalNow(modalRefs.caseFilesRef, modalRefs.caseFilesApiRef, modalState.setCaseFilesOpen);
            }}
            onReadInterrogationLogs={() => {
              mysteryState.loadConversationEvents({ silent: false });
              showModalNow(modalRefs.interrogationLogsRef, modalRefs.interrogationLogsApiRef, modalState.setInterrogationLogsOpen);
            }}
            onReviewDepositions={() => {
              mysteryState.loadBackstories(mysteryState.mysteryId);
              showModalNow(modalRefs.depositionsRef, modalRefs.depositionsApiRef, modalState.setDepositionsOpen);
            }}
            onTalkToSheriff={() => {
              liveSessions.startSheriffLiveSession();
              showModalNow(modalRefs.sheriffTalkRef, modalRefs.sheriffTalkApiRef, modalState.setSheriffTalkOpen);
            }}
            onTalkToCsiDetective={() => {
              liveSessions.startCsiLiveSession();
              showModalNow(modalRefs.csiTalkRef, modalRefs.csiTalkApiRef, modalState.setCsiTalkOpen);
            }}
            onVisitLocation={() => showModalNow(modalRefs.playerLocationVisitRef, modalRefs.playerLocationVisitApiRef, modalState.setPlayerLocationVisitOpen)}
            onEvidenceLocker={() => {
              mysteryState.loadEvidence(mysteryState.scenarioId);
              showModalNow(modalRefs.evidenceStudyRef, modalRefs.evidenceStudyApiRef, modalState.setEvidenceStudyOpen);
            }}
            onOpenGameMgmt={handleOpenGameMgmt}
            onOpenCrimeLab={handleOpenCrimeLab}
            onClose={() => { window.location.href = '/mystery.php'; }}
          />
        </div>
      </section>

      <MysteryModals
        isAdmin={isAdmin}
        busy={busy}
        mysteryState={mysteryState}
        darkroom={darkroom}
        masterAssets={masterAssets}
        settings={settings}
        liveSessions={liveSessions}
        interrogation={interrogation}
        modalState={modalState}
        modalRefs={modalRefs}
        modalActions={modalActions}
        onOpenAiConfig={onOpenAiConfig}
        onOpenAiVoiceConfig={onOpenAiVoiceConfig}
        onOpenAiImageConfig={onOpenAiImageConfig}
        showMysteryToast={showMysteryToast}
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
    </PageLayout>
  );
}
