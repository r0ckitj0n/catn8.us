import React from 'react';

import { WebpImage } from '../common/WebpImage';
import './StoryModal.css';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';

interface StoryBlock {
  image?: string;
  alt?: string;
  text?: string;
}

interface Story {
  title: string;
  content: StoryBlock[];
}

interface StoryModalProps {
  open: boolean;
  onClose: () => void;
  story: Story | null;
}

export function StoryModal({ open, onClose, story }: StoryModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  const title = String(story?.title || 'Story');
  const blocks = Array.isArray(story?.content) ? story.content : [];

  return (
    <div className="modal fade catn8-story-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title">{title}</h2>
            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <div className="catn8-story-content">
              {blocks.map((b, idx) => (
                <div key={`${b?.image || 'img'}-${idx}`} className="catn8-story-block">
                  {b?.image ? <WebpImage className="catn8-story-modal-image" src={b.image} alt={String(b.alt || '')} /> : null}
                  {b?.text ? <p className="catn8-story-modal-text">{b.text}</p> : null}
                </div>
              ))}
              {!blocks.length ? <div className="text-muted">Story content coming soon.</div> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
