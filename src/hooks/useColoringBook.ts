import React from 'react';

import { ApiClient } from '../core/ApiClient';
import { COLORING_PAGES, COLORING_THEME_LABELS, COLORING_THEMES } from '../data/coloringPages';
import { ColoringDifficulty, ColoringMode, ColoringPageDefinition, ColoringRegion, ColoringThemeId } from '../types/coloring';

type DifficultyFilter = ColoringDifficulty | 'all';
type ThemeFilter = ColoringThemeId | 'all';

type FillMap = Record<string, string>;

interface DbPageResponse {
  id: number;
  title: string;
  description: string;
  theme_slug: string;
  theme_name: string;
  difficulty_slug: string;
  difficulty_name: string;
  palette: any[];
  regions: any[];
}

const MODE_DEFAULTS: Record<ColoringMode, string> = {
  professional: 'Choose a color, then click any area to fill it.',
  beginner: 'Click any area and it will auto-fill with the suggested color.',
  novice: 'Follow the highlighted color target and click matching areas only.',
};

function firstUnfilledTargetColor(page: ColoringPageDefinition, fills: FillMap): string | null {
  for (const color of page.palette) {
    const pending = page.regions.some((region) => region.targetColorId === color.id && fills[region.id] !== color.id);
    if (pending) {
      return color.id;
    }
  }
  return null;
}

function getRegion(page: ColoringPageDefinition, regionId: string): ColoringRegion | null {
  return page.regions.find((region) => region.id === regionId) || null;
}

function normalizeDifficulty(value: string): ColoringDifficulty {
  const v = String(value || '').toLowerCase();
  if (v === 'simple' || v === 'medium' || v === 'difficult') return v;
  return 'medium';
}

function mapDbPageToDefinition(page: DbPageResponse): ColoringPageDefinition | null {
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

  const themeSlug = String(page.theme_slug || 'custom');
  const difficulty = normalizeDifficulty(String(page.difficulty_slug || 'medium'));
  return {
    id: `db-${page.id}`,
    title: String(page.title),
    theme: themeSlug,
    difficulty,
    previewEmoji: '🖍️',
    description: String(page.description || ''),
    palette,
    regions,
  };
}

