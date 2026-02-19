import React from 'react';

interface WeaponSelectorSectionProps {
  weapons: any[];
  weaponSelectedId: string;
  weaponSelectedIsLocked: boolean;
  weaponsBusy: boolean;
  busy: boolean;
  isAdmin: boolean;
  weaponImageDraft: any;
  selectWeaponById: (id: string, list: any[]) => void;
  setWeaponIsArchivedDraft: (archived: boolean) => void;
  deleteWeaponAction: () => Promise<void>;
  generateWeapon: (fillMissing: boolean) => Promise<void>;
  uploadWeaponImage: (file: File) => Promise<void>;
  deleteWeaponImage: () => Promise<void>;
}

export function WeaponSelectorSection({
  weapons,
  weaponSelectedId,
  weaponSelectedIsLocked,
  weaponsBusy,
  busy,
  isAdmin,
  weaponImageDraft,
  selectWeaponById,
  setWeaponIsArchivedDraft,
  deleteWeaponAction,
  generateWeapon,
  uploadWeaponImage,
  deleteWeaponImage,
}: WeaponSelectorSectionProps) {
  return (
    <div className="catn8-card p-3 h-100">
      <label className="form-label" htmlFor="weapons-select">Weapon</label>
      <select
        id="weapons-select"
        className="form-select"
        value={weaponSelectedId}
        onChange={(e) => selectWeaponById(e.target.value, weapons)}
        disabled={busy || weaponsBusy}
      >
        <option value="">(New weapon)</option>
        {weapons.map((w: any) => {
          const id = String(w?.id || '');
          const name = String(w?.name || '') || '(Unnamed)';
          const locked = Number(w?.is_locked || 0) === 1;
          const archived = Number(w?.is_archived || 0) === 1;
          const label = `${name}${archived ? ' (archived)' : ''}${locked ? ' (locked)' : ''}`;
          return <option key={id} value={id}>{label}</option>;
        })}
      </select>

      {weaponSelectedIsLocked && (
        <div className="alert alert-warning mt-3 mb-0">
          This weapon is in an active case and cannot be edited or deleted.
        </div>
      )}

      <div className="d-flex gap-2 mt-3">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setWeaponIsArchivedDraft(true)}
          disabled={busy || weaponsBusy || !isAdmin || weaponSelectedIsLocked}
        >
          Archive
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-danger"
          onClick={deleteWeaponAction}
          disabled={busy || weaponsBusy || !isAdmin || weaponSelectedIsLocked || !weaponSelectedId}
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
              onClick={() => void generateWeapon(true)}
              disabled={busy || weaponsBusy || !isAdmin || weaponSelectedIsLocked || !(Number(weaponSelectedId || 0) > 0)}
              title={(Number(weaponSelectedId || 0) > 0) ? 'Generate an evidence photo' : 'Save the weapon first'}
            >
              Generate Photo
            </button>
          </div>
        )}

        {String(weaponImageDraft?.url || '').trim() ? (
          <div className="mt-2">
            <img
              className="img-fluid rounded"
              src={String(weaponImageDraft?.url || '')}
              alt={String(weaponImageDraft?.alt_text || 'Weapon')}
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
              disabled={busy || weaponsBusy || !isAdmin || weaponSelectedIsLocked || !weaponSelectedId}
              onChange={(e) => {
                const f = (e.target.files && e.target.files[0]) ? e.target.files[0] : null;
                if (!f) return;
                void uploadWeaponImage(f);
                try { (e.target as any).value = ''; } catch (_e) {}
              }}
            />
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={deleteWeaponImage}
              disabled={busy || weaponsBusy || !isAdmin || weaponSelectedIsLocked || !String(weaponImageDraft?.url || '').trim()}
            >
              Delete Photo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
