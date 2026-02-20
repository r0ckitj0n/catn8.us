import React from 'react';
import { SheriffStationView } from '../../../mystery/SheriffStationView';

interface MysteryStationViewProps {
  busy: boolean;
  isAdmin: boolean;
  caseId: string;
  scenarioId: string;
  briefing: string;
  onOpenInterrogationRoom: () => void;
  onStudyCaseFiles: () => void;
  onReadInterrogationLogs: () => void;
  onReviewDepositions: () => void;
  onTalkToSheriff: () => void;
  onTalkToCsiDetective: () => void;
  onVisitLocation: () => void;
  onEvidenceLocker: () => void;
  openTakeCaseModal: () => void;
  onOpenGameMgmt: () => void;
  onOpenCrimeLab: () => void;
}

export function MysteryStationView({
  busy,
  isAdmin,
  caseId,
  scenarioId,
  briefing,
  onOpenInterrogationRoom,
  onStudyCaseFiles,
  onReadInterrogationLogs,
  onReviewDepositions,
  onTalkToSheriff,
  onTalkToCsiDetective,
  onVisitLocation,
  onEvidenceLocker,
  openTakeCaseModal,
  onOpenGameMgmt,
  onOpenCrimeLab
}: MysteryStationViewProps) {
  const handleEnterStation = () => {
    window.location.href = '/sheriff_station.php';
  };

  return (
    <div className="row g-3">
      {isAdmin && (
        <div className="col-12 mb-4">
          <div className="catn8-card p-4 shadow-lg admin-console-card" style={{ background: 'rgba(13, 202, 240, 0.12)' }}>
            <div className="d-flex align-items-center gap-3 mb-4 text-info border-bottom border-info border-opacity-25 pb-3">
              <i className="bi bi-shield-lock-fill" style={{ fontSize: '2.2rem', filter: 'drop-shadow(0 0 8px rgba(13, 202, 240, 0.8))' }}></i>
              <div>
                <h4 className="text-uppercase mb-0 fw-black" style={{ letterSpacing: '0.2em', fontWeight: 900, textShadow: '0 0 10px rgba(13, 202, 240, 0.5)' }}>Administrator Command Center</h4>
                <div className="small opacity-100 fw-bold text-white">SYSTEM ACCESS: AUTHORIZED</div>
              </div>
            </div>
            <div className="d-flex flex-wrap gap-4">
              <button
                type="button"
                className="btn btn-lg btn-outline-info d-flex flex-column align-items-center justify-content-center p-4 gap-3 admin-console-btn"
                onClick={onOpenGameMgmt}
                disabled={busy}
                style={{ 
                  minWidth: '200px', 
                  borderRadius: '24px', 
                  background: 'rgba(0,0,0,0.6)', 
                  border: '2px solid #0dcaf0',
                  boxShadow: '0 0 20px rgba(13, 202, 240, 0.4)',
                  color: '#0dcaf0'
                }}
              >
                <i className="bi bi-person-badge-fill" style={{ fontSize: '3rem' }}></i>
                <span className="fw-black text-uppercase" style={{ letterSpacing: '2px', fontWeight: 900 }}>🪪 Dossier</span>
              </button>
              <button
                type="button"
                className="btn btn-lg btn-outline-info d-flex flex-column align-items-center justify-content-center p-4 gap-3 admin-console-btn"
                onClick={onOpenCrimeLab}
                disabled={busy}
                style={{ 
                  minWidth: '200px', 
                  borderRadius: '24px', 
                  background: 'rgba(0,0,0,0.6)', 
                  border: '2px solid #0dcaf0',
                  boxShadow: '0 0 20px rgba(13, 202, 240, 0.4)',
                  color: '#0dcaf0'
                }}
              >
                <i className="bi bi-microscope" style={{ fontSize: '3rem' }}></i>
                <span className="fw-black text-uppercase" style={{ letterSpacing: '2px', fontWeight: 900 }}>🔬 Crime Lab</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="col-12">
        <div className="catn8-card p-3">
          <div className="d-flex flex-column gap-2">
            <div className="d-flex flex-wrap gap-2">
              {caseId ? (
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleEnterStation}
                  disabled={busy}
                >
                  Enter Sheriff Station
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openTakeCaseModal}
                  disabled={busy}
                >
                  Take the Case
                </button>
              )}
            </div>
            {caseId && (
              <div 
                className="mt-3 p-4 rounded shadow-lg" 
                style={{ 
                  backgroundColor: '#1a1a1a',
                  color: '#ffffff',
                  border: '2px solid #0dcaf0',
                  borderLeft: '8px solid #0dcaf0',
                  display: 'block',
                  minHeight: '80px'
                }}
              >
                <div className="d-flex align-items-center gap-2 mb-3">
                  <i className="bi bi-file-earmark-text-fill text-info" style={{ fontSize: '1.5rem' }}></i>
                  <h5 className="text-uppercase mb-0 text-info" style={{ fontSize: '1.1rem', letterSpacing: '0.2em', fontWeight: '900' }}>
                    CASE BRIEFING
                  </h5>
                </div>
                <div 
                  className="ps-2" 
                  style={{ 
                    lineHeight: '1.8', 
                    fontSize: '1.15rem', 
                    color: '#f8f9fa',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {briefing || "The briefing for this case is currently unavailable. Please consult the Sheriff or check the Case Files."}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
