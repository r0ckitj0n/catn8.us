import { IBuildWizardDocument, IBuildWizardStep } from '../buildWizard';

export type WizardView = 'launcher' | 'build';

export type BuildTabId =
  | 'overview'
  | 'start'
  | 'land'
  | 'permits'
  | 'site'
  | 'framing'
  | 'mep'
  | 'finishes'
  | 'desk'
  | 'completed';

export type StepDraftMap = Record<number, IBuildWizardStep>;

export type DocumentDraftMap = Record<number, { kind: string; caption: string; step_id: number }>;

export type StepType = IBuildWizardStep['step_type'];

export type LotSizeUnit = 'sqft' | 'acres';

export interface DateRangeChartProps {
  steps: IBuildWizardStep[];
  rangeStart: string;
  rangeEnd: string;
  compact?: boolean;
}

export interface FooterTimelineProps {
  steps: IBuildWizardStep[];
  rangeStart: string;
  rangeEnd: string;
}

export interface BuildWizardTimelineHelpers {
  tabLabelShort: (tabId: BuildTabId) => string;
  parseDate: (input: string | null | undefined) => Date | null;
  formatTimelineDate: (input: string | null | undefined) => string;
  toIsoDate: (date: Date) => string;
  stepDateRange: (step: IBuildWizardStep) => { start: Date | null; end: Date | null };
  stepPhaseBucket: (step: IBuildWizardStep) => BuildTabId;
}

export interface BuildWizardTimelinePalette {
  tabPhaseColors: Record<BuildTabId, string>;
  buildTabs: Array<{ id: BuildTabId; label: string }>;
}

export type BuildWizardDocumentType = IBuildWizardDocument;
