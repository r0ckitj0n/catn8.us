import React from 'react';

import { Accumul8StatementSearchResult } from '../../types/accumul8';
import { Accumul8StatementSearchResultCard } from './Accumul8StatementHistoryCard';

interface Accumul8StatementModalSearchSectionProps {
  busy: boolean;
  ownerUserId: number;
  searchBusy: boolean;
  searchQuery: string;
  searchResults: Accumul8StatementSearchResult[];
  setSearchQuery: (query: string) => void;
  onSearch: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function Accumul8StatementModalSearchSection({
  busy,
  ownerUserId,
  searchBusy,
  searchQuery,
  searchResults,
  setSearchQuery,
  onSearch,
}: Accumul8StatementModalSearchSectionProps) {
  return (
    <section className="accumul8-statement-panel">
      <div className="accumul8-statement-section-head">
        <div>
          <strong>Statement search</strong>
          <div className="small text-muted">Search OCR text, payees, memo text, or dates across all scanned statements.</div>
        </div>
      </div>
      <form className="accumul8-statement-search" onSubmit={onSearch}>
        <input className="form-control" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search scanned statement contents, payees, memo text, or dates" disabled={busy || searchBusy} />
        <button type="submit" className="btn btn-outline-primary" disabled={busy || searchBusy || searchQuery.trim() === ''}>Search</button>
      </form>
      <div className="accumul8-statement-search-results">
        {searchResults.length > 0 ? searchResults.map((result) => <Accumul8StatementSearchResultCard key={result.upload_id} ownerUserId={ownerUserId} result={result} />) : (
          <div className="accumul8-statement-history-empty">Run a search to find a statement by its contents instead of browsing manually.</div>
        )}
      </div>
    </section>
  );
}