export function useColoringBook() {
  const [mode, setMode] = React.useState<ColoringMode>('professional');
  const [themeFilter, setThemeFilter] = React.useState<ThemeFilter>('all');
  const [difficultyFilter, setDifficultyFilter] = React.useState<DifficultyFilter>('all');
  const [dynamicPages, setDynamicPages] = React.useState<ColoringPageDefinition[]>([]);
  const [selectedPageId, setSelectedPageId] = React.useState<string>('');
  const [selectedColorId, setSelectedColorId] = React.useState<string>('');
  const [fills, setFills] = React.useState<FillMap>({});
  const [statusText, setStatusText] = React.useState<string>(MODE_DEFAULTS.professional);

  const allPages = React.useMemo(() => {
    if (!dynamicPages.length) return COLORING_PAGES;
    return [...dynamicPages, ...COLORING_PAGES];
  }, [dynamicPages]);

  const themeOptions = React.useMemo(() => {
    const base = [...COLORING_THEMES.map((theme) => ({ id: theme.id, label: theme.label, emoji: theme.emoji }))];
    const known = new Set(base.map((t) => t.id));

    for (const page of allPages) {
      if (!known.has(page.theme)) {
        base.push({
          id: page.theme,
          label: COLORING_THEME_LABELS[page.theme] || page.theme.replace(/[-_]/g, ' '),
          emoji: '🖍️',
        });
        known.add(page.theme);
      }
    }
    return base;
  }, [allPages]);

  React.useEffect(() => {
    let canceled = false;
    const loadDbPages = async () => {
      try {
        const response = await ApiClient.get<{ pages: DbPageResponse[] }>('/api/coloring/pages.php?action=list');
        if (canceled) return;
        const mapped = Array.isArray(response?.pages)
          ? response.pages.map(mapDbPageToDefinition).filter(Boolean) as ColoringPageDefinition[]
          : [];
        setDynamicPages(mapped);
      } catch (error) {
        console.error('[useColoringBook] Failed to load DB coloring pages', error);
        if (!canceled) setDynamicPages([]);
      }
    };

    void loadDbPages();
    return () => {
      canceled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!selectedPageId && allPages[0]?.id) {
      setSelectedPageId(allPages[0].id);
    }
  }, [allPages, selectedPageId]);

  const filteredPages = React.useMemo(() => allPages.filter((page) => {
    if (themeFilter !== 'all' && page.theme !== themeFilter) {
      return false;
    }
    if (difficultyFilter !== 'all' && page.difficulty !== difficultyFilter) {
      return false;
    }
    return true;
  }), [allPages, themeFilter, difficultyFilter]);

  const selectedPage = React.useMemo(
    () => filteredPages.find((page) => page.id === selectedPageId) || filteredPages[0] || allPages[0] || null,
    [filteredPages, selectedPageId, allPages],
  );

  React.useEffect(() => {
    if (!selectedPage) return;
    if (selectedPageId !== selectedPage.id) {
      setSelectedPageId(selectedPage.id);
      setFills({});
    }
  }, [selectedPage, selectedPageId]);

  React.useEffect(() => {
    if (!selectedPage) return;
    if (!selectedPage.palette.some((color) => color.id === selectedColorId)) {
      setSelectedColorId(selectedPage.palette[0]?.id || '');
    }
  }, [selectedPage, selectedColorId]);

  React.useEffect(() => {
    setStatusText(MODE_DEFAULTS[mode]);
  }, [mode]);

  const noviceTargetColorId = React.useMemo(() => {
    if (!selectedPage || mode !== 'novice') return null;
    return firstUnfilledTargetColor(selectedPage, fills);
  }, [selectedPage, mode, fills]);

  const correctness = React.useMemo(() => {
    if (!selectedPage) {
      return { correct: 0, total: 0, completed: false };
    }
    const correct = selectedPage.regions.filter((region) => fills[region.id] === region.targetColorId).length;
    return {
      correct,
      total: selectedPage.regions.length,
      completed: selectedPage.regions.length > 0 && correct === selectedPage.regions.length,
    };
  }, [selectedPage, fills]);

  const selectPage = React.useCallback((pageId: string) => {
    setSelectedPageId(pageId);
    setFills({});
    setStatusText(MODE_DEFAULTS[mode]);
  }, [mode]);

  const resetPage = React.useCallback(() => {
    setFills({});
    setStatusText(MODE_DEFAULTS[mode]);
  }, [mode]);

  const onRegionClick = React.useCallback((regionId: string) => {
    if (!selectedPage) return;

    const region = getRegion(selectedPage, regionId);
    if (!region) return;

    if (mode === 'professional') {
      if (!selectedColorId) {
        setStatusText('Choose a color first.');
        return;
      }
      setFills((prev) => ({ ...prev, [region.id]: selectedColorId }));
      setStatusText(`Filled ${region.label}.`);
      return;
    }

    if (mode === 'beginner') {
      setFills((prev) => ({ ...prev, [region.id]: region.targetColorId }));
      setStatusText(`${region.label} auto-filled with ${region.targetColorId}.`);
      return;
    }

    const targetColorId = firstUnfilledTargetColor(selectedPage, fills);
    if (!targetColorId) {
      setStatusText('Great work. This page is complete.');
      return;
    }

    if (region.targetColorId !== targetColorId) {
      setStatusText('Try again: click a highlighted area for this color.');
      return;
    }

    setFills((prev) => ({ ...prev, [region.id]: targetColorId }));
    setStatusText(`Nice! ${region.label} matched ${targetColorId}.`);
  }, [selectedPage, mode, selectedColorId, fills]);

  return {
    mode,
    setMode,
    themeFilter,
    setThemeFilter,
    difficultyFilter,
    setDifficultyFilter,
    selectedPage,
    filteredPages,
    themeOptions,
    selectedPageId,
    selectPage,
    selectedColorId,
    setSelectedColorId,
    fills,
    onRegionClick,
    noviceTargetColorId,
    correctness,
    resetPage,
    statusText,
    totalPageCount: allPages.length,
  };
}
