import React from 'react';

interface Valid8AccessStateProps {
  canAccess: boolean;
  entriesCount: number;
  isAuthed: boolean;
  loaded: boolean;
  onLoginClick?: () => void;
  visibleEntriesCount: number;
}

export function Valid8AccessState({
  canAccess,
  entriesCount,
  isAuthed,
  loaded,
  onLoginClick,
  visibleEntriesCount,
}: Valid8AccessStateProps) {
  if (!isAuthed) {
    return (
      <>
        <p className="mb-3">Log in to view your VALID8 vault entries.</p>
        <button type="button" className="btn btn-primary" onClick={onLoginClick}>Log In</button>
      </>
    );
  }
  if (!canAccess) {
    return (
      <p className="mb-0 text-danger">
        Your account does not currently have access to VALID8. Contact an administrator to join the VALID8 Users group.
      </p>
    );
  }
  if (!loaded) {
    return <p className="mb-0 text-muted">Loading vault entries...</p>;
  }
  if (entriesCount === 0) {
    return <p className="mb-0 text-muted">No vault entries were found for your account.</p>;
  }
  if (visibleEntriesCount === 0) {
    return <p className="mb-0 text-muted">No entries match your current filters.</p>;
  }
  return null;
}
