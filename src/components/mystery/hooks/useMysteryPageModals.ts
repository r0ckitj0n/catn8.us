import React, { useRef } from 'react';
import { IBootstrapModal } from '../../../core/bootstrapModal';
export function useMysteryPageModals(
  showModalNow: (ref: React.RefObject<HTMLElement>, apiRef: React.MutableRefObject<IBootstrapModal | null>, setOpen?: (open: boolean) => void) => void,
  transitionToModal: (fromRef: React.RefObject<HTMLElement>, toRef: React.RefObject<HTMLElement>, toApiRef: React.MutableRefObject<IBootstrapModal | null>, setToOpen: (open: boolean) => void) => void,
  setCaseId: (id: string) => void,
  confirmMysterySelection: (id?: string) => void
) {
  const [gameMgmtOpen, setGameMgmtOpen] = React.useState(false);
  const [startResumeOpen, setStartResumeOpen] = React.useState(false);
  const [takeCaseModalOpen, setTakeCaseModalOpen] = React.useState(false);
  const [mysteryPickerOpen, setMysteryPickerOpen] = React.useState(false);
  const [caseMgmtOpen, setCaseMgmtOpen] = React.useState(false);
  const [locationsModalOpen, setLocationsModalOpen] = React.useState(false);
  const [weaponsModalOpen, setWeaponsModalOpen] = React.useState(false);
  const [motivesModalOpen, setMotivesModalOpen] = React.useState(false);
  const [backstoryModalOpen, setBackstoryModalOpen] = React.useState(false);
  const [caseSetupModalOpen, setCaseSetupModalOpen] = React.useState(false);
  const [scenariosModalOpen, setScenariosModalOpen] = React.useState(false);
  const [mysteriesModalOpen, setMysteriesModalOpen] = React.useState(false);
  const [storiesModalOpen, setStoriesModalOpen] = React.useState(false);
  const [seedStoryModalOpen, setSeedStoryModalOpen] = React.useState(false);
  const [advancedModalOpen, setAdvancedModalOpen] = React.useState(false);
  const [caseboardOpen, setCaseboardOpen] = React.useState(false);
  const [crimeLabOpen, setCrimeLabOpen] = React.useState(false);
  const [toolsOpen, setToolsOpen] = React.useState(false);
  const [interrogationOpen, setInterrogationOpen] = React.useState(false);
  const [suspectsModalOpen, setSuspectsModalOpen] = React.useState(false);
  const [rapSheetOpen, setRapSheetOpen] = React.useState(false);
  const [assetLibraryOpen, setAssetLibraryOpen] = React.useState(false);
  const [characterLibraryOpen, setCharacterLibraryOpen] = React.useState(false);
  const [mysterySettingsOpen, setMysterySettingsOpen] = React.useState(false);
  const [mysterySettingsEditorOpen, setMysterySettingsEditorOpen] = React.useState(false);
  const [jsonPreviewOpen, setJsonPreviewOpen] = React.useState(false);
  const [sheriffTalkOpen, setSheriffTalkOpen] = React.useState(false);
  const [csiTalkOpen, setCsiTalkOpen] = React.useState(false);
  const [evidenceStudyOpen, setEvidenceStudyOpen] = React.useState(false);
  const [caseFilesOpen, setCaseFilesOpen] = React.useState(false);
  const [interrogationLogsOpen, setInterrogationLogsOpen] = React.useState(false);
  const [depositionsOpen, setDepositionsOpen] = React.useState(false);
  const [playerLocationVisitOpen, setPlayerLocationVisitOpen] = React.useState(false);
  const takeCaseModalRef = useRef<HTMLDivElement>(null);
  const takeCaseModalApiRef = useRef<IBootstrapModal | null>(null);
  const crimeLabRef = useRef<HTMLDivElement>(null);
  const crimeLabApiRef = useRef<IBootstrapModal | null>(null);
  const locationsModalRef = useRef<HTMLDivElement>(null);
  const locationsModalApiRef = useRef<IBootstrapModal | null>(null);
  const weaponsModalRef = useRef<HTMLDivElement>(null);
  const weaponsModalApiRef = useRef<IBootstrapModal | null>(null);
  const motivesModalRef = useRef<HTMLDivElement>(null);
  const motivesModalApiRef = useRef<IBootstrapModal | null>(null);
  const storiesModalRef = useRef<HTMLDivElement>(null);
  const storiesModalApiRef = useRef<IBootstrapModal | null>(null);
  const caseMgmtRef = useRef<HTMLDivElement>(null);
  const caseMgmtApiRef = useRef<IBootstrapModal | null>(null);
  const startResumeRef = useRef<HTMLDivElement>(null);
  const startResumeApiRef = useRef<IBootstrapModal | null>(null);
  const interrogationRef = useRef<HTMLDivElement>(null);
  const interrogationApiRef = useRef<IBootstrapModal | null>(null);
  const suspectsModalRef = useRef<HTMLDivElement>(null);
  const suspectsModalApiRef = useRef<IBootstrapModal | null>(null);
  const rapSheetRef = useRef<HTMLDivElement>(null);
  const rapSheetApiRef = useRef<IBootstrapModal | null>(null);
  const mysteryPickerRef = useRef<HTMLDivElement>(null);
  const mysteryPickerApiRef = useRef<IBootstrapModal | null>(null);
  const gameMgmtRef = useRef<HTMLDivElement>(null);
  const gameMgmtApiRef = useRef<IBootstrapModal | null>(null);
  const backstoryModalRef = useRef<HTMLDivElement>(null);
  const backstoryModalApiRef = useRef<IBootstrapModal | null>(null);
  const caseSetupModalRef = useRef<HTMLDivElement>(null);
  const caseSetupModalApiRef = useRef<IBootstrapModal | null>(null);
  const scenariosModalRef = useRef<HTMLDivElement>(null);
  const scenariosModalApiRef = useRef<IBootstrapModal | null>(null);
  const mysteriesModalRef = useRef<HTMLDivElement>(null);
  const mysteriesModalApiRef = useRef<IBootstrapModal | null>(null);
  const seedStoryModalRef = useRef<HTMLDivElement>(null);
  const seedStoryModalApiRef = useRef<IBootstrapModal | null>(null);
  const advancedModalRef = useRef<HTMLDivElement>(null);
  const advancedModalApiRef = useRef<IBootstrapModal | null>(null);
  const caseboardRef = useRef<HTMLDivElement>(null);
  const caseboardApiRef = useRef<IBootstrapModal | null>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const toolsApiRef = useRef<IBootstrapModal | null>(null);
  const mysterySettingsRef = useRef<HTMLDivElement>(null);
  const mysterySettingsApiRef = useRef<IBootstrapModal | null>(null);
  const mysterySettingsEditorRef = useRef<HTMLDivElement>(null);
  const mysterySettingsEditorApiRef = useRef<IBootstrapModal | null>(null);
  const masterDeleteConfirmRef = useRef<HTMLDivElement>(null);
  const masterDeleteConfirmApiRef = useRef<IBootstrapModal | null>(null);
  const assetLibraryRef = useRef<HTMLDivElement>(null);
  const assetLibraryApiRef = useRef<IBootstrapModal | null>(null);
  const characterLibraryRef = useRef<HTMLDivElement>(null);
  const characterLibraryApiRef = useRef<IBootstrapModal | null>(null);
  const masterAssetDetailsRef = useRef<HTMLDivElement>(null);
  const masterAssetDetailsApiRef = useRef<IBootstrapModal | null>(null);
  const masterAssetJsonRef = useRef<HTMLDivElement>(null);
  const masterAssetJsonApiRef = useRef<IBootstrapModal | null>(null);
  const jsonPreviewRef = useRef<HTMLDivElement>(null);
  const jsonPreviewApiRef = useRef<IBootstrapModal | null>(null);
  const sheriffTalkRef = useRef<HTMLDivElement>(null);
  const sheriffTalkApiRef = useRef<IBootstrapModal | null>(null);
  const csiTalkRef = useRef<HTMLDivElement>(null);
  const csiTalkApiRef = useRef<IBootstrapModal | null>(null);
  const evidenceStudyRef = useRef<HTMLDivElement>(null);
  const evidenceStudyApiRef = useRef<IBootstrapModal | null>(null);
  const caseFilesRef = useRef<HTMLDivElement>(null);
  const caseFilesApiRef = useRef<IBootstrapModal | null>(null);
  const interrogationLogsRef = useRef<HTMLDivElement>(null);
  const interrogationLogsApiRef = useRef<IBootstrapModal | null>(null);
  const depositionsRef = useRef<HTMLDivElement>(null);
  const depositionsApiRef = useRef<IBootstrapModal | null>(null);
  const playerLocationVisitRef = useRef<HTMLDivElement>(null);
  const playerLocationVisitApiRef = useRef<IBootstrapModal | null>(null);
  const openTakeCaseModal = React.useCallback(() => {
    setTakeCaseModalOpen(true);
    showModalNow(takeCaseModalRef, takeCaseModalApiRef, setTakeCaseModalOpen);
  }, [showModalNow]);
  const takeCaseSelect = React.useCallback((cid: string | number) => {
    const caseIdStr = String(cid || '');
    if (!caseIdStr) {
      return;
    }
    try {
      setCaseId(caseIdStr);
      if (takeCaseModalApiRef.current) {
        takeCaseModalApiRef.current.hide();
      }
      window.location.href = '/sheriff_station.php'; return;
    } catch (err) {
      console.error("takeCaseSelect: CRITICAL ERROR", err);
    }
  }, [setCaseId, setTakeCaseModalOpen, setGameMgmtOpen, setCaseMgmtOpen, setMysteryPickerOpen]);
  const confirmMysterySelect = React.useCallback((id?: string) => {
    confirmMysterySelection(id);
    if (mysteryPickerApiRef.current) {
      mysteryPickerApiRef.current.hide();
    }
    setMysteryPickerOpen(false);
  }, [confirmMysterySelection, setMysteryPickerOpen]);
  return {
    state: {
      gameMgmtOpen, setGameMgmtOpen,
      startResumeOpen, setStartResumeOpen,
      takeCaseModalOpen, setTakeCaseModalOpen,
      mysteryPickerOpen, setMysteryPickerOpen,
      caseMgmtOpen, setCaseMgmtOpen,
      locationsModalOpen, setLocationsModalOpen,
      weaponsModalOpen, setWeaponsModalOpen,
      motivesModalOpen, setMotivesModalOpen,
      backstoryModalOpen, setBackstoryModalOpen,
      caseSetupModalOpen, setCaseSetupModalOpen,
      scenariosModalOpen, setScenariosModalOpen,
      mysteriesModalOpen, setMysteriesModalOpen,
      storiesModalOpen, setStoriesModalOpen,
      seedStoryModalOpen, setSeedStoryModalOpen,
      advancedModalOpen, setAdvancedModalOpen,
      caseboardOpen, setCaseboardOpen,
      crimeLabOpen, setCrimeLabOpen,
      toolsOpen, setToolsOpen,
      interrogationOpen, setInterrogationOpen,
      suspectsModalOpen, setSuspectsModalOpen,
      rapSheetOpen, setRapSheetOpen,
      assetLibraryOpen, setAssetLibraryOpen,
      characterLibraryOpen, setCharacterLibraryOpen,
      mysterySettingsOpen, setMysterySettingsOpen,
      mysterySettingsEditorOpen, setMysterySettingsEditorOpen,
      jsonPreviewOpen, setJsonPreviewOpen,
      sheriffTalkOpen, setSheriffTalkOpen,
      csiTalkOpen, setCsiTalkOpen,
      evidenceStudyOpen, setEvidenceStudyOpen,
      caseFilesOpen, setCaseFilesOpen,
      interrogationLogsOpen, setInterrogationLogsOpen,
      depositionsOpen, setDepositionsOpen,
      playerLocationVisitOpen, setPlayerLocationVisitOpen,
    },
    refs: {
      takeCaseModalRef, takeCaseModalApiRef,
      crimeLabRef, crimeLabApiRef,
      locationsModalRef, locationsModalApiRef,
      weaponsModalRef, weaponsModalApiRef,
      motivesModalRef, motivesModalApiRef,
      storiesModalRef, storiesModalApiRef,
      caseMgmtRef, caseMgmtApiRef,
      startResumeRef, startResumeApiRef,
      interrogationRef, interrogationApiRef,
      suspectsModalRef, suspectsModalApiRef,
      rapSheetRef, rapSheetApiRef,
      mysteryPickerRef, mysteryPickerApiRef,
      gameMgmtRef, gameMgmtApiRef,
      backstoryModalRef, backstoryModalApiRef,
      caseSetupModalRef, caseSetupModalApiRef,
      scenariosModalRef, scenariosModalApiRef,
      mysteriesModalRef, mysteriesModalApiRef,
      seedStoryModalRef, seedStoryModalApiRef,
      advancedModalRef, advancedModalApiRef,
      caseboardRef, caseboardApiRef,
      toolsRef, toolsApiRef,
      mysterySettingsRef, mysterySettingsApiRef,
      mysterySettingsEditorRef, mysterySettingsEditorApiRef,
      masterDeleteConfirmRef, masterDeleteConfirmApiRef,
      assetLibraryRef, assetLibraryApiRef,
      characterLibraryRef, characterLibraryApiRef,
      masterAssetDetailsRef, masterAssetDetailsApiRef,
      masterAssetJsonRef, masterAssetJsonApiRef,
      jsonPreviewRef, jsonPreviewApiRef,
      sheriffTalkRef, sheriffTalkApiRef,
      csiTalkRef, csiTalkApiRef,
      evidenceStudyRef, evidenceStudyApiRef,
      caseFilesRef, caseFilesApiRef,
      interrogationLogsRef, interrogationLogsApiRef,
      depositionsRef, depositionsApiRef,
      playerLocationVisitRef, playerLocationVisitApiRef,
    },
    actions: { openTakeCaseModal, takeCaseSelect, confirmMysterySelect }
  };
}
