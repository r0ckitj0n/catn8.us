import React from 'react';

import { WebpImage } from '../common/WebpImage';
import { PageLayout } from '../layout/PageLayout';
import { FilterBar } from '../layout/FilterBar';
import { normalizeText } from '../../utils/textUtils';
import arcade from '../../data/arcade.json';

interface ArcadePageProps {
  viewer: any;
  onLoginClick: () => void;
  onLogout: () => void;
  onAccountClick: () => void;
  mysteryTitle?: string;
}

export function ArcadePage({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle }: ArcadePageProps) {
  const [query, setQuery] = React.useState('');
  const q = normalizeText(query);
  const filtered = React.useMemo(() => {
    if (!q) return arcade;
    return (arcade as any[]).filter((g) => normalizeText(g.title).includes(q));
  }, [q]);

  return (
    <PageLayout page="arcade" title="Arcade" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className="section">
        <div className="container">
          <h1 className="section-title">Arcade</h1>
          <p className="lead text-center mb-4">Welcome to our arcade! Here you'll find fun and educational games to play.</p>
          <FilterBar label="Arcade Games" query={query} setQuery={setQuery} />
          <div className="row mt-4">
            {filtered.map((g) => (
              <div className="col-md-6" key={g.id}>
                <a className="game-card" href={g.href}>
                  <WebpImage src={g.image} alt={g.title} />
                  <div className="game-info">
                    <h3>{g.title}</h3>
                    <p className="mb-0">{g.description}</p>
                  </div>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
