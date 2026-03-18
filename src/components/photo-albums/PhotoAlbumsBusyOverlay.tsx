import React from 'react';

import { WebpImage } from '../common/WebpImage';

export function PhotoAlbumsBusyOverlay() {
  return (
    <div className="catn8-photo-albums-busy-overlay" role="status" aria-live="polite" aria-label="Photo albums action in progress">
      <div className="catn8-photo-albums-busy-card">
        <WebpImage
          className="catn8-photo-albums-busy-logo"
          src="/images/catn8_logo.webp"
          alt=""
          aria-hidden="true"
        />
        <div className="catn8-photo-albums-busy-text">Working on your album layout...</div>
      </div>
    </div>
  );
}
