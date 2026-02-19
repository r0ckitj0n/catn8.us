import React from 'react';

interface LocationDetailsSectionProps {
  isAdmin: boolean;
  locationNameDraft: string;
  setLocationNameDraft: (v: string) => void;
  locationSlugDraft: string;
  setLocationSlugDraft: (v: string) => void;
  locationDescriptionDraft: string;
  setLocationDescriptionDraft: (v: string) => void;
  locationExternalIdDraft: string;
  setLocationExternalIdDraft: (v: string) => void;
  locationCountryDraft: string;
  setLocationCountryDraft: (v: string) => void;
  locationAddress1Draft: string;
  setLocationAddress1Draft: (v: string) => void;
  locationAddress2Draft: string;
  setLocationAddress2Draft: (v: string) => void;
  locationCityDraft: string;
  setLocationCityDraft: (v: string) => void;
  locationRegionDraft: string;
  setLocationRegionDraft: (v: string) => void;
  locationPostalDraft: string;
  setLocationPostalDraft: (v: string) => void;
  locationIsArchivedDraft: boolean;
  setLocationIsArchivedDraft: (v: boolean) => void;
  busy: boolean;
  locationsBusy: boolean;
  locationSelectedIsLocked: boolean;
}

export function LocationDetailsSection({
  isAdmin,
  locationNameDraft, setLocationNameDraft,
  locationSlugDraft, setLocationSlugDraft,
  locationDescriptionDraft, setLocationDescriptionDraft,
  locationExternalIdDraft, setLocationExternalIdDraft,
  locationCountryDraft, setLocationCountryDraft,
  locationAddress1Draft, setLocationAddress1Draft,
  locationAddress2Draft, setLocationAddress2Draft,
  locationCityDraft, setLocationCityDraft,
  locationRegionDraft, setLocationRegionDraft,
  locationPostalDraft, setLocationPostalDraft,
  locationIsArchivedDraft, setLocationIsArchivedDraft,
  busy,
  locationsBusy,
  locationSelectedIsLocked
}: LocationDetailsSectionProps) {
  const isDisabled = busy || locationsBusy || locationSelectedIsLocked || !isAdmin;

  return (
    <div className="catn8-card p-3 h-100">
      <div className="row g-2">
        <div className="col-12 col-lg-6">
          <label className="form-label" htmlFor="location-name">Name</label>
          <input id="location-name" className="form-control" value={locationNameDraft} onChange={(e) => setLocationNameDraft(e.target.value)} disabled={isDisabled} />
        </div>
        <div className="col-12 col-lg-6">
          <label className="form-label" htmlFor="location-slug">Slug</label>
          <input id="location-slug" className="form-control" value={locationSlugDraft} onChange={(e) => setLocationSlugDraft(e.target.value)} disabled={isDisabled} />
        </div>

        <div className="col-12">
          <label className="form-label" htmlFor="location-description">Description</label>
          <textarea id="location-description" className="form-control" rows={4} value={locationDescriptionDraft} onChange={(e) => setLocationDescriptionDraft(e.target.value)} disabled={isDisabled}></textarea>
        </div>

        <div className="col-12 col-lg-6">
          <label className="form-label" htmlFor="location-external-id">Location ID</label>
          <input id="location-external-id" className="form-control" value={locationExternalIdDraft} onChange={(e) => setLocationExternalIdDraft(e.target.value)} disabled={isDisabled} />
        </div>
        <div className="col-12 col-lg-6">
          <label className="form-label" htmlFor="location-country">Country</label>
          <input id="location-country" className="form-control" value={locationCountryDraft} onChange={(e) => setLocationCountryDraft(e.target.value)} disabled={isDisabled} />
        </div>

        <div className="col-12 col-lg-6">
          <label className="form-label" htmlFor="location-address1">Address line 1</label>
          <input id="location-address1" className="form-control" value={locationAddress1Draft} onChange={(e) => setLocationAddress1Draft(e.target.value)} disabled={isDisabled} />
        </div>
        <div className="col-12 col-lg-6">
          <label className="form-label" htmlFor="location-address2">Address line 2</label>
          <input id="location-address2" className="form-control" value={locationAddress2Draft} onChange={(e) => setLocationAddress2Draft(e.target.value)} disabled={isDisabled} />
        </div>

        <div className="col-12 col-lg-4">
          <label className="form-label" htmlFor="location-city">City</label>
          <input id="location-city" className="form-control" value={locationCityDraft} onChange={(e) => setLocationCityDraft(e.target.value)} disabled={isDisabled} />
        </div>
        <div className="col-12 col-lg-4">
          <label className="form-label" htmlFor="location-region">State</label>
          <input id="location-region" className="form-control" value={locationRegionDraft} onChange={(e) => setLocationRegionDraft(e.target.value)} disabled={isDisabled} />
        </div>
        <div className="col-12 col-lg-4">
          <label className="form-label" htmlFor="location-postal">Postal code</label>
          <input id="location-postal" className="form-control" value={locationPostalDraft} onChange={(e) => setLocationPostalDraft(e.target.value)} disabled={isDisabled} />
        </div>

        <div className="col-12">
          <div className="form-check mt-2">
            <input id="location-is-archived" className="form-check-input" type="checkbox" checked={locationIsArchivedDraft} onChange={(e) => setLocationIsArchivedDraft(e.target.checked)} disabled={isDisabled} />
            <label className="form-check-label" htmlFor="location-is-archived">Archived</label>
          </div>
        </div>
      </div>
    </div>
  );
}
