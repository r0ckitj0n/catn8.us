import React from 'react';

import { Accumul8StatementArchiveSection, Accumul8StatementUpload } from '../../types/accumul8';
import { StatementWorkspacePanel } from '../modals/accumul8StatementWorkspaceUtils';

interface UseAccumul8StatementsArchiveActionsArgs {
  isAwaitingImportApproval: (upload: Accumul8StatementUpload) => boolean;
  onArchiveStatement: (payload: { id: number; archived_from_section?: Accumul8StatementArchiveSection }) => Promise<unknown>;
  onDeleteArchivedStatement: (id: number) => Promise<unknown>;
  onRestoreStatement: (id: number) => Promise<{ restored_to_section: Accumul8StatementArchiveSection; upload: Accumul8StatementUpload }>;
  setActiveSection: (section: 'inbox' | 'library' | 'search' | 'signals') => void;
  setArchiveDialogOpen: (open: boolean) => void;
  setSelectedLibraryUploadId: (id: number | null) => void;
  setSelectedReviewUploadId: (id: number | null) => void;
  setSelectedSignalUploadId: (id: number | null) => void;
  setSelectedWorkspacePanel: (panel: StatementWorkspacePanel) => void;
}

export function useAccumul8StatementsArchiveActions({
  isAwaitingImportApproval,
  onArchiveStatement,
  onDeleteArchivedStatement,
  onRestoreStatement,
  setActiveSection,
  setArchiveDialogOpen,
  setSelectedLibraryUploadId,
  setSelectedReviewUploadId,
  setSelectedSignalUploadId,
  setSelectedWorkspacePanel,
}: UseAccumul8StatementsArchiveActionsArgs) {
  const focusRestoredUpload = React.useCallback((upload: Accumul8StatementUpload, section: Accumul8StatementArchiveSection) => {
    if (section === 'signals') {
      setActiveSection('signals');
      setSelectedSignalUploadId(upload.id);
    } else if (isAwaitingImportApproval(upload)) {
      setActiveSection('inbox');
      setSelectedReviewUploadId(upload.id);
      setSelectedWorkspacePanel('review');
    } else {
      setActiveSection('library');
      setSelectedLibraryUploadId(upload.id);
    }
  }, [isAwaitingImportApproval, setActiveSection, setSelectedLibraryUploadId, setSelectedReviewUploadId, setSelectedSignalUploadId, setSelectedWorkspacePanel]);

  const archiveActiveReviewUpload = React.useCallback(async (upload: Accumul8StatementUpload) => {
    if (!window.confirm(`Archive "${upload.original_filename}"?`)) return;
    await onArchiveStatement({ id: upload.id, archived_from_section: 'inbox' });
  }, [onArchiveStatement]);

  const restoreArchivedUpload = React.useCallback(async (upload: Accumul8StatementUpload, shouldFocus = false) => {
    const response = await onRestoreStatement(upload.id);
    if (!shouldFocus) return;
    setArchiveDialogOpen(false);
    focusRestoredUpload(response.upload, response.restored_to_section);
  }, [focusRestoredUpload, onRestoreStatement, setArchiveDialogOpen]);

  const deleteArchivedUpload = React.useCallback(async (upload: Accumul8StatementUpload) => {
    if (!window.confirm(`Delete "${upload.original_filename}" permanently?`)) return;
    await onDeleteArchivedStatement(upload.id);
  }, [onDeleteArchivedStatement]);

  return { archiveActiveReviewUpload, deleteArchivedUpload, restoreArchivedUpload };
}
