import React from 'react';

import { WebpImage } from '../../common/WebpImage';
import './TakeCaseModal.css';

interface TakeCaseModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  cases: any[];
  busy: boolean;
  onTakeCase: (caseId: number) => void;
}

export function TakeCaseModal({ modalRef, cases, busy, onTakeCase }: TakeCaseModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered catn8-take-case-dialog modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Take the Case</div>
            <button type="button" className="catn8-mystery-modal-close" aria-label="Close" data-bs-dismiss="modal">×</button>
          </div>
          <div className="modal-body">
            <div className="catn8-card p-3 catn8-mystery-modal-card">
              <div className="catn8-take-case-scroll">
                <div className="catn8-take-case-grid">
                  {(Array.isArray(cases) ? cases : [])
                    .filter((c: any) => Number(c?.is_archived || 0) !== 1)
                    .filter((c: any) => Number(c?.is_template || 0) !== 1)
                    .map((c: any) => {
                      const cid = Number(c?.id || 0);
                      const title = String(c?.title || '').trim() || 'Untitled Case';
                      const backstoryTitle = String(c?.backstory_title || '').trim();
                      const backstorySummary = String(c?.backstory_summary || '').trim();
                      const briefing = String(c?.briefing_text || c?.description || '').trim();
                      const summary = briefing || backstorySummary;
                      const bgUrl = String(c?.location_image_url || '').trim();

                      return (
                        <button
                          key={String(cid) + '-' + String(c?.slug || '')}
                          type="button"
                          className="catn8-take-case-tile"
                          onClick={() => {
                            console.log("TakeCaseModal: Tile clicked for cid =", cid);
                            onTakeCase(cid);
                          }}
                          disabled={busy || !cid}
                        >
                          {bgUrl ? (
                            <WebpImage className="catn8-take-case-tile-bg" src={bgUrl} alt="" aria-hidden="true" />
                          ) : null}
                          <div className="catn8-take-case-tile-inner">
                            <div className="catn8-take-case-title">{title}</div>
                            {backstoryTitle ? (
                              <div className="catn8-take-case-subtitle">Backstory: {backstoryTitle}</div>
                            ) : null}
                            {summary ? (
                              <div className="catn8-take-case-briefing">{summary}</div>
                            ) : (
                              <div className="catn8-take-case-briefing catn8-take-case-briefing--empty">No summary yet.</div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
