import React from 'react';

interface WeaponDetailsSectionProps {
  isAdmin: boolean;
  weaponNameDraft: string;
  setWeaponNameDraft: (v: string) => void;
  weaponSlugDraft: string;
  setWeaponSlugDraft: (v: string) => void;
  weaponDescriptionDraft: string;
  setWeaponDescriptionDraft: (v: string) => void;
  weaponIsArchivedDraft: boolean;
  setWeaponIsArchivedDraft: (v: boolean) => void;
  busy: boolean;
  weaponsBusy: boolean;
  weaponSelectedIsLocked: boolean;
}

export function WeaponDetailsSection({
  isAdmin,
  weaponNameDraft, setWeaponNameDraft,
  weaponSlugDraft, setWeaponSlugDraft,
  weaponDescriptionDraft, setWeaponDescriptionDraft,
  weaponIsArchivedDraft, setWeaponIsArchivedDraft,
  busy,
  weaponsBusy,
  weaponSelectedIsLocked
}: WeaponDetailsSectionProps) {
  const isDisabled = busy || weaponsBusy || weaponSelectedIsLocked || !isAdmin;

  return (
    <div className="catn8-card p-3 h-100">
      <div className="row g-2">
        <div className="col-12 col-lg-6">
          <label className="form-label" htmlFor="weapon-name">Name</label>
          <input id="weapon-name" className="form-control" value={weaponNameDraft} onChange={(e) => setWeaponNameDraft(e.target.value)} disabled={isDisabled} />
        </div>
        <div className="col-12 col-lg-6">
          <label className="form-label" htmlFor="weapon-slug">Slug</label>
          <input id="weapon-slug" className="form-control" value={weaponSlugDraft} onChange={(e) => setWeaponSlugDraft(e.target.value)} disabled={isDisabled} />
        </div>

        <div className="col-12">
          <label className="form-label" htmlFor="weapon-description">Description</label>
          <textarea id="weapon-description" className="form-control" rows={6} value={weaponDescriptionDraft} onChange={(e) => setWeaponDescriptionDraft(e.target.value)} disabled={isDisabled}></textarea>
        </div>

        <div className="col-12">
          <div className="form-check mt-2">
            <input id="weapon-is-archived" className="form-check-input" type="checkbox" checked={weaponIsArchivedDraft} onChange={(e) => setWeaponIsArchivedDraft(e.target.checked)} disabled={isDisabled} />
            <label className="form-check-label" htmlFor="weapon-is-archived">Archived</label>
          </div>
        </div>
      </div>
    </div>
  );
}
