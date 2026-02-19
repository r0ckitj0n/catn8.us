import React from 'react';
import { 
  IMystery, ICase, IScenario, IScenarioEntity, IEvidence, 
  IBackstory, IConversationEvent, IRapSheet, IStoryBookEntry, 
  IMasterCharacter, IMasterLocation, IMasterWeapon, IMasterMotive, 
  IVoiceProfile, ITtsVoice, IAgentProfile, IMysterySettings,
  InterrogationStatus, IJob
} from './game';
import { IToast } from './common';
import { IBootstrapModal } from '../core/bootstrapModal';
import { GeminiLiveClient } from '../core/GeminiLiveClient';

export interface IMysteryStateCore {
  mysteries: IMystery[];
  setMysteries: React.Dispatch<React.SetStateAction<IMystery[]>>;
  mysteryId: string;
  setMysteryId: React.Dispatch<React.SetStateAction<string>>;
  cachedMysteryTitle: string;
  setCachedMysteryTitle: React.Dispatch<React.SetStateAction<string>>;
  mysteryPickerList: IMystery[];
  setMysteryPickerList: React.Dispatch<React.SetStateAction<IMystery[]>>;
  mysteryPickerSelectedId: string;
  setMysteryPickerSelectedId: React.Dispatch<React.SetStateAction<string>>;
  mysteryPickerAdminOpen: boolean;
  setMysteryPickerAdminOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mysteryAdminCreateTitle: string;
  setMysteryAdminCreateTitle: React.Dispatch<React.SetStateAction<string>>;
  mysteryAdminCreateSlug: string;
  setMysteryAdminCreateSlug: React.Dispatch<React.SetStateAction<string>>;
  mysteryAdminEditTitle: string;
  setMysteryAdminEditTitle: React.Dispatch<React.SetStateAction<string>>;
  mysteryAdminEditSlug: string;
  setMysteryAdminEditSlug: React.Dispatch<React.SetStateAction<string>>;
  mysteryAdminEditArchived: boolean;
  setMysteryAdminEditArchived: React.Dispatch<React.SetStateAction<boolean>>;
  mysteryAdminDeleteArmed: boolean;
  setMysteryAdminDeleteArmed: React.Dispatch<React.SetStateAction<boolean>>;
  selectedMystery: IMystery | null;
  selectedCase: ICase | null;
  jobs: IJob[];
  setJobs: React.Dispatch<React.SetStateAction<IJob[]>>;
  cases: ICase[];
  setCases: React.Dispatch<React.SetStateAction<ICase[]>>;
  caseId: string;
  setCaseId: React.Dispatch<React.SetStateAction<string>>;
  scenarios: IScenario[];
  setScenarios: React.Dispatch<React.SetStateAction<IScenario[]>>;
  scenarioId: string;
  setScenarioId: React.Dispatch<React.SetStateAction<string>>;
  scenario: IScenario | null;
  setScenario: React.Dispatch<React.SetStateAction<IScenario | null>>;
  backstories: IBackstory[];
  setBackstories: React.Dispatch<React.SetStateAction<IBackstory[]>>;
  backstoryId: string;
  setBackstoryId: React.Dispatch<React.SetStateAction<string>>;
  backstoryDetails: IBackstory | null;
  setBackstoryDetails: React.Dispatch<React.SetStateAction<IBackstory | null>>;
  loadMysteries: () => Promise<void>;
  loadCases: (mid: string | number) => Promise<ICase[]>;
  loadJobs: (cid: string | number) => Promise<void>;
  loadScenarios: (cid: string | number) => Promise<IScenario[]>;
  loadBackstories: (mid: string | number) => Promise<IBackstory[]>;
  loadBackstoryDetails: (id: string | number) => Promise<void>;
  loadBackstoryFullStory: (id: string | number) => Promise<string | undefined>;
  toggleBackstoryArchived: (id: string | number) => Promise<void>;
  importDefaultMystery: () => Promise<void>;
  createMysteryFromPicker: () => Promise<void>;
  saveMysteryFromPicker: () => Promise<void>;
  deleteMysteryFromPicker: () => Promise<void>;
  confirmMysterySelection: (id?: string) => void;
}

export interface IMysteryStateScenario {
  characters: any[];
  setCharacters: React.Dispatch<React.SetStateAction<any[]>>;
  scenarioEntities: IScenarioEntity[];
  setScenarioEntities: React.Dispatch<React.SetStateAction<IScenarioEntity[]>>;
  caseNotes: any[];
  setCaseNotes: React.Dispatch<React.SetStateAction<any[]>>;
  lies: any[];
  setLies: React.Dispatch<React.SetStateAction<any[]>>;
  evidenceList: IEvidence[];
  setEvidenceList: React.Dispatch<React.SetStateAction<IEvidence[]>>;
  depositions: any[];
  setDepositions: React.Dispatch<React.SetStateAction<any[]>>;
  images: any[];
  setImages: React.Dispatch<React.SetStateAction<any[]>>;
  coldHardFacts: string;
  setColdHardFacts: React.Dispatch<React.SetStateAction<string>>;
  coldHardFactsUpdatedAt: string;
  setColdHardFactsUpdatedAt: React.Dispatch<React.SetStateAction<string>>;
  scenarioCrimeScene: string;
  setScenarioCrimeScene: React.Dispatch<React.SetStateAction<string>>;
  newScenario: { title: string };
  setNewScenario: React.Dispatch<React.SetStateAction<{ title: string }>>;
  entityNameById: Record<string, string>;
  setEntityNameById: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  crimeSceneLocationIdDraft: string;
  setCrimeSceneLocationIdDraft: React.Dispatch<React.SetStateAction<string>>;
  deleteScenarioArmed: boolean;
  setDeleteScenarioArmed: React.Dispatch<React.SetStateAction<boolean>>;
  loadScenario: (sid: string | number) => Promise<void>;
  loadScenarioEntities: (sid: string | number) => Promise<void>;
  loadCaseNotes: (sid: string | number) => Promise<void>;
  loadEvidence: (sid: string | number) => Promise<void>;
  createScenario: (e: React.FormEvent) => Promise<void>;
  deleteScenario: (sid: string | number) => Promise<void>;
  ensureDefaultScenarioForCase: (cid: string | number) => Promise<void>;
  reassignScenarioCase: (sid: string | number, cid: string | number) => Promise<void>;
  saveCrimeSceneLocationId: () => Promise<void>;
}

