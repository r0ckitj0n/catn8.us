import React from 'react';
import './MysteryPage.css';
import { PageLayout } from '../layout/PageLayout';
import { useMysteryToasts } from '../mystery/hooks/useMysteryToasts';
import { useMysteryState } from '../mystery/hooks/useMysteryState';
import { useMysteryModals } from '../mystery/hooks/useMysteryModals';
import { useJobTracking } from '../mystery/hooks/useJobTracking';
import { useMysteryLiveSessions } from '../mystery/hooks/useMysteryLiveSessions';
import { useInterrogation } from '../mystery/hooks/useInterrogation';
import { useMasterAssets } from '../mystery/hooks/useMasterAssets';
import { useMysterySettings } from '../mystery/hooks/useMysterySettings';
import { useMysteryStateDarkroom } from '../mystery/hooks/useMysteryStateDarkroom';
import { useMysteryPageModals } from '../mystery/hooks/useMysteryPageModals';
import { cleanupModalArtifactsIfNoOpenModals } from '../../utils/modalUtils';

// Section imports
import { MysteryHeader } from './sections/mystery/MysteryHeader';
import { MysteryStationView } from './sections/mystery/MysteryStationView';
import { MysteryModals } from '../mystery/MysteryModals';
import { InvestigationModals } from '../mystery/sections/modals/InvestigationModals';
import { AppShellPageProps } from '../../types/pages/commonPageProps';

interface MysteryPageProps {
  viewer: AppShellPageProps['viewer'];
  isAdmin: boolean;
  onLoginClick: AppShellPageProps['onLoginClick'];
  onLogout: AppShellPageProps['onLogout'];
  onAccountClick: AppShellPageProps['onAccountClick'];
  onToast: any;
  onOpenAiImageConfig: () => void;
  onOpenAiConfig: () => void;
  onOpenAiVoiceConfig: () => void;
  onMysteryTitleChange: (title: string) => void;
  mysteryTitle: AppShellPageProps['mysteryTitle'];
  refreshViewer: () => Promise<any>;
}

/**
 * MysteryPage - Refactored Main Page
 * COMPLIANCE: File size < 250 lines
 */
