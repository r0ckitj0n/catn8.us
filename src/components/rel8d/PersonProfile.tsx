import React from 'react';

import type { Rel8dPerson } from '../../types/rel8d';

type Props = {
  person: Rel8dPerson | null;
  onSetRoot?: (id: number) => void;
  canEdit?: boolean;
};

export function PersonProfile({ person, onSetRoot, canEdit }: Props) {
  if (!person) {
    return <div className="rel8d-empty">Select a person from search or the pedigree.</div>;
  }

  return (
    <article className="rel8d-profile">
      <header>
        <h2>{person.name_display}</h2>
        <span className={'rel8d-badge ' + (person.sourced_badge || (person.has_sources ? 'sourced' : 'unsourced'))}>
          {person.sourced_badge || (person.has_sources ? 'sourced' : 'unsourced')}
        </span>
        {canEdit && onSetRoot ? (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onSetRoot(person.id)}>
            Set as tree root
          </button>
        ) : null}
      </header>
      <p className="rel8d-vital">
        {[person.birth_date_raw, person.birth_place].filter(Boolean).join(' · ') || 'Birth unknown'}
        {' → '}
        {[person.death_date_raw, person.death_place].filter(Boolean).join(' · ') || 'Living / unknown'}
      </p>

      <section>
        <h3>Fact timeline</h3>
        {(person.events || []).length === 0 ? (
          <div className="rel8d-empty">No events.</div>
        ) : (
          <ol className="rel8d-timeline">
            {(person.events || []).map((ev) => (
              <li key={String(ev.id)}>
                <strong>{ev.tag}{ev.type_label ? ` (${ev.type_label})` : ''}</strong>
                <span>{[ev.date_raw, ev.place].filter(Boolean).join(' · ')}</span>
                {ev.description ? <em>{ev.description}</em> : null}
                {Number(ev.has_sources) === 1 ? <i className="rel8d-badge sourced">sourced</i> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h3>Sources</h3>
        {(person.citations || []).length === 0 ? (
          <div className="rel8d-empty">No citations linked.</div>
        ) : (
          <ul className="rel8d-list">
            {(person.citations || []).map((c) => (
              <li key={String(c.id)}>
                <strong>{c.source_title || 'Source'}</strong>
                <span>{[c.page, c.quality ? `quality ${c.quality}` : ''].filter(Boolean).join(' · ')}</span>
                {c.note ? <em>{c.note}</em> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {(person.notes || []).length > 0 ? (
        <section>
          <h3>Notes</h3>
          <ul className="rel8d-list">
            {(person.notes || []).map((n) => (
              <li key={String(n.id)}>
                {n.title ? <strong>{n.title}</strong> : null}
                <p>{n.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
