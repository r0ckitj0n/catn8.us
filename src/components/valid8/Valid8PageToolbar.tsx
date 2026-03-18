import React from 'react';

interface Valid8PageToolbarProps {
  busy: boolean;
  canAccess: boolean;
  includeInactive: boolean;
  loaded: boolean;
  onCreateEntry: () => void;
  onLoad: () => void;
  onOpenCategories: () => void;
  onOpenOwners: () => void;
  onSetIncludeInactive: (value: boolean) => void;
  onSetOwnerFilter: (value: string) => void;
  onSetQuery: (value: string) => void;
  ownerFilter: string;
  ownerOptions: string[];
  query: string;
}

export function Valid8PageToolbar({
  busy,
  canAccess,
  includeInactive,
  loaded,
  onCreateEntry,
  onLoad,
  onOpenCategories,
  onOpenOwners,
  onSetIncludeInactive,
  onSetOwnerFilter,
  onSetQuery,
  ownerFilter,
  ownerOptions,
  query,
}: Valid8PageToolbarProps) {
  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h1 className="section-title mb-0">VALID8 Password Vault</h1>
        {canAccess ? (
          <div className="d-inline-flex gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={onCreateEntry}>Add New Credentials</button>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onOpenOwners}>Owners</button>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onOpenCategories}>Categories</button>
          </div>
        ) : null}
      </div>
      {canAccess ? (
        <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
          <div className="d-flex align-items-center gap-2">
            <label className="form-label mb-0" htmlFor="valid8-search">Filter</label>
            <input
              id="valid8-search"
              type="text"
              className="form-control form-control-sm"
              value={query}
              onChange={(event) => onSetQuery(event.target.value)}
              placeholder="Type to filter..."
            />
          </div>
          <div className="d-flex align-items-center gap-2">
            <label className="form-label mb-0" htmlFor="valid8-owner-filter">Owner</label>
            <select
              id="valid8-owner-filter"
              className="form-select form-select-sm"
              value={ownerFilter}
              onChange={(event) => onSetOwnerFilter(event.target.value)}
            >
              <option value="">All owners</option>
              {ownerOptions.map((owner) => (
                <option key={owner} value={owner}>{owner}</option>
              ))}
            </select>
          </div>
          <label className="form-check mb-0">
            <input
              type="checkbox"
              className="form-check-input"
              checked={includeInactive}
              onChange={(event) => onSetIncludeInactive(event.target.checked)}
            />
            <span className="form-check-label">Include inactive history</span>
          </label>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onLoad} disabled={busy}>
            {!loaded && busy ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      ) : null}
    </>
  );
}
