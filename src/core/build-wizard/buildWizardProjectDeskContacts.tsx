import React from 'react';

import { IBuildWizardContact, IBuildWizardContactAssignment, IBuildWizardStep } from '../../types/buildWizard';
import { BuildWizardContactType, contactTypeLabel, normalizeContactType } from './buildWizardPageRenderTypes';

type DeskContactDraft = {
  company: string;
  contact_id?: number;
  contact_type: BuildWizardContactType;
  display_name: string;
  email: string;
  is_project_only: number;
  is_vendor: number;
  notes: string;
  phone: string;
  role_title: string;
  vendor_license: string;
  vendor_trade: string;
  vendor_type: string;
  vendor_website: string;
};

interface BuildWizardProjectDeskContactsProps {
  contacts: IBuildWizardContact[];
  contactAssignmentCountById: Map<number, number>;
  deleteContactAssignment: (projectId: number, assignmentId: number) => Promise<unknown>;
  deskAssignmentPhaseKey: string;
  deskAssignmentStepId: number;
  deskContactDraft: DeskContactDraft;
  deskContactQuery: string;
  deskContactTypeFilter: 'all' | BuildWizardContactType;
  deskSelectedContactId: number;
  filteredContacts: IBuildWizardContact[];
  linkedStepOptions: Array<{ label: string; step: IBuildWizardStep }>;
  onAddDeskPhaseAssignment: () => Promise<unknown>;
  onAddDeskStepAssignment: () => Promise<unknown>;
  onDeleteDeskContact: () => Promise<unknown>;
  onSaveDeskContact: () => Promise<unknown>;
  onStartNewDeskContact: () => void;
  phaseOptions: Array<{ value: string; label: string }>;
  projectId: number;
  selectedContact: IBuildWizardContact | null;
  selectedContactAssignments: IBuildWizardContactAssignment[];
  setDeskAssignmentPhaseKey: (value: string) => void;
  setDeskAssignmentStepId: (value: number) => void;
  setDeskContactDraft: React.Dispatch<React.SetStateAction<DeskContactDraft>>;
  setDeskContactQuery: (value: string) => void;
  setDeskContactTypeFilter: (value: 'all' | BuildWizardContactType) => void;
  setDeskCreateMode: (value: boolean) => void;
  setDeskSelectedContactId: (value: number) => void;
  stepByIdMap: Map<number, IBuildWizardStep>;
}

