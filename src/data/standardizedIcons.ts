import { CustomCssSettings, EmojiAssetChoice, StandardIconKey, StandardizedIconSetting } from '../types/uiStandards';

export const EMOJI_ASSET_CATALOG: EmojiAssetChoice[] = [
  { id: 'heavy-plus', emoji: '➕', codepoint: '2795', asset_path: '/emojis/twemoji/2795.png', label: 'Heavy Plus' },
  { id: 'card-index-dividers', emoji: '🗂', codepoint: '1f5c2', asset_path: '/emojis/twemoji/1f5c2.png', label: 'Card Index Dividers' },
  { id: 'card-file-box', emoji: '🗃', codepoint: '1f5c3', asset_path: '/emojis/twemoji/1f5c3.png', label: 'Card File Box' },
  { id: 'file-cabinet', emoji: '🗄', codepoint: '1f5c4', asset_path: '/emojis/twemoji/1f5c4.png', label: 'File Cabinet' },
  { id: 'wastebasket', emoji: '🗑', codepoint: '1f5d1', asset_path: '/emojis/twemoji/1f5d1.png', label: 'Wastebasket' },
  { id: 'printer', emoji: '🖨', codepoint: '1f5a8', asset_path: '/emojis/twemoji/1f5a8.png', label: 'Printer' },
  { id: 'cross-mark', emoji: '❌', codepoint: '274c', asset_path: '/emojis/twemoji/274c.png', label: 'Cross Mark' },
  { id: 'question-mark', emoji: '❓', codepoint: '2753', asset_path: '/emojis/twemoji/2753.png', label: 'Question Mark' },
  { id: 'pencil', emoji: '✏️', codepoint: '270f', asset_path: '/emojis/twemoji/270f.png', label: 'Pencil' },
  { id: 'gear', emoji: '⚙️', codepoint: '2699', asset_path: '/emojis/twemoji/2699.png', label: 'Gear' },
  { id: 'information', emoji: 'ℹ️', codepoint: '2139', asset_path: '/emojis/twemoji/2139.png', label: 'Information' },
  { id: 'house', emoji: '🏠', codepoint: '1f3e0', asset_path: '/emojis/twemoji/1f3e0.png', label: 'House' },
  { id: 'bust', emoji: '👤', codepoint: '1f464', asset_path: '/emojis/twemoji/1f464.png', label: 'Bust In Silhouette' },
  { id: 'paperclip', emoji: '📎', codepoint: '1f4ce', asset_path: '/emojis/twemoji/1f4ce.png', label: 'Paperclip' },
  { id: 'outbox', emoji: '📤', codepoint: '1f4e4', asset_path: '/emojis/twemoji/1f4e4.png', label: 'Outbox Tray' },
  { id: 'inbox', emoji: '📥', codepoint: '1f4e5', asset_path: '/emojis/twemoji/1f4e5.png', label: 'Inbox Tray' },
  { id: 'email', emoji: '📧', codepoint: '1f4e7', asset_path: '/emojis/twemoji/1f4e7.png', label: 'Email' },
  { id: 'floppy-disk', emoji: '💾', codepoint: '1f4be', asset_path: '/emojis/twemoji/1f4be.png', label: 'Floppy Disk' },
  { id: 'clipboard', emoji: '📋', codepoint: '1f4cb', asset_path: '/emojis/twemoji/1f4cb.png', label: 'Clipboard' },
  { id: 'magnifier-left', emoji: '🔍', codepoint: '1f50d', asset_path: '/emojis/twemoji/1f50d.png', label: 'Magnifying Glass Left' },
  { id: 'link', emoji: '🔗', codepoint: '1f517', asset_path: '/emojis/twemoji/1f517.png', label: 'Link' },
  { id: 'repeat', emoji: '🔄', codepoint: '1f504', asset_path: '/emojis/twemoji/1f504.png', label: 'Repeat' },
  { id: 'broom', emoji: '🧹', codepoint: '1f9f9', asset_path: '/emojis/twemoji/1f9f9.png', label: 'Broom' },
  { id: 'eye', emoji: '👁', codepoint: '1f441', asset_path: '/emojis/twemoji/1f441.png', label: 'Eye' },
];

function findEmojiAsset(id: string): EmojiAssetChoice {
  const match = EMOJI_ASSET_CATALOG.find((item) => item.id === id);
  if (!match) {
    throw new Error(`Unknown emoji asset id: ${id}`);
  }
  return match;
}

function makeSetting(
  key: StandardIconKey,
  label: string,
  keywords: string[],
  assetId: string,
): StandardizedIconSetting {
  const asset = findEmojiAsset(assetId);
  return {
    key,
    label,
    keywords,
    emoji: asset.emoji,
    codepoint: asset.codepoint,
    asset_path: asset.asset_path,
    source_name: 'Twemoji',
  };
}

export const DEFAULT_STANDARDIZED_ICON_SETTINGS: StandardizedIconSetting[] = [
  makeSetting('close', 'Close', ['close', 'dismiss', 'cancel', 'exit'], 'cross-mark'),
  makeSetting('save', 'Save', ['save', 'commit', 'apply'], 'floppy-disk'),
  makeSetting('edit', 'Edit', ['edit', 'rename', 'modify'], 'pencil'),
  makeSetting('delete', 'Delete', ['delete', 'remove', 'trash'], 'wastebasket'),
  makeSetting('download', 'Download', ['download', 'export'], 'inbox'),
  makeSetting('upload', 'Upload', ['upload', 'import', 'attach'], 'paperclip'),
  makeSetting('search', 'Search', ['search', 'find', 'lookup'], 'magnifier-left'),
  makeSetting('settings', 'Settings', ['settings', 'preferences', 'config'], 'gear'),
  makeSetting('refresh', 'Refresh', ['refresh', 'reload', 'sync'], 'repeat'),
  makeSetting('print', 'Print', ['print', 'hardcopy'], 'printer'),
  makeSetting('copy', 'Copy', ['copy', 'duplicate'], 'clipboard'),
  makeSetting('add', 'Add', ['add', 'create', 'new'], 'heavy-plus'),
  makeSetting('filter', 'Filter', ['filter', 'narrow'], 'broom'),
  makeSetting('share', 'Share', ['share', 'send'], 'outbox'),
  makeSetting('link', 'Link', ['link', 'url'], 'link'),
  makeSetting('view', 'View', ['view', 'preview', 'show'], 'eye'),
  makeSetting('home', 'Home', ['home', 'dashboard'], 'house'),
  makeSetting('archive', 'Archive', ['archive', 'store'], 'file-cabinet'),
  makeSetting('email', 'Email', ['email', 'mail'], 'email'),
  makeSetting('user', 'User', ['user', 'account', 'profile'], 'bust'),
  makeSetting('info', 'Info', ['info', 'help text'], 'information'),
  makeSetting('help', 'Help', ['help', 'support'], 'question-mark'),
];

export const DEFAULT_CUSTOM_CSS_SETTINGS: CustomCssSettings = {
  button_radius_px: 12,
  panel_radius_px: 16,
  hover_lift_px: 2,
  hover_scale_pct: 102,
  surface_alpha_pct: 96,
  surface_blur_px: 5,
  transition_ms: 170,
  focus_ring_color: '#2f75d8',
  icon_button_size_px: 32,
  content_max_width_px: 1680,
  base_font_size_px: 16,
};
