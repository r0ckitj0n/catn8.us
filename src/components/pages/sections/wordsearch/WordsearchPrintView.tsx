import React from 'react';

interface WordsearchPrintViewProps {
  printJobs: any[];
}

export function WordsearchPrintView({ printJobs }: WordsearchPrintViewProps) {
  return (
    <div className="catn8-ws-print-root" style={{ display: 'none' }}>
      {printJobs.map((job, idx) => (
        <div key={`${job?.puzzle?.id || 'p'}-${job?.page?.id || 'pg'}-${idx}`}>
          <div className="catn8-ws-legacy-header">
            <h2 className="catn8-ws-legacy-title">{job?.puzzle?.title || 'Puzzle'}</h2>
            {job?.page?.description ? (
              <div className="catn8-ws-legacy-description">{job.page.description}</div>
            ) : null}
          </div>

          {job?.page?.summary ? (
            <div className="catn8-ws-legacy-summary">{job.page.summary}</div>
          ) : null}

          <div className="catn8-ws-legacy-wordlist">
            <div className="catn8-ws-legacy-words">
              {(Array.isArray(job?.page?.words) ? job.page.words : []).map((w: string) => (
                <span key={w} className="catn8-ws-legacy-word">{w}</span>
              ))}
            </div>
          </div>

          <div className="catn8-ws-grid-wrapper">
            <div
              className="catn8-ws-grid"
              style={{
                gridTemplateColumns: `repeat(${job?.puzzle?.grid_size || 12}, 1fr)`,
                gridTemplateRows: `repeat(${job?.puzzle?.grid_size || 12}, 1fr)`,
              }}
              aria-label="Word search grid"
            >
              {(Array.isArray(job?.page?.grid) ? job.page.grid : []).flat().map((ch: string, cidx: number) => (
                <div
                  key={cidx}
                  className="catn8-ws-cell"
                >
                  {ch}
                </div>
              ))}
            </div>
          </div>

          <div className="page-break"></div>
        </div>
      ))}
    </div>
  );
}
