import React from 'react';

import { ApiClient } from '../ApiClient';
import {
  IBuildWizardContact,
  IBuildWizardContactAssignment,
} from '../../types/buildWizard';
import {
  AddContactAssignmentResponse,
  BuildWizardToast,
  DeleteContactAssignmentResponse,
  DeleteContactResponse,
  SaveContactResponse,
  SavePhaseDateRangeResponse,
} from './buildWizardInternalTypes';

interface UseBuildWizardContactActionsArgs {
  onToast?: (t: BuildWizardToast) => void;
  setContacts: React.Dispatch<React.SetStateAction<IBuildWizardContact[]>>;
  setContactAssignments: React.Dispatch<React.SetStateAction<IBuildWizardContactAssignment[]>>;
  setPhaseDateRanges: React.Dispatch<React.SetStateAction<any[]>>;
}

export function useBuildWizardContactActions({
  onToast,
  setContacts,
  setContactAssignments,
  setPhaseDateRanges,
}: UseBuildWizardContactActionsArgs) {
  const saveContact = React.useCallback(async (payload: {
    project_id: number;
    contact_id?: number;
    display_name: string;
    contact_type?: 'contact' | 'vendor' | 'authority';
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    role_title?: string | null;
    notes?: string | null;
    is_vendor?: number;
    is_project_only?: number;
    vendor_type?: string | null;
    vendor_license?: string | null;
    vendor_trade?: string | null;
    vendor_website?: string | null;
  }) => {
    if (Number(payload.project_id || 0) <= 0) {
      return null;
    }
    try {
      const res = await ApiClient.post<SaveContactResponse>('/api/build_wizard.php?action=save_contact', payload);
      const next = res?.contact || null;
      if (next) {
        setContacts((prev) => {
          const existingIndex = prev.findIndex((item) => item.id === next.id);
          if (existingIndex >= 0) {
            const merged = [...prev];
            merged[existingIndex] = next;
            return merged;
          }
          return [...prev, next];
        });
      }
      onToast?.({ tone: 'success', message: 'Contact saved.' });
      return next;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to save contact' });
      return null;
    }
  }, [onToast, setContacts]);

  const deleteContact = React.useCallback(async (projectIdValue: number, contactId: number) => {
    if (projectIdValue <= 0 || contactId <= 0) return false;
    try {
      await ApiClient.post<DeleteContactResponse>('/api/build_wizard.php?action=delete_contact', { project_id: projectIdValue, contact_id: contactId });
      setContacts((prev) => prev.filter((contact) => contact.id !== contactId));
      setContactAssignments((prev) => prev.filter((assignment) => assignment.contact_id !== contactId));
      onToast?.({ tone: 'success', message: 'Contact deleted.' });
      return true;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to delete contact' });
      return false;
    }
  }, [onToast, setContactAssignments, setContacts]);

  const addContactAssignment = React.useCallback(async (payload: {
    project_id: number;
    contact_id: number;
    step_id?: number | null;
    phase_key?: string | null;
  }) => {
    if (Number(payload.project_id || 0) <= 0 || Number(payload.contact_id || 0) <= 0) return null;
    try {
      const res = await ApiClient.post<AddContactAssignmentResponse>('/api/build_wizard.php?action=add_contact_assignment', payload);
      const next = res?.assignment || null;
      if (next) {
        setContactAssignments((prev) => prev.some((assignment) => assignment.id === next.id)
          ? prev.map((assignment) => (assignment.id === next.id ? next : assignment))
          : [...prev, next]);
      }
      onToast?.({ tone: 'success', message: 'Assignment added.' });
      return next;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to add assignment' });
      return null;
    }
  }, [onToast, setContactAssignments]);

  const deleteContactAssignment = React.useCallback(async (projectIdValue: number, assignmentId: number) => {
    if (projectIdValue <= 0 || assignmentId <= 0) return false;
    try {
      await ApiClient.post<DeleteContactAssignmentResponse>('/api/build_wizard.php?action=delete_contact_assignment', {
        project_id: projectIdValue,
        assignment_id: assignmentId,
      });
      setContactAssignments((prev) => prev.filter((assignment) => assignment.id !== assignmentId));
      onToast?.({ tone: 'success', message: 'Assignment removed.' });
      return true;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to remove assignment' });
      return false;
    }
  }, [onToast, setContactAssignments]);

  const savePhaseDateRange = React.useCallback(async (
    projectIdValue: number,
    phaseTab: 'land' | 'permits' | 'site' | 'framing' | 'mep' | 'finishes',
    startDate: string | null,
    endDate: string | null,
  ) => {
    if (projectIdValue <= 0) return null;
    try {
      const res = await ApiClient.post<SavePhaseDateRangeResponse>('/api/build_wizard.php?action=save_phase_date_range', {
        project_id: projectIdValue,
        phase_tab: phaseTab,
        start_date: startDate,
        end_date: endDate,
      });
      const nextRanges = Array.isArray(res?.phase_date_ranges) ? res.phase_date_ranges : [];
      setPhaseDateRanges(nextRanges);
      return nextRanges;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to save phase date range' });
      return null;
    }
  }, [onToast, setPhaseDateRanges]);

  return {
    saveContact,
    deleteContact,
    addContactAssignment,
    deleteContactAssignment,
    savePhaseDateRange,
  };
}
