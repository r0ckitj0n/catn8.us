import React from 'react';

import { WebpImage } from '../common/WebpImage';
import { PageLayout } from '../layout/PageLayout';

interface ActivitiesPageProps {
  viewer: any;
  onLoginClick: () => void;
  onLogout: () => void;
  onAccountClick: () => void;
  mysteryTitle?: string;
}

export function ActivitiesPage({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle }: ActivitiesPageProps) {
  const sections = [
    {
      title: 'Fun Activities for Everyone!',
      subtitle: 'Discover exciting activities to do together!',
      items: [
        { title: 'Starfall Reading Fun', description: 'Learn to read with fun interactive stories and activities!', image: '/images/starfall-reading-fun.jpg' },
        { title: 'Coloring Art Adventure', description: 'Express your creativity with fun coloring activities!', image: '/images/coloring-ws-art-adventure.jpg' },
        { title: 'PBS Kids Educational Play', description: 'Learn and play with your favorite PBS Kids characters!', image: '/images/pbs-kids-educational-play.jpg' },
        { title: 'Color by Numbers Art', description: 'Create beautiful art while learning numbers!', image: '/images/color-by-numbers-art.jpg' },
      ],
    },
    {
      title: 'Creative Activities',
      subtitle: 'Let your imagination run wild!',
      items: [
        { title: 'Puzzle Maker Learning', description: 'Create and solve your own puzzles!', image: '/images/puzzle-maker-learning.jpg' },
        { title: 'Crayola Crafts Creative', description: 'Make amazing crafts with Crayola!', image: '/images/crayola-crafts-creative.jpg' },
        { title: 'Khan Academy Interactive', description: 'Learn through fun interactive activities!', image: '/images/khan-academy-interactive.jpg' },
        { title: 'Music Theory Learning', description: 'Discover the joy of music through fun activities!', image: '/images/music-theory-learning.jpg' },
      ],
    },
    {
      title: 'Educational Activities',
      subtitle: 'Learn while having fun!',
      items: [
        { title: 'ABCya Educational Games', description: 'Play and learn with fun educational games!', image: '/images/abcya-educational-games.jpg' },
      ],
    },
  ];

  return (
    <PageLayout page="activities" title="Activities" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      {sections.map((sec) => (
        <section className="section" key={sec.title}>
          <div className="container">
            <h1 className="section-title">{sec.title}</h1>
            <p className="lead text-center mb-4">{sec.subtitle}</p>
            <div className="row">
              {sec.items.map((it) => (
                <div className="col-md-6" key={it.title}>
                  <div className="game-card">
                    <WebpImage src={it.image} alt={it.title} />
                    <div className="game-card-content">
                      <h3>{it.title}</h3>
                      <p className="mb-0">{it.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </PageLayout>
  );
}
