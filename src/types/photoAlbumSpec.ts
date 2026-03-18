export type PhotoAlbumAspectRatio = '4:3' | '3:2' | '16:9' | '1:1';

export interface PhotoAlbumSpec {
  schema_version: 'catn8_scrapbook_spec_v1';
  dimensions: {
    width_px: number;
    height_px: number;
    aspect_ratio: PhotoAlbumAspectRatio;
    safe_margin_px: number;
    bleed_px: number;
  };
  controls: {
    page_turn_style: 'ribbon-tabs' | 'classic-book' | 'spiral-notebook';
    zoom: {
      min: number;
      max: number;
      step: number;
      initial: number;
    };
    downloads: {
      allow_cover_download: boolean;
      allow_page_download: boolean;
      formats: string[];
      default_format: string;
    };
  };
  style_guide: {
    memory_era: string;
    mood: string;
    palette: string[];
    materials: string[];
    motifs: string[];
    scrapbook_feel: string;
  };
  spreads: Array<{
    spread_number: number;
    title: string;
    caption: string;
    is_locked?: boolean;
    default_contact_label?: string;
    photo_slots: number;
    embellishments: string[];
    background_prompt: string;
    background_image_url?: string;
    text_items?: Array<{
      id: string;
      text: string;
      speaker?: string;
      time?: string;
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      rotation?: number;
      border_color?: string;
      bg_color?: string;
      side?: 'left' | 'right';
    }>;
    note_layout?: Record<string, {
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      rotation?: number;
    }>;
    decor_items?: Array<{
      id: string;
      emoji: string;
      x?: number;
      y?: number;
      size?: number;
      rotation?: number;
    }>;
    images?: Array<{
      src: string;
      media_type?: 'image' | 'video';
      display_src?: string;
      original_src?: string;
      live_video_src?: string;
      live_photo_available?: boolean;
      captured_at?: string;
      source_filename?: string;
      caption?: string;
      memory_text?: string;
      speaker_label?: string;
      speaker_handle_id?: string;
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      rotation?: number;
      border_color?: string;
    }>;
  }>;
}
