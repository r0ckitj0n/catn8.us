import React from 'react';
import { IBackstory, IMasterLocation, IStoryBookEntry } from '../../../../types/game';

interface BackstoriesSectionProps {
  busy: boolean;
  isAdmin: boolean;
  mysteryId: string | number;
  backStoryCreateSource: string;
  setBackStoryCreateSource: (val: string) => void;
  backStoryCreateTitle: string;
  setBackStoryCreateTitle: (val: string) => void;
  backStoryCreateLocationMasterId: string;
  setBackStoryCreateLocationMasterId: (val: string) => void;
  backStoryCreateFromSeed: boolean;
  setBackStoryCreateFromSeed: (val: boolean) => void;
  masterLocations: IMasterLocation[];
  seedStories: IStoryBookEntry[];
  loadBackstories: (mid: string | number) => Promise<IBackstory[]>;
  createBackstory: (params?: any) => Promise<string | undefined>;
  loadStoryBookEntry: (id: string) => Promise<void>;
}

export function BackstoriesSection({
  busy, isAdmin, mysteryId, backStoryCreateSource, setBackStoryCreateSource,
  backStoryCreateTitle, setBackStoryCreateTitle, backStoryCreateLocationMasterId,
  setBackStoryCreateLocationMasterId, backStoryCreateFromSeed, setBackStoryCreateFromSeed, masterLocations,
  seedStories, loadBackstories, createBackstory, loadStoryBookEntry
}: BackstoriesSectionProps) {
  const handleGenerate = async () => {
    const isScratch = backStoryCreateSource === 'scratch';
    const seed = seedStories.find(s => String(s.id) === String(backStoryCreateSource));
    
    if (!isScratch && !seed) return;

    const params: any = {
      title: backStoryCreateFromSeed ? (seed?.title || seed?.slug || 'New Backstory') : backStoryCreateTitle,
      source_text: isScratch ? '' : (seed?.source_text || ''),
      location_master_id: backStoryCreateLocationMasterId
    };

    await createBackstory(params);
  };

  return (
    <div className="catn8-card p-3 h-100">
      <div className="d-flex justify-content-between align-items-start gap-2">
        <div>
          <div className="fw-bold">Backstories</div>
          <div className="form-text">Create/select backstories and open the backstory editor.</div>
        </div>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => void loadBackstories(mysteryId)}
            disabled={busy || !mysteryId}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="catn8-card p-2 mt-3">
        <div className="fw-bold">Generate Backstory</div>
        <div className="form-text">Optionally seed from Story Book, then create a new backstory record.</div>

        <div className="row g-2 mt-1 align-items-end">
          <div className="col-12">
            <label className="form-label" htmlFor="stories-backstory-create-source">Start Here</label>
            <select
              id="stories-backstory-create-source"
              className="form-select"
              value={backStoryCreateSource}
              onChange={(e) => {
                const v = String(e.target.value || 'scratch');
                setBackStoryCreateSource(v);
                if (v !== 'scratch') {
                  void loadStoryBookEntry(v);
                } else {
                  setBackStoryCreateFromSeed(false);
                }
              }}
              disabled={busy || !mysteryId}
            >
              <option value="scratch">Create from scratch</option>
              {seedStories.map((x) => (
                <option key={'stories-backstory-create-sbe' + String(x.id)} value={String(x.id)}>
                  {String(x.title || x.slug || ('Seed Story #' + String(x.id)))}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12">
            <label className="form-label" htmlFor="stories-backstory-create-title">Title</label>
            <input
              id="stories-backstory-create-title"
              className="form-control"
              value={backStoryCreateFromSeed ? '(Auto-Generated)' : backStoryCreateTitle}
              onChange={(e) => setBackStoryCreateTitle(e.target.value)}
              disabled={busy || !mysteryId || backStoryCreateFromSeed}
              placeholder={backStoryCreateFromSeed ? '(Auto-Generated)' : 'A New Backstory'}
            />
          </div>

          <div className="col-12">
            <label className="form-label" htmlFor="stories-backstory-create-location">Location</label>
            <select
              id="stories-backstory-create-location"
              className="form-select"
              value={backStoryCreateLocationMasterId}
              onChange={(e) => setBackStoryCreateLocationMasterId(e.target.value)}
              disabled={busy || !mysteryId || !isAdmin}
            >
              <option value="">Select a location…</option>
              {(Array.isArray(masterLocations) ? masterLocations : [])
                .filter((l: any) => Number(l?.is_archived || 0) !== 1)
                .map((l: any) => (
                  <option key={'stories-backstory-create-loc-' + String(l?.id || '')} value={String(l?.id || '')}>
                    {String(l?.name || ('Location #' + String(l?.id || '')))}
                  </option>
                ))}
            </select>
            {!isAdmin && (
              <div className="form-text">Location selection requires admin access.</div>
            )}
          </div>

          {isAdmin && (
            <div className="col-12 d-flex justify-content-end">
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={handleGenerate}
                disabled={busy || !mysteryId || (!backStoryCreateFromSeed && !String(backStoryCreateTitle || '').trim()) || (String(backStoryCreateSource || '') !== 'scratch' && !(Number(backStoryCreateSource) > 0))}
                title={(String(backStoryCreateSource || '') !== 'scratch' && !(Number(backStoryCreateSource) > 0)) ? 'Select a Seed Story first' : ''}
              >
                Generate Backstory
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
