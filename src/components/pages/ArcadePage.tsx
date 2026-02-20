import React from 'react';

import { PageLayout } from '../layout/PageLayout';
import { FilterBar } from '../layout/FilterBar';
import { normalizeText } from '../../utils/textUtils';
import arcade from '../../data/arcade.json';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { CatalogCard } from '../common/cards/CatalogCard';
import { ArcadeGameModal } from '../modals/ArcadeGameModal';
import { ArcadeCatalogEntry, ArcadeGameId } from '../../types/arcade';

const LOCAL_ARCADE_GAMES: ArcadeGameId[] = ['tetris', 'frogger', 'asteroids'];

export function ArcadePage({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle }: AppShellPageProps) {
  const [query, setQuery] = React.useState('');
  const [activeGameId, setActiveGameId] = React.useState<ArcadeGameId | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const q = normalizeText(query);
  const filtered = React.useMemo(() => {
    if (!q) return arcade;
    return (arcade as ArcadeCatalogEntry[]).filter((g) => normalizeText(g.title).includes(q));
  }, [q]);

  const openGame = React.useCallback((id: string) => {
    if (!LOCAL_ARCADE_GAMES.includes(id as ArcadeGameId)) {
      return;
    }
    setActiveGameId(id as ArcadeGameId);
    setModalOpen(true);
  }, []);

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
                {LOCAL_ARCADE_GAMES.includes(g.id as ArcadeGameId) ? (
                  <CatalogCard title={g.title} description={g.description} image={g.image} onClick={() => openGame(g.id)} />
                ) : (
                  <CatalogCard title={g.title} description={g.description} image={g.image} href={g.href} />
                )}
              </div>
            ))}
          </div>

          <ArcadeGameModal
            open={modalOpen}
            gameId={activeGameId}
            onClose={() => {
              setModalOpen(false);
              setActiveGameId(null);
            }}
          />
        </div>
      </section>
    </PageLayout>
  );
}
