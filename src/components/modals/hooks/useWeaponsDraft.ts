import React, { useState } from 'react';

export function useWeaponsDraft() {
  const [weaponSlugDraft, setWeaponSlugDraft] = React.useState('');
  const [weaponNameDraft, setWeaponNameDraft] = React.useState('');
  const [weaponDescriptionDraft, setWeaponDescriptionDraft] = React.useState('');
  const [weaponIsArchivedDraft, setWeaponIsArchivedDraft] = React.useState(false);
  const [weaponImageDraft, setWeaponImageDraft] = useState<any>({ 
    title: '', url: '', alt_text: '', prompt_text: '', negative_prompt_text: '', provider: '', model: '' 
  });

  const resetDraft = React.useCallback(() => {
    setWeaponSlugDraft('');
    setWeaponNameDraft('');
    setWeaponDescriptionDraft('');
    setWeaponIsArchivedDraft(false);
    setWeaponImageDraft({ title: '', url: '', alt_text: '', prompt_text: '', negative_prompt_text: '', provider: '', model: '' });
  }, []);

  const setDraftFromWeapon = React.useCallback((found: any) => {
    setWeaponSlugDraft(String(found?.slug || ''));
    setWeaponNameDraft(String(found?.name || ''));
    setWeaponDescriptionDraft(String(found?.description || ''));
    setWeaponIsArchivedDraft(Boolean(Number(found?.is_archived || 0) === 1));
    setWeaponImageDraft(found?.image && typeof found.image === 'object' ? found.image : { title: '', url: '', alt_text: '', prompt_text: '', negative_prompt_text: '', provider: '', model: '' });
  }, []);

  return {
    weaponSlugDraft, setWeaponSlugDraft,
    weaponNameDraft, setWeaponNameDraft,
    weaponDescriptionDraft, setWeaponDescriptionDraft,
    weaponIsArchivedDraft, setWeaponIsArchivedDraft,
    weaponImageDraft, setWeaponImageDraft,
    resetDraft, setDraftFromWeapon
  };
}
