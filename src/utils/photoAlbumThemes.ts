export interface AlbumTheme {
  name: 'warm' | 'celebration' | 'calm' | 'support';
  emojis: string[];
  borderColor: string;
  accentColor: string;
}

export function inferAlbumThemeFromCorpus(corpus: string): AlbumTheme {
  if (/(birthday|party|celebrate|graduation|holiday|christmas|halloween)/.test(corpus)) {
    return { name: 'celebration', emojis: ['🎉', '🎈', '✨', '🥳'], borderColor: '#a54c1f', accentColor: '#ffe6b7' };
  }
  if (/(hospital|medicine|sick|weak|help|covered|plan|work)/.test(corpus)) {
    return { name: 'support', emojis: ['💪', '🤍', '🫶', '🙏'], borderColor: '#3d5f7e', accentColor: '#dcecff' };
  }
  if (/(baby|newborn|sleep|tiny|family|grandma|mom|dad)/.test(corpus)) {
    return { name: 'warm', emojis: ['🍼', '💛', '🧸', '📸'], borderColor: '#8a4d2e', accentColor: '#ffe8cf' };
  }
  return { name: 'calm', emojis: ['🌿', '☁️', '📷', '💌'], borderColor: '#3f5f48', accentColor: '#dff5df' };
}
