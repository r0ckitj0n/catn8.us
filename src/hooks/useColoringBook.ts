import React from 'react';

import { COLORING_PAGES } from '../data/coloringPages';
import { ColoringDifficulty, ColoringMode, ColoringPageDefinition, ColoringRegion, ColoringThemeId } from '../types/coloring';

type DifficultyFilter = ColoringDifficulty | 'all';
type ThemeFilter = ColoringThemeId | 'all';

type FillMap = Record<string, string>;

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

export function useColoringBook() {
  const [mode, setMode] = React.useState<ColoringMode>('professional');
  const [themeFilter, setThemeFilter] = React.useState<ThemeFilter>('all');
  const [difficultyFilter, setDifficultyFilter] = React.useState<DifficultyFilter>('all');
  const [selectedPageId, setSelectedPageId] = React.useState<string>(COLORING_PAGES[0]?.id || '');
  const [selectedColorId, setSelectedColorId] = React.useState<string>('');
  const [fills, setFills] = React.useState<FillMap>({});
  const [statusText, setStatusText] = React.useState<string>(MODE_DEFAULTS.professional);

  const filteredPages = React.useMemo(() => COLORING_PAGES.filter((page) => {
    if (themeFilter !== 'all' && page.theme !== themeFilter) {
      return false;
    }
    if (difficultyFilter !== 'all' && page.difficulty !== difficultyFilter) {
      return false;
    }
    return true;
  }), [themeFilter, difficultyFilter]);

  const selectedPage = React.useMemo(
    () => filteredPages.find((page) => page.id === selectedPageId) || filteredPages[0] || COLORING_PAGES[0] || null,
    [filteredPages, selectedPageId],
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
  };
}
