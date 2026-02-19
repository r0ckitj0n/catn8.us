import React from 'react';

import { WebpImage } from '../../common/WebpImage';

interface LocationSelectorSectionProps {
  locations: any[];
  locationSelectedId: string;
  locationSelectedIsLocked: boolean;
  locationsBusy: boolean;
  busy: boolean;
  isAdmin: boolean;
  locationImageDraft: any;
  locationAddress1Draft: string;
  locationCityDraft: string;
  locationRegionDraft: string;
  selectLocationById: (id: string, list: any[]) => void;
  setLocationIsArchivedDraft: (archived: boolean) => void;
  deleteLocationAction: () => Promise<void>;
  generateLocationPhotoFromAddress: () => Promise<void>;
  uploadLocationImage: (file: File) => Promise<void>;
  deleteLocationImage: () => Promise<void>;
}

export function LocationSelectorSection({
  locations,
  locationSelectedId,
  locationSelectedIsLocked,
  locationsBusy,
  busy,
  isAdmin,
  locationImageDraft,
  locationAddress1Draft,
  locationCityDraft,
  locationRegionDraft,
  selectLocationById,
  setLocationIsArchivedDraft,
  deleteLocationAction,
  generateLocationPhotoFromAddress,
  uploadLocationImage,
  deleteLocationImage,
}: LocationSelectorSectionProps) {
  return (
    <div className="catn8-card p-3 h-100">
      <label className="form-label" htmlFor="locations-select">Location</label>
      <select
        id="locations-select"
        className="form-select"
        value={locationSelectedId}
        onChange={(e) => selectLocationById(e.target.value, locations)}
        disabled={busy || locationsBusy}
      >
        <option value="">(New location)</option>
        {locations.map((l: any) => {
          const id = String(l?.id || '');
          const name = String(l?.name || '') || '(Unnamed)';
          const locked = Number(l?.is_locked || 0) === 1;
          const archived = Number(l?.is_archived || 0) === 1;
          const label = `${name}${archived ? ' (archived)' : ''}${locked ? ' (locked)' : ''}`;
          return <option key={id} value={id}>{label}</option>;
        })}
      </select>

      {locationSelectedIsLocked && (
        <div className="alert alert-warning mt-3 mb-0">
          This location is a crime scene in an active case and cannot be edited or deleted.
        </div>
      )}

      <div className="d-flex gap-2 mt-3">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setLocationIsArchivedDraft(true)}
          disabled={busy || locationsBusy || !isAdmin || locationSelectedIsLocked}
        >
          Archive
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-danger"
          onClick={deleteLocationAction}
          disabled={busy || locationsBusy || !isAdmin || locationSelectedIsLocked || !locationSelectedId}
        >
          Delete
        </button>
      </div>

      <div className="mt-3">
        <div className="fw-bold">Photo</div>
        {isAdmin && (
          <div className="mt-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={generateLocationPhotoFromAddress}
              disabled={
                busy ||
                locationsBusy ||
                !isAdmin ||
                locationSelectedIsLocked ||
                !(Number(locationSelectedId || 0) > 0) ||
                !locationAddress1Draft.trim() ||
                !locationCityDraft.trim() ||
                !locationRegionDraft.trim()
              }
              title={
                locationAddress1Draft.trim() && locationCityDraft.trim() && locationRegionDraft.trim()
                  ? 'Fetch a reference photo for this address and generate a noir-styled scene photo'
                  : 'Enter address line 1, city, and region first'
              }
            >
              Generate Photo
            </button>
          </div>
        )}

        {String(locationImageDraft?.url || '').trim() ? (
          <div className="mt-2">
            <WebpImage               className="img-fluid rounded"
              src={String(locationImageDraft?.url || '')}
              alt={String(locationImageDraft?.alt_text || 'Location')}
              loading="lazy"
            />
          </div>
        ) : (
          <div className="form-text mt-1">No photo yet.</div>
        )}

        {isAdmin && (
          <div className="d-flex gap-2 align-items-center mt-2">
            <input
              type="file"
              className="form-control"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy || locationsBusy || !isAdmin || locationSelectedIsLocked || !locationSelectedId}
              onChange={(e) => {
                const f = (e.target.files && e.target.files[0]) ? e.target.files[0] : null;
                if (!f) return;
                void uploadLocationImage(f);
                try { (e.target as any).value = ''; } catch (_e) {}
              }}
            />
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={deleteLocationImage}
              disabled={busy || locationsBusy || !isAdmin || locationSelectedIsLocked || !String(locationImageDraft?.url || '').trim()}
            >
              Delete Photo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
