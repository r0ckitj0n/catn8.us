import React from 'react';

interface CrimeDetailsSectionProps {
  busy: boolean;
  isAdmin: boolean;
  scenarioId: string;
  crimeSceneLocationIdDraft: string;
  setCrimeSceneLocationIdDraft: (val: string) => void;
  locations: any[];
  saveCrimeSceneLocationId: () => Promise<void>;
  scenarioCrimeScene: any;
  entityNameById: Record<string, string>;
  onOpenBackstories: () => void;
}

export function CrimeDetailsSection({
  busy, isAdmin, scenarioId, crimeSceneLocationIdDraft, setCrimeSceneLocationIdDraft,
  locations, saveCrimeSceneLocationId, scenarioCrimeScene, entityNameById, onOpenBackstories
}: CrimeDetailsSectionProps) {
  return (
    <div className="catn8-card p-3 h-100">
      <div className="d-flex align-items-start justify-content-between gap-2">
        <div>
          <div className="fw-bold">Crime Details</div>
          <div className="form-text mb-2">Quick view of the key crime details for the selected scenario.</div>
        </div>
      </div>

      {!scenarioId ? (
        <div className="text-muted">Select a scenario to view crime details.</div>
      ) : (
        <div className="d-flex flex-column gap-3">
          <div className="row g-2">
            <div className="col-12">
              <label className="form-label" htmlFor="crime-scene-location-global">Crime Scene Location (Global)</label>
              <div className="d-flex gap-2 align-items-end">
                <select
                  id="crime-scene-location-global"
                  className="form-select"
                  value={crimeSceneLocationIdDraft}
                  onChange={(e) => setCrimeSceneLocationIdDraft(e.target.value)}
                  disabled={busy || !scenarioId || !isAdmin}
                >
                  <option value="">(Not set)</option>
                  {(Array.isArray(locations) ? locations : [])
                    .filter((l: any) => Number(l?.is_archived || 0) !== 1)
                    .map((l: any) => (
                      <option key={'crime-scene-location-global-' + String(l?.id || '')} value={String(l?.id || '')}>
                        {String(l?.name || ('Location #' + String(l?.id || '')))}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => void saveCrimeSceneLocationId()}
                  disabled={busy || !scenarioId || !isAdmin}
                >
                  Save
                </button>
              </div>
              <div className="form-text">Uses global Locations (not mystery-scoped). The case-specific notes stay on the scenario.</div>
            </div>
          </div>

          <div className="row g-2">
            <div className="col-6">
              <div className="text-muted small">Killer</div>
              <div className="fw-semibold">
                {(() => {
                  const list = Array.isArray(scenarioCrimeScene?.murderer_ids) ? scenarioCrimeScene.murderer_ids : [];
                  const names = list.map((id: number) => entityNameById[String(id)] || ('Entity #' + String(id)));
                  return names.length ? names.join(', ') : 'Not set';
                })()}
              </div>
            </div>
            <div className="col-6">
              <div className="text-muted small">Motive</div>
              <div className="fw-semibold">{String(scenarioCrimeScene?.motive || 'Not set')}</div>
            </div>
            <div className="col-6">
              <div className="text-muted small">Weapon</div>
              <div className="fw-semibold">{String(scenarioCrimeScene?.weapon || 'Not set')}</div>
            </div>
            <div className="col-6">
              <div className="text-muted small">Location</div>
              <div className="fw-semibold">{String(scenarioCrimeScene?.location || 'Not set')}</div>
            </div>
          </div>

          <div className="d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onOpenBackstories}
              disabled={busy || !scenarioId}
            >
              Open Back Stories
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
