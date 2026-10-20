import React from 'react';

import type { Rel8dDashboard, Rel8dPerson } from '../../types/rel8d';

type Props = {
  dashboard: Rel8dDashboard | null;
  onOpenPerson: (id: number) => void;
  onSurname: (surname: string) => void;
};

export function Rel8dHomePanels({ dashboard, onOpenPerson, onSurname }: Props) {
  const onThisDay = dashboard?.on_this_day || [];
  const recent = dashboard?.recent_people || [];
  const surnames = dashboard?.surname_preview || [];

  return (
    <div className="rel8d-grid">
      <section className="rel8d-section">
        <h2>On this day</h2>
        {onThisDay.length === 0 ? (
          <div className="rel8d-empty">No anniversaries today.</div>
        ) : (
          <ul className="rel8d-list">
            {onThisDay.map((p: Rel8dPerson) => (
              <li key={p.id}>
                <button type="button" className="btn btn-link p-0" onClick={() => onOpenPerson(p.id)}>
                  {p.name_display}
                </button>
                <span>{[p.birth_date_raw, p.death_date_raw].filter(Boolean).join(' / ')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rel8d-section">
        <h2>Recent people</h2>
        <ul className="rel8d-list">
          {recent.map((p) => (
            <li key={p.id}>
              <button type="button" className="btn btn-link p-0" onClick={() => onOpenPerson(p.id)}>
                {p.name_display}
              </button>
              <span className={'rel8d-badge ' + (p.has_sources ? 'sourced' : 'unsourced')}>
                {p.has_sources ? 'sourced' : 'unsourced'}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="rel8d-section">
        <h2>Top surnames</h2>
        <ul className="rel8d-list">
          {surnames.map((s) => (
            <li key={s.surname}>
              <button type="button" className="btn btn-link p-0" onClick={() => onSurname(s.surname)}>
                {s.surname}
              </button>
              <span>{s.person_count}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
