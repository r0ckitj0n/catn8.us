import React from 'react';

import type { Rel8dDnaRegion } from '../../types/rel8d';

type Props = {
  regions: Rel8dDnaRegion[];
  communities: Array<{ id?: number; community_name: string }>;
  isAdmin?: boolean;
};

export function Rel8dDnaPanel({ regions, communities, isAdmin }: Props) {
  const parents = regions.filter((x) => !x.parent_region_id);
  return (
    <section className="rel8d-section">
      <h2>DNA ethnicity</h2>
      <ul className="rel8d-dna">
        {parents.map((region) => (
          <li key={region.id || region.region_name}>
            <strong>{region.region_name}</strong>
            <span>{region.percent}%</span>
            <ul>
              {regions
                .filter((sub) => Number(sub.parent_region_id) === Number(region.id))
                .map((sub) => (
                  <li key={sub.id || sub.region_name}>
                    {sub.region_name} <em>{sub.percent}%</em>
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
      <h3>Communities</h3>
      <ul className="rel8d-list">
        {communities.map((c) => (
          <li key={c.id || c.community_name}>{c.community_name}</li>
        ))}
      </ul>
      {isAdmin ? (
        <p className="rel8d-meta">Admin can revise ethnicity via Rel8r agent or save_dna API.</p>
      ) : null}
    </section>
  );
}
