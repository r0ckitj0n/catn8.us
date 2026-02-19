import React from 'react';
import './SheriffStationView.css';

interface SheriffStationViewProps {
  isAdmin: boolean;
  caseTitle: string;
  caseNumber?: number;
  briefing?: string;
  onOpenInterrogationRoom: () => void;
  onStudyCaseFiles: () => void;
  onReadInterrogationLogs: () => void;
  onReviewDepositions: () => void;
  onTalkToSheriff: () => void;
  onTalkToCsiDetective: () => void;
  onVisitLocation: () => void;
  onEvidenceLocker: () => void;
  onOpenGameMgmt: () => void;
  onOpenCrimeLab: () => void;
  onClose: () => void;
}

export function SheriffStationView({
  isAdmin,
  caseTitle,
  caseNumber,
  briefing,
  onOpenInterrogationRoom,
  onStudyCaseFiles,
  onReadInterrogationLogs,
  onReviewDepositions,
  onTalkToSheriff,
  onTalkToCsiDetective,
  onVisitLocation,
  onEvidenceLocker,
  onOpenGameMgmt,
  onOpenCrimeLab,
  onClose,
}: SheriffStationViewProps) {
  return (
    <div className="catn8-sheriff-station-view container py-4 position-relative">
      <button 
        type="button" 
        className="btn-close catn8-mystery-modal-close position-absolute top-0 end-0 m-3" 
        aria-label="Close"
        onClick={onClose}
        style={{ fontSize: '1.5rem', zIndex: 10 }}
      ></button>

      <div className="text-center catn8-case-header">
        <h1 className="catn8-noir-title mb-3">Sheriff Station</h1>
        <div className="d-flex flex-column align-items-center justify-content-center">
          <span className="catn8-case-name mb-3">
            Current Case: {caseNumber ? `#${caseNumber} - ` : ''}{caseTitle || 'UNSOLVED MYSTERY'}
          </span>
          
          {briefing && (
            <div className="catn8-station-briefing mb-4 p-3 bg-dark bg-opacity-50 rounded text-white border border-secondary shadow-sm" style={{ maxWidth: '800px', textAlign: 'left', whiteSpace: 'pre-wrap' }}>
              <div className="d-flex align-items-center gap-2 mb-2 text-info opacity-75">
                <i className="bi bi-file-text"></i>
                <small className="text-uppercase fw-bold" style={{ letterSpacing: '0.1em' }}>Case Briefing</small>
              </div>
              <div style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                {briefing}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="catn8-sheriff-station-grid">
        <button type="button" className="catn8-station-btn" onClick={onOpenInterrogationRoom}>
          <div className="catn8-station-btn-icon">👥</div>
          <div className="catn8-station-btn-text">Interrogation Room</div>
        </button>

        <button type="button" className="catn8-station-btn" onClick={onStudyCaseFiles}>
          <div className="catn8-station-btn-icon">📁</div>
          <div className="catn8-station-btn-text">Study Case Files</div>
        </button>

        <button type="button" className="catn8-station-btn" onClick={onReadInterrogationLogs}>
          <div className="catn8-station-btn-icon">📝</div>
          <div className="catn8-station-btn-text">Interrogation Logs</div>
        </button>

        <button type="button" className="catn8-station-btn" onClick={onReviewDepositions}>
          <div className="catn8-station-btn-icon">📜</div>
          <div className="catn8-station-btn-text">Review Depositions</div>
        </button>

        <button type="button" className="catn8-station-btn" onClick={onTalkToSheriff}>
          <div className="catn8-station-btn-icon">⭐</div>
          <div className="catn8-station-btn-text">Talk to Sheriff</div>
        </button>

        <button type="button" className="catn8-station-btn" onClick={onTalkToCsiDetective}>
          <div className="catn8-station-btn-icon">🔍</div>
          <div className="catn8-station-btn-text">Talk to CSI Detective</div>
        </button>

        <button type="button" className="catn8-station-btn" onClick={onVisitLocation}>
          <div className="catn8-station-btn-icon">📍</div>
          <div className="catn8-station-btn-text">Visit a Location</div>
        </button>

        <button type="button" className="catn8-station-btn" onClick={onEvidenceLocker}>
          <div className="catn8-station-btn-icon">🔦</div>
          <div className="catn8-station-btn-text">Evidence Locker</div>
        </button>

        {isAdmin && (
          <>
            <button
              type="button"
              className="catn8-station-btn admin-console-btn"
              onClick={onOpenGameMgmt}
              style={{ border: '2px solid #0dcaf0', background: 'rgba(13, 202, 240, 0.1)' }}
            >
              <div className="catn8-station-btn-icon"><i className="bi bi-person-badge-fill"></i></div>
              <div className="catn8-station-btn-text fw-bold">Dossier</div>
            </button>

            <button
              type="button"
              className="catn8-station-btn admin-console-btn"
              onClick={onOpenCrimeLab}
              style={{ border: '2px solid #0dcaf0', background: 'rgba(13, 202, 240, 0.1)' }}
            >
              <div className="catn8-station-btn-icon"><i className="bi bi-microscope"></i></div>
              <div className="catn8-station-btn-text fw-bold">Crime Lab</div>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
