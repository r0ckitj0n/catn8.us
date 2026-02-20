export interface ColoringAdminCategory {
  id: number;
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  is_active: number;
}

export interface ColoringAdminTheme {
  id: number;
  category_id: number;
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  is_active: number;
}

export interface ColoringAdminDifficulty {
  id: number;
  slug: string;
  name: string;
  description: string;
  complexity_level: number;
  sort_order: number;
  is_active: number;
}

export interface ColoringAdminPage {
  id: number;
  title: string;
  description: string;
  category_id: number;
  theme_id: number;
  difficulty_id: number;
  image_url: string;
  image_prompt: string;
  palette_json: string;
  regions_json: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ColoringAdminListResponse {
  categories: ColoringAdminCategory[];
  themes: ColoringAdminTheme[];
  difficulties: ColoringAdminDifficulty[];
  pages: ColoringAdminPage[];
}

export interface ColoringPageGenerateRequest {
  title: string;
  description: string;
  category_id: number;
  theme_id: number;
  difficulty_id: number;
}
