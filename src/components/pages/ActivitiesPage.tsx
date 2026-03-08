import React from 'react';

import { PageLayout } from '../layout/PageLayout';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { CatalogCard } from '../common/cards/CatalogCard';

export function ActivitiesPage({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle }: AppShellPageProps) {
  const sections = [
    {
      title: 'ACTIV8',
      subtitle: 'Discover exciting activities to do together!',
      items: [
        { title: 'Starfall Reading Fun', description: 'Learn to read with fun interactive stories and activities!', image: '/images/.png' },
        { title: 'Coloring Art Adventure', description: 'Express your creativity with fun coloring activities!', image: '/images/.png' },
        { title: 'PBS Kids Educational Play', description: 'Learn and play with your favorite PBS Kids characters!', image: '/images/.png' },
        { title: 'Color by Numbers Art', description: 'Create beautiful art while learning numbers!', image: '/images/.png' },
      ],
    },
    {
      title: 'Creative Activities',
      subtitle: 'Let your imagination run wild!',
      items: [
        { title: 'Puzzle Maker Learning', description: 'Create and solve your own puzzles!', image: '/images/.png' },
        { title: 'Crayola Crafts Creative', description: 'Make amazing crafts with Crayola!', image: '/images/.png' },
        { title: 'Khan Academy Interactive', description: 'Learn through fun interactive activities!', image: '/images/.png' },
        { title: 'Music Theory Learning', description: 'Discover the joy of music through fun activities!', image: '/images/.png' },
      ],
    },
    {
      title: 'Educational Activities',
      subtitle: 'Learn while having fun!',
      items: [
        { title: 'ABCya Educational Games', description: 'Play and learn with fun educational games!', image: '/images/.png' },
      ],
    },
  ];

  return (
    <PageLayout page="activities" title="ACTIV8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      {sections.map((sec) => (
        <section className="section" key={sec.title}>
          <div className="container">
            <h1 className="section-title">{sec.title}</h1>
            <p className="lead text-center mb-4">{sec.subtitle}</p>
            <div className="row">
              {sec.items.map((it) => (
                <div className="col-md-6" key={it.title}>
                  <CatalogCard title={it.title} description={it.description} image={it.image} />
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </PageLayout>
  );
}
