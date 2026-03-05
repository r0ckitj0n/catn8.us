import React from 'react';

import { SelectedItem } from './photoAlbumStageEngine';

export function PhotoAlbumStageSelectedActions({
  editable,
  selectedItem,
  selectedItemActionsStyle,
  isLayoutLocked,
  onViewSelected,
  onEditSelected,
  onDuplicateSelected,
  onDeleteSelected,
  onClearSelected,
}: {
  editable: boolean;
  selectedItem: SelectedItem | null;
  selectedItemActionsStyle?: React.CSSProperties;
  isLayoutLocked: boolean;
  onViewSelected: () => void;
  onEditSelected: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onClearSelected: () => void;
}) {
  if (!editable || !selectedItem) {
    return null;
  }

  return (
    <div className="catn8-item-actions" style={selectedItemActionsStyle} onClick={(event) => event.stopPropagation()}>
      <span className="catn8-item-actions-label">
        {selectedItem.type === 'media' ? 'Media' : selectedItem.type === 'note' ? 'Text' : 'Decor'}
      </span>
      {selectedItem.type !== 'decor' ? (
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onViewSelected}>View</button>
      ) : null}
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onEditSelected} disabled={isLayoutLocked}>Edit</button>
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onDuplicateSelected} disabled={isLayoutLocked}>Duplicate</button>
      <button type="button" className="btn btn-sm btn-outline-danger" onClick={onDeleteSelected} disabled={isLayoutLocked}>Delete</button>
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary catn8-close-viewer-btn"
        onClick={onClearSelected}
        aria-label="Close item actions"
        title="Close"
      >
        ×
      </button>
    </div>
  );
}
