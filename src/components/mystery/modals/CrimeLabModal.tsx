import React from 'react';
import './CrimeLabModal.css';
import { IToast } from '../../../types/common';

interface CrimeLabModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  isAdmin: boolean;
  mysteryId: string | number;
  busy: boolean;
  onOpenAssetLibrary: () => void;
  onOpenCharacterLibrary: () => void;
  onOpenCaseMgmt: () => void;
  onOpenCommunications: () => void;
  onOpenDarkroom: () => void;
  onOpenLocations: () => void;
  onOpenMotives: () => void;
  onOpenStories: () => void;
  onOpenWeapons: () => void;
  showMysteryToast: (t: Partial<IToast>) => void;
}

export function CrimeLabModal({
  modalRef,
  isAdmin,
  mysteryId,
  busy,
  onOpenAssetLibrary,
  onOpenCharacterLibrary,
  onOpenCaseMgmt,
  onOpenCommunications,
  onOpenDarkroom,
  onOpenLocations,
  onOpenMotives,
  onOpenStories,
  onOpenWeapons,
  showMysteryToast,
}: CrimeLabModalProps) {
  const checkAdmin = (action: () => void, requiresMystery: boolean = true) => {
    // Administrators get higher priority and more bypasses
    if (isAdmin) {
      if (requiresMystery && !mysteryId) {
        showMysteryToast({ tone: 'error', message: 'Select a mystery first to use this specific tool.' });
        return;
      }
      action();
      return;
    }

    // Players/Non-admins logic
    if (requiresMystery && !mysteryId) {
      showMysteryToast({ tone: 'error', message: 'An active mystery is required.' });
      return;
    }
    
    action();
  };

  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered catn8-modal-menu catn8-crime-lab-modal">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Crime Lab</div>
            <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <div className="catn8-card p-3 catn8-mystery-modal-card catn8-crime-lab-card">
              <div className="catn8-crime-lab-grid">
                <button
                  type="button"
                  className="catn8-crime-lab-tile"
                  onClick={() => checkAdmin(onOpenAssetLibrary, false)}
                  disabled={busy || !isAdmin}
                >
                  <span className="catn8-crime-lab-tile-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" />
                      <path d="M9 7h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M9 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M9 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="catn8-crime-lab-tile-label">Asset Library</span>
                </button>

                <button
                  type="button"
                  className="catn8-crime-lab-tile"
                  onClick={() => checkAdmin(onOpenCharacterLibrary, false)}
                  disabled={busy || !isAdmin}
                >
                  <span className="catn8-crime-lab-tile-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M19 8v6m-3-3h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="catn8-crime-lab-tile-label">Characters</span>
                </button>

                <button
                  type="button"
                  className="catn8-crime-lab-tile"
                  onClick={() => checkAdmin(onOpenCaseMgmt, false)}
                  disabled={busy}
                >
                  <span className="catn8-crime-lab-tile-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path d="M8 7h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M8 11h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M8 15h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </span>
                  <span className="catn8-crime-lab-tile-label">Case Management</span>
                </button>

                <button
                  type="button"
                  className="catn8-crime-lab-tile"
                  onClick={() => checkAdmin(onOpenCommunications, false)}
                  disabled={busy || !isAdmin}
                >
                  <span className="catn8-crime-lab-tile-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path d="M8 7h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M6 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M7 14c0 3 2 6 5 6s5-3 5-6l-3-6H10l-3 6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="catn8-crime-lab-tile-label">Communications</span>
                </button>

                <button
                  type="button"
                  className="catn8-crime-lab-tile"
                  onClick={() => checkAdmin(onOpenDarkroom)}
                  disabled={busy}
                >
                  <span className="catn8-crime-lab-tile-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path d="M5 20h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M7 20V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v12" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <path d="M10 10h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M10 14h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="catn8-crime-lab-tile-label">Darkroom</span>
                </button>

                <button
                  type="button"
                  className="catn8-crime-lab-tile"
                  onClick={() => checkAdmin(onOpenLocations, false)}
                  disabled={busy}
                >
                  <span className="catn8-crime-lab-tile-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <path d="M12 11.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </span>
                  <span className="catn8-crime-lab-tile-label">Locations</span>
                </button>

                <button
                  type="button"
                  className="catn8-crime-lab-tile"
                  onClick={() => checkAdmin(onOpenMotives, false)}
                  disabled={busy}
                >
                  <span className="catn8-crime-lab-tile-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2l3 7H9l3-7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <path d="M4 22h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M8 9l-3 5h14l-3-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="catn8-crime-lab-tile-label">Motives</span>
                </button>

                <button
                  type="button"
                  className="catn8-crime-lab-tile"
                  onClick={() => checkAdmin(onOpenStories, false)}
                  disabled={busy}
                >
                  <span className="catn8-crime-lab-tile-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path d="M6 4h12a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H7a2 2 0 0 0-2 2V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <path d="M8 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M8 16h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="catn8-crime-lab-tile-label">Stories</span>
                </button>

                <button
                  type="button"
                  className="catn8-crime-lab-tile"
                  onClick={() => checkAdmin(onOpenWeapons, false)}
                  disabled={busy}
                >
                  <span className="catn8-crime-lab-tile-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path d="M14 6l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M5 21l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M7 7l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="catn8-crime-lab-tile-label">Weapons</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
