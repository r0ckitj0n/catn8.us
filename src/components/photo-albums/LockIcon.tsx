import React from 'react';

interface LockIconProps {
  locked: boolean;
  className?: string;
}

export function LockIcon({ locked, className }: LockIconProps) {
  return (
    <svg
      className={className || 'catn8-lock-icon'}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      {locked ? (
        <path d="M8 1a2 2 0 0 0-2 2v4H5.5A1.5 1.5 0 0 0 4 8.5v6A1.5 1.5 0 0 0 5.5 16h5a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 10.5 7H10V3a2 2 0 0 0-2-2zM7 3a1 1 0 1 1 2 0v4H7V3z" />
      ) : (
        <path d="M11 1a2 2 0 0 1 2 2v4h.5A1.5 1.5 0 0 1 15 8.5v6a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 4 14.5v-6A1.5 1.5 0 0 1 5.5 7H11V3a1 1 0 1 0-2 0v1H8V3a2 2 0 0 1 3-1.732V1z" />
      )}
    </svg>
  );
}
