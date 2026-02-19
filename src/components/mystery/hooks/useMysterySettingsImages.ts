import React from 'react';
import { IMysterySettings } from '../../../types/game';

export const defaultImageStyleMaster = 'A gritty, black and white photograph in a film noir style. The lighting is harsh and directional, creating deep shadows.';
export const defaultLocationImageStyle = 'Film noir street photography. Black and white. High contrast. Wet pavement reflections. Dramatic shadows. Wide angle establishing shot. If an address is provided, use the real-world exterior/interior cues of that address as reference (street layout, architecture, signage, materials). If you cannot retrieve or view a real photo of the address, do not claim you did; instead approximate based on typical architecture for that place.';
export const defaultWeaponImageStyle = 'Film noir product photo. Black and white. High contrast. Macro details. Dramatic shadows. Minimal background.';

export function useMysterySettingsImages(mysterySettingsObjRef: React.MutableRefObject<IMysterySettings>) {
  const getImageStyleSettings = React.useCallback(() => {
    const s = (mysterySettingsObjRef.current && typeof mysterySettingsObjRef.current === 'object') ? mysterySettingsObjRef.current : {};
    const st = (s.image_styles && typeof s.image_styles === 'object' && !Array.isArray(s.image_styles)) ? (s.image_styles as Record<string, any>) : {};
    return {
      master: String(st.master || '').trim() || defaultImageStyleMaster,
      location: String(st.location || '').trim() || defaultLocationImageStyle,
      weapon: String(st.weapon || '').trim() || defaultWeaponImageStyle,
      mugshot: String(st.mugshot || '').trim(),
    };
  }, [mysterySettingsObjRef]);

  const buildStyledImagePrompt = React.useCallback(({ promptText, kind }: { promptText: string, kind: 'location' | 'mugshot' | 'weapon' | 'generic' }) => {
    const p = String(promptText || '').trim();
    const st = getImageStyleSettings();
    const parts: string[] = [];
    if (String(st.master || '').trim()) parts.push(String(st.master).trim());
    if (kind === 'location' && String(st.location || '').trim()) parts.push(String(st.location).trim());
    if (kind === 'mugshot' && String(st.mugshot || '').trim()) parts.push(String(st.mugshot).trim());
    if (kind === 'weapon' && String(st.weapon || '').trim()) parts.push(String(st.weapon).trim());
    if (p) parts.push(p);
    return parts.join('\n\n').trim();
  }, [getImageStyleSettings]);

  return React.useMemo(() => ({
    getImageStyleSettings,
    buildStyledImagePrompt
  }), [getImageStyleSettings, buildStyledImagePrompt]);
}
