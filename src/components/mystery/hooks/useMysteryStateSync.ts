import React, { useState } from 'react';
import { IMysteryStateSync } from '../../../types/mysteryHooks';

export interface IStoryGenSync {
  active: boolean;
  status: string;
  error: string;
  crimeStatus: string;
  storyStatus: string;
  briefingStatus: string;
}

export interface IDepositionGenSync {
  active: boolean;
  status: string;
  error: string;
  queued: number;
  done: number;
  errorCount: number;
}

export function useMysteryStateSync(): IMysteryStateSync {
  const [storyGenSync, setStoryGenSync] = useState<IStoryGenSync>({
    active: false,
    status: '',
    error: '',
    crimeStatus: '',
    storyStatus: '',
    briefingStatus: '',
  });

  const [depositionGenSync, setDepositionGenSync] = useState<IDepositionGenSync>({
    active: false,
    status: '',
    error: '',
    queued: 0,
    done: 0,
    errorCount: 0,
  });

  const [coldHardFactsAudit, setColdHardFactsAudit] = useState<any>(null);
  const [coldHardFactsAuditOpen, setColdHardFactsAuditOpen] = React.useState(false);
  const [coldHardFactsAuditBusy, setColdHardFactsAuditBusy] = React.useState(false);

  return React.useMemo(() => ({
    storyGenSync, setStoryGenSync,
    depositionGenSync, setDepositionGenSync,
    coldHardFactsAudit, setColdHardFactsAudit,
    coldHardFactsAuditOpen, setColdHardFactsAuditOpen,
    coldHardFactsAuditBusy, setColdHardFactsAuditBusy
  }), [
    storyGenSync, depositionGenSync, coldHardFactsAudit,
    coldHardFactsAuditOpen, coldHardFactsAuditBusy
  ]);
}
