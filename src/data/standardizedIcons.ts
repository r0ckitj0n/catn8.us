import { CustomCssSettings, StandardizedIconDefinition, StandardizedIconSetting } from '../types/uiStandards';

export const STANDARDIZED_ICON_DEFINITIONS: StandardizedIconDefinition[] = [
  { key: 'close', label: 'Close', keywords: ['close', 'dismiss', 'cancel', 'exit'], viewBox: '0 0 24 24', path: 'M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7a1 1 0 1 0-1.4 1.4l4.9 4.9-4.9 4.9a1 1 0 1 0 1.4 1.4l4.9-4.9 4.9 4.9a1 1 0 0 0 1.4-1.4l-4.9-4.9 4.9-4.9a1 1 0 0 0 0-1.4Z' },
  { key: 'save', label: 'Save', keywords: ['save', 'commit', 'apply'], viewBox: '0 0 24 24', path: 'M5 3h11l5 5v12a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1 2v5h9V5H6Zm0 8v6h12v-6H6Z' },
  { key: 'edit', label: 'Edit', keywords: ['edit', 'rename', 'modify'], viewBox: '0 0 24 24', path: 'M16.6 3.4a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8l-9.9 9.9-4.2 1.2 1.2-4.2 9.9-9.9Z' },
  { key: 'delete', label: 'Delete', keywords: ['delete', 'remove', 'trash'], viewBox: '0 0 24 24', path: 'M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h2v10H7V9Zm4 0h2v10h-2V9Zm4 0h2v10h-2V9Z' },
  { key: 'download', label: 'Download', keywords: ['download', 'export'], viewBox: '0 0 24 24', path: 'M11 3h2v9.2l2.6-2.6 1.4 1.4-5 5-5-5 1.4-1.4 2.6 2.6V3ZM5 19h14v2H5v-2Z' },
  { key: 'upload', label: 'Upload', keywords: ['upload', 'import'], viewBox: '0 0 24 24', path: 'M11 21h2v-9.2l2.6 2.6 1.4-1.4-5-5-5 5 1.4 1.4 2.6-2.6V21ZM5 3h14v2H5V3Z' },
  { key: 'search', label: 'Search', keywords: ['search', 'find', 'lookup'], viewBox: '0 0 24 24', path: 'M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm0-2a8 8 0 1 0 4.9 14.3l4.4 4.4 1.4-1.4-4.4-4.4A8 8 0 0 0 10 2Z' },
  { key: 'settings', label: 'Settings', keywords: ['settings', 'preferences', 'config'], viewBox: '0 0 24 24', path: 'M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Zm8.2 3-1.8-.3a6.9 6.9 0 0 0-.6-1.4l1.1-1.5-1.4-1.4-1.5 1.1a6.9 6.9 0 0 0-1.4-.6l-.3-1.8h-2l-.3 1.8a6.9 6.9 0 0 0-1.4.6L8.1 6.9 6.7 8.3l1.1 1.5a6.9 6.9 0 0 0-.6 1.4l-1.8.3v2l1.8.3c.1.5.3 1 .6 1.4l-1.1 1.5 1.4 1.4 1.5-1.1c.4.2.9.4 1.4.6l.3 1.8h2l.3-1.8c.5-.1 1-.3 1.4-.6l1.5 1.1 1.4-1.4-1.1-1.5c.2-.4.4-.9.6-1.4l1.8-.3v-2Z' },
  { key: 'refresh', label: 'Refresh', keywords: ['refresh', 'reload', 'sync'], viewBox: '0 0 24 24', path: 'M12 4a8 8 0 0 1 7.7 6h-2.1A6 6 0 1 0 18 14h-3l4-4 4 4h-3a8 8 0 1 1-8-10Z' },
  { key: 'print', label: 'Print', keywords: ['print', 'hardcopy'], viewBox: '0 0 24 24', path: 'M7 3h10v4H7V3Zm11 6a3 3 0 0 1 3 3v5h-4v4H7v-4H3v-5a3 3 0 0 1 3-3h12Zm-3 10v-4H9v4h6Z' },
  { key: 'copy', label: 'Copy', keywords: ['copy', 'duplicate'], viewBox: '0 0 24 24', path: 'M9 3h11a1 1 0 0 1 1 1v13h-2V5H9V3ZM5 7h11a1 1 0 0 1 1 1v13H6a1 1 0 0 1-1-1V7Z' },
  { key: 'add', label: 'Add', keywords: ['add', 'create', 'new'], viewBox: '0 0 24 24', path: 'M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4Z' },
  { key: 'filter', label: 'Filter', keywords: ['filter', 'narrow'], viewBox: '0 0 24 24', path: 'M4 5h16l-6 7v6l-4 2v-8L4 5Z' },
  { key: 'share', label: 'Share', keywords: ['share', 'send'], viewBox: '0 0 24 24', path: 'M15 7a3 3 0 1 0-2.8-4 3 3 0 0 0 2.8 4ZM6 14a3 3 0 1 0-2.8-4A3 3 0 0 0 6 14Zm9 7a3 3 0 1 0-2.8-4 3 3 0 0 0 2.8 4Zm-7.6-8.2 5.2 2.9 1-1.7-5.2-2.9-1 1.7Zm5.2-2.7-5.2-2.9-1 1.7 5.2 2.9 1-1.7Z' },
  { key: 'link', label: 'Link', keywords: ['link', 'url'], viewBox: '0 0 24 24', path: 'M8.6 15.4a3 3 0 0 1 0-4.2l3.2-3.2a3 3 0 1 1 4.2 4.2l-1.4 1.4-1.4-1.4 1.4-1.4a1 1 0 1 0-1.4-1.4l-3.2 3.2a1 1 0 1 0 1.4 1.4l.8-.8 1.4 1.4-.8.8a3 3 0 0 1-4.2 0Zm6.8-6.8a3 3 0 0 1 0 4.2l-3.2 3.2a3 3 0 0 1-4.2-4.2l1.4-1.4 1.4 1.4-1.4 1.4a1 1 0 1 0 1.4 1.4l3.2-3.2a1 1 0 0 0-1.4-1.4l-.8.8-1.4-1.4.8-.8a3 3 0 0 1 4.2 0Z' },
  { key: 'view', label: 'View', keywords: ['view', 'preview', 'show'], viewBox: '0 0 24 24', path: 'M12 6c5.5 0 9.5 6 9.5 6s-4 6-9.5 6S2.5 12 2.5 12 6.5 6 12 6Zm0 2c-3.7 0-6.6 3.4-7.3 4 .7.6 3.6 4 7.3 4s6.6-3.4 7.3-4c-.7-.6-3.6-4-7.3-4Zm0 1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z' },
  { key: 'home', label: 'Home', keywords: ['home', 'dashboard'], viewBox: '0 0 24 24', path: 'M12 4 3 11h2v9h5v-6h4v6h5v-9h2L12 4Z' },
  { key: 'archive', label: 'Archive', keywords: ['archive', 'store'], viewBox: '0 0 24 24', path: 'M4 4h16v4H4V4Zm1 6h14v10H5V10Zm5 2v2h4v-2h-4Z' },
  { key: 'email', label: 'Email', keywords: ['email', 'mail'], viewBox: '0 0 24 24', path: 'M3 6h18v12H3V6Zm2 2v.2l7 4.4 7-4.4V8l-7 4.4L5 8Z' },
  { key: 'user', label: 'User', keywords: ['user', 'account', 'profile'], viewBox: '0 0 24 24', path: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-7 14a7 7 0 1 1 14 0H5Z' },
  { key: 'info', label: 'Info', keywords: ['info', 'help text'], viewBox: '0 0 24 24', path: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm-1 7h2v7h-2v-7Zm0-3h2v2h-2V7Z' },
  { key: 'help', label: 'Help', keywords: ['help', 'support'], viewBox: '0 0 24 24', path: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 13h2v2h-2v-2Zm1-10a4 4 0 0 1 2.8 6.8L14 14.6V15h-2v-1.2l2.4-2.4A2 2 0 1 0 11 9H9a4 4 0 0 1 4-3Z' },
];

export const DEFAULT_STANDARDIZED_ICON_SETTINGS: StandardizedIconSetting[] = STANDARDIZED_ICON_DEFINITIONS.map((icon) => ({
  key: icon.key,
  label: icon.label,
  keywords: icon.keywords,
  enabled: true,
}));

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
