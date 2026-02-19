import React from 'react';
import './RapSheetModal.css';

interface RapSheetModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  rapSheet: any;
  rapSheetBusy: boolean;
  scenarioId: string;
  interrogationEntityId: number;
  onLoadRapSheet: (sid: string, eid: number, opts?: { silent: boolean }) => Promise<void>;
}

export function RapSheetModal({
  modalRef,
  rapSheet,
  rapSheetBusy,
  scenarioId,
  interrogationEntityId,
  onLoadRapSheet,
}: RapSheetModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">RAP Sheet{rapSheet?.suspect?.name ? (': ' + String(rapSheet.suspect.name)) : ''}</div>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  onLoadRapSheet(scenarioId, interrogationEntityId, { silent: false });
                }}
                disabled={rapSheetBusy || !scenarioId || !interrogationEntityId}
              >
                Refresh
              </button>
              <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body">
            <div className="row g-3">
              <div className="col-12 col-lg-5">
                <div className="catn8-card p-3">
                  <div className="fw-bold mb-2">Booking Info</div>
                  {rapSheet?.booking && typeof rapSheet.booking === 'object' ? (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle mb-0">
                        <tbody>
                          {Object.entries(rapSheet.booking).map(([k, v]) => (
                            <tr key={k}>
                              <td className="text-muted catn8-rap-sheet-booking-key">{String(k)}</td>
                              <td>{String(v || '')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-muted">No booking details available.</div>
                  )}
                </div>

                <div className="catn8-card p-3 mt-3">
                  <div className="fw-bold mb-2">Time of Death &amp; Alibi</div>
                  <div className="d-flex flex-column gap-2">
                    <div>
                      <div className="text-muted small">Estimated time of death</div>
                      <div className="fw-bold">{String(rapSheet?.time_of_death || 'Unknown')}</div>
                    </div>
                    <div>
                      <div className="text-muted small">Claimed alibi</div>
                      <div className="catn8-mystery-log-text">{String(rapSheet?.alibi?.lie_text || 'None documented.')}</div>
                      {rapSheet?.alibi?.truth_text ? (
                        <div className="mt-2">
                          <div className="text-muted small">Truth (admin)</div>
                          <div className="catn8-mystery-log-text">{String(rapSheet?.alibi?.truth_text || '')}</div>
                        </div>
                      ) : null}
                    </div>
                    {Array.isArray(rapSheet?.alibi?.trigger_questions) && rapSheet.alibi.trigger_questions.length ? (
                      <div>
                        <div className="text-muted small">Common alibi questions</div>
                        <div className="d-flex flex-column gap-1">
                          {rapSheet.alibi.trigger_questions.map((q: any, idx: number) => (
                            <div key={String(idx)} className="text-muted small">{String(q || '')}</div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="catn8-card p-3 mt-3">
                  <div className="fw-bold mb-2">Prior Arrests</div>
                  {Array.isArray(rapSheet?.prior_arrests) && rapSheet.prior_arrests.length ? (
                    <div className="d-flex flex-column gap-2">
                      {rapSheet.prior_arrests.map((a: any, idx: number) => (
                        <div key={String(a?.id || idx)} className="catn8-card p-2">
                          <div className="fw-bold">{String(a?.summary || 'Arrest')}</div>
                          {a?.date ? <div className="text-muted small">{String(a.date)}</div> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted">None documented.</div>
                  )}
                </div>
              </div>

              <div className="col-12 col-lg-7">
                <div className="catn8-card p-3">
                  <div className="fw-bold mb-2">Information obtained during rapport building</div>
                  {Array.isArray(rapSheet?.kid_detective) && rapSheet.kid_detective.length ? (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th className="catn8-rap-sheet-col-question">Question</th>
                            <th>Answer</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rapSheet.kid_detective.map((qa: any, idx: number) => (
                            <tr key={String(idx)}>
                              <td className="catn8-mystery-log-text">{String(qa?.question || '')}</td>
                              <td className="catn8-mystery-log-text">{String(qa?.answer || '')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-muted">No starter Q&amp;A available.</div>
                  )}
                </div>

                <div className="catn8-card p-3 mt-3">
                  <div className="fw-bold mb-2">Interrogation History</div>
                  {Array.isArray(rapSheet?.interrogations) && rapSheet.interrogations.length ? (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle">
                        <thead>
                          <tr>
                            <th className="catn8-rap-sheet-col-time">Time</th>
                            <th className="catn8-rap-sheet-col-case">Case</th>
                            <th className="catn8-rap-sheet-col-scenario">Scenario</th>
                            <th>Q</th>
                            <th>A</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rapSheet.interrogations.map((ev: any) => (
                            <tr key={String(ev?.id)}>
                              <td className="text-muted">{String(ev?.asked_at || '')}</td>
                              <td>{String(ev?.case_title || '')}</td>
                              <td>{String(ev?.scenario_title || '')}</td>
                              <td className="catn8-mystery-log-text">{String(ev?.question_text || '')}</td>
                              <td className="catn8-mystery-log-text">{String(ev?.answer_text || '')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-muted">No interrogations found yet.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