export interface IMysteryStateInvestigation {
  rapSheet: IRapSheet | null;
  setRapSheet: React.Dispatch<React.SetStateAction<IRapSheet | null>>;
  rapSheetBusy: boolean;
  setRapSheetBusy: React.Dispatch<React.SetStateAction<boolean>>;
  rapSheetError: string;
  setRapSheetError: React.Dispatch<React.SetStateAction<string>>;
  conversationEvents: IConversationEvent[];
  setConversationEvents: React.Dispatch<React.SetStateAction<IConversationEvent[]>>;
  conversationEventsBusy: boolean;
  setConversationEventsBusy: React.Dispatch<React.SetStateAction<boolean>>;
  conversationEventsError: string;
  setConversationEventsError: React.Dispatch<React.SetStateAction<string>>;
  loadRapSheet: (sid: string | number, eid: string | number) => Promise<void>;
  loadConversationEvents: (opts?: { silent?: boolean }) => Promise<void>;
}

export interface IMysteryStateCaseMgmt {
  caseMgmtMysteryId: string;
  setCaseMgmtMysteryId: React.Dispatch<React.SetStateAction<string>>;
  caseMgmtCases: ICase[];
  setCaseMgmtCases: React.Dispatch<React.SetStateAction<ICase[]>>;
  caseMgmtCaseId: string;
  setCaseMgmtCaseId: React.Dispatch<React.SetStateAction<string>>;
  caseMgmtScenarios: IScenario[];
  setCaseMgmtScenarios: React.Dispatch<React.SetStateAction<IScenario[]>>;
  caseMgmtScenarioId: string;
  setCaseMgmtScenarioId: React.Dispatch<React.SetStateAction<string>>;
  caseMgmtBriefingDraft: string;
  setCaseMgmtBriefingDraft: React.Dispatch<React.SetStateAction<string>>;
  caseMgmtCaseTitleDraft: string;
  setCaseMgmtCaseTitleDraft: React.Dispatch<React.SetStateAction<string>>;
  caseMgmtCaseSlugDraft: string;
  setCaseMgmtCaseSlugDraft: React.Dispatch<React.SetStateAction<string>>;
  caseMgmtCaseDescriptionDraft: string;
  setCaseMgmtCaseDescriptionDraft: React.Dispatch<React.SetStateAction<string>>;
  caseMgmtCaseArchivedDraft: boolean;
  setCaseMgmtCaseArchivedDraft: React.Dispatch<React.SetStateAction<boolean>>;
  caseMgmtCaseTemplateDraft: boolean;
  setCaseMgmtCaseTemplateDraft: React.Dispatch<React.SetStateAction<boolean>>;
  caseMgmtScenarioSnapshot: any;
  setCaseMgmtScenarioSnapshot: React.Dispatch<React.SetStateAction<any>>;
  csiDetectiveEntityIdDraft: string;
  setCsiDetectiveEntityIdDraft: React.Dispatch<React.SetStateAction<string>>;
  csiReportTextDraft: string;
  setCsiReportTextDraft: React.Dispatch<React.SetStateAction<string>>;
  csiReportJsonDraft: string;
  setCsiReportJsonDraft: React.Dispatch<React.SetStateAction<string>>;
  caseMgmtScenarioEntities: IScenarioEntity[];
  setCaseMgmtScenarioEntities: React.Dispatch<React.SetStateAction<IScenarioEntity[]>>;
  caseMgmtInvolvedCharacters: IScenarioEntity[];
  setCaseMgmtInvolvedCharacters: React.Dispatch<React.SetStateAction<IScenarioEntity[]>>;
  caseMgmtExpandedEntityIds: number[];
  setCaseMgmtExpandedEntityIds: React.Dispatch<React.SetStateAction<number[]>>;
  caseMgmtDepositionBusyByEntityId: Record<string, boolean>;
  setCaseMgmtDepositionBusyByEntityId: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  caseMgmtDepositionErrorByEntityId: Record<string, string>;
  setCaseMgmtDepositionErrorByEntityId: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  caseMgmtDepositionByEntityId: Record<string, { text: string; updated_at: string }>;
  setCaseMgmtDepositionByEntityId: React.Dispatch<React.SetStateAction<Record<string, { text: string; updated_at: string }>>>;
  caseAvailableMasterCharacterIds: number[];
  setCaseAvailableMasterCharacterIds: React.Dispatch<React.SetStateAction<number[]>>;
  caseAvailableMasterLocationIds: number[];
  setCaseAvailableMasterLocationIds: React.Dispatch<React.SetStateAction<number[]>>;
  caseAvailableMasterWeaponIds: number[];
  setCaseAvailableMasterWeaponIds: React.Dispatch<React.SetStateAction<number[]>>;
  caseAvailableMasterMotiveIds: number[];
  setCaseAvailableMasterMotiveIds: React.Dispatch<React.SetStateAction<number[]>>;
  loadCaseMgmtCases: (mid: string | number) => Promise<void>;
  loadCaseMgmtScenariosAndBriefing: () => Promise<void>;
  loadCaseMgmtBriefingForScenarioId: (sid: number) => Promise<void>;
  saveCaseMgmtCaseDetails: () => Promise<void>;
  saveCaseMgmtBriefing: () => Promise<void>;
  loadCaseMgmtDepositionForEntity: (eid: number) => Promise<void>;
  enqueueCaseMgmtGenerateDeposition: (eid: number) => Promise<void>;
  removeCaseMgmtLawEnforcementCharacter: (sei: number) => Promise<void>;
  recomputeCaseMgmtRoles: () => Promise<void>;
  saveCsiReport: () => Promise<void>;
}

