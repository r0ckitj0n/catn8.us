import React from 'react';
import { IJob } from '../../../../types/game';

export interface ToolsModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  isAdmin: boolean;
  busy: boolean;
  caseId: string | number;
  setCaseId: (val: string) => void;
  cases: any[];
  jobs: IJob[];
  jobAction: string;
  setJobAction: (val: string) => void;
  jobScopeCharacter: boolean;
  setJobScopeCharacter: (val: boolean) => void;
  jobScopeLocation: boolean;
  setJobScopeLocation: (val: boolean) => void;
  jobScopeWeapon: boolean;
  setJobScopeWeapon: (val: boolean) => void;
  jobScopeMotive: boolean;
  setJobScopeMotive: (val: boolean) => void;
  jobSpecText: string;
  setJobSpecText: (val: string) => void;
  imageStyleMasterDraft: string;
  setImageStyleMasterDraft: (val: string) => void;
  locationImageStyleDraft: string;
  setLocationImageStyleDraft: (val: string) => void;
  mugshotImageStyleDraft: string;
  setMugshotImageStyleDraft: (val: string) => void;
  weaponImageStyleDraft: string;
  setWeaponImageStyleDraft: (val: string) => void;
  enqueueJob: (e: React.FormEvent) => void;
  previewEnqueueJobJson: () => void;
  loadJobs: (cid: string | number) => void;
  clearQueuedJobs: () => void;
  clearCompletedJobs: () => void;
  deleteQueuedJob: (id: number | string) => void;
  saveImageStyleSetting: (params: { key: string; value: string }) => void;
}
