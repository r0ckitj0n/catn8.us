import { ApiClient } from './ApiClient';
import {
  IBuildWizardDropdownSettings,
  IBuildWizardDropdownSettingsResponse,
} from '../types/buildWizardDropdowns';

export const BUILD_WIZARD_DROPDOWN_SETTINGS_UPDATED_EVENT = 'catn8:build-wizard-dropdown-settings-updated';

export const DEFAULT_BUILD_WIZARD_DROPDOWN_SETTINGS: IBuildWizardDropdownSettings = {
  document_kinds: ['blueprint', 'document', 'home_photo', 'other', 'permit', 'photo', 'plat', 'receipt', 'site_photo', 'spec_sheet', 'survey'],
  permit_statuses: ['', 'approved', 'closed', 'drafting', 'not_started', 'rejected', 'submitted'],
  purchase_units: ['', 'box', 'bundle', 'cuft', 'ea', 'ft', 'gal', 'lb', 'roll', 'set', 'sqft'],
};

function normalizeToken(value: string): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) {
    return '';
  }
  return raw
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');
}

function normalizeList(values: string[], fallback: string[], allowLeadingBlank = false): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  (Array.isArray(values) ? values : fallback).forEach((raw) => {
    const token = normalizeToken(raw);
    if (!token || seen.has(token)) {
      return;
    }
    seen.add(token);
    out.push(token);
  });

  if (!out.length) {
    fallback.forEach((raw) => {
      const token = normalizeToken(raw);
      if (!token || seen.has(token)) {
        return;
      }
      seen.add(token);
      out.push(token);
    });
  }

  if (!seen.has('plat')) {
    out.push('plat');
  }

  if (allowLeadingBlank) {
    return ['', ...out];
  }

  return out;
}

export function normalizeBuildWizardDropdownSettings(
  settings: Partial<IBuildWizardDropdownSettings> | null | undefined,
): IBuildWizardDropdownSettings {
  return {
    document_kinds: normalizeList(
      settings?.document_kinds || [],
      DEFAULT_BUILD_WIZARD_DROPDOWN_SETTINGS.document_kinds,
      false,
    ),
    permit_statuses: normalizeList(
      settings?.permit_statuses || [],
      DEFAULT_BUILD_WIZARD_DROPDOWN_SETTINGS.permit_statuses,
      true,
    ),
    purchase_units: normalizeList(
      settings?.purchase_units || [],
      DEFAULT_BUILD_WIZARD_DROPDOWN_SETTINGS.purchase_units,
      true,
    ),
  };
}

export async function fetchBuildWizardDropdownSettings(): Promise<IBuildWizardDropdownSettings> {
  const res = await ApiClient.get<IBuildWizardDropdownSettingsResponse>('/api/settings/build_wizard_dropdowns.php');
  return normalizeBuildWizardDropdownSettings(res?.settings || null);
}

export async function saveBuildWizardDropdownSettings(settings: IBuildWizardDropdownSettings): Promise<IBuildWizardDropdownSettings> {
  const normalized = normalizeBuildWizardDropdownSettings(settings);
  const res = await ApiClient.post<IBuildWizardDropdownSettingsResponse>('/api/settings/build_wizard_dropdowns.php', {
    settings: normalized,
  });
  const saved = normalizeBuildWizardDropdownSettings(res?.settings || normalized);
  dispatchBuildWizardDropdownSettingsUpdated(saved);
  return saved;
}

export function dispatchBuildWizardDropdownSettingsUpdated(settings: IBuildWizardDropdownSettings): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(BUILD_WIZARD_DROPDOWN_SETTINGS_UPDATED_EVENT, { detail: settings }));
}

export function buildWizardTokenLabel(value: string, emptyLabel: string): string {
  const clean = String(value || '').trim();
  if (!clean) {
    return emptyLabel;
  }
  return clean
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
