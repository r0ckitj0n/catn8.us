import React from 'react';

import { DocumentDraftMap } from '../../types/pages/buildWizardPage';

export function useBuildWizardProjectDeskEffects(options: any) {
  const filteredDeskContacts = Array.isArray(options.filteredDeskContacts) ? options.filteredDeskContacts : [];

  React.useEffect(() => {
    if (options.docStepId <= 0) {
      return;
    }
    const exists = options.selectableDocSteps.some((step: any) => step.id === options.docStepId);
    if (!exists) {
      options.setDocStepId(0);
    }
  }, [options.docStepId, options.selectableDocSteps, options.setDocStepId]);

  React.useEffect(() => {
    if (!options.projectDeskOpen) {
      options.setDeskCreateMode(false);
    }
  }, [options.projectDeskOpen, options.setDeskCreateMode]);

  React.useEffect(() => {
    if (!options.projectDeskOpen) {
      return;
    }
    const nextDrafts: DocumentDraftMap = {};
    options.documents.forEach((doc: any) => {
      nextDrafts[doc.id] = {
        kind: doc.kind || 'other',
        caption: doc.caption || '',
        step_id: Number(doc.step_id || 0),
        receipt_amount: doc.receipt_amount !== null && Number.isFinite(Number(doc.receipt_amount))
          ? String(doc.receipt_amount)
          : '',
        receipt_title: doc.receipt_title || '',
        receipt_vendor: doc.receipt_vendor || '',
        receipt_date: options.taskUsesManualDateOverride(doc, options.parseTaskMetaFromReceiptNotes(doc.receipt_notes || '').taskMeta) ? (doc.receipt_date || '') : '',
        receipt_notes: doc.receipt_notes || '',
      };
    });
    options.setDocumentDrafts(nextDrafts);
    options.setDocumentManagerKindFilter('all');
    options.setDocumentManagerPhaseFilter('all');
    options.setDocumentManagerStepFilter('all');
    options.setDocumentManagerQuery('');
    options.setDocumentUploadModalOpen(false);
    options.setDocumentUploadFile(null);

    if (options.deskCreateMode) {
      return;
    }
    if (options.deskSelectedContactId > 0 && options.deskContacts.some((contact: any) => contact.id === options.deskSelectedContactId)) {
      return;
    }
    options.setDeskSelectedContactId(options.deskContacts[0]?.id || 0);
  }, [options]);

  React.useEffect(() => {
    if (options.documentManagerStepFilter === 'all' || options.documentManagerStepFilter === 'unlinked') {
      return;
    }
    const selectedStepId = Number(options.documentManagerStepFilter);
    if (selectedStepId <= 0) {
      options.setDocumentManagerStepFilter('all');
      return;
    }
    const stillValid = options.documentManagerLinkedStepFilterOptions.some((option: any) => option.step.id === selectedStepId);
    if (!stillValid) {
      options.setDocumentManagerStepFilter('all');
    }
  }, [options.documentManagerLinkedStepFilterOptions, options.documentManagerStepFilter, options.setDocumentManagerStepFilter]);

  React.useEffect(() => {
    if (!options.projectDeskOpen || options.deskCreateMode || options.deskSelectedContactId <= 0) {
      return;
    }
    if (!filteredDeskContacts.length) {
      return;
    }
    if (filteredDeskContacts.some((contact: any) => contact.id === options.deskSelectedContactId)) {
      return;
    }
    options.setDeskSelectedContactId(filteredDeskContacts[0].id);
  }, [filteredDeskContacts, options.deskCreateMode, options.deskSelectedContactId, options.projectDeskOpen, options.setDeskSelectedContactId]);

  React.useEffect(() => {
    if (!options.projectDeskOpen) {
      return;
    }
    if (!options.selectedDeskContact) {
      if (!options.deskCreateMode) {
        options.setDeskContactDraft({
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
      }
      return;
    }
    options.setDeskCreateMode(false);
    options.setDeskContactDraft({
      contact_id: options.selectedDeskContact.id,
      display_name: options.selectedDeskContact.display_name || '',
      email: options.selectedDeskContact.email || '',
      phone: options.selectedDeskContact.phone || '',
      company: options.selectedDeskContact.company || '',
      role_title: options.selectedDeskContact.role_title || '',
      notes: options.selectedDeskContact.notes || '',
      contact_type: options.normalizeContactType(options.selectedDeskContact),
      is_vendor: options.normalizeContactType(options.selectedDeskContact) === 'vendor' ? 1 : 0,
      is_project_only: options.selectedDeskContact.project_id ? 1 : 0,
      vendor_type: options.selectedDeskContact.vendor_type || '',
      vendor_license: options.selectedDeskContact.vendor_license || '',
      vendor_trade: options.selectedDeskContact.vendor_trade || '',
      vendor_website: options.selectedDeskContact.vendor_website || '',
    });
  }, [options]);
}