export interface IMysteryStateStoryBook {
  seedStories: IStoryBookEntry[];
  setSeedStories: React.Dispatch<React.SetStateAction<IStoryBookEntry[]>>;
  storyBookBusy: boolean;
  setStoryBookBusy: React.Dispatch<React.SetStateAction<boolean>>;
  storyBookError: string;
  setStoryBookError: React.Dispatch<React.SetStateAction<string>>;
  storyBookIncludeArchived: boolean;
  setStoryBookIncludeArchived: React.Dispatch<React.SetStateAction<boolean>>;
  storyBookSelectedId: string;
  setStoryBookSelectedId: React.Dispatch<React.SetStateAction<string>>;
  storyBookTitleDraft: string;
  setStoryBookTitleDraft: React.Dispatch<React.SetStateAction<string>>;
  storyBookSlugDraft: string;
  setStoryBookSlugDraft: React.Dispatch<React.SetStateAction<string>>;
  storyBookSourceDraft: string;
  setStoryBookSourceDraft: React.Dispatch<React.SetStateAction<string>>;
  storyBookMetaDraft: string;
  setStoryBookMetaDraft: React.Dispatch<React.SetStateAction<string>>;
  storyBookSelectedIsArchived: boolean;
  setStoryBookSelectedIsArchived: React.Dispatch<React.SetStateAction<boolean>>;
  backstoryId: string;
  setBackstoryId: React.Dispatch<React.SetStateAction<string>>;
  backStoryCreateSource: string;
  setBackStoryCreateSource: React.Dispatch<React.SetStateAction<string>>;
  backStoryCreateTitle: string;
  setBackStoryCreateTitle: React.Dispatch<React.SetStateAction<string>>;
  backStoryCreateSlug: string;
  setBackStoryCreateSlug: React.Dispatch<React.SetStateAction<string>>;
  backStoryCreateLocationMasterId: string;
  setBackStoryCreateLocationMasterId: React.Dispatch<React.SetStateAction<string>>;
  backStoryCreateFromSeed: boolean;
  setBackStoryCreateFromSeed: React.Dispatch<React.SetStateAction<boolean>>;
  backStoryCreateMeta: string;
  setBackStoryCreateMeta: React.Dispatch<React.SetStateAction<string>>;
  storyLongDraft: string;
  setStoryLongDraft: React.Dispatch<React.SetStateAction<string>>;
  loadStoryBookEntries: () => Promise<void>;
  loadStoryBookEntry: (id: string | number) => Promise<void>;
  saveStoryBookEntry: () => Promise<void>;
  archiveStoryBookEntry: (id: string | number, archived: boolean) => Promise<void>;
  deleteStoryBookEntry: (id: string | number) => Promise<void>;
}

