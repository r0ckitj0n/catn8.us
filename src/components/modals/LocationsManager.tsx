import React from 'react';
import { IToast } from '../../types/common';
import { useLocationsManager } from './hooks/useLocationsManager';
import { LocationSelectorSection } from './sections/LocationSelectorSection';
import { LocationDetailsSection } from './sections/LocationDetailsSection';
import './LocationsManager.css';

interface LocationsManagerProps {
  isAdmin: boolean;
  caseId: string | number;
  busy: boolean;
  showMysteryToast: (t: Partial<IToast>) => void;
  onClose?: () => void;
}

/**
 * LocationsManager - Refactored Component
 * COMPLIANCE: File size < 250 lines
 */
export function LocationsManager({
  isAdmin,
  caseId,
  busy,
  showMysteryToast,
  onClose,
}: LocationsManagerProps) {
  const state = useLocationsManager(isAdmin, caseId, showMysteryToast);

  return (
    <div className="modal-content">
      <div className="modal-header">
        <div className="fw-bold">Locations</div>
        <div className="d-flex align-items-center gap-2">
          <div className="form-check">
            <input
              id="locations-include-archived"
              className="form-check-input"
              type="checkbox"
              checked={state.locationsIncludeArchived}
              onChange={(e) => state.setLocationsIncludeArchived(e.target.checked)}
              disabled={busy || state.locationsBusy}
            />
            <label className="form-check-label" htmlFor="locations-include-archived">Show archived</label>
          </div>
          <button 
            type="button" 
            className="btn btn-sm btn-outline-secondary" 
            onClick={state.loadLocations} 
            disabled={busy || state.locationsBusy}
          >
            Refresh
          </button>
          {isAdmin && (
            <button
              type="button"
              className={'btn btn-sm btn-primary catn8-dirty-save' + (state.locationIsDirty ? ' catn8-dirty-save--visible' : '')}
              onClick={() => void state.saveLocation()}
              disabled={busy || state.locationsBusy || !isAdmin || !state.locationIsDirty || state.locationSelectedIsLocked}
              aria-label="Save"
              title={state.locationSelectedIsLocked ? 'Location is locked' : (state.locationIsDirty ? 'Save changes' : 'No changes to save')}
            >
              Save
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => void state.generateLocation(true)}
              disabled={busy || state.locationsBusy || state.locationSelectedIsLocked || !state.canGenerateLocationDetails}
              title={state.canGenerateLocationDetails ? 'Generate details using the current fields as constraints' : 'Enter required fields first'}
            >
              Generate Details
            </button>
          )}
          {onClose ? (
            <button type="button" className="btn-close catn8-mystery-modal-close" onClick={onClose} aria-label="Close"></button>
          ) : (
            <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
          )}
        </div>
      </div>
      <div className="modal-body">
        <div className="row g-3">
          <div className="col-12 col-lg-4">
            <LocationSelectorSection 
              locations={state.locations}
              locationSelectedId={state.locationSelectedId}
              locationSelectedIsLocked={state.locationSelectedIsLocked}
              locationsBusy={state.locationsBusy}
              busy={busy}
              isAdmin={isAdmin}
              locationImageDraft={state.locationImageDraft}
              locationAddress1Draft={state.locationAddress1Draft}
              locationCityDraft={state.locationCityDraft}
              locationRegionDraft={state.locationRegionDraft}
              selectLocationById={state.selectLocationById}
              setLocationIsArchivedDraft={state.setLocationIsArchivedDraft}
              deleteLocationAction={state.deleteLocationAction}
              generateLocationPhotoFromAddress={state.generateLocationPhotoFromAddress}
              uploadLocationImage={state.uploadLocationImage}
              deleteLocationImage={state.deleteLocationImage}
            />
          </div>
          <div className="col-12 col-lg-8">
            <LocationDetailsSection 
              isAdmin={isAdmin}
              locationNameDraft={state.locationNameDraft}
              setLocationNameDraft={state.setLocationNameDraft}
              locationSlugDraft={state.locationSlugDraft}
              setLocationSlugDraft={state.setLocationSlugDraft}
              locationDescriptionDraft={state.locationDescriptionDraft}
              setLocationDescriptionDraft={state.setLocationDescriptionDraft}
              locationExternalIdDraft={state.locationExternalIdDraft}
              setLocationExternalIdDraft={state.setLocationExternalIdDraft}
              locationCountryDraft={state.locationCountryDraft}
              setLocationCountryDraft={state.setLocationCountryDraft}
              locationAddress1Draft={state.locationAddress1Draft}
              setLocationAddress1Draft={state.setLocationAddress1Draft}
              locationAddress2Draft={state.locationAddress2Draft}
              setLocationAddress2Draft={state.setLocationAddress2Draft}
              locationCityDraft={state.locationCityDraft}
              setLocationCityDraft={state.setLocationCityDraft}
              locationRegionDraft={state.locationRegionDraft}
              setLocationRegionDraft={state.setLocationRegionDraft}
              locationPostalDraft={state.locationPostalDraft}
              setLocationPostalDraft={state.setLocationPostalDraft}
              locationIsArchivedDraft={state.locationIsArchivedDraft}
              setLocationIsArchivedDraft={state.setLocationIsArchivedDraft}
              busy={busy}
              locationsBusy={state.locationsBusy}
              locationSelectedIsLocked={state.locationSelectedIsLocked}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
