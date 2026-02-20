export interface IMysteryStateActionsProps {
  setBusy: (busy: boolean) => void;
  setError: (err: string) => void;
  showMysteryToast: (t: any) => void;
  scenarioId: string;
  caseId: string;
  mysteryId: string;
  backstoryId: string;
  backstoryTitleDraft: string;
  backstorySlugDraft: string;
  backstoryTextDraft: string;
  backstoryLocationMasterIdDraft: string;
  backstoryMetaDraft: string;
  backstoryFullTextDraft: string;
  loadEvidence: (sid: string | number) => Promise<void>;
  loadJobs: (cid: string | number) => Promise<void>;
  loadCases: (mid: string | number) => Promise<any[]>;
  loadMysteries: () => Promise<void>;
  loadBackstories: (mid: string | number) => Promise<any[]>;
  loadBackstoryDetails: (id: string | number) => Promise<void>;
  loadCaseMgmtBriefingForScenarioId: (sid: number) => Promise<void>;
  loadScenarios: (sid: string | number) => Promise<any[]>;
  loadScenarioEntities: (sid: string | number) => Promise<void>;
  loadScenario: (sid: string | number) => Promise<void>;
  watchJobToast: (opts: { caseId: number; jobId: number; label: string; onDone?: (result: any) => void }) => Promise<void>;
}
