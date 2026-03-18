import React from 'react';

import { IBuildWizardContact, IBuildWizardStep } from '../../types/buildWizard';
import { BuildWizardContactType } from './buildWizardPageRenderTypes';
import { useBuildWizardDeskAutoAssignActions } from './useBuildWizardDeskAutoAssignActions';

interface DeskContactDraft {
  contact_id?: number;
  display_name: string;
  email: string;
  phone: string;
  company: string;
  role_title: string;
  notes: string;
  contact_type: BuildWizardContactType;
  is_vendor: number;
  is_project_only: number;
  vendor_type: string;
  vendor_license: string;
  vendor_trade: string;
  vendor_website: string;
}

interface UseBuildWizardDeskActionsOptions {
  addContactAssignment: (payload: { project_id: number; contact_id: number; phase_key?: string; step_id?: number }) => Promise<unknown>;
  aiBusy: boolean;
  deleteContact: (projectId: number, contactId: number) => Promise<boolean>;
  deskAssignmentPhaseKey: string;
  deskAssignmentStepId: number;
  deskAutoAssignBusy: boolean;
  deskContactDraft: DeskContactDraft;
  deskContacts: IBuildWizardContact[];
  generateStepsFromAi: (mode: 'fill_missing') => Promise<{ steps?: IBuildWizardStep[] } | null | undefined>;
  onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
  projectId: number;
  requestConfirmation: (config: { title: string; message: string; confirmLabel?: string; cancelLabel?: string; confirmButtonClass?: string }) => Promise<boolean>;
  saveContact: (payload: Record<string, unknown>) => Promise<{ id?: number } | null | undefined>;
  selectedDeskContact: IBuildWizardContact | null;
  setDeskAutoAssignBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setDeskContactDraft: React.Dispatch<React.SetStateAction<DeskContactDraft>>;
  setDeskCreateMode: React.Dispatch<React.SetStateAction<boolean>>;
  setDeskSelectedContactId: React.Dispatch<React.SetStateAction<number>>;
  setStepContactCandidateByStepId: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setStepContactPickerOpenByStepId: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  steps: IBuildWizardStep[];
  updateStep: (stepId: number, patch: Partial<IBuildWizardStep>) => Promise<unknown>;
  toStringOrNull: (value: string | null | undefined) => string | null;
}

