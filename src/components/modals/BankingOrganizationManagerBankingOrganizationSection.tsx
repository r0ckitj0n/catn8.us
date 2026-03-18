import React from 'react';

import { Accumul8BankingOrganization, Accumul8BankingOrganizationUpsertRequest } from '../../types/accumul8';
import { toBankingOrganizationForm, toBankingOrganizationPayload } from './bankingOrganizationManagerModalData';

interface BankingOrganizationManagerBankingOrganizationSectionProps {
  bankingOrganizationForm: Accumul8BankingOrganizationUpsertRequest;
  busy: boolean;
  createBankingOrganization: (form: Accumul8BankingOrganizationUpsertRequest) => Promise<void>;
  editingBankingOrganizationId: number | null;
  resetBankingOrganizationForm: () => void;
  setBankingOrganizationForm: React.Dispatch<React.SetStateAction<Accumul8BankingOrganizationUpsertRequest>>;
  setEditingBankingOrganizationId: (id: number | null) => void;
  updateBankingOrganization: (id: number, form: Accumul8BankingOrganizationUpsertRequest) => Promise<void>;
  visibleBankingOrganizations: Accumul8BankingOrganization[];
  onDelete: (bankingOrganization: Accumul8BankingOrganization) => void;
}

export function BankingOrganizationManagerBankingOrganizationSection({
  bankingOrganizationForm,
  busy,
  createBankingOrganization,
  editingBankingOrganizationId,
  resetBankingOrganizationForm,
  setBankingOrganizationForm,
  setEditingBankingOrganizationId,
  updateBankingOrganization,
  visibleBankingOrganizations,
  onDelete,
}: BankingOrganizationManagerBankingOrganizationSectionProps) {
  return (
    <>
      <p className="text-muted small mb-3">Create, rename, disable, or remove banking organizations. Each one now keeps a protected access group so the right Accumul8 users can share the same account data safely.</p>
      <form className="row g-2 mb-3" onSubmit={(e) => {
        e.preventDefault();
        const payload = toBankingOrganizationPayload(bankingOrganizationForm);
        if (editingBankingOrganizationId) void updateBankingOrganization(editingBankingOrganizationId, payload).then(() => resetBankingOrganizationForm());
        else void createBankingOrganization(payload).then(() => resetBankingOrganizationForm());
      }}>
        <div className="col-md-4"><label className="form-label" htmlFor="accumul8-banking-organization-name">Banking organization name</label><input id="accumul8-banking-organization-name" className="form-control" value={bankingOrganizationForm.banking_organization_name || ''} onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, banking_organization_name: e.target.value }))} required /></div>
        <div className="col-md-3"><label className="form-label" htmlFor="accumul8-banking-organization-institution">Institution</label><input id="accumul8-banking-organization-institution" className="form-control" value={bankingOrganizationForm.institution_name || ''} onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, institution_name: e.target.value }))} /></div>
        <div className="col-md-3"><label className="form-label" htmlFor="accumul8-banking-organization-active">Status</label><select id="accumul8-banking-organization-active" className="form-select" value={String(Number(bankingOrganizationForm.is_active || 0))} onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, is_active: Number(e.target.value) }))}><option value="1">Active</option><option value="0">Inactive</option></select></div>
        <div className="col-md-2 d-grid"><label className="form-label invisible">Save</label><button type="submit" className="btn btn-success" disabled={busy}>{editingBankingOrganizationId ? 'Update' : 'Add'}</button></div>
        <div className="col-md-6"><label className="form-label" htmlFor="accumul8-banking-organization-website-url">Website URL</label><input id="accumul8-banking-organization-website-url" className="form-control" type="url" placeholder="https://www.example.com" value={bankingOrganizationForm.website_url || ''} onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, website_url: e.target.value }))} /></div>
        <div className="col-md-6"><label className="form-label" htmlFor="accumul8-banking-organization-login-url">Login URL</label><input id="accumul8-banking-organization-login-url" className="form-control" type="url" placeholder="https://example.com/sign-in" value={bankingOrganizationForm.login_url || ''} onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, login_url: e.target.value }))} /></div>
        <div className="col-md-6"><label className="form-label" htmlFor="accumul8-banking-organization-support-url">Support URL</label><input id="accumul8-banking-organization-support-url" className="form-control" type="url" placeholder="https://example.com/support" value={bankingOrganizationForm.support_url || ''} onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, support_url: e.target.value }))} /></div>
        <div className="col-md-3"><label className="form-label" htmlFor="accumul8-banking-organization-support-phone">Support phone</label><input id="accumul8-banking-organization-support-phone" className="form-control" value={bankingOrganizationForm.support_phone || ''} onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, support_phone: e.target.value }))} /></div>
        <div className="col-md-3"><label className="form-label" htmlFor="accumul8-banking-organization-support-email">Support email</label><input id="accumul8-banking-organization-support-email" className="form-control" type="email" value={bankingOrganizationForm.support_email || ''} onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, support_email: e.target.value }))} /></div>
        <div className="col-md-3"><label className="form-label" htmlFor="accumul8-banking-organization-routing-number">Routing number</label><input id="accumul8-banking-organization-routing-number" className="form-control" value={bankingOrganizationForm.routing_number || ''} onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, routing_number: e.target.value }))} /></div>
        <div className="col-md-6"><label className="form-label" htmlFor="accumul8-banking-organization-icon-path">Icon asset path</label><input id="accumul8-banking-organization-icon-path" className="form-control" placeholder="/images/bank-organizations/example-1024.png" value={bankingOrganizationForm.icon_path || ''} onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, icon_path: e.target.value }))} /></div>
        <div className="col-md-9"><label className="form-label" htmlFor="accumul8-banking-organization-mailing-address">Mailing address</label><input id="accumul8-banking-organization-mailing-address" className="form-control" value={bankingOrganizationForm.mailing_address || ''} onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, mailing_address: e.target.value }))} /></div>
        <div className="col-md-3"><label className="form-label" htmlFor="accumul8-banking-organization-access-group">Access group ID</label><input id="accumul8-banking-organization-access-group" className="form-control" type="number" min={1} placeholder="Auto-create" value={Number(bankingOrganizationForm.access_group_id || 0) > 0 ? String(bankingOrganizationForm.access_group_id) : ''} onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, access_group_id: e.target.value ? Number(e.target.value) : null }))} /><div className="form-text">Leave blank to auto-create or keep the linked protected group.</div></div>
        <div className="col-12"><label className="form-label" htmlFor="accumul8-banking-organization-notes">Notes</label><textarea id="accumul8-banking-organization-notes" className="form-control" rows={2} value={bankingOrganizationForm.notes || ''} onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, notes: e.target.value }))} /></div>
        {editingBankingOrganizationId ? <div className="col-md-2 d-grid"><button type="button" className="btn btn-outline-secondary" onClick={resetBankingOrganizationForm} disabled={busy}>Cancel</button></div> : null}
      </form>
      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead><tr><th>Name</th><th>Institution</th><th>Web / Launch</th><th>Support</th><th>Access Group</th><th>Status</th><th>Notes</th><th className="text-end catn8-actions-column">Actions</th></tr></thead>
          <tbody>
            {visibleBankingOrganizations.map((bankingOrganization) => (
              <tr key={bankingOrganization.id}>
                <td>{bankingOrganization.banking_organization_name}</td>
                <td>{bankingOrganization.institution_name || '-'}</td>
                <td><div>{bankingOrganization.website_url || '-'}</div><div>{bankingOrganization.login_url || '-'}</div><div className="small text-muted">{bankingOrganization.icon_path || 'No icon asset'}</div></td>
                <td><div>{bankingOrganization.support_phone || bankingOrganization.support_email || '-'}</div><div className="small text-muted">{bankingOrganization.support_url || bankingOrganization.routing_number || bankingOrganization.mailing_address || '-'}</div></td>
                <td><div>{bankingOrganization.access_group_title || '-'}</div><div className="small text-muted">{bankingOrganization.access_group_slug || 'Protected group not linked yet'}</div></td>
                <td>{bankingOrganization.is_active ? 'Active' : 'Inactive'}</td>
                <td>{bankingOrganization.notes || '-'}</td>
                <td className="text-end catn8-actions-column">
                  <div className="d-inline-flex gap-2">
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => { setEditingBankingOrganizationId(bankingOrganization.id); setBankingOrganizationForm(toBankingOrganizationForm(bankingOrganization)); }} disabled={busy}>Edit</button>
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDelete(bankingOrganization)} disabled={busy}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {visibleBankingOrganizations.length === 0 ? <tr><td colSpan={7} className="text-muted">No banking organizations created yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
