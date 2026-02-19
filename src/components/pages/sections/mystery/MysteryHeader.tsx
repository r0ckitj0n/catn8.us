import React from 'react';
import './MysteryHeader.css';
import { IMystery, ICase } from '../../../../types/game';

interface MysteryHeaderProps {
  mysteryTitle: string;
  cachedMysteryTitle: string;
  selectedMystery: IMystery | null;
  selectedCase: ICase | null;
  caseId: string;
  scenarioTitle: string;
  error: string;
  isAdmin: boolean;
  onOpenGameMgmt: () => void;
  onOpenCrimeLab: () => void;
  openMysteryPicker: () => void;
  openTakeCaseModal: () => void;
  onCloseCase: () => void;
}

export function MysteryHeader({
  mysteryTitle,
  cachedMysteryTitle,
  selectedMystery,
  selectedCase,
  caseId,
  scenarioTitle,
  error,
  isAdmin,
  onOpenGameMgmt,
  onOpenCrimeLab,
  openMysteryPicker,
  openTakeCaseModal,
  onCloseCase
}: MysteryHeaderProps) {
  return (
    <div className="catn8-mystery-header">
      <div className="catn8-mystery-header-title d-flex align-items-center gap-3">
        <span 
          className="catn8-header-clickable" 
          onClick={openMysteryPicker}
          title="Change Mystery"
        >
          {selectedMystery ? (
            `Mystery: ${selectedMystery.title}`
          ) : cachedMysteryTitle ? (
            `Mystery: ${cachedMysteryTitle}`
          ) : 'Choose a Mystery'}
        </span>
        
        {caseId && (
          <div className="d-flex align-items-center gap-2 ms-3">
            <button
              type="button"
              className="btn-close btn-close-white small"
              aria-label="Close Case"
              onClick={(e) => {
                e.stopPropagation();
                onCloseCase();
              }}
              style={{ fontSize: '0.65rem', padding: '0.25rem' }}
              title="Close Case"
            />
            <span 
              className="catn8-header-clickable" 
              onClick={openTakeCaseModal}
              title="Change Case"
            >
              Case: {scenarioTitle || (selectedCase ? selectedCase.title : 'Loading Case...')}
            </span>
          </div>
        )}
      </div>
      <div className="d-flex align-items-center gap-2">
        {isAdmin && (
          <div className="d-flex align-items-center gap-2 me-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-info d-flex align-items-center gap-1 fw-bold admin-console-btn"
              onClick={onOpenGameMgmt}
              title="Dossier (Management)"
              style={{ border: '1px solid #0dcaf0' }}
            >
              <i className="bi bi-person-badge-fill"></i>
              <span>🪪 Dossier</span>
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-info d-flex align-items-center gap-1 fw-bold admin-console-btn"
              onClick={onOpenCrimeLab}
              title="Crime Lab"
              style={{ border: '1px solid #0dcaf0' }}
            >
              <i className="bi bi-microscope"></i>
              <span>🔬 Lab</span>
            </button>
          </div>
        )}
        {error && <div className="text-danger small me-2" title={error} style={{ cursor: 'help' }}>Error</div>}
        <button
          type="button"
          className="catn8-mystery-header-close"
          aria-label="Close"
          onClick={() => { window.location.href = '/'; }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