export function MysteryPage({
  viewer, isAdmin, onLoginClick, onLogout, onAccountClick, onToast,
  onOpenAiImageConfig, onOpenAiConfig, onOpenAiVoiceConfig,
  onMysteryTitleChange, mysteryTitle, refreshViewer
}: MysteryPageProps) {
  const isAuthed = Boolean(viewer && viewer.id);

  // 1. Hook initializations
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const { showMysteryToast, showVoiceToast } = useMysteryToasts(onToast);
  const { watchJobToast } = useJobTracking(showMysteryToast);
  const mysteryState = useMysteryState(isAuthed, setError, setBusy, showMysteryToast);
  const { 
    mysteries, mysteryId, cachedMysteryTitle, scenarioId, caseId, setCaseId, 
    scenario, scenarioEntities, setScenarioEntities, loadMysteries, loadCases, 
    loadBackstories, loadBackstoryDetails, loadConversationEvents, loadEvidence, 
    loadScenarios, loadCaseMgmtBriefingForScenarioId,
    deleteScenarioArmed, setDeleteScenarioArmed,
    crimeSceneLocationIdDraft, setCrimeSceneLocationIdDraft,
    saveCrimeSceneLocationId, createScenario, deleteScenario,
    ensureDefaultScenarioForCase, reassignScenarioCase,
    createBackstory, spawnCaseFromBackstory,
    confirmMysterySelection,
    enqueueSpecificJob
  } = mysteryState;

  React.useEffect(() => {
    if (cachedMysteryTitle && cachedMysteryTitle !== mysteryTitle) {
      onMysteryTitleChange(cachedMysteryTitle);
    }
  }, [cachedMysteryTitle, mysteryTitle, onMysteryTitleChange]);

  const masterAssets = useMasterAssets(
    isAdmin, 
    mysteryId, 
    caseId, 
    scenarioId, 
    scenarioEntities, 
    enqueueSpecificJob,
    watchJobToast,
    showMysteryToast, 
    setError, 
    setBusy
  );

  const settings = useMysterySettings(isAdmin, mysteryId, masterAssets, showMysteryToast, setError);

  const getActiveVoiceMapProvider = React.useCallback(() => 
    (settings.mysterySettingsObj?.tts?.voice_map_active === 'live' ? 'live' : 'google'), 
    [settings.mysterySettingsObj?.tts?.voice_map_active]
  );

  const liveSessions = useMysteryLiveSessions({
    scenarioId,
    caseId,
    showMysteryToast, showVoiceToast, getActiveVoiceMapProvider,
    setScenarioEntities,
    setError, setMessage: () => {}, setBusy
  });

  const interrogation = useInterrogation({
    scenarioId,
    showVoiceToast, getActiveVoiceMapProvider,
    interviewTtsEnabled: true,
    loadConversationEvents,
    setError, setMessage: () => {}, setBusy
  });

  const darkroom = useMysteryStateDarkroom(
    isAdmin,
    mysteryId,
    caseId,
    scenarioId,
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

  const { showModalNow, transitionToModal } = useMysteryModals(setError, cleanupModalArtifactsIfNoOpenModals);
  const { state: modalState, refs: modalRefs, actions: modalActions } = useMysteryPageModals(showModalNow, transitionToModal, setCaseId, confirmMysterySelection);
  const { mysteryPickerOpen, setMysteryPickerOpen } = modalState;

  const openMysteryPicker = React.useCallback(async () => {
    if (mysteryPickerOpen) return;
    await loadMysteries();
    showModalNow(modalRefs.mysteryPickerRef, modalRefs.mysteryPickerApiRef, setMysteryPickerOpen);
  }, [mysteryPickerOpen, loadMysteries, showModalNow, modalRefs, setMysteryPickerOpen]);

  React.useEffect(() => {
    if (isAuthed && !mysteryId && !mysteryPickerOpen) {
      void openMysteryPicker();
    }
  }, [isAuthed, mysteryId, mysteryPickerOpen, openMysteryPicker]);

  const handleInterrogateSuspects = React.useCallback(() => showModalNow(modalRefs.suspectsModalRef, modalRefs.suspectsModalApiRef, modalState.setSuspectsModalOpen), [showModalNow, modalRefs, modalState.setSuspectsModalOpen]);
  const handleStudyCaseFiles = React.useCallback(() => {
    if (scenarioId) loadScenarios(caseId);
    showModalNow(modalRefs.caseFilesRef, modalRefs.caseFilesApiRef, modalState.setCaseFilesOpen);
  }, [scenarioId, caseId, loadScenarios, showModalNow, modalRefs, modalState.setCaseFilesOpen]);
  const handleReadInterrogationLogs = React.useCallback(() => {
    loadConversationEvents({ silent: false });
    showModalNow(modalRefs.interrogationLogsRef, modalRefs.interrogationLogsApiRef, modalState.setInterrogationLogsOpen);
  }, [loadConversationEvents, showModalNow, modalRefs, modalState.setInterrogationLogsOpen]);
  const handleReviewDepositions = React.useCallback(() => {
    loadBackstories(mysteryId);
    showModalNow(modalRefs.depositionsRef, modalRefs.depositionsApiRef, modalState.setDepositionsOpen);
  }, [loadBackstories, mysteryId, showModalNow, modalRefs, modalState.setDepositionsOpen]);
  const handleTalkToSheriff = React.useCallback(() => {
    liveSessions.startSheriffLiveSession();
    showModalNow(modalRefs.sheriffTalkRef, modalRefs.sheriffTalkApiRef, modalState.setSheriffTalkOpen);
  }, [liveSessions, showModalNow, modalRefs, modalState.setSheriffTalkOpen]);
  const handleTalkToCsiDetective = React.useCallback(() => {
    liveSessions.startCsiLiveSession();
    showModalNow(modalRefs.csiTalkRef, modalRefs.csiTalkApiRef, modalState.setCsiTalkOpen);
  }, [liveSessions, showModalNow, modalRefs, modalState.setCsiTalkOpen]);
  const handleVisitLocation = React.useCallback(() => showModalNow(modalRefs.playerLocationVisitRef, modalRefs.playerLocationVisitApiRef, modalState.setPlayerLocationVisitOpen), [showModalNow, modalRefs, modalState.setPlayerLocationVisitOpen]);
  const handleOpenEvidenceLocker = React.useCallback(() => {
    loadEvidence(scenarioId);
    showModalNow(modalRefs.evidenceStudyRef, modalRefs.evidenceStudyApiRef, modalState.setEvidenceStudyOpen);
  }, [loadEvidence, scenarioId, showModalNow, modalRefs, modalState.setEvidenceStudyOpen]);
  const handleOpenGameMgmt = React.useCallback(() => {
    showModalNow(modalRefs.gameMgmtRef, modalRefs.gameMgmtApiRef, modalState.setGameMgmtOpen);
  }, [showModalNow, modalRefs, modalState.setGameMgmtOpen]);
  const handleOpenCrimeLab = React.useCallback(() => showModalNow(modalRefs.crimeLabRef, modalRefs.crimeLabApiRef, modalState.setCrimeLabOpen), [showModalNow, modalRefs, modalState.setCrimeLabOpen]);

  React.useEffect(() => {
    (window as any).catn8_open_dossier = handleOpenGameMgmt;
    (window as any).catn8_open_crime_lab = handleOpenCrimeLab;
    return () => {
      delete (window as any).catn8_open_dossier;
      delete (window as any).catn8_open_crime_lab;
    };
  }, [handleOpenGameMgmt, handleOpenCrimeLab]);

  const handleCloseCase = React.useCallback(() => {
    setCaseId('');
    mysteryState.setScenarioId('');
    mysteryState.setScenario(null);
  }, [setCaseId, mysteryState.setScenarioId, mysteryState.setScenario]);

  const activeBriefing = scenario?.briefing_text || 
                         mysteryState.scenarios.find(s => String(s.id) === String(scenarioId))?.briefing_text ||
                         (mysteryState.scenarios.length > 0 ? mysteryState.scenarios[0].briefing_text : '') ||
                         (mysteryState.selectedCase as any)?.backstory_summary || 
                         (mysteryState.selectedCase as any)?.briefing || 
                         ((mysteryState.selectedCase?.description && mysteryState.selectedCase.description.length > 20) ? mysteryState.selectedCase.description : '') ||
                         (caseId ? (scenarioId ? `Briefing for ${mysteryState.selectedCase?.title || 'this case'} is being prepared...` : 'Selecting scenario...') : '');

  return (
    <PageLayout page="mystery" title="Mystery Game" viewer={viewer} isAdmin={isAdmin} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick}>
      <section className="section">
        <div className="container">
          <MysteryHeader 
            mysteryTitle={mysteryTitle}
            cachedMysteryTitle={cachedMysteryTitle}
            selectedMystery={mysteryState.selectedMystery}
            selectedCase={mysteryState.selectedCase}
            caseId={caseId}
            scenarioTitle={scenario?.title || ''}
            error={error}
            isAdmin={isAdmin}
            onOpenGameMgmt={handleOpenGameMgmt}
            onOpenCrimeLab={handleOpenCrimeLab}
            openMysteryPicker={openMysteryPicker}
            openTakeCaseModal={modalActions.openTakeCaseModal}
            onCloseCase={handleCloseCase}
          />

          <MysteryStationView 
            busy={busy}
            isAdmin={isAdmin}
            caseId={caseId}
            scenarioId={scenarioId}
            briefing={activeBriefing}
            onOpenInterrogationRoom={handleInterrogateSuspects}
            onStudyCaseFiles={handleStudyCaseFiles}
            onReadInterrogationLogs={handleReadInterrogationLogs}
            onReviewDepositions={handleReviewDepositions}
            onTalkToSheriff={handleTalkToSheriff}
            onTalkToCsiDetective={handleTalkToCsiDetective}
            onVisitLocation={handleVisitLocation}
            onEvidenceLocker={handleOpenEvidenceLocker}
            openTakeCaseModal={modalActions.openTakeCaseModal}
            onOpenGameMgmt={handleOpenGameMgmt}
            onOpenCrimeLab={handleOpenCrimeLab}
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
