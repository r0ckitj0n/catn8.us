import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IToast } from '../../../types/common';
import { useLocationsDraft } from './useLocationsDraft';

/**
 * useLocationsManager - Refactored Hook
 * COMPLIANCE: File size < 250 lines
 */
export function useLocationsManager(
  isAdmin: boolean,
  caseId: string | number,
  showMysteryToast: (t: Partial<IToast>) => void
) {
  const [locationsBusy, setLocationsBusy] = React.useState(false);
  const [locationsError, setLocationsError] = React.useState('');
  const [locationsIncludeArchived, setLocationsIncludeArchived] = React.useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [locationSelectedId, setLocationSelectedId] = React.useState('');
  const [locationSelectedIsLocked, setLocationSelectedIsLocked] = React.useState(false);
  const [locationBaseline, setLocationBaseline] = useState<any>({ 
    id: '', slug: '', name: '', description: '', location_id: '', 
    address_line1: '', address_line2: '', city: '', region: '', 
    postal_code: '', country: '', is_archived: 0 
  });

  const draft = useLocationsDraft();

  const loadLocations = React.useCallback(async () => {
    setLocationsBusy(true);
    setLocationsError('');
    try {
      const caseIdParam = !isAdmin && caseId ? `&case_id=${caseId}` : '';
      const res = await ApiClient.get(`/api/mystery/admin.php?action=list_locations&include_archived=${locationsIncludeArchived ? 1 : 0}${caseIdParam}`);
      const items = Array.isArray(res?.locations) ? res.locations : [];
      setLocations(items);
      if (locationSelectedId) {
        const found = items.find((x: any) => String(x?.id || '') === locationSelectedId);
        setLocationSelectedIsLocked(Boolean(found && Number(found?.is_locked || 0) === 1));
      }
    } catch (e: any) {
      setLocationsError(e?.message || 'Failed to load locations');
    } finally {
      setLocationsBusy(false);
    }
  }, [locationSelectedId, locationsIncludeArchived]);

  const selectLocationById = React.useCallback((id: string, list: any[]) => {
    const sid = String(id || '');
    setLocationSelectedId(sid);
    const found = (Array.isArray(list) ? list : []).find((x: any) => String(x?.id || '') === sid);
    if (!found) {
      setLocationSelectedIsLocked(false);
      draft.resetDraft();
      setLocationBaseline({ id: '', slug: '', name: '', description: '', location_id: '', address_line1: '', address_line2: '', city: '', region: '', postal_code: '', country: '', is_archived: 0 });
      return;
    }
    setLocationSelectedIsLocked(Boolean(Number(found?.is_locked || 0) === 1));
    draft.setDraftFromLocation(found);
    setLocationBaseline({
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
    });
  }, [draft]);

  const saveLocation = React.useCallback(async () => {
    if (!isAdmin || locationSelectedIsLocked) return;
    setLocationsBusy(true);
    try {
      const idNum = locationSelectedId ? Number(locationSelectedId) : 0;
      const res = await ApiClient.post('/api/mystery/admin.php?action=save_location', {
        id: idNum > 0 ? idNum : 0,
        slug: draft.locationSlugDraft,
        name: draft.locationNameDraft,
        description: draft.locationDescriptionDraft,
        location_id: draft.locationExternalIdDraft,
        address_line1: draft.locationAddress1Draft,
        address_line2: draft.locationAddress2Draft,
        city: draft.locationCityDraft,
        region: draft.locationRegionDraft,
        postal_code: draft.locationPostalDraft,
        country: draft.locationCountryDraft,
        is_archived: draft.locationIsArchivedDraft ? 1 : 0,
      });
      const newId = String(res?.id || '');
      if (res?.image) draft.setLocationImageDraft(res.image);
      await loadLocations();
      if (newId) {
        const refreshed = await ApiClient.get(`/api/mystery/admin.php?action=list_locations&include_archived=${locationsIncludeArchived ? 1 : 0}`);
        const items = Array.isArray(refreshed?.locations) ? refreshed.locations : [];
        setLocations(items);
        selectLocationById(newId, items);
      }
    } catch (e: any) {
      setLocationsError(e?.message || 'Failed to save location');
    } finally {
      setLocationsBusy(false);
    }
  }, [isAdmin, locationSelectedIsLocked, locationSelectedId, draft, loadLocations, locationsIncludeArchived, selectLocationById]);

  const generateLocation = React.useCallback(async (fillMissingOnly: boolean) => {
    if (!isAdmin || locationSelectedIsLocked) return;
    setLocationsBusy(true);
    try {
      const idNum = locationSelectedId ? Number(locationSelectedId) : 0;
      const res = await ApiClient.post('/api/mystery/admin.php?action=generate_location', {
        id: idNum > 0 ? idNum : 0,
        fill_missing_only: fillMissingOnly ? 1 : 0,
        with_image: 1,
        name: draft.locationNameDraft,
        description: draft.locationDescriptionDraft,
        location_id: draft.locationExternalIdDraft,
        address_line1: draft.locationAddress1Draft,
        address_line2: draft.locationAddress2Draft,
        city: draft.locationCityDraft,
        region: draft.locationRegionDraft,
        postal_code: draft.locationPostalDraft,
        country: draft.locationCountryDraft,
      });
      const loc = res?.location;
      if (loc) {
        setLocationSelectedId(String(loc.id || ''));
        draft.setDraftFromLocation(loc);
      }
      await loadLocations();
    } catch (e: any) {
      setLocationsError(e?.message || 'Failed to generate location');
    } finally {
      setLocationsBusy(false);
    }
  }, [isAdmin, locationSelectedIsLocked, locationSelectedId, draft, loadLocations]);

  React.useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  React.useEffect(() => {
    if (locationsError) {
      showMysteryToast({ tone: 'error', message: String(locationsError) });
      setLocationsError('');
    }
  }, [locationsError, showMysteryToast]);

  const locationIsDirty = React.useMemo(() => {
    const base = locationBaseline || {};
    const norm = (v: any) => String(v ?? '');
    const normBool = (v: any) => (Boolean(v) ? 1 : 0);
    return (
      norm(base.slug) !== norm(draft.locationSlugDraft) ||
      norm(base.name) !== norm(draft.locationNameDraft) ||
      norm(base.description) !== norm(draft.locationDescriptionDraft) ||
      norm(base.location_id) !== norm(draft.locationExternalIdDraft) ||
      norm(base.address_line1) !== norm(draft.locationAddress1Draft) ||
      norm(base.address_line2) !== norm(draft.locationAddress2Draft) ||
      norm(base.city) !== norm(draft.locationCityDraft) ||
      norm(base.region) !== norm(draft.locationRegionDraft) ||
      norm(base.postal_code) !== norm(draft.locationPostalDraft) ||
      norm(base.country) !== norm(draft.locationCountryDraft) ||
      normBool(base.is_archived) !== normBool(draft.locationIsArchivedDraft)
    );
  }, [locationBaseline, draft]);

  const canGenerateLocationDetails = React.useMemo(() => {
    return Boolean(draft.locationNameDraft.trim());
  }, [draft.locationNameDraft]);

  const deleteLocationAction = React.useCallback(async () => {
    if (!isAdmin || !locationSelectedId || locationSelectedIsLocked) return;
    setLocationsBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=delete_location', { id: Number(locationSelectedId) });
      showMysteryToast({ tone: 'success', message: 'Location deleted.' });
      setLocationSelectedId('');
      draft.resetDraft();
      await loadLocations();
    } catch (e: any) {
      setLocationsError(e?.message || 'Failed to delete location');
    } finally {
      setLocationsBusy(false);
    }
  }, [isAdmin, locationSelectedId, locationSelectedIsLocked, draft, loadLocations, showMysteryToast]);

  const generateLocationPhotoFromAddress = React.useCallback(async () => {
    if (!isAdmin || !locationSelectedId || locationSelectedIsLocked) return;
    setLocationsBusy(true);
    try {
      const res = await ApiClient.post<{ image?: any }>('/api/mystery/admin.php?action=generate_location_photo', {
        id: Number(locationSelectedId),
        address_line1: draft.locationAddress1Draft,
        city: draft.locationCityDraft,
        region: draft.locationRegionDraft
      });
      if (res?.image) {
        draft.setLocationImageDraft(res.image);
        showMysteryToast({ tone: 'success', message: 'Location photo generated.' });
      }
    } catch (e: any) {
      setLocationsError(e?.message || 'Failed to generate photo');
    } finally {
      setLocationsBusy(false);
    }
  }, [isAdmin, locationSelectedId, locationSelectedIsLocked, draft, showMysteryToast]);

  const uploadLocationImage = React.useCallback(async (file: File) => {
    if (!isAdmin || !locationSelectedId || locationSelectedIsLocked) return;
    setLocationsBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('id', locationSelectedId);
      formData.append('type', 'location');
      
      const res = await ApiClient.post<{ image?: any }>('/api/mystery/admin.php?action=upload_location_image', formData);
      if (res?.image) {
        draft.setLocationImageDraft(res.image);
        showMysteryToast({ tone: 'success', message: 'Image uploaded.' });
      }
    } catch (e: any) {
      setLocationsError(e?.message || 'Upload failed');
    } finally {
      setLocationsBusy(false);
    }
  }, [isAdmin, locationSelectedId, locationSelectedIsLocked, draft, showMysteryToast]);

  const deleteLocationImage = React.useCallback(async () => {
    if (!isAdmin || !locationSelectedId || locationSelectedIsLocked) return;
    setLocationsBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=delete_location_image', { id: Number(locationSelectedId) });
      draft.setLocationImageDraft({ title: '', url: '', alt_text: '', prompt_text: '', negative_prompt_text: '', provider: '', model: '' });
      showMysteryToast({ tone: 'success', message: 'Image removed.' });
    } catch (e: any) {
      setLocationsError(e?.message || 'Failed to remove image');
    } finally {
      setLocationsBusy(false);
    }
  }, [isAdmin, locationSelectedId, locationSelectedIsLocked, draft, showMysteryToast]);

  return {
    locationsBusy, locationsIncludeArchived, setLocationsIncludeArchived,
    locations, locationSelectedId, setLocationSelectedId, locationSelectedIsLocked,
    ...draft, loadLocations, selectLocationById, saveLocation, generateLocation,
    locationIsDirty, canGenerateLocationDetails, deleteLocationAction,
    generateLocationPhotoFromAddress, uploadLocationImage, deleteLocationImage
  };
}
