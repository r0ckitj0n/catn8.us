import React, { useState } from 'react';

export function useLocationsDraft() {
  const [locationSlugDraft, setLocationSlugDraft] = React.useState('');
  const [locationNameDraft, setLocationNameDraft] = React.useState('');
  const [locationDescriptionDraft, setLocationDescriptionDraft] = React.useState('');
  const [locationExternalIdDraft, setLocationExternalIdDraft] = React.useState('');
  const [locationAddress1Draft, setLocationAddress1Draft] = React.useState('');
  const [locationAddress2Draft, setLocationAddress2Draft] = React.useState('');
  const [locationCityDraft, setLocationCityDraft] = React.useState('');
  const [locationRegionDraft, setLocationRegionDraft] = React.useState('GA');
  const [locationPostalDraft, setLocationPostalDraft] = React.useState('30534');
  const [locationCountryDraft, setLocationCountryDraft] = React.useState('United States of America');
  const [locationIsArchivedDraft, setLocationIsArchivedDraft] = React.useState(false);
  const [locationImageDraft, setLocationImageDraft] = useState<any>({ 
    title: '', url: '', alt_text: '', prompt_text: '', negative_prompt_text: '', provider: '', model: '' 
  });

  const resetDraft = React.useCallback(() => {
    setLocationSlugDraft('');
    setLocationNameDraft('');
    setLocationDescriptionDraft('');
    setLocationExternalIdDraft('');
    setLocationAddress1Draft('');
    setLocationAddress2Draft('');
    setLocationCityDraft('');
    setLocationRegionDraft('GA');
    setLocationPostalDraft('30534');
    setLocationCountryDraft('United States of America');
    setLocationIsArchivedDraft(false);
    setLocationImageDraft({ title: '', url: '', alt_text: '', prompt_text: '', negative_prompt_text: '', provider: '', model: '' });
  }, []);

  const setDraftFromLocation = React.useCallback((found: any) => {
    setLocationSlugDraft(String(found?.slug || ''));
    setLocationNameDraft(String(found?.name || ''));
    setLocationDescriptionDraft(String(found?.description || ''));
    setLocationExternalIdDraft(String(found?.location_id || ''));
    setLocationAddress1Draft(String(found?.address_line1 || ''));
    setLocationAddress2Draft(String(found?.address_line2 || ''));
    setLocationCityDraft(String(found?.city || ''));
    setLocationRegionDraft(String(found?.region || ''));
    setLocationPostalDraft(String(found?.postal_code || ''));
    setLocationCountryDraft(String(found?.country || ''));
    setLocationIsArchivedDraft(Boolean(Number(found?.is_archived || 0) === 1));
    setLocationImageDraft(found?.image && typeof found.image === 'object' ? found.image : { title: '', url: '', alt_text: '', prompt_text: '', negative_prompt_text: '', provider: '', model: '' });
  }, []);

  return {
    locationSlugDraft, setLocationSlugDraft,
    locationNameDraft, setLocationNameDraft,
    locationDescriptionDraft, setLocationDescriptionDraft,
    locationExternalIdDraft, setLocationExternalIdDraft,
    locationAddress1Draft, setLocationAddress1Draft,
    locationAddress2Draft, setLocationAddress2Draft,
    locationCityDraft, setLocationCityDraft,
    locationRegionDraft, setLocationRegionDraft,
    locationPostalDraft, setLocationPostalDraft,
    locationCountryDraft, setLocationCountryDraft,
    locationIsArchivedDraft, setLocationIsArchivedDraft,
    locationImageDraft, setLocationImageDraft,
    resetDraft, setDraftFromLocation
  };
}
