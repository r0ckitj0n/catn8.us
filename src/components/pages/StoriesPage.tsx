import React from 'react';

import { PageLayout } from '../layout/PageLayout';
import { FilterBar } from '../layout/FilterBar';
import { StoryModal } from '../modals/StoryModal';
import { normalizeText } from '../../utils/textUtils';
import stories from '../../data/stories.json';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { StoryCatalogCard } from '../common/cards/StoryCatalogCard';

export function StoriesPage({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle }: AppShellPageProps) {
  const [query, setQuery] = React.useState('');
  const [activeStoryId, setActiveStoryId] = React.useState<number | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const q = normalizeText(query);
  
  const filtered = React.useMemo(() => {
    if (!q) return stories;
    return stories.filter((s) => normalizeText(s.title).includes(q));
  }, [q]);

  const activeStory = React.useMemo(() => {
    const id = Number(activeStoryId || 0);
    if (!id) return null;
    return (stories as any[]).find((s) => Number(s?.id || 0) === id) || null;
  }, [activeStoryId]);

  const openStory = (id: string | number) => {
    setActiveStoryId(Number(id) || null);
    setModalOpen(true);
  };

  return (
    <PageLayout page="stories" title="Stories" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className="section">
        <div className="container">
          <h1 className="section-title">Stories</h1>
          <p className="lead text-center mb-4">Enjoy our collection of stories!</p>
          <FilterBar label="Stories" query={query} setQuery={setQuery} />
          <div className="row mt-4">
            {filtered.map((s) => (
              <div className="col-md-6" key={s.id}>
                <StoryCatalogCard
                  age={s.age}
                  title={s.title}
                  excerpt={s.excerpt}
                  image={s.image}
                  tags={s.tags}
                  onOpen={() => openStory(s.id)}
                />
              </div>
            ))}
          </div>

          <StoryModal
            open={modalOpen}
            onClose={() => {
              setModalOpen(false);
            }}
            story={activeStory}
          />
        </div>
      </section>
    </PageLayout>
  );
}
