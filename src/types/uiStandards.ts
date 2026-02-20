export type StandardIconKey =
  | 'add'
  | 'archive'
  | 'close'
  | 'copy'
  | 'delete'
  | 'download'
  | 'edit'
  | 'email'
  | 'filter'
  | 'help'
  | 'home'
  | 'info'
  | 'link'
  | 'print'
  | 'refresh'
  | 'save'
  | 'search'
  | 'settings'
  | 'share'
  | 'upload'
  | 'user'
  | 'view';

export interface StandardizedIconSetting {
  key: StandardIconKey;
  label: string;
  keywords: string[];
  enabled: boolean;
}

export interface StandardizedIconDefinition {
  key: StandardIconKey;
  label: string;
  keywords: string[];
  viewBox: string;
  path: string;
}

export interface CustomCssSettings {
  button_radius_px: number;
  panel_radius_px: number;
  hover_lift_px: number;
  hover_scale_pct: number;
  surface_alpha_pct: number;
  surface_blur_px: number;
  transition_ms: number;
  focus_ring_color: string;
  icon_button_size_px: number;
  content_max_width_px: number;
  base_font_size_px: number;
}
