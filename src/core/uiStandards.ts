import { DEFAULT_CUSTOM_CSS_SETTINGS, DEFAULT_STANDARDIZED_ICON_SETTINGS } from '../data/standardizedIcons';
import { CustomCssSettings, StandardIconKey, StandardizedIconSetting } from '../types/uiStandards';

export const UI_STANDARDS_EVENT = 'catn8:ui-standards-updated';

declare global {
  interface Window {
    __CATN8_ICON_BUTTON_SETTINGS__?: StandardizedIconSetting[];
  }
}

export function isMysteryExperiencePage(page: string): boolean {
  return page === 'investig8' || page === 'sheriff_station';
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

function sanitizeIconSettings(raw: unknown): StandardizedIconSetting[] {
  if (!Array.isArray(raw)) {
    return DEFAULT_STANDARDIZED_ICON_SETTINGS;
  }

  const byKey = new Map<string, StandardizedIconSetting>();
  raw.forEach((item: any) => {
    const key = String(item?.key || '').trim();
    if (!key) return;
    byKey.set(key, {
      key: key as StandardizedIconSetting['key'],
      label: String(item?.label || key),
      keywords: Array.isArray(item?.keywords)
        ? item.keywords.map((keyword: any) => String(keyword || '').trim()).filter(Boolean)
        : [],
      emoji: String(item?.emoji || ''),
      codepoint: String(item?.codepoint || ''),
      asset_path: String(item?.asset_path || ''),
      source_name: String(item?.source_name || 'Twemoji'),
    });
  });

  return DEFAULT_STANDARDIZED_ICON_SETTINGS.map((defaults) => {
    const candidate = byKey.get(defaults.key);
    if (!candidate) {
      return defaults;
    }
    return {
      ...defaults,
      label: candidate.label || defaults.label,
      keywords: candidate.keywords.length ? candidate.keywords : defaults.keywords,
      emoji: candidate.emoji || defaults.emoji,
      codepoint: candidate.codepoint || defaults.codepoint,
      asset_path: candidate.asset_path || defaults.asset_path,
      source_name: candidate.source_name || defaults.source_name,
    };
  });
}

export function loadStandardizedIconSettings(): StandardizedIconSetting[] {
  if (typeof window === 'undefined') {
    return DEFAULT_STANDARDIZED_ICON_SETTINGS;
  }
  return sanitizeIconSettings(window.__CATN8_ICON_BUTTON_SETTINGS__);
}

export function replaceStandardizedIconSettings(settings: StandardizedIconSetting[]): void {
  if (typeof window === 'undefined') return;
  window.__CATN8_ICON_BUTTON_SETTINGS__ = sanitizeIconSettings(settings);
}

export function getStandardizedIconSetting(iconKey: StandardIconKey): StandardizedIconSetting {
  const match = loadStandardizedIconSettings().find((item) => item.key === iconKey);
  return match || DEFAULT_STANDARDIZED_ICON_SETTINGS.find((item) => item.key === iconKey) || DEFAULT_STANDARDIZED_ICON_SETTINGS[0];
}

export function sanitizeCustomCssSettings(raw: any): CustomCssSettings {
  return {
    button_radius_px: parseNumber(raw?.button_radius_px, DEFAULT_CUSTOM_CSS_SETTINGS.button_radius_px, 6, 24),
    panel_radius_px: parseNumber(raw?.panel_radius_px, DEFAULT_CUSTOM_CSS_SETTINGS.panel_radius_px, 8, 28),
    hover_lift_px: parseNumber(raw?.hover_lift_px, DEFAULT_CUSTOM_CSS_SETTINGS.hover_lift_px, 0, 10),
    hover_scale_pct: parseNumber(raw?.hover_scale_pct, DEFAULT_CUSTOM_CSS_SETTINGS.hover_scale_pct, 100, 106),
    surface_alpha_pct: parseNumber(raw?.surface_alpha_pct, DEFAULT_CUSTOM_CSS_SETTINGS.surface_alpha_pct, 86, 100),
    surface_blur_px: parseNumber(raw?.surface_blur_px, DEFAULT_CUSTOM_CSS_SETTINGS.surface_blur_px, 0, 18),
    transition_ms: parseNumber(raw?.transition_ms, DEFAULT_CUSTOM_CSS_SETTINGS.transition_ms, 100, 360),
    focus_ring_color: parseColor(raw?.focus_ring_color, DEFAULT_CUSTOM_CSS_SETTINGS.focus_ring_color),
    icon_button_size_px: parseNumber(raw?.icon_button_size_px, DEFAULT_CUSTOM_CSS_SETTINGS.icon_button_size_px, 28, 44),
    content_max_width_px: parseNumber(raw?.content_max_width_px, DEFAULT_CUSTOM_CSS_SETTINGS.content_max_width_px, 960, 1920),
    base_font_size_px: parseNumber(raw?.base_font_size_px, DEFAULT_CUSTOM_CSS_SETTINGS.base_font_size_px, 14, 20),
  };
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
    root.style.removeProperty('--catn8-global-icon-button-size');
    root.style.removeProperty('--catn8-global-content-max-width');
    root.style.removeProperty('--catn8-global-base-font-size');
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
  root.style.setProperty('--catn8-global-icon-button-size', `${settings.icon_button_size_px}px`);
  root.style.setProperty('--catn8-global-content-max-width', `${settings.content_max_width_px}px`);
  root.style.setProperty('--catn8-global-base-font-size', `${settings.base_font_size_px}px`);
}

export function applyGlobalUiSettings(page: string): void {
  if (typeof document === 'undefined') return;
  const body = document.body;
  if (isMysteryExperiencePage(page)) {
    body.classList.remove('catn8-global-ui');
    return;
  }
  body.classList.add('catn8-global-ui');
}
