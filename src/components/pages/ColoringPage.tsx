import React from 'react';

import { COLORING_THEME_LABELS } from '../../data/coloringPages';
import { useColoringBook } from '../../hooks/useColoringBook';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { ColoringMode, ColoringShapeType } from '../../types/coloring';
import { PageLayout } from '../layout/PageLayout';

import './ColoringPage.css';

const MODE_LABELS: Record<ColoringMode, string> = {
  professional: 'Professional',
  beginner: 'Beginner',
  novice: 'Novice',
};

const MODE_HINTS: Record<ColoringMode, string> = {
  professional: 'Pick a color, then click any area to fill it.',
  beginner: 'Click an area and it fills itself with the guided color.',
  novice: 'Follow the shown color and click only matching spaces.',
};

function buildPolygonPoints(shapeType: ColoringShapeType, cx: number, cy: number, width: number, height: number): string {
  const halfW = width / 2;
  const halfH = height / 2;

  if (shapeType === 'triangle') {
    return `${cx},${cy - halfH} ${cx - halfW},${cy + halfH} ${cx + halfW},${cy + halfH}`;
  }

  if (shapeType === 'diamond') {
    return `${cx},${cy - halfH} ${cx - halfW},${cy} ${cx},${cy + halfH} ${cx + halfW},${cy}`;
  }

  return `${cx - halfW * 0.72},${cy - halfH} ${cx + halfW * 0.72},${cy - halfH} ${cx + halfW},${cy} ${cx + halfW * 0.72},${cy + halfH} ${cx - halfW * 0.72},${cy + halfH} ${cx - halfW},${cy}`;
}

