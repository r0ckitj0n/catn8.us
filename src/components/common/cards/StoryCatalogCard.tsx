import React from 'react';
import { WebpImage } from '../WebpImage';

interface StoryCatalogCardProps {
  title: string;
  excerpt: string;
  image: string;
  age: string;
  tags: string[];
  onOpen: () => void;
}

export function StoryCatalogCard({ title, excerpt, image, age, tags, onOpen }: StoryCatalogCardProps) {
  return (
    <div
      className="catn8-story-card catn8-glass-card catn8-glass-card--interactive"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          onOpen();
        }
      }}
    >
      <div className="catn8-story-age-badge catn8-chip catn8-text-heading">{age}</div>
      <WebpImage src={image} alt={title} className="catn8-story-card-image catn8-media-frame" />
      <h3 className="catn8-story-title catn8-text-heading">{title}</h3>
      <p className="catn8-story-text catn8-text-body">{excerpt}</p>
      <div className="catn8-story-tags">
        {tags.map((tag) => (
          <span className="catn8-story-tag catn8-chip catn8-text-muted" key={tag}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
