import { IBuildWizardDocument, IBuildWizardStep } from '../../types/buildWizard';
import { isBuildWizardTaskDocumentKind, toStringOrNull } from '../../components/pages/build-wizard/buildWizardUtils';
import { BuildWizardTaskMeta, BuildWizardTaskType, TaskDocumentField, TaskDocumentPreview } from './buildWizardPageRenderTypes';

export const BUILD_WIZARD_TASK_META_PREFIX = '[task_meta_json]';

export const TASK_TYPE_OPTIONS: Array<{ value: BuildWizardTaskType; label: string }> = [];

export const defaultTaskMeta = (taskType: BuildWizardTaskType = 'construction'): BuildWizardTaskMeta => ({
  task_type: taskType,
  is_completed: false,
  manual_date_override: false,
  permit_document_id: null,
  permit_name: null,
  permit_authority: null,
  permit_status: null,
  permit_application_url: null,
  purchase_category: null,
  purchase_brand: null,
  purchase_model: null,
  purchase_sku: null,
  purchase_unit: null,
  purchase_qty: null,
  purchase_unit_price: null,
  purchase_vendor: null,
  purchase_url: null,
  source_ref: null,
});

export const parseTaskMetaFromReceiptNotes = (notes: string | null | undefined, allowedTaskTypes: BuildWizardTaskType[]): { taskMeta: BuildWizardTaskMeta; plainNotes: string } => {
  const raw = String(notes || '');
  const trimmed = raw.trim();
  if (!trimmed.startsWith(BUILD_WIZARD_TASK_META_PREFIX)) return { taskMeta: defaultTaskMeta(), plainNotes: raw };
  const newlineIndex = trimmed.indexOf('\n');
  const jsonPart = (newlineIndex >= 0 ? trimmed.slice(BUILD_WIZARD_TASK_META_PREFIX.length, newlineIndex) : trimmed.slice(BUILD_WIZARD_TASK_META_PREFIX.length)).trim();
  const plainNotes = newlineIndex >= 0 ? trimmed.slice(newlineIndex + 1) : '';
  try {
    const decoded = JSON.parse(jsonPart);
    const seed = defaultTaskMeta();
    if (!decoded || typeof decoded !== 'object') return { taskMeta: seed, plainNotes };
    const taskType = String((decoded as Record<string, unknown>).task_type || '').trim() as BuildWizardTaskType;
    return {
      taskMeta: {
        ...seed,
        ...(decoded as Partial<BuildWizardTaskMeta>),
        is_completed: Boolean((decoded as Record<string, unknown>).is_completed),
        task_type: (allowedTaskTypes.includes(taskType) ? taskType : 'construction'),
      },
      plainNotes,
    };
  } catch {
    return { taskMeta: defaultTaskMeta(), plainNotes: raw };
  }
};

export const composeReceiptNotesWithTaskMeta = (taskMeta: BuildWizardTaskMeta, plainNotes: string): string => {
  const json = JSON.stringify(taskMeta);
  const notes = plainNotes.trim();
  return notes ? `${BUILD_WIZARD_TASK_META_PREFIX}${json}\n${notes}` : `${BUILD_WIZARD_TASK_META_PREFIX}${json}`;
};

export const isLegacyAutoStampedTaskDate = (doc: Pick<IBuildWizardDocument, 'kind' | 'receipt_date' | 'uploaded_at'>, taskMeta?: Pick<BuildWizardTaskMeta, 'manual_date_override'> | null): boolean => {
  if (!isBuildWizardTaskDocumentKind(doc.kind) || taskMeta?.manual_date_override === true) return false;
  const taskDate = toStringOrNull(doc.receipt_date || '');
  const uploadedDate = toStringOrNull(String(doc.uploaded_at || '').slice(0, 10));
  return Boolean(taskDate && uploadedDate && taskDate === uploadedDate);
};

