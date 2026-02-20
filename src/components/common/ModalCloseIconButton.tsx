import React from 'react';
import { StandardIconButton } from './StandardIconButton';

interface ModalCloseIconButtonProps {
  onClick?: () => void;
  className?: string;
  title?: string;
}

export function ModalCloseIconButton({ onClick, className = '', title = 'Close' }: ModalCloseIconButtonProps) {
  return (
    <StandardIconButton
      iconKey="close"
      ariaLabel="Close"
      title={title}
      className={`btn btn-outline-secondary btn-sm catn8-action-icon-btn ${className}`.trim()}
      dismissModal={!onClick}
      onClick={onClick}
    />
  );
}
