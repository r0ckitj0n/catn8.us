import React from 'react';
import { WebpImage } from '../WebpImage';

interface CatalogCardProps {
  title: string;
  description: string;
  image: string;
  href?: string;
  onClick?: () => void;
}

export function CatalogCard({ title, description, image, href, onClick }: CatalogCardProps) {
  const content = (
    <>
      <WebpImage src={image} alt={title} className="catn8-catalog-card-image" />
      <div className="catn8-catalog-card-content catn8-text-body">
        <h3 className="catn8-text-heading">{title}</h3>
        <p className="mb-0">{description}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <a className="catn8-catalog-card catn8-glass-card catn8-glass-card--interactive" href={href}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" className="catn8-catalog-card catn8-glass-card catn8-glass-card--interactive" onClick={onClick}>
      {content}
    </button>
  );
}
