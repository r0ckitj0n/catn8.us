export const EMPTY_LOCATION_BASELINE = {
  id: '',
  slug: '',
  name: '',
  description: '',
  location_id: '',
  address_line1: '',
  address_line2: '',
  city: '',
  region: '',
  postal_code: '',
  country: '',
  is_archived: 0,
};

export function mapLocationToBaseline(found: any) {
  return {
    id: String(found?.id || ''),
    slug: String(found?.slug || ''),
    name: String(found?.name || ''),
    description: String(found?.description || ''),
    location_id: String(found?.location_id || ''),
    address_line1: String(found?.address_line1 || ''),
    address_line2: String(found?.address_line2 || ''),
    city: String(found?.city || ''),
    region: String(found?.region || ''),
    postal_code: String(found?.postal_code || ''),
    country: String(found?.country || ''),
    is_archived: Number(found?.is_archived || 0) === 1 ? 1 : 0,
  };
}

export function isLocationDirty(locationBaseline: any, draft: any) {
  const base = locationBaseline || {};
  const norm = (value: any) => String(value ?? '');
  const normBool = (value: any) => (Boolean(value) ? 1 : 0);
  return (
    norm(base.slug) !== norm(draft.locationSlugDraft)
    || norm(base.name) !== norm(draft.locationNameDraft)
    || norm(base.description) !== norm(draft.locationDescriptionDraft)
    || norm(base.location_id) !== norm(draft.locationExternalIdDraft)
    || norm(base.address_line1) !== norm(draft.locationAddress1Draft)
    || norm(base.address_line2) !== norm(draft.locationAddress2Draft)
    || norm(base.city) !== norm(draft.locationCityDraft)
    || norm(base.region) !== norm(draft.locationRegionDraft)
    || norm(base.postal_code) !== norm(draft.locationPostalDraft)
    || norm(base.country) !== norm(draft.locationCountryDraft)
    || normBool(base.is_archived) !== normBool(draft.locationIsArchivedDraft)
  );
}
