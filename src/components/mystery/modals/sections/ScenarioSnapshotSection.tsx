import React from 'react';

interface ScenarioSnapshotSectionProps {
  caseMgmtScenarioSnapshot: any;
  caseMgmtScenarioId: string;
}

export function ScenarioSnapshotSection({
  caseMgmtScenarioSnapshot,
  caseMgmtScenarioId,
}: ScenarioSnapshotSectionProps) {
  return (
    <div className="col-12">
      <div className="catn8-card p-2">
        <div className="fw-bold">Scenario Snapshot (read-only)</div>
        {caseMgmtScenarioSnapshot ? (
          <div className="row g-2 mt-1">
            <div className="col-lg-6">
              <div className="text-muted">Scenario</div>
              <div>{String(caseMgmtScenarioSnapshot?.title || '')}</div>
              <div className="form-text">Slug: {String(caseMgmtScenarioSnapshot?.slug || '')}</div>
            </div>
            <div className="col-lg-6">
              <div className="text-muted">Status</div>
              <div>{String(caseMgmtScenarioSnapshot?.status || '')}</div>
            </div>
            <div className="col-lg-4">
              <div className="text-muted">Crime Scene Location</div>
              <div>{String(caseMgmtScenarioSnapshot?.crime_scene_location || '')}</div>
            </div>
            <div className="col-lg-4">
              <div className="text-muted">Weapon</div>
              <div>{String(caseMgmtScenarioSnapshot?.crime_scene_weapon || '')}</div>
            </div>
            <div className="col-lg-4">
              <div className="text-muted">Motive</div>
              <div>{String(caseMgmtScenarioSnapshot?.crime_scene_motive || '')}</div>
            </div>
          </div>
        ) : (
          <div className="text-muted mt-1">
            {caseMgmtScenarioId ? 'Loading snapshot...' : 'Select a scenario to view snapshot details.'}
          </div>
        )}
      </div>
    </div>
  );
}
