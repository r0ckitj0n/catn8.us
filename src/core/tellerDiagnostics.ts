import { ApiClient } from './ApiClient';
import {
  Accumul8TellerDiagnosticEventName,
  Accumul8TellerDiagnosticRequest,
  Accumul8TellerDiagnosticResponse,
} from '../types/accumul8';

const WATCHED_TELLER_INSTITUTION_IDS = new Set(['fifth_third', 'truist']);
const WATCHED_TELLER_INSTITUTION_NAME_PATTERNS = [
  /fifth\s*third/i,
  /\b5\/3\b/i,
  /\btruist\b/i,
];

function clampText(value: unknown, maxLen: number): string {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (text.length <= maxLen) {
    return text;
  }
  return text.slice(0, maxLen);
}

export function isWatchedTellerInstitution(institutionId?: string, institutionName?: string): boolean {
  const normalizedId = clampText(institutionId, 64).toLowerCase();
  if (normalizedId && WATCHED_TELLER_INSTITUTION_IDS.has(normalizedId)) {
    return true;
  }
  const normalizedName = clampText(institutionName, 191);
  return WATCHED_TELLER_INSTITUTION_NAME_PATTERNS.some((pattern) => pattern.test(normalizedName));
}

export async function logTellerDiagnostic(request: Accumul8TellerDiagnosticRequest): Promise<void> {
  const payload: Accumul8TellerDiagnosticRequest = {
    source: clampText(request.source, 64),
    event_name: request.event_name as Accumul8TellerDiagnosticEventName,
    institution_id: clampText(request.institution_id, 64) || undefined,
    institution_name: clampText(request.institution_name, 191) || undefined,
    enrollment_id: clampText(request.enrollment_id, 191) || undefined,
    connection_id: Number.isFinite(Number(request.connection_id)) ? Number(request.connection_id) : undefined,
    message: clampText(request.message, 500) || undefined,
    meta: request.meta && typeof request.meta === 'object' ? request.meta : undefined,
  };

  try {
    await ApiClient.post<Accumul8TellerDiagnosticResponse>('/api/accumul8.php?action=teller_connect_diagnostic', payload);
  } catch (error) {
    console.warn('[TellerDiagnostics] failed to log event', payload.event_name, error);
  }
}
