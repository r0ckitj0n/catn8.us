import React from 'react';

import { parseDate, sortAlpha } from '../../components/pages/build-wizard/buildWizardUtils';
import { IBuildWizardContact, IBuildWizardContactAssignment, IBuildWizardStep } from '../../types/buildWizard';
import { BuildWizardContactType, normalizeContactType } from './buildWizardPageRenderTypes';

export function useBuildWizardWorkspaceData({
  activeTab,
  contactAssignments,
  contacts,
  deskContactQuery,
  deskContactTypeFilter,
  deskSelectedContactId,
  stepInfoModalStepId,
  stepEditModalStepId,
  moveStepModalStepId,
  stepDrafts,
  stepPhaseBucket,
  steps,
}: {
  activeTab: string;
  contactAssignments: IBuildWizardContactAssignment[];
  contacts: IBuildWizardContact[];
  deskContactQuery: string;
  deskContactTypeFilter: 'all' | BuildWizardContactType;
  deskSelectedContactId: number;
  moveStepModalStepId: number;
  stepDrafts: Record<number, IBuildWizardStep>;
  stepEditModalStepId: number;
  stepInfoModalStepId: number;
  stepPhaseBucket: (step: IBuildWizardStep) => string;
  steps: IBuildWizardStep[];
}) {
  const completedSteps = React.useMemo(() => steps.filter((s) => Number(s.is_completed) === 1).sort((a, b) => (parseDate(b.completed_at)?.getTime() || 0) - (parseDate(a.completed_at)?.getTime() || 0)), [steps]);
  const filteredTabSteps = React.useMemo(() => (activeTab === 'completed' || activeTab === 'start' || activeTab === 'overview' ? [] : steps.filter((step) => stepPhaseBucket(step) === activeTab)), [activeTab, stepPhaseBucket, steps]);
  const stepById = React.useMemo(() => new Map<number, IBuildWizardStep>(steps.map((step) => [step.id, step])), [steps]);
  const stepByIdMap = stepById;
  const projectDeskSteps = React.useMemo(() => steps.filter((step) => stepPhaseBucket(step) === 'desk'), [stepPhaseBucket, steps]);
  const deskContacts = React.useMemo(() => [...contacts].sort((a, b) => sortAlpha(String(a.display_name || ''), String(b.display_name || ''))), [contacts]);
  const selectedDeskContact = React.useMemo(() => deskSelectedContactId <= 0 ? null : (deskContacts.find((contact) => contact.id === deskSelectedContactId) || null), [deskContacts, deskSelectedContactId]);
  const stepInfoModalStep = React.useMemo(() => stepInfoModalStepId <= 0 ? null : (stepByIdMap.get(stepInfoModalStepId) || null), [stepByIdMap, stepInfoModalStepId]);
  const stepEditModalStep = React.useMemo(() => stepEditModalStepId <= 0 ? null : (stepByIdMap.get(stepEditModalStepId) || null), [stepByIdMap, stepEditModalStepId]);
  const moveStepModalStep = React.useMemo(() => moveStepModalStepId <= 0 ? null : (stepByIdMap.get(moveStepModalStepId) || null), [moveStepModalStepId, stepByIdMap]);
  const stepEditModalDraft = React.useMemo(() => (!stepEditModalStep ? null : (stepDrafts[stepEditModalStep.id] || stepEditModalStep)), [stepDrafts, stepEditModalStep]);
  const selectedContactAssignments = React.useMemo(() => !selectedDeskContact ? [] : contactAssignments.filter((assignment) => assignment.contact_id === selectedDeskContact.id).sort((a, b) => a.id - b.id), [contactAssignments, selectedDeskContact]);
  const deskContactAssignmentCountById = React.useMemo(() => {
    const map = new Map<number, number>();
    contactAssignments.forEach((assignment) => map.set(assignment.contact_id, (map.get(assignment.contact_id) || 0) + 1));
    return map;
  }, [contactAssignments]);
  const filteredDeskContacts = React.useMemo(() => {
    const query = deskContactQuery.trim().toLowerCase();
    return deskContacts.filter((contact) => {
      const contactType = normalizeContactType(contact);
      if (deskContactTypeFilter !== 'all' && contactType !== deskContactTypeFilter) return false;
      if (!query) return true;
      return [contact.display_name, contact.company, contact.role_title, contact.email, contact.phone].map((value) => String(value || '').toLowerCase()).join(' ').includes(query);
    });
  }, [deskContactQuery, deskContactTypeFilter, deskContacts]);
  const authorityContacts = React.useMemo(() => contacts.filter((contact) => normalizeContactType(contact) === 'authority').sort((a, b) => sortAlpha(String(a.display_name || ''), String(b.display_name || ''))), [contacts]);

  return {
    authorityContacts,
    completedSteps,
    deskContactAssignmentCountById,
    deskContacts,
    filteredDeskContacts,
    filteredTabSteps,
    moveStepModalStep,
    projectDeskSteps,
    selectedContactAssignments,
    selectedDeskContact,
    stepById,
    stepByIdMap,
    stepEditModalDraft,
    stepEditModalStep,
    stepInfoModalStep,
  };
}
