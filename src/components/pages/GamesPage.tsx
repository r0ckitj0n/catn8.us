import React from 'react';

import { PageLayout } from '../layout/PageLayout';
import { FilterBar } from '../layout/FilterBar';
import { normalizeText } from '../../utils/textUtils';
import games from '../../data/games.json';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { CatalogCard } from '../common/cards/CatalogCard';

export function GamesPage({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle }: AppShellPageProps) {
  const [query, setQuery] = React.useState('');
  const q = normalizeText(query);

  const sections = React.useMemo(() => {
    if (!q) return games;
    return (games as any[])
      .map((sec) => {
        const items = sec.items.filter((it: any) => normalizeText(it.title).includes(q));
        return { ...sec, items };
      })
      .filter((sec) => sec.items.length > 0);
  }, [q]);

  return (
    <PageLayout page="games" title="Games" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className="section">
        <div className="container">
          <h1 className="section-title">Fun Games for Everyone!</h1>
          <p className="lead text-center mb-4">Play and learn with our collection of exciting games!</p>
          <FilterBar label="Games" query={query} setQuery={setQuery} />
          {sections.map((sec) => (
            <div key={sec.section} className="mt-5">
              <h2 className="section-title section-title-sm">{sec.section}</h2>
              <div className="row">
                {sec.items.map((it: any) => (
                  <div className="col-md-6" key={it.title}>
                    <CatalogCard title={it.title} description={it.description} image={it.image} href={it.href} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </PageLayout>
  );
}
