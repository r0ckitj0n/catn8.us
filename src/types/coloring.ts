export type ColoringMode = 'professional' | 'beginner' | 'novice';

export type ColoringDifficulty = 'simple' | 'medium' | 'difficult';

export type ColoringThemeId = string;

export interface ColoringColorOption {
  id: string;
  name: string;
  hex: string;
}

export type ColoringShapeType = 'rect' | 'circle' | 'diamond' | 'hexagon' | 'triangle';

export interface ColoringRegion {
  id: string;
  label: string;
  targetColorId: string;
  shapeType: ColoringShapeType;
  cx: number;
  cy: number;
  width: number;
  height: number;
}

export interface ColoringPageDefinition {
  id: string;
  title: string;
  theme: ColoringThemeId;
  difficulty: ColoringDifficulty;
  previewEmoji: string;
  description: string;
  palette: ColoringColorOption[];
  regions: ColoringRegion[];
}

export interface ColoringThemeDefinition {
  id: ColoringThemeId;
  label: string;
  emoji: string;
  subjects: string[];
  palette: ColoringColorOption[];
  shapeBias: ColoringShapeType[];
}
