import React from 'react';

import { Accumul8StatementUpload } from '../../types/accumul8';

interface UseAccumul8StatementsPanelSelectionSyncArgs {
  filteredLibraryUploads: Accumul8StatementUpload[];
  pendingUploads: Accumul8StatementUpload[];
  selectedLibraryUploadId: number | null;
  selectedReviewUploadId: number | null;
  selectedSignalUploadId: number | null;
  setSelectedLibraryUploadId: (id: number | null) => void;
  setSelectedReviewUploadId: (id: number | null) => void;
  setSelectedSignalUploadId: (id: number | null) => void;
  signalUploads: Accumul8StatementUpload[];
  sortedStatementUploads: Accumul8StatementUpload[];
}

export function useAccumul8StatementsPanelSelectionSync({
  filteredLibraryUploads,
  pendingUploads,
  selectedLibraryUploadId,
  selectedReviewUploadId,
  selectedSignalUploadId,
  setSelectedLibraryUploadId,
  setSelectedReviewUploadId,
  setSelectedSignalUploadId,
  signalUploads,
  sortedStatementUploads,
}: UseAccumul8StatementsPanelSelectionSyncArgs) {
  React.useEffect(() => {
    if (pendingUploads.length === 0) setSelectedReviewUploadId(null);
    else if (!pendingUploads.some((upload) => upload.id === selectedReviewUploadId)) setSelectedReviewUploadId(pendingUploads[0].id);
  }, [pendingUploads, selectedReviewUploadId, setSelectedReviewUploadId]);

  React.useEffect(() => {
    if (sortedStatementUploads.length === 0) setSelectedLibraryUploadId(null);
    else if (!sortedStatementUploads.some((upload) => upload.id === selectedLibraryUploadId)) setSelectedLibraryUploadId(sortedStatementUploads[0].id);
  }, [selectedLibraryUploadId, setSelectedLibraryUploadId, sortedStatementUploads]);

  React.useEffect(() => {
    if (filteredLibraryUploads.length > 0 && !filteredLibraryUploads.some((upload) => upload.id === selectedLibraryUploadId)) {
      setSelectedLibraryUploadId(filteredLibraryUploads[0].id);
    }
  }, [filteredLibraryUploads, selectedLibraryUploadId, setSelectedLibraryUploadId]);

  React.useEffect(() => {
    if (signalUploads.length === 0) setSelectedSignalUploadId(null);
    else if (!signalUploads.some((upload) => upload.id === selectedSignalUploadId)) setSelectedSignalUploadId(signalUploads[0].id);
  }, [selectedSignalUploadId, setSelectedSignalUploadId, signalUploads]);
}