export function BuildWizardProjectDeskContacts({
  contacts,
  contactAssignmentCountById,
  deleteContactAssignment,
  deskAssignmentPhaseKey,
  deskAssignmentStepId,
  deskContactDraft,
  deskContactQuery,
  deskContactTypeFilter,
  deskSelectedContactId,
  filteredContacts,
  linkedStepOptions,
  onAddDeskPhaseAssignment,
  onAddDeskStepAssignment,
  onDeleteDeskContact,
  onSaveDeskContact,
  onStartNewDeskContact,
  phaseOptions,
  projectId,
  selectedContact,
  selectedContactAssignments,
  setDeskAssignmentPhaseKey,
  setDeskAssignmentStepId,
  setDeskContactDraft,
  setDeskContactQuery,
  setDeskContactTypeFilter,
  setDeskCreateMode,
  setDeskSelectedContactId,
  stepByIdMap,
}: BuildWizardProjectDeskContactsProps) {
  return (
    <div className="build-wizard-desk-contacts">
      <h3>Contacts</h3>
      <div className="build-wizard-contact-summary">
        <span className="build-wizard-contact-summary-chip">Total: {contacts.length}</span>
        <span className="build-wizard-contact-summary-chip is-vendor">Vendors: {contacts.filter((contact) => normalizeContactType(contact) === 'vendor').length}</span>
        <span className="build-wizard-contact-summary-chip is-authority">Authorities: {contacts.filter((contact) => normalizeContactType(contact) === 'authority').length}</span>
        <span className="build-wizard-contact-summary-chip is-contact">Contacts: {contacts.filter((contact) => normalizeContactType(contact) === 'contact').length}</span>
      </div>
      <div className="build-wizard-contact-toolbar">
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={onStartNewDeskContact}>New Contact</button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setDeskContactQuery(''); setDeskContactTypeFilter('all'); }}>Clear Filters</button>
      </div>
      <div className="build-wizard-contact-filter-grid">
        <input type="search" placeholder="Search name, company, email..." value={deskContactQuery} onChange={(e) => setDeskContactQuery(e.target.value)} />
        <select value={deskContactTypeFilter} onChange={(e) => setDeskContactTypeFilter(e.target.value as 'all' | BuildWizardContactType)}>
          <option value="all">All types</option>
          <option value="contact">Contacts only</option>
          <option value="vendor">Vendors only</option>
          <option value="authority">Authorities only</option>
        </select>
      </div>
      <div className="build-wizard-contact-list-nav">
        {filteredContacts.length ? filteredContacts.map((contact) => {
          const assignmentCount = contactAssignmentCountById.get(contact.id) || 0;
          const isSelected = contact.id === deskSelectedContactId;
          return (
            <button type="button" key={contact.id} className={`build-wizard-contact-list-item${isSelected ? ' is-selected' : ''}`} onClick={() => { setDeskCreateMode(false); setDeskSelectedContactId(contact.id); }}>
              <span className="build-wizard-contact-list-main">
                <strong>{contact.display_name || 'Unnamed contact'}</strong>
                <span className="build-wizard-contact-list-sub">
                  {contact.company ? `${contact.company} | ` : ''}
                  {contactTypeLabel(normalizeContactType(contact))}
                  {contact.project_id ? ' | Project' : ' | Site'}
                </span>
              </span>
              <span className="build-wizard-contact-list-count">{assignmentCount} assignment{assignmentCount === 1 ? '' : 's'}</span>
            </button>
          );
        }) : <div className="build-wizard-muted">No contacts match the current filters.</div>}
      </div>
      <div className="build-wizard-contact-editor">
        <label>Name<input type="text" value={deskContactDraft.display_name} onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, display_name: e.target.value }))} /></label>
        <label>Email<input type="email" value={deskContactDraft.email} onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, email: e.target.value }))} /></label>
        <label>Phone<input type="text" value={deskContactDraft.phone} onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, phone: e.target.value }))} /></label>
        <label>Company<input type="text" value={deskContactDraft.company} onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, company: e.target.value }))} /></label>
        <label>Role<input type="text" value={deskContactDraft.role_title} onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, role_title: e.target.value }))} /></label>
        <div className="build-wizard-contact-flags">
          <label>
            Type
            <select
              value={deskContactDraft.contact_type}
              onChange={(e) => {
                const nextType = e.target.value as BuildWizardContactType;
                setDeskContactDraft((prev) => ({
                  ...prev,
                  contact_type: nextType,
                  is_vendor: nextType === 'vendor' ? 1 : 0,
                  ...(nextType === 'vendor' ? {} : { vendor_type: '', vendor_license: '', vendor_trade: '', vendor_website: '' }),
                }));
              }}
            >
              <option value="contact">Contact</option>
              <option value="vendor">Vendor</option>
              <option value="authority">Authority</option>
            </select>
          </label>
          <label>
            <input type="checkbox" checked={deskContactDraft.is_project_only === 1} onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, is_project_only: e.target.checked ? 1 : 0 }))} />
            Project-only contact
          </label>
        </div>
        {deskContactDraft.contact_type === 'vendor' ? (
          <div className="build-wizard-contact-vendor-fields">
            <label>Vendor Type<input type="text" value={deskContactDraft.vendor_type} onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, vendor_type: e.target.value }))} /></label>
            <label>Trade<input type="text" value={deskContactDraft.vendor_trade} onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, vendor_trade: e.target.value }))} /></label>
            <label>License<input type="text" value={deskContactDraft.vendor_license} onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, vendor_license: e.target.value }))} /></label>
            <label>Website<input type="url" value={deskContactDraft.vendor_website} onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, vendor_website: e.target.value }))} /></label>
          </div>
        ) : null}
        <label>Notes<textarea rows={3} value={deskContactDraft.notes} onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, notes: e.target.value }))} /></label>
        <div className="build-wizard-contact-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void onSaveDeskContact()} disabled={!deskContactDraft.display_name.trim()}>Save Contact</button>
          {selectedContact ? <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void onDeleteDeskContact()}>Delete</button> : null}
        </div>
      </div>
      {selectedContact ? (
        <div className="build-wizard-contact-assignments">
          <h4>Assignments</h4>
          <div className="build-wizard-contact-assignment-controls">
            <select value={deskAssignmentPhaseKey} onChange={(e) => setDeskAssignmentPhaseKey(e.target.value)}>
              <option value="general">General</option>
              {phaseOptions.map((opt) => (
                <option key={`contact-phase-${opt.value}`} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => void onAddDeskPhaseAssignment()}>Assign Phase</button>
          </div>
          <div className="build-wizard-contact-assignment-controls">
            <select value={deskAssignmentStepId > 0 ? String(deskAssignmentStepId) : ''} onChange={(e) => setDeskAssignmentStepId(Number(e.target.value || '0'))}>
              <option value="">Select step...</option>
              {linkedStepOptions.map((opt) => (
                <option key={`contact-step-${opt.step.id}`} value={opt.step.id}>{opt.label}</option>
              ))}
            </select>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => void onAddDeskStepAssignment()}>Assign Step</button>
          </div>
          <div className="build-wizard-contact-assignment-list">
            {selectedContactAssignments.length ? selectedContactAssignments.map((assignment) => {
              const assignedStep = assignment.step_id ? stepByIdMap.get(assignment.step_id) : null;
              const phaseName = assignment.phase_key ? assignment.phase_key : null;
              return (
                <div key={assignment.id} className="build-wizard-contact-assignment-item">
                  <div>{assignedStep ? `Step #${assignedStep.step_order} ${assignedStep.title}` : `Phase: ${phaseName || 'General'}`}</div>
                  <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void deleteContactAssignment(projectId, assignment.id)}>Remove</button>
                </div>
              );
            }) : <div className="build-wizard-muted">No assignments yet.</div>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
