import React from 'react';
import './FilterBar.css';

interface FilterBarProps {
  label: string;
  query: string;
  setQuery: (query: string) => void;
}

export function FilterBar({ label, query, setQuery }: FilterBarProps) {
  return (
    <div className="catn8-filter">
      <label className="catn8-filter-label" htmlFor="catn8-filter-input">
        Filter {label}
      </label>
      <input
        id="catn8-filter-input"
        className="catn8-filter-input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Type to filter..."
      />
      <button
        className="catn8-filter-button"
        type="button"
        onClick={() => setQuery('')}
        disabled={query === ''}
      >
        Clear
      </button>
    </div>
  );
}