export function useBuildWizardDeskActions({
  addContactAssignment,
  aiBusy,
  deleteContact,
  deskAssignmentPhaseKey,
  deskAssignmentStepId,
  deskAutoAssignBusy,
  deskContactDraft,
  deskContacts,
  generateStepsFromAi,
  onToast,
  projectId,
  requestConfirmation,
  saveContact,
  selectedDeskContact,
  setDeskAutoAssignBusy,
  setDeskContactDraft,
  setDeskCreateMode,
  setDeskSelectedContactId,
  setStepContactCandidateByStepId,
  setStepContactPickerOpenByStepId,
  steps,
  updateStep,
  toStringOrNull,
}: UseBuildWizardDeskActionsOptions) {
  const onStartNewDeskContact = React.useCallback(() => {
    setDeskCreateMode(true);
    setDeskSelectedContactId(0);
    setDeskContactDraft({
      display_name: '',
      email: '',
      phone: '',
      company: '',
      role_title: '',
      notes: '',
      contact_type: 'contact',
      is_vendor: 0,
      is_project_only: 1,
      vendor_type: '',
      vendor_license: '',
      vendor_trade: '',
      vendor_website: '',
    });
  }, [setDeskContactDraft, setDeskCreateMode, setDeskSelectedContactId]);

  const onSaveDeskContact = React.useCallback(async () => {
    if (projectId <= 0) {
      return;
    }
    const next = await saveContact({
      project_id: projectId,
      contact_id: deskContactDraft.contact_id,
      display_name: deskContactDraft.display_name,
      contact_type: deskContactDraft.contact_type,
      email: toStringOrNull(deskContactDraft.email),
      phone: toStringOrNull(deskContactDraft.phone),
      company: toStringOrNull(deskContactDraft.company),
      role_title: toStringOrNull(deskContactDraft.role_title),
      notes: toStringOrNull(deskContactDraft.notes),
      is_vendor: deskContactDraft.contact_type === 'vendor' ? 1 : 0,
      is_project_only: deskContactDraft.is_project_only,
      vendor_type: toStringOrNull(deskContactDraft.vendor_type),
      vendor_license: toStringOrNull(deskContactDraft.vendor_license),
      vendor_trade: toStringOrNull(deskContactDraft.vendor_trade),
      vendor_website: toStringOrNull(deskContactDraft.vendor_website),
    });
    if (next?.id) {
      setDeskCreateMode(false);
      setDeskSelectedContactId(next.id);
    }
  }, [deskContactDraft, projectId, saveContact, setDeskCreateMode, setDeskSelectedContactId, toStringOrNull]);

  const onDeleteDeskContact = React.useCallback(async () => {
    if (projectId <= 0 || !selectedDeskContact) {
      return;
    }
    const confirmed = await requestConfirmation({
      title: 'Delete Contact?',
      message: `Delete contact "${selectedDeskContact.display_name}"?`,
      confirmLabel: 'Delete Contact',
      confirmButtonClass: 'btn btn-danger',
    });
    if (!confirmed) {
      return;
    }
    const didDelete = await deleteContact(projectId, selectedDeskContact.id);
    if (!didDelete) {
      return;
    }
    const fallback = deskContacts.find((contact) => contact.id !== selectedDeskContact.id);
    setDeskSelectedContactId(fallback?.id || 0);
  }, [deleteContact, deskContacts, projectId, requestConfirmation, selectedDeskContact, setDeskSelectedContactId]);

  const onAddDeskPhaseAssignment = React.useCallback(async () => {
    if (projectId <= 0 || !selectedDeskContact) {
      return;
    }
    await addContactAssignment({
      project_id: projectId,
      contact_id: selectedDeskContact.id,
      phase_key: deskAssignmentPhaseKey,
    });
  }, [addContactAssignment, deskAssignmentPhaseKey, projectId, selectedDeskContact]);

  const onAddDeskStepAssignment = React.useCallback(async () => {
    if (projectId <= 0 || !selectedDeskContact || deskAssignmentStepId <= 0) {
      return;
    }
    await addContactAssignment({
      project_id: projectId,
      contact_id: selectedDeskContact.id,
      step_id: deskAssignmentStepId,
    });
  }, [addContactAssignment, deskAssignmentStepId, projectId, selectedDeskContact]);

  const onAddContactToStep = React.useCallback(async (stepId: number, contactId: number) => {
    if (projectId <= 0 || stepId <= 0 || contactId <= 0) {
      return;
    }
    const saved = await addContactAssignment({
      project_id: projectId,
      contact_id: contactId,
      step_id: stepId,
    });
    if (saved) {
      setStepContactCandidateByStepId((prev) => ({ ...prev, [stepId]: '' }));
      setStepContactPickerOpenByStepId((prev) => ({ ...prev, [stepId]: false }));
    }
  }, [addContactAssignment, projectId, setStepContactCandidateByStepId, setStepContactPickerOpenByStepId]);
  const onAutoAssignDeskStepsToTimeline = useBuildWizardDeskAutoAssignActions({
    aiBusy,
    deskAutoAssignBusy,
    generateStepsFromAi,
    onToast,
    setDeskAutoAssignBusy,
    steps,
    updateStep,
  });

  return {
    onAddContactToStep,
    onAddDeskPhaseAssignment,
    onAddDeskStepAssignment,
    onAutoAssignDeskStepsToTimeline,
    onDeleteDeskContact,
    onSaveDeskContact,
    onStartNewDeskContact,
  };
}