export const taskUsesManualDateOverride = (doc: Pick<IBuildWizardDocument, 'kind' | 'receipt_date' | 'uploaded_at'>, taskMeta?: Pick<BuildWizardTaskMeta, 'manual_date_override'> | null): boolean => {
  const taskDate = toStringOrNull(doc.receipt_date || '');
  if (!taskDate || !isBuildWizardTaskDocumentKind(doc.kind)) return false;
  if (taskMeta?.manual_date_override === true) return true;
  return !isLegacyAutoStampedTaskDate(doc, taskMeta);
};

export const getTaskEffectiveDate = (doc: Pick<IBuildWizardDocument, 'kind' | 'receipt_date' | 'uploaded_at'>, step?: Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date'> | null, taskMeta?: Pick<BuildWizardTaskMeta, 'manual_date_override'> | null): string | null => {
  if (taskUsesManualDateOverride(doc, taskMeta)) return toStringOrNull(doc.receipt_date || '');
  return toStringOrNull(step?.expected_start_date || '') || toStringOrNull(step?.expected_end_date || '');
};

export const setTaskDateOverrideInReceiptNotes = (notes: string | null | undefined, taskDate: string | null | undefined, allowedTaskTypes: BuildWizardTaskType[]): string => {
  const parsed = parseTaskMetaFromReceiptNotes(notes, allowedTaskTypes);
  return composeReceiptNotesWithTaskMeta({ ...parsed.taskMeta, manual_date_override: Boolean(toStringOrNull(taskDate || '')) }, parsed.plainNotes);
};

export const normalizeTaskMetaValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return '';
};

export const parseTaskDocumentPreview = (text: string, taskMetaFieldLabels: Record<keyof BuildWizardTaskMeta, string>): TaskDocumentPreview | null => {
  const normalized = String(text || '').replace(/\r\n?/g, '\n');
  if (!normalized.trim()) return null;
  const lines = normalized.split('\n');
  const summaryFields: TaskDocumentField[] = [];
  [{ label: 'Task', regex: /^Task:\s*(.+)\s*$/i }, { label: 'Vendor', regex: /^Vendor:\s*(.+)\s*$/i }, { label: 'Date', regex: /^Date:\s*(.+)\s*$/i }, { label: 'Amount', regex: /^Amount:\s*(.+)\s*$/i }].forEach(({ label, regex }) => {
    const match = lines.find((line) => regex.test(line));
    const value = (match?.match(regex)?.[1] || '').trim();
    if (value) summaryFields.push({ label, value });
  });
  const notesStart = lines.findIndex((line) => /^Notes:\s*$/i.test(line.trim()));
  const trailingLines = notesStart >= 0 ? lines.slice(notesStart + 1) : [];
  const noteLines: string[] = [];
  const systemLines: string[] = [];
  let decodedMeta: Partial<BuildWizardTaskMeta> | null = null;
  trailingLines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.startsWith(BUILD_WIZARD_TASK_META_PREFIX)) {
      const metaJson = trimmed.slice(BUILD_WIZARD_TASK_META_PREFIX.length).trim();
      try {
        const parsed = JSON.parse(metaJson);
        if (parsed && typeof parsed === 'object') decodedMeta = parsed as Partial<BuildWizardTaskMeta>;
      } catch { noteLines.push(trimmed); }
      return;
    }
    if (/^Imported from mapped note\b/i.test(trimmed) || /^Generated repair document\b/i.test(trimmed)) systemLines.push(trimmed);
    else noteLines.push(trimmed);
  });
  const metaFields: TaskDocumentField[] = decodedMeta ? (Object.keys(taskMetaFieldLabels) as Array<keyof BuildWizardTaskMeta>).map((fieldKey) => {
    const rawValue = normalizeTaskMetaValue(decodedMeta?.[fieldKey]);
    return rawValue ? { label: taskMetaFieldLabels[fieldKey], value: rawValue } : null;
  }).filter((entry): entry is TaskDocumentField => entry !== null) : [];
  if (!summaryFields.length && !noteLines.length && !metaFields.length && !systemLines.length) return null;
  return { summaryFields, noteLines, metaFields, systemLines };
};