export function ColoringPage({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle }: AppShellPageProps) {
  const {
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
    totalPageCount,
  } = useColoringBook();

  const paletteMap = React.useMemo(() => {
    const map: Record<string, { name: string; hex: string }> = {};
    for (const color of selectedPage?.palette || []) {
      map[color.id] = { name: color.name, hex: color.hex };
    }
    return map;
  }, [selectedPage]);

  const noviceColor = noviceTargetColorId ? paletteMap[noviceTargetColorId] : null;

  return (
    <PageLayout page="coloring" title="Coloring" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className="section">
        <div className="container">
          <h1 className="section-title">Coloring Studio</h1>
          <p className="lead text-center mb-2">{totalPageCount} themed pages with simple to difficult designs.</p>

          <div className="catn8-coloring-controls catn8-card p-3 mb-3">
            <div>
              <label className="form-label mb-1" htmlFor="coloring-theme-filter">Theme</label>
              <select
                id="coloring-theme-filter"
                className="form-select"
                value={themeFilter}
                onChange={(event) => setThemeFilter(event.target.value as typeof themeFilter)}
              >
                <option value="all">All Themes</option>
                {themeOptions.map((theme) => (
                  <option key={theme.id} value={theme.id}>{theme.emoji} {theme.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label mb-1" htmlFor="coloring-difficulty-filter">Difficulty</label>
              <select
                id="coloring-difficulty-filter"
                className="form-select"
                value={difficultyFilter}
                onChange={(event) => setDifficultyFilter(event.target.value as typeof difficultyFilter)}
              >
                <option value="all">All Levels</option>
                <option value="simple">Simple</option>
                <option value="medium">Medium</option>
                <option value="difficult">Difficult</option>
              </select>
            </div>
            <div>
              <label className="form-label mb-1" htmlFor="coloring-page-filter">Page</label>
              <select
                id="coloring-page-filter"
                className="form-select"
                value={selectedPageId}
                onChange={(event) => selectPage(event.target.value)}
              >
                {filteredPages.map((page) => (
                  <option key={page.id} value={page.id}>{page.previewEmoji} {page.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="catn8-coloring-layout">
            <aside className="catn8-coloring-sidebar catn8-card p-3">
              <h2 className="h5 mb-2">Modes</h2>
              <div className="btn-group w-100" role="group" aria-label="Coloring mode">
                {(Object.keys(MODE_LABELS) as ColoringMode[]).map((modeOption) => (
                  <button
                    key={modeOption}
                    type="button"
                    className={`btn btn-sm ${modeOption === mode ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setMode(modeOption)}
                  >
                    {MODE_LABELS[modeOption]}
                  </button>
                ))}
              </div>
              <p className="small text-muted mt-2 mb-3">{MODE_HINTS[mode]}</p>

              {mode === 'professional' && (
                <>
                  <h2 className="h6">Palette</h2>
                  <div className="catn8-coloring-palette">
                    {(selectedPage?.palette || []).map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        className={`catn8-color-swatch ${selectedColorId === color.id ? 'active' : ''}`}
                        style={{ backgroundColor: color.hex }}
                        onClick={() => setSelectedColorId(color.id)}
                        title={color.name}
                        aria-label={`Select ${color.name}`}
                      />
                    ))}
                  </div>
                </>
              )}

              {mode === 'novice' && noviceColor && (
                <div className="catn8-novice-target mb-3">
                  <div className="small text-uppercase fw-semibold">Current Color</div>
                  <div className="catn8-novice-chip">
                    <span className="catn8-color-dot" style={{ backgroundColor: noviceColor.hex }} aria-hidden="true" />
                    <strong>{noviceColor.name}</strong>
                  </div>
                </div>
              )}

              <div className="catn8-card p-2 mt-2">
                <div className="small text-muted">Progress</div>
                <div className="fw-semibold">{correctness.correct} / {correctness.total} correct</div>
                {correctness.completed && <div className="text-success fw-semibold mt-1">Page complete!</div>}
                <button type="button" className="btn btn-outline-secondary btn-sm mt-2" onClick={resetPage}>Reset Page</button>
              </div>

              <div className="small mt-3 catn8-coloring-status">{statusText}</div>
            </aside>

            <div className="catn8-coloring-main">
              <div className="catn8-coloring-header-row">
                <div>
                  <h2 className="h4 mb-1">{selectedPage?.previewEmoji} {selectedPage?.title}</h2>
                  <div className="text-muted small">{selectedPage ? COLORING_THEME_LABELS[selectedPage.theme] : ''} • {selectedPage?.difficulty}</div>
                </div>
              </div>

              <div className="catn8-coloring-canvas-wrap catn8-card">
                <svg viewBox="0 0 1000 700" className="catn8-coloring-canvas" role="img" aria-label={`Coloring page for ${selectedPage?.title || 'selected scene'}`}>
                  <rect x="0" y="0" width="1000" height="700" fill="#FFFFFF" />
                  {(selectedPage?.regions || []).map((region) => {
                    const fillId = fills[region.id];
                    const fillHex = fillId ? (paletteMap[fillId]?.hex || '#FFFFFF') : '#FFFFFF';
                    const isNoviceTarget = mode === 'novice' && noviceTargetColorId === region.targetColorId && fillId !== region.targetColorId;

                    if (region.shapeType === 'rect') {
                      return (
                        <rect
                          key={region.id}
                          x={region.cx - region.width / 2}
                          y={region.cy - region.height / 2}
                          width={region.width}
                          height={region.height}
                          rx={14}
                          ry={14}
                          fill={fillHex}
                          stroke={isNoviceTarget ? '#0D6EFD' : '#2F3E46'}
                          strokeWidth={isNoviceTarget ? 5 : 2.25}
                          className="catn8-coloring-region"
                          onClick={() => onRegionClick(region.id)}
                        />
                      );
                    }

                    if (region.shapeType === 'circle') {
                      return (
                        <ellipse
                          key={region.id}
                          cx={region.cx}
                          cy={region.cy}
                          rx={region.width / 2}
                          ry={region.height / 2}
                          fill={fillHex}
                          stroke={isNoviceTarget ? '#0D6EFD' : '#2F3E46'}
                          strokeWidth={isNoviceTarget ? 5 : 2.25}
                          className="catn8-coloring-region"
                          onClick={() => onRegionClick(region.id)}
                        />
                      );
                    }

                    return (
                      <polygon
                        key={region.id}
                        points={buildPolygonPoints(region.shapeType, region.cx, region.cy, region.width, region.height)}
                        fill={fillHex}
                        stroke={isNoviceTarget ? '#0D6EFD' : '#2F3E46'}
                        strokeWidth={isNoviceTarget ? 5 : 2.25}
                        className="catn8-coloring-region"
                        onClick={() => onRegionClick(region.id)}
                      />
                    );
                  })}
                </svg>
              </div>

              <div className="catn8-coloring-page-grid mt-3">
                {filteredPages.slice(0, 18).map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    className={`catn8-page-tile ${page.id === selectedPageId ? 'active' : ''}`}
                    onClick={() => selectPage(page.id)}
                  >
                    <span className="catn8-page-tile-emoji" aria-hidden="true">{page.previewEmoji}</span>
                    <span className="catn8-page-tile-title">{page.title}</span>
                    <span className="catn8-page-tile-meta">{COLORING_THEME_LABELS[page.theme]} • {page.difficulty}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
