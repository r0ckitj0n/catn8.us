import { IBuildWizardDocument, IBuildWizardStep } from '../../../types/buildWizard';
import { BuildTabId } from '../../../types/pages/buildWizardPage';
import {
  calculateDurationDays,
  detectLotSizeUnit,
  formatDate,
  formatTimelineDate,
  getDefaultRange,
  lotSizeInputToSqftAuto,
  lotSizeSqftToDisplayInput,
  parseDate,
  stepDateRange,
  toIsoDate,
  toNumberOrNull,
} from './buildWizardDateUtils';
import {
  prettyPhaseLabel,
  recommendPhaseKeyForStep,
  stepPhaseBucket,
  tabLabelShort,
} from './buildWizardPhaseUtils';
import {
  fileExtensionFromName,
  getStepPastelColor,
  mimeGroupLabel,
  parseUrlState,
  pushUrlState,
  segmentBackground,
  withDownloadFlag,
} from './buildWizardViewUtils';

export function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(Number(value))) {
    return '-';
  }
  return Number(value).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function thumbnailKindLabel(doc: IBuildWizardDocument): string {
  const extension = fileExtensionFromName(doc.original_name);
  if (extension) {
    return extension;
  }
  return mimeGroupLabel(doc.mime_type);
}

export function isPdfDocument(doc: IBuildWizardDocument): boolean {
  const mime = String(doc.mime_type || '').trim().toLowerCase();
  if (mime === 'application/pdf') {
    return true;
  }
  return fileExtensionFromName(doc.original_name) === 'PDF';
}

export function toStringOrNull(value: string): string | null {
  const trimmed = String(value || '').trim();
  return trimmed === '' ? null : trimmed;
}

export function sortAlpha(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

export {
  calculateDurationDays,
  detectLotSizeUnit,
  fileExtensionFromName,
  formatDate,
  formatTimelineDate,
  getDefaultRange,
  getStepPastelColor,
  lotSizeInputToSqftAuto,
  lotSizeSqftToDisplayInput,
  mimeGroupLabel,
  parseDate,
  parseUrlState,
  prettyPhaseLabel,
  pushUrlState,
  recommendPhaseKeyForStep,
  segmentBackground,
  stepDateRange,
  stepPhaseBucket,
  tabLabelShort,
  toIsoDate,
  toNumberOrNull,
  withDownloadFlag,
};
