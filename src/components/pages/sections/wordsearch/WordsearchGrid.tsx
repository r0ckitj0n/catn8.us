import React from 'react';
import './WordsearchGrid.css';

interface WordsearchGridProps {
  puzzle: any;
  selectedPage: any;
}

export function WordsearchGrid({ puzzle, selectedPage }: WordsearchGridProps) {
  if (!selectedPage) return null;

  return (
    <div className="mt-4">
      <div className="catn8-ws-legacy-header">
        <h2 className="catn8-ws-legacy-title">{puzzle?.title || 'Puzzle'}</h2>
        {selectedPage?.description ? (
          <div className="catn8-ws-legacy-description">{selectedPage.description}</div>
        ) : null}
      </div>

      {selectedPage?.summary ? (
        <div className="catn8-ws-legacy-summary">{selectedPage.summary}</div>
      ) : null}

      <div className="catn8-ws-legacy-wordlist">
        <div className="catn8-ws-legacy-words">
          {(Array.isArray(selectedPage.words) ? selectedPage.words : []).map((w: string) => (
            <span key={w} className="catn8-ws-legacy-word">{w}</span>
          ))}
        </div>
      </div>

      <div className="catn8-ws-grid-wrapper">
        <div
          className="catn8-ws-grid"
          style={{
            gridTemplateColumns: `repeat(${puzzle?.grid_size || 12}, 1fr)`,
            gridTemplateRows: `repeat(${puzzle?.grid_size || 12}, 1fr)`,
          }}
          aria-label="Word search grid"
        >
          {(Array.isArray(selectedPage.grid) ? selectedPage.grid : []).flat().map((ch: string, idx: number) => (
            <div
              key={idx}
              className="catn8-ws-cell"
            >
              {ch}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
