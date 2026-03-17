import { ColoringDifficulty, ColoringPageDefinition, ColoringRegion } from '../types/coloring';

export type DbPageResponse = {
  id: number;
  title: string;
  description: string;
  theme_slug: string;
  theme_name: string;
  difficulty_slug: string;
  difficulty_name: string;
  palette: any[];
  regions: any[];
};

type FillMap = Record<string, string>;

export function firstUnfilledTargetColor(page: ColoringPageDefinition, fills: FillMap): string | null {
  for (const color of page.palette) {
    const pending = page.regions.some((region) => region.targetColorId === color.id && fills[region.id] !== color.id);
    if (pending) {
      return color.id;
    }
  }
  return null;
}

export function getRegion(page: ColoringPageDefinition, regionId: string): ColoringRegion | null {
  return page.regions.find((region) => region.id === regionId) || null;
}

export function mapDbPageToDefinition(page: DbPageResponse): ColoringPageDefinition | null {
  if (!Array.isArray(page.palette) || !Array.isArray(page.regions) || !page.title) {
    return null;
  }

  const palette = page.palette
    .map((color) => ({
      id: String(color?.id || ''),
      name: String(color?.name || ''),
      hex: String(color?.hex || ''),
    }))
    .filter((color) => color.id !== '' && color.name !== '' && color.hex !== '');

  const regions = page.regions
    .map((region, idx) => ({
      id: String(region?.id || `db-${page.id}-r${idx + 1}`),
      label: String(region?.label || `Region ${idx + 1}`),
      targetColorId: String(region?.targetColorId || ''),
      shapeType: (['rect', 'circle', 'diamond', 'hexagon', 'triangle'].includes(String(region?.shapeType || ''))
        ? String(region.shapeType)
        : 'rect') as ColoringRegion['shapeType'],
      cx: Number(region?.cx || 500),
      cy: Number(region?.cy || 350),
      width: Number(region?.width || 120),
      height: Number(region?.height || 120),
    }))
    .filter((region) => region.targetColorId !== '');

  if (!palette.length || !regions.length) {
    return null;
  }

  return {
    id: `db-${page.id}`,
    title: String(page.title),
    theme: String(page.theme_slug || 'custom'),
    difficulty: normalizeDifficulty(String(page.difficulty_slug || 'medium')),
    previewEmoji: '🖍️',
    description: String(page.description || ''),
    palette,
    regions,
  };
}

function normalizeDifficulty(value: string): ColoringDifficulty {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'simple' || normalized === 'medium' || normalized === 'difficult') {
    return normalized;
  }
  return 'medium';
}