export interface IMysteryStateSync {
  storyGenSync: {
    active: boolean;
    status: string;
    error: string;
    crimeStatus: string;
    storyStatus: string;
    briefingStatus: string;
  };
  setStoryGenSync: React.Dispatch<React.SetStateAction<any>>;
  depositionGenSync: {
    active: boolean;
    status: string;
    error: string;
    queued: number;
    done: number;
    errorCount: number;
  };
  setDepositionGenSync: React.Dispatch<React.SetStateAction<any>>;
  coldHardFactsAudit: any;
  setColdHardFactsAudit: React.Dispatch<React.SetStateAction<any>>;
  coldHardFactsAuditOpen: boolean;
  setColdHardFactsAuditOpen: React.Dispatch<React.SetStateAction<boolean>>;
  coldHardFactsAuditBusy: boolean;
  setColdHardFactsAuditBusy: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface IMysteryStateActions {
  addEvidenceNote: (evidenceId: number, noteText: string) => Promise<void>;
  enqueueSpecificJob: (params: { action: string, spec: any, requireScenario: boolean, entityId?: any }) => Promise<any>;
  createBackstory: (params?: any) => Promise<string | undefined>;
  spawnCaseFromBackstory: (bid?: string | number) => Promise<void>;
  saveCaseSetup: (params: any) => Promise<void>;
  saveBackstoryDetails: () => Promise<void>;
  saveBackstoryFullStory: () => Promise<void>;
  generateCsiReport: (sid?: string | number) => Promise<void>;
  loadBackstories: (mid: string | number) => Promise<IBackstory[]>;
  loadBackstoryDetails: (id: string | number) => Promise<void>;
  loadScenarios: (cid: string | number) => Promise<IScenario[]>;
  watchJobToast: (opts: { caseId: number; jobId: number; label: string; onDone?: (result: any) => void }) => Promise<void>;
}

export interface IMysteryStateDarkroom {
  jobAction: string;
  setJobAction: React.Dispatch<React.SetStateAction<string>>;
  jobSpecText: string;
  setJobSpecText: React.Dispatch<React.SetStateAction<string>>;
  jobScopeCharacter: boolean;
  setJobScopeCharacter: React.Dispatch<React.SetStateAction<boolean>>;
  jobScopeLocation: boolean;
  setJobScopeLocation: React.Dispatch<React.SetStateAction<boolean>>;
  jobScopeWeapon: boolean;
  setJobScopeWeapon: React.Dispatch<React.SetStateAction<boolean>>;
  jobScopeMotive: boolean;
  setJobScopeMotive: React.Dispatch<React.SetStateAction<boolean>>;
  imageStyleMasterDraft: string;
  setImageStyleMasterDraft: React.Dispatch<React.SetStateAction<string>>;
  locationImageStyleDraft: string;
  setLocationImageStyleDraft: React.Dispatch<React.SetStateAction<string>>;
  mugshotImageStyleDraft: string;
  setMugshotImageStyleDraft: React.Dispatch<React.SetStateAction<string>>;
  weaponImageStyleDraft: string;
  setWeaponImageStyleDraft: React.Dispatch<React.SetStateAction<string>>;
  enqueueJob: (e: React.FormEvent) => Promise<void>;
  previewEnqueueJobJson: () => void;
  clearQueuedJobs: () => Promise<void>;
  clearCompletedJobs: () => Promise<void>;
  deleteQueuedJob: (id: number | string) => Promise<void>;
  saveImageStyleSetting: (params: { key: string; value: string }) => Promise<void>;
}

export interface IMysteryState extends IMysteryStateCore, IMysteryStateScenario, IMysteryStateInvestigation, IMysteryStateCaseMgmt, IMysteryStateStoryBook, IMysteryStateSync, IMysteryStateActions {
  deleteScenarioArmed: boolean;
  setDeleteScenarioArmed: React.Dispatch<React.SetStateAction<boolean>>;
  scenarioCast: {
    entityId: string | number;
    agentId: number;
    role: string;
    name: string;
    thumbUrl: string;
    irImageUrl: string;
    blurb: string;
  }[];
  selectedMystery: IMystery | null;
  selectedCase: ICase | null;
  showMysteryToast: (t: any) => void;
}

export interface IMasterAssetsCore {
  masterCharacters: IMasterCharacter[];
  setMasterCharacters: React.Dispatch<React.SetStateAction<IMasterCharacter[]>>;
  masterLocations: IMasterLocation[];
  setMasterLocations: React.Dispatch<React.SetStateAction<IMasterLocation[]>>;
  masterWeapons: IMasterWeapon[];
  setMasterWeapons: React.Dispatch<React.SetStateAction<IMasterWeapon[]>>;
  masterMotives: IMasterMotive[];
  setMasterMotives: React.Dispatch<React.SetStateAction<IMasterMotive[]>>;
  voiceProfiles: IVoiceProfile[];
  setVoiceProfiles: React.Dispatch<React.SetStateAction<IVoiceProfile[]>>;
  masterAssetsIncludeArchived: boolean;
  setMasterAssetsIncludeArchived: React.Dispatch<React.SetStateAction<boolean>>;
  masterAssetNameDrafts: Record<string, string>;
  setMasterAssetNameDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  pendingMasterDelete: { type: string; item: any } | null;
  setPendingMasterDelete: React.Dispatch<React.SetStateAction<{ type: string; item: any } | null>>;
  newMasterCharacter: { name: string };
  setNewMasterCharacter: React.Dispatch<React.SetStateAction<{ name: string }>>;
  newMasterLocation: { name: string };
  setNewMasterLocation: React.Dispatch<React.SetStateAction<{ name: string }>>;
  newMasterWeapon: { name: string };
  setNewMasterWeapon: React.Dispatch<React.SetStateAction<{ name: string }>>;
  newMasterMotive: { name: string };
  setNewMasterMotive: React.Dispatch<React.SetStateAction<{ name: string }>>;
  masterCharacterImageUrl: string;
  setMasterCharacterImageUrl: React.Dispatch<React.SetStateAction<string>>;
  masterCharacterMugshotUrl: string;
  setMasterCharacterMugshotUrl: React.Dispatch<React.SetStateAction<string>>;
  masterCharacterIrUrls: string[];
  setMasterCharacterIrUrls: React.Dispatch<React.SetStateAction<string[]>>;
  masterCharacterIrIndex: number;
  setMasterCharacterIrIndex: React.Dispatch<React.SetStateAction<number>>;
  masterCharacterIrEmotionEnabled: Record<string, boolean>;
  setMasterCharacterIrEmotionEnabled: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  masterCharacterIrEmotions: string[];
  masterAssetJsonOpen: boolean;
  setMasterAssetJsonOpen: React.Dispatch<React.SetStateAction<boolean>>;
  masterAssetJsonText: string;
  setMasterAssetJsonText: React.Dispatch<React.SetStateAction<string>>;
  masterAssetJsonError: string;
  setMasterAssetJsonError: React.Dispatch<React.SetStateAction<string>>;
  masterAssetJsonTitle: string;
  setMasterAssetJsonTitle: React.Dispatch<React.SetStateAction<string>>;
  jsonPreviewOpen: boolean;
  setJsonPreviewOpen: React.Dispatch<React.SetStateAction<boolean>>;
  jsonPreviewText: string;
  setJsonPreviewText: React.Dispatch<React.SetStateAction<string>>;
  jsonPreviewTitle: string;
  setJsonPreviewTitle: React.Dispatch<React.SetStateAction<string>>;
  masterCharacterDepositionText: string;
  setMasterCharacterDepositionText: React.Dispatch<React.SetStateAction<string>>;
  masterCharacterDepositionUpdatedAt: string;
  setMasterCharacterDepositionUpdatedAt: React.Dispatch<React.SetStateAction<string>>;
  masterCharacterDepositionError: string;
  setMasterCharacterDepositionError: React.Dispatch<React.SetStateAction<string>>;
  masterCharacterDepositionBusy: boolean;
  setMasterCharacterDepositionBusy: React.Dispatch<React.SetStateAction<boolean>>;
  needsCleanup: boolean;
  setNeedsCleanup: React.Dispatch<React.SetStateAction<boolean>>;
  needsLinkImport: boolean;
  setNeedsLinkImport: React.Dispatch<React.SetStateAction<boolean>>;
  loadVoiceProfiles: (isAdmin: boolean) => Promise<void>;
  loadMasterCharacters: () => Promise<IMasterCharacter[]>;
  loadMasterLocations: () => Promise<IMasterLocation[]>;
  loadMasterWeapons: () => Promise<IMasterWeapon[]>;
  loadMasterMotives: () => Promise<IMasterMotive[]>;
  loadMasterCharacterImages: (id: string | number) => Promise<void>;
  openJsonPreview: (opts: { title: string; payload: any }) => void;
}

export interface IMasterAssetsDetails {
  masterAssetDetailsOpen: boolean;
  setMasterAssetDetailsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  masterAssetDetailsItem: any;
  setMasterAssetDetailsItem: React.Dispatch<React.SetStateAction<any>>;
  masterAssetDetailsType: string;
  setMasterAssetDetailsType: React.Dispatch<React.SetStateAction<string>>;
  masterAssetDetailsName: string;
  setMasterAssetDetailsName: React.Dispatch<React.SetStateAction<string>>;
  masterAssetDetailsSlug: string;
  setMasterAssetDetailsSlug: React.Dispatch<React.SetStateAction<string>>;
  masterAssetDetailsFields: Record<string, any>;
  setMasterAssetDetailsFields: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  masterAssetDetailsLocks: Record<string, number>;
  setMasterAssetDetailsLocks: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  masterAssetDetailsData: Record<string, any>;
  setMasterAssetDetailsData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  masterAssetDetailsRapport: any;
  setMasterAssetDetailsRapport: React.Dispatch<React.SetStateAction<any>>;
  masterAssetDetailsFavorites: any;
  setMasterAssetDetailsFavorites: React.Dispatch<React.SetStateAction<any>>;
  masterAssetDetailsDataText: string;
  masterCharacterRapport: any;
  masterCharacterMissingRequiredImageFields: string[];
  isMasterAssetDetailsDirty: boolean;
  masterAssetDetailsCleanSnapshotRef: React.MutableRefObject<string>;
  getMasterAssetFieldLocks: () => Record<string, number>;
  loadMasterAssetFieldLocks: (type: string, id: string | number) => Promise<void>;
  toggleMasterAssetFieldLock: (lockKey: string) => Promise<void>;
  isMasterAssetFieldLocked: (lockKey: string) => boolean;
  openMasterAssetDetails: (opts: { type: string; item: any }) => void;
  updateMasterAssetDetailsDataObject: (updater: any) => void;
  getMasterAssetDataObject: () => any;
  resetMasterAssetDetails: () => void;
  buildMasterAssetDetailsSnapshot: () => string;
}

export interface IMasterAssetsActions {
  upsertMasterCharacter: (e?: React.FormEvent) => Promise<void>;
  archiveMasterAsset: (params: { type: string; id: string | number; is_archived: number }) => Promise<void>;
  confirmMasterAssetDelete: () => Promise<void>;
  generateMasterAssetContent: () => Promise<void>;
  clearMasterAssetFields: () => Promise<void>;
  upsertMasterLocation: (e?: React.FormEvent) => Promise<void>;
  upsertMasterWeapon: (e?: React.FormEvent) => Promise<void>;
  upsertMasterMotive: (e?: React.FormEvent) => Promise<void>;
  setMasterAssetRegenLock: (opts: { type: string; item: any; is_regen_locked: number }) => Promise<void>;
  saveMasterAssetDetails: () => Promise<void>;
  requestMasterAssetDelete: (opts: { type: string; item: any }) => void;
  backfillMasterAssetColumnsFromJson: () => Promise<void>;
  checkMaintenanceNeeded: () => Promise<void>;
  cleanupMasterOnlyFieldsForMystery: () => Promise<void>;
  linkAndImportCaseDetailsForMystery: () => Promise<void>;
  getMasterAssetNameDraft: (opts: { type: string; id: string | number; fallback: string }) => string;
  updateMasterAssetNameDraft: (opts: { type: string; id: string | number; value: string }) => void;
  saveMasterAssetInlineName: (opts: { type: string; item: any }) => Promise<void>;
  uploadMasterCharacterImage: (opts: { kind: 'character' | 'mugshot' | 'ir', file: File }) => Promise<void>;
  deleteMasterCharacterImage: (opts: { kind: 'character' | 'mugshot' | 'ir', url?: string }) => Promise<void>;
  openMasterCharacterImagePrompt: (opts: { kind: 'character' | 'mugshot' | 'ir' }) => Promise<void>;
  generateMasterCharacterImages: (opts: { kind: 'character' | 'mugshot' | 'ir' }) => Promise<void>;
  generateAllMissingMasterCharacterImages: () => Promise<void>;
  uploadMasterAssetImage: (opts: { file: File }) => Promise<void>;
  generateMasterAssetPrimaryImage: () => Promise<void>;
  deleteMasterAssetPrimaryImage: () => Promise<void>;
  openMasterAssetDerivedJson: () => Promise<void>;
  loadMasterCharacterDeposition: () => Promise<void>;
}

export interface IMasterAssets extends IMasterAssetsCore, IMasterAssetsDetails, IMasterAssetsActions {
  caseId: string | number;
  scenarioId: string | number;
  masterCharacterScenarioEntityId: number | null;
  enqueueSpecificJob: (params: { action: string, spec: any, requireScenario: boolean, entityId?: any }) => Promise<any>;
}

export interface IMysterySettingsCore {
  mysterySettingsObj: IMysterySettings;
  setMysterySettingsObj: React.Dispatch<React.SetStateAction<IMysterySettings>>;
  mysterySettingsDraft: string;
  setMysterySettingsDraft: React.Dispatch<React.SetStateAction<string>>;
  mysterySettingsUpdatedAt: string;
  setMysterySettingsUpdatedAt: React.Dispatch<React.SetStateAction<string>>;
  mysterySettingsObjRef: React.MutableRefObject<IMysterySettings>;
  loadMysterySettings: () => Promise<void>;
  saveMysterySettingsObject: () => Promise<void>;
}

export interface IMysterySettingsVoices {
  ttsVoices: ITtsVoice[];
  setTtsVoices: React.Dispatch<React.SetStateAction<ITtsVoice[]>>;
  ttsVoicesError: string;
  setTtsVoicesError: React.Dispatch<React.SetStateAction<string>>;
  ttsVoicesLoadedAt: string;
  setTtsVoicesLoadedAt: React.Dispatch<React.SetStateAction<string>>;
  agentProfiles: IAgentProfile[];
  setAgentProfiles: React.Dispatch<React.SetStateAction<IAgentProfile[]>>;
  agentProfilesError: string;
  setAgentProfilesError: React.Dispatch<React.SetStateAction<string>>;
  agentProfilesLoadedAt: string;
  setAgentProfilesLoadedAt: React.Dispatch<React.SetStateAction<string>>;
  voiceMapRowIds: string[];
  voiceIdToCharacters: Map<string, string[]>;
  voiceIdSuggestions: string[];
  getActiveVoiceMap: (settings: IMysterySettings) => any;
  loadTtsVoices: () => Promise<void>;
  loadAgentProfiles: () => Promise<void>;
  addVoiceMapEntry: (voiceId: string) => void;
  addMissingVoiceIdsFromCharacters: () => void;
  autoAssignVoiceMapBestMatchAndSave: () => Promise<void>;
  deleteVoiceMapEntry: (voiceId: string) => void;
  toggleVoiceMapLock: (voiceId: string) => void;
  updateVoiceMapEntry: (voiceId: string, field: string, value: any) => void;
}

export interface IMysterySettingsImages {
  getImageStyleSettings: () => { master: string; location: string; weapon: string; mugshot: string };
  buildStyledImagePrompt: (params: { promptText: string, kind: 'location' | 'mugshot' | 'weapon' | 'generic' }) => string;
}

export interface IMysterySettingsUtils {
  countVoiceMapVoiceNames: (settings: IMysterySettings) => number;
  ensureAiModelSync: (s: IMysterySettings) => any;
  ensureTtsVoiceMaps: (s: IMysterySettings) => IMysterySettings;
  stableHashInt: (raw: unknown) => number;
}

export interface IMysterySettingsFull extends IMysterySettingsCore, IMysterySettingsVoices, IMysterySettingsImages, IMysterySettingsUtils {
  mysterySettingsTab: string;
  setMysterySettingsTab: React.Dispatch<React.SetStateAction<string>>;
  mysterySettingsEditorTarget: string;
  setMysterySettingsEditorTarget: React.Dispatch<React.SetStateAction<string>>;
  mysterySettingsEditorText: string;
  setMysterySettingsEditorText: React.Dispatch<React.SetStateAction<string>>;
  openMysterySettingsEditor: () => void;
}

export interface IInterrogation {
  interrogationEntityId: number;
  setInterrogationEntityId: React.Dispatch<React.SetStateAction<number>>;
  interrogationEntityName: string;
  setInterrogationEntityName: React.Dispatch<React.SetStateAction<string>>;
  interrogationAgentId: number;
  setInterrogationAgentId: React.Dispatch<React.SetStateAction<number>>;
  interrogationStatus: InterrogationStatus;
  setInterrogationStatus: React.Dispatch<React.SetStateAction<InterrogationStatus>>;
  interrogationInputText: string;
  setInterrogationInputText: React.Dispatch<React.SetStateAction<string>>;
  interrogationOutputText: string;
  setInterrogationOutputText: React.Dispatch<React.SetStateAction<string>>;
  interrogationImageUrlFinal: string;
  interrogationTypedQuestion: string;
  setInterrogationTypedQuestion: React.Dispatch<React.SetStateAction<string>>;
  interrogationTypedAudioUrl: string;
  setInterrogationTypedAudioUrl: React.Dispatch<React.SetStateAction<string>>;
  interrogationTypedAudioRef: React.RefObject<HTMLAudioElement>;
  askInterrogationTyped: (e: React.FormEvent) => Promise<void>;
  stopInterrogationStreaming: () => Promise<void>;
  startInterrogationStreaming: () => Promise<void>;
}

export interface IGeminiLiveSession {
  status: InterrogationStatus;
  setStatus: React.Dispatch<React.SetStateAction<InterrogationStatus>>;
  inputText: string;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  outputText: string;
  setOutputText: React.Dispatch<React.SetStateAction<string>>;
  name: string;
  startSession: () => Promise<void>;
  startStreaming: () => Promise<void>;
  stopStreaming: () => Promise<void>;
}

export interface IMysteryLiveSessions {
  sheriffLiveStatus: InterrogationStatus;
  sheriffLiveInputText: string;
  sheriffLiveOutputText: string;
  scenarioSheriffName: string;
  startSheriffLiveSession: () => Promise<void>;
  startSheriffLiveStreaming: () => Promise<void>;
  stopSheriffLiveStreaming: () => Promise<void>;
  csiLiveStatus: InterrogationStatus;
  csiLiveInputText: string;
  csiLiveOutputText: string;
  scenarioCsiDetectiveName: string;
  startCsiLiveSession: () => Promise<void>;
  startCsiLiveStreaming: () => Promise<void>;
  stopCsiLiveStreaming: () => Promise<void>;
}

export interface IMysteryModals {
  showModalNow: (ref: React.RefObject<HTMLElement>, apiRef: React.MutableRefObject<IBootstrapModal | null>, setOpen?: (open: boolean) => void) => void;
  transitionToModal: (fromRef: React.RefObject<HTMLElement>, toRef: React.RefObject<HTMLElement>, toApiRef: React.MutableRefObject<IBootstrapModal | null>, setToOpen: (open: boolean) => void) => void;
  syncStackedMysteryModalDimming: () => void;
  cleanupModalArtifactsIfNoOpenModals: () => void;
}

export interface IMysteryPageModals {
  state: {
    gameMgmtOpen: boolean;
    setGameMgmtOpen: (open: boolean) => void;
    takeCaseModalOpen: boolean;
    setTakeCaseModalOpen: (open: boolean) => void;
    mysteryPickerOpen: boolean;
    setMysteryPickerOpen: (open: boolean) => void;
    caseMgmtOpen: boolean;
    setCaseMgmtOpen: (open: boolean) => void;
    locationsModalOpen: boolean;
    setLocationsModalOpen: (open: boolean) => void;
    weaponsModalOpen: boolean;
    setWeaponsModalOpen: (open: boolean) => void;
    motivesModalOpen: boolean;
    setMotivesModalOpen: (open: boolean) => void;
    backstoryModalOpen: boolean;
    setBackstoryModalOpen: (open: boolean) => void;
    caseSetupModalOpen: boolean;
    setCaseSetupModalOpen: (open: boolean) => void;
    scenariosModalOpen: boolean;
    setScenariosModalOpen: (open: boolean) => void;
    mysteriesModalOpen: boolean;
    setMysteriesModalOpen: (open: boolean) => void;
    storiesModalOpen: boolean;
    setStoriesModalOpen: (open: boolean) => void;
    seedStoryModalOpen: boolean;
    setSeedStoryModalOpen: (open: boolean) => void;
    advancedModalOpen: boolean;
    setAdvancedModalOpen: (open: boolean) => void;
    caseboardOpen: boolean;
    setCaseboardOpen: (open: boolean) => void;
    crimeLabOpen: boolean;
    setCrimeLabOpen: (open: boolean) => void;
    toolsOpen: boolean;
    setToolsOpen: (open: boolean) => void;
    interrogationOpen: boolean;
    setInterrogationOpen: (open: boolean) => void;
    rapSheetOpen: boolean;
    setRapSheetOpen: (open: boolean) => void;
    assetLibraryOpen: boolean;
    setAssetLibraryOpen: (open: boolean) => void;
    characterLibraryOpen: boolean;
    setCharacterLibraryOpen: (open: boolean) => void;
    mysterySettingsOpen: boolean;
    setMysterySettingsOpen: (open: boolean) => void;
    mysterySettingsEditorOpen: boolean;
    setMysterySettingsEditorOpen: (open: boolean) => void;
    jsonPreviewOpen: boolean;
    setJsonPreviewOpen: (open: boolean) => void;
    sheriffTalkOpen: boolean;
    setSheriffTalkOpen: (open: boolean) => void;
    csiTalkOpen: boolean;
    setCsiTalkOpen: (open: boolean) => void;
    evidenceStudyOpen: boolean;
    setEvidenceStudyOpen: (open: boolean) => void;
    caseFilesOpen: boolean;
    setCaseFilesOpen: (open: boolean) => void;
    interrogationLogsOpen: boolean;
    setInterrogationLogsOpen: (open: boolean) => void;
    depositionsOpen: boolean;
    setDepositionsOpen: (open: boolean) => void;
    playerLocationVisitOpen: boolean;
    setPlayerLocationVisitOpen: (open: boolean) => void;
  };
    refs: {
    takeCaseModalRef: React.RefObject<HTMLDivElement>;
    takeCaseModalApiRef: React.MutableRefObject<IBootstrapModal | null>;
    crimeLabRef: React.RefObject<HTMLDivElement>;
    crimeLabApiRef: React.MutableRefObject<IBootstrapModal | null>;
    locationsModalRef: React.RefObject<HTMLDivElement>;
    locationsModalApiRef: React.MutableRefObject<IBootstrapModal | null>;
    weaponsModalRef: React.RefObject<HTMLDivElement>;
    weaponsModalApiRef: React.MutableRefObject<IBootstrapModal | null>;
    motivesModalRef: React.RefObject<HTMLDivElement>;
    motivesModalApiRef: React.MutableRefObject<IBootstrapModal | null>;
    storiesModalRef: React.RefObject<HTMLDivElement>;
    storiesModalApiRef: React.MutableRefObject<IBootstrapModal | null>;
    caseMgmtRef: React.RefObject<HTMLDivElement>;
    caseMgmtApiRef: React.MutableRefObject<IBootstrapModal | null>;
    startResumeRef: React.RefObject<HTMLDivElement>;
    startResumeApiRef: React.MutableRefObject<IBootstrapModal | null>;
    interrogationRef: React.RefObject<HTMLDivElement>;
    interrogationApiRef: React.MutableRefObject<IBootstrapModal | null>;
    rapSheetRef: React.RefObject<HTMLDivElement>;
    rapSheetApiRef: React.MutableRefObject<IBootstrapModal | null>;
    mysteryPickerRef: React.RefObject<HTMLDivElement>;
    mysteryPickerApiRef: React.MutableRefObject<IBootstrapModal | null>;
    gameMgmtRef: React.RefObject<HTMLDivElement>;
    gameMgmtApiRef: React.MutableRefObject<IBootstrapModal | null>;
    backstoryModalRef: React.RefObject<HTMLDivElement>;
    backstoryModalApiRef: React.MutableRefObject<IBootstrapModal | null>;
    caseSetupModalRef: React.RefObject<HTMLDivElement>;
    caseSetupModalApiRef: React.MutableRefObject<IBootstrapModal | null>;
    scenariosModalRef: React.RefObject<HTMLDivElement>;
    scenariosModalApiRef: React.MutableRefObject<IBootstrapModal | null>;
    suspectsModalRef: React.RefObject<HTMLDivElement>;
    suspectsModalApiRef: React.MutableRefObject<IBootstrapModal | null>;
    mysteriesModalRef: React.RefObject<HTMLDivElement>;
    mysteriesModalApiRef: React.MutableRefObject<IBootstrapModal | null>;
    seedStoryModalRef: React.RefObject<HTMLDivElement>;
    seedStoryModalApiRef: React.MutableRefObject<IBootstrapModal | null>;
    advancedModalRef: React.RefObject<HTMLDivElement>;
    advancedModalApiRef: React.MutableRefObject<IBootstrapModal | null>;
    caseboardRef: React.RefObject<HTMLDivElement>;
    caseboardApiRef: React.MutableRefObject<IBootstrapModal | null>;
    toolsRef: React.RefObject<HTMLDivElement>;
    toolsApiRef: React.MutableRefObject<IBootstrapModal | null>;
    mysterySettingsRef: React.RefObject<HTMLDivElement>;
    mysterySettingsApiRef: React.MutableRefObject<IBootstrapModal | null>;
    mysterySettingsEditorRef: React.RefObject<HTMLDivElement>;
    mysterySettingsEditorApiRef: React.MutableRefObject<IBootstrapModal | null>;
    masterDeleteConfirmRef: React.RefObject<HTMLDivElement>;
    masterDeleteConfirmApiRef: React.MutableRefObject<IBootstrapModal | null>;
    assetLibraryRef: React.RefObject<HTMLDivElement>;
    assetLibraryApiRef: React.MutableRefObject<IBootstrapModal | null>;
    characterLibraryRef: React.RefObject<HTMLDivElement>;
    characterLibraryApiRef: React.MutableRefObject<IBootstrapModal | null>;
    masterAssetDetailsRef: React.RefObject<HTMLDivElement>;
    masterAssetDetailsApiRef: React.MutableRefObject<IBootstrapModal | null>;
    masterAssetJsonRef: React.RefObject<HTMLDivElement>;
    masterAssetJsonApiRef: React.MutableRefObject<IBootstrapModal | null>;
    jsonPreviewRef: React.RefObject<HTMLDivElement>;
    jsonPreviewApiRef: React.MutableRefObject<IBootstrapModal | null>;
    sheriffTalkRef: React.RefObject<HTMLDivElement>;
    sheriffTalkApiRef: React.MutableRefObject<IBootstrapModal | null>;
    csiTalkRef: React.RefObject<HTMLDivElement>;
    csiTalkApiRef: React.MutableRefObject<IBootstrapModal | null>;
    evidenceStudyRef: React.RefObject<HTMLDivElement>;
    evidenceStudyApiRef: React.MutableRefObject<IBootstrapModal | null>;
    caseFilesRef: React.RefObject<HTMLDivElement>;
    caseFilesApiRef: React.MutableRefObject<IBootstrapModal | null>;
    interrogationLogsRef: React.RefObject<HTMLDivElement>;
    interrogationLogsApiRef: React.MutableRefObject<IBootstrapModal | null>;
    depositionsRef: React.RefObject<HTMLDivElement>;
    depositionsApiRef: React.MutableRefObject<IBootstrapModal | null>;
    playerLocationVisitRef: React.RefObject<HTMLDivElement>;
    playerLocationVisitApiRef: React.MutableRefObject<IBootstrapModal | null>;
  };
  actions: {
    openTakeCaseModal: () => void;
    takeCaseSelect: (cid: string | number) => void;
    confirmMysterySelect: () => void;
  };
}
