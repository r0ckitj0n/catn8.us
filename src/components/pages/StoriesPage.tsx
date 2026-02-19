import React, { useState } from 'react';
import './StoriesPage.css';
import { PageLayout } from '../layout/PageLayout';
import { FilterBar } from '../layout/FilterBar';
import { StoryModal } from '../modals/StoryModal';
import { normalizeText } from '../../utils/textUtils';
import stories from '../../data/stories.json';

interface StoriesPageProps {
  viewer: any;
  onLoginClick: () => void;
  onLogout: () => void;
  onAccountClick: () => void;
  mysteryTitle?: string;
}

export function StoriesPage({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle }: StoriesPageProps) {
  const [query, setQuery] = React.useState('');
  const [activeStoryId, setActiveStoryId] = useState<number | null>(null);
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
                <div
                  className="story-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => openStory(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') openStory(s.id);
                  }}
                >
                  <div className="age-badge">{s.age}</div>
                  <div className="story-section">
                    <img src={s.image} alt={s.title} className="story-image" />
                    <h3 className="story-title">{s.title}</h3>
                    <p className="story-text">{s.excerpt}</p>
                    <div className="story-tags">
                      {s.tags.map((t) => (
                        <span className="story-tag" key={t}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
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
