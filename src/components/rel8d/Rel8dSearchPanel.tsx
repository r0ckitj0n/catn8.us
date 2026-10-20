import React from 'react';

import type { Rel8dPerson } from '../../types/rel8d';

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  onSearch: () => void;
  people: Rel8dPerson[];
  peopleTotal: number;
  surnames: Array<{ surname: string; person_count: number }>;
  onOpenPerson: (id: number) => void;
  onSurname: (surname: string) => void;
};

export function Rel8dSearchPanel({
  query,
  onQueryChange,
  onSearch,
  people,
  peopleTotal,
  surnames,
  onOpenPerson,
  onSurname,
}: Props) {
  return (
    <section className="rel8d-section">
      <h2>Search &amp; surname index</h2>
      <form
        className="rel8d-search"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch();
        }}
      >
        <input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="Name or place" />
        <button type="submit" className="btn btn-sm btn-success">Search</button>
      </form>
      <p className="rel8d-meta">{peopleTotal} matches</p>
      <div className="rel8d-split">
        <ul className="rel8d-list">
          {people.map((p) => (
            <li key={p.id}>
              <button type="button" className="btn btn-link p-0" onClick={() => onOpenPerson(p.id)}>
                {p.name_display}
              </button>
              <span>{[p.birth_date_raw, p.death_date_raw].filter(Boolean).join(' – ')}</span>
            </li>
          ))}
        </ul>
        <ul className="rel8d-list compact">
          {surnames.map((s) => (
            <li key={s.surname}>
              <button type="button" className="btn btn-link p-0" onClick={() => onSurname(s.surname)}>
                {s.surname}
              </button>
              <span>{s.person_count}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
