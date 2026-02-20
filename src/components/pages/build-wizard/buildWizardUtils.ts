import { IBuildWizardDocument, IBuildWizardStep } from '../../../types/buildWizard';
import { BuildTabId, LotSizeUnit, WizardView } from '../../../types/pages/buildWizardPage';
import { BUILD_TABS, SQFT_PER_ACRE } from './buildWizardConstants';

export function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(Number(value))) {
    return '-';
  }
  return Number(value).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function parseDate(input: string | null | undefined): Date | null {
  if (!input) {
    return null;
  }
  const str = String(input).trim();
  if (!str) {
    return null;
  }
  const normalized = str.length > 10 ? str.slice(0, 10) : str;
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDate(input: string | null | undefined): string {
  const date = parseDate(input);
  return date ? toIsoDate(date) : '-';
}

export function formatTimelineDate(input: string | null | undefined): string {
  const date = parseDate(input);
  if (!date) {
    return '-';
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function tabLabelShort(tabId: BuildTabId): string {
  const label = BUILD_TABS.find((tab) => tab.id === tabId)?.label || tabId;
  return label.replace(/^\d+\.\s*/, '');
}

export function withDownloadFlag(url: string): string {
  const clean = String(url || '').trim();
  if (!clean) {
    return '';
  }
  return `${clean}${clean.includes('?') ? '&' : '?'}download=1`;
}

export function fileExtensionFromName(name: string): string {
  const clean = String(name || '').trim();
  if (!clean || !clean.includes('.')) {
    return '';
  }
  const extension = clean.split('.').pop() || '';
  return extension.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase();
}

export function mimeGroupLabel(mimeType: string): string {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.startsWith('application/pdf')) {
    return 'PDF';
  }
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) {
    return 'Spreadsheet';
  }
  if (mime.includes('wordprocessingml') || mime.includes('msword') || mime.includes('rtf') || mime.includes('text/')) {
    return 'Document';
  }
  if (mime.includes('presentation')) {
    return 'Slides';
  }
  if (mime.includes('zip') || mime.includes('compressed')) {
    return 'Archive';
  }
  if (mime.includes('json') || mime.includes('xml')) {
    return 'Data';
  }
  return 'File';
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

export function toNumberOrNull(value: string): number | null {
  const trimmed = String(value || '').trim();
  if (trimmed === '') {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function detectLotSizeUnit(inputValue: string): LotSizeUnit {
  const parsed = toNumberOrNull(inputValue);
  if (parsed === null) {
    return 'acres';
  }
  return parsed < 1000 ? 'acres' : 'sqft';
}

export function lotSizeInputToSqftAuto(inputValue: string): number | null {
  const parsed = toNumberOrNull(inputValue);
  if (parsed === null) {
    return null;
  }
  const unit = detectLotSizeUnit(inputValue);
  if (unit === 'sqft') {
    return Math.round(parsed);
  }
  return Math.round(parsed * SQFT_PER_ACRE);
}

export function lotSizeSqftToDisplayInput(sqft: number | null): string {
  if (sqft === null || !Number.isFinite(Number(sqft)) || Number(sqft) <= 0) {
    return '';
  }
  const acres = Number(sqft) / SQFT_PER_ACRE;
  return acres.toFixed(4).replace(/\.?0+$/, '');
}

export function toStringOrNull(value: string): string | null {
  const trimmed = String(value || '').trim();
  return trimmed === '' ? null : trimmed;
}

export function sortAlpha(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

export function calculateDurationDays(startDate: string | null | undefined, endDate: string | null | undefined): number | null {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) {
    return null;
  }
  const millisecondsDiff = end.getTime() - start.getTime();
  const days = Math.round(millisecondsDiff / 86400000) + 1;
  return Math.max(1, days);
}

export function stepPhaseBucket(step: IBuildWizardStep): BuildTabId {
  const key = String(step.phase_key || '').toLowerCase();

  if (key.includes('land') || key.includes('survey') || key.includes('due_diligence') || key.includes('purchase')) {
    return 'land';
  }
  if (key.includes('permit') || key.includes('approval')) {
    return 'permits';
  }
  if (key.includes('site') || key.includes('foundation') || key.includes('grading') || key.includes('excav')) {
    return 'site';
  }
  if (key.includes('framing') || key.includes('enclosure') || key.includes('roof') || key.includes('shell')) {
    return 'framing';
  }
  if (key.includes('plumb') || key.includes('elect') || key.includes('mechanical') || key.includes('hvac') || key.includes('mep') || key.includes('inspection')) {
    return 'mep';
  }
  if (key.includes('finish') || key.includes('interior') || key.includes('paint') || key.includes('cabinet') || key.includes('floor')) {
    return 'finishes';
  }
  return 'desk';
}

export function prettyPhaseLabel(phaseKey: string | null | undefined): string {
  const raw = String(phaseKey || '').trim();
  if (!raw) {
    return 'General';
  }
  return raw
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function stepDateRange(step: IBuildWizardStep): { start: Date | null; end: Date | null } {
  const start = parseDate(step.expected_start_date) || parseDate(step.completed_at) || parseDate(step.expected_end_date);
  const end = parseDate(step.expected_end_date) || parseDate(step.completed_at) || parseDate(step.expected_start_date);

  if (!start && !end) {
    return { start: null, end: null };
  }
  if (start && end && end.getTime() < start.getTime()) {
    return { start: end, end: start };
  }
  return {
    start: start || end,
    end: end || start,
  };
}

export function getDefaultRange(steps: IBuildWizardStep[]): { start: string; end: string } {
  const allDates: Date[] = [];
  steps.forEach((step) => {
    const range = stepDateRange(step);
    if (range.start) {
      allDates.push(range.start);
    }
    if (range.end) {
      allDates.push(range.end);
    }
  });

  if (!allDates.length) {
    const today = new Date();
    return { start: toIsoDate(today), end: toIsoDate(today) };
  }

  allDates.sort((a, b) => a.getTime() - b.getTime());
  return {
    start: toIsoDate(allDates[0]),
    end: toIsoDate(allDates[allDates.length - 1]),
  };
}

export function parseUrlState(): { view: WizardView; projectId: number | null } {
  if (typeof window === 'undefined') {
    return { view: 'launcher', projectId: null };
  }
  const url = new URL(window.location.href);
  const viewParam = String(url.searchParams.get('view') || '').toLowerCase();
  const projectIdParam = Number(url.searchParams.get('project_id') || '0');
  return {
    view: viewParam === 'build' ? 'build' : 'launcher',
    projectId: Number.isFinite(projectIdParam) && projectIdParam > 0 ? projectIdParam : null,
  };
}

export function pushUrlState(view: WizardView, projectId: number | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  const url = new URL(window.location.href);

  if (view === 'build' && projectId && projectId > 0) {
    url.searchParams.set('view', 'build');
    url.searchParams.set('project_id', String(projectId));
  } else {
    url.searchParams.delete('view');
    url.searchParams.delete('project_id');
  }

  window.history.pushState({ view, projectId }, '', url.toString());
}

export function segmentBackground(colors: string[]): string {
  if (colors.length <= 1) {
    return colors[0] || 'var(--catn8-bw-tab-fallback-color)';
  }
  const stripeWidth = 8;
  const stops = colors
    .map((color, index) => {
      const start = index * stripeWidth;
      const end = (index + 1) * stripeWidth;
      return `${color} ${start}px ${end}px`;
    })
    .join(', ');
  return `repeating-linear-gradient(135deg, ${stops})`;
}
