import { DEFAULT_CUSTOM_CSS_SETTINGS, DEFAULT_STANDARDIZED_ICON_SETTINGS } from '../data/standardizedIcons';
import { catn8LocalStorageGet, catn8LocalStorageSet } from '../utils/storageUtils';
import { CustomCssSettings, StandardizedIconSetting } from '../types/uiStandards';

export const LS_STANDARDIZED_ICONS = 'catn8_standardized_icons_v1';
export const LS_CUSTOM_CSS_SETTINGS = 'catn8_custom_css_settings_v1';
export const UI_STANDARDS_EVENT = 'catn8:ui-standards-updated';

export function isMysteryExperiencePage(page: string): boolean {
  return page === 'mystery' || page === 'sheriff_station';
}

function parseNumber(value: unknown, fallback: number, min: number, max: number): number {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.round(raw)));
}

function parseColor(value: unknown, fallback: string): string {
  const raw = String(value || '').trim();
  if (!/^#[0-9a-f]{6}$/i.test(raw)) return fallback;
  return raw;
}

export function loadStandardizedIconSettings(): StandardizedIconSetting[] {
  const raw = catn8LocalStorageGet(LS_STANDARDIZED_ICONS);
  if (!raw) return DEFAULT_STANDARDIZED_ICON_SETTINGS;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_STANDARDIZED_ICON_SETTINGS;

    const byKey = new Map<string, StandardizedIconSetting>();
    parsed.forEach((item: any) => {
      const key = String(item?.key || '').trim();
      if (!key) return;
      byKey.set(key, {
        key: key as StandardizedIconSetting['key'],
        label: String(item?.label || key),
        keywords: Array.isArray(item?.keywords) ? item.keywords.map((keyword: any) => String(keyword || '').trim()).filter(Boolean) : [],
        enabled: Boolean(item?.enabled),
      });
    });

    return DEFAULT_STANDARDIZED_ICON_SETTINGS.map((defaults) => {
      const candidate = byKey.get(defaults.key);
      if (!candidate) return defaults;
      return {
        ...defaults,
        label: candidate.label || defaults.label,
        keywords: candidate.keywords.length ? candidate.keywords : defaults.keywords,
        enabled: candidate.enabled,
      };
    });
  } catch (_err) {
    return DEFAULT_STANDARDIZED_ICON_SETTINGS;
  }
}

export function saveStandardizedIconSettings(settings: StandardizedIconSetting[]): void {
  catn8LocalStorageSet(LS_STANDARDIZED_ICONS, JSON.stringify(settings));
}

export function loadCustomCssSettings(): CustomCssSettings {
  const raw = catn8LocalStorageGet(LS_CUSTOM_CSS_SETTINGS);
  if (!raw) return DEFAULT_CUSTOM_CSS_SETTINGS;

  try {
    const parsed = JSON.parse(raw);
    return {
      button_radius_px: parseNumber(parsed?.button_radius_px, DEFAULT_CUSTOM_CSS_SETTINGS.button_radius_px, 6, 22),
      panel_radius_px: parseNumber(parsed?.panel_radius_px, DEFAULT_CUSTOM_CSS_SETTINGS.panel_radius_px, 8, 28),
      hover_lift_px: parseNumber(parsed?.hover_lift_px, DEFAULT_CUSTOM_CSS_SETTINGS.hover_lift_px, 0, 8),
      hover_scale_pct: parseNumber(parsed?.hover_scale_pct, DEFAULT_CUSTOM_CSS_SETTINGS.hover_scale_pct, 100, 106),
      surface_alpha_pct: parseNumber(parsed?.surface_alpha_pct, DEFAULT_CUSTOM_CSS_SETTINGS.surface_alpha_pct, 88, 100),
      surface_blur_px: parseNumber(parsed?.surface_blur_px, DEFAULT_CUSTOM_CSS_SETTINGS.surface_blur_px, 0, 16),
      transition_ms: parseNumber(parsed?.transition_ms, DEFAULT_CUSTOM_CSS_SETTINGS.transition_ms, 100, 320),
      focus_ring_color: parseColor(parsed?.focus_ring_color, DEFAULT_CUSTOM_CSS_SETTINGS.focus_ring_color),
    };
  } catch (_err) {
    return DEFAULT_CUSTOM_CSS_SETTINGS;
  }
}

export function saveCustomCssSettings(settings: CustomCssSettings): void {
  catn8LocalStorageSet(LS_CUSTOM_CSS_SETTINGS, JSON.stringify(settings));
}

export function notifyUiStandardsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(UI_STANDARDS_EVENT));
}

export function applyCustomCssSettings(settings: CustomCssSettings, page: string): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const body = document.body;
  const isMystery = isMysteryExperiencePage(page);

  if (isMystery) {
    body.classList.remove('catn8-global-ui');
    root.style.removeProperty('--catn8-global-button-radius');
    root.style.removeProperty('--catn8-global-panel-radius');
    root.style.removeProperty('--catn8-global-hover-lift');
    root.style.removeProperty('--catn8-global-hover-scale');
    root.style.removeProperty('--catn8-global-surface-alpha');
    root.style.removeProperty('--catn8-global-surface-blur');
    root.style.removeProperty('--catn8-global-transition-ms');
    root.style.removeProperty('--catn8-global-focus-ring');
    return;
  }

  body.classList.add('catn8-global-ui');
  root.style.setProperty('--catn8-global-button-radius', `${settings.button_radius_px}px`);
  root.style.setProperty('--catn8-global-panel-radius', `${settings.panel_radius_px}px`);
  root.style.setProperty('--catn8-global-hover-lift', `${settings.hover_lift_px}px`);
  root.style.setProperty('--catn8-global-hover-scale', `${settings.hover_scale_pct / 100}`);
  root.style.setProperty('--catn8-global-surface-alpha', `${settings.surface_alpha_pct / 100}`);
  root.style.setProperty('--catn8-global-surface-blur', `${settings.surface_blur_px}px`);
  root.style.setProperty('--catn8-global-transition-ms', `${settings.transition_ms}ms`);
  root.style.setProperty('--catn8-global-focus-ring', settings.focus_ring_color);
}

export function applyGlobalUiSettings(page: string): void {
  const settings = loadCustomCssSettings();
  applyCustomCssSettings(settings, page);
}
