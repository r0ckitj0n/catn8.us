import React from 'react';

import { Accumul8EntityAliasEditor } from '../accumul8/Accumul8EntityAliasEditor';
import {
  Accumul8ContactType,
  Accumul8Entity,
  Accumul8EntityAliasDraft,
  Accumul8EntityUpsertRequest,
} from '../../types/accumul8';

export function isBusinessSelected(form: Accumul8EntityUpsertRequest): boolean {
  return String(form.entity_kind || '').trim().toLowerCase() === 'business' || Number(form.is_vendor || 0) === 1;
}

interface Accumul8EntityModalFieldsProps {
  busy: boolean;
  editing: boolean;
  form: Accumul8EntityUpsertRequest;
  entity: Accumul8Entity | null;
  entities: Accumul8Entity[];
  aliasDraft: Accumul8EntityAliasDraft;
  entitySummary?: {
    count: number;
    lastAmount: number | null;
    lastDate: string;
  } | null;
  onFormChange: React.Dispatch<React.SetStateAction<Accumul8EntityUpsertRequest>>;
  onAliasDraftChange: (draft: Accumul8EntityAliasDraft) => void;
  onAddAlias: () => Promise<void>;
  onDeleteAlias: (aliasId: number) => Promise<void>;
}

export function Accumul8EntityModalFields({
  busy,
  editing,
  form,
  entity,
  entities,
  aliasDraft,
  entitySummary,
  onFormChange,
  onAliasDraftChange,
  onAddAlias,
  onDeleteAlias,
}: Accumul8EntityModalFieldsProps) {
  return (
    <>
      {editing && entity ? (
        <div className="accumul8-entity-modal-summary">
          <div className="accumul8-entity-modal-summary-card">
            <span className="accumul8-entity-modal-summary-label">Linked Aliases</span>
            <strong>{entity.aliases.length}</strong>
            <div className="accumul8-entity-modal-alias-list">
              {entity.aliases.length > 0 ? entity.aliases.map((alias) => (
                <span key={alias.id} className="accumul8-entity-modal-alias-chip">{alias.alias_name}</span>
              )) : <span className="accumul8-entity-modal-empty">No saved aliases yet.</span>}
            </div>
          </div>
          <div className="accumul8-entity-modal-summary-card">
            <span className="accumul8-entity-modal-summary-label">Transaction History</span>
            <strong>{Number(entitySummary?.count || 0)}</strong>
            <div className="accumul8-entity-modal-summary-meta">
              {entitySummary?.lastDate ? `Last activity ${entitySummary.lastDate}` : 'No linked transactions yet.'}
            </div>
            <div className="accumul8-entity-modal-summary-meta">
              {entitySummary?.lastAmount === null || entitySummary?.lastAmount === undefined ? '' : `Last amount ${Number(entitySummary.lastAmount).toFixed(2)}`}
            </div>
          </div>
        </div>
      ) : null}
      <div className="row g-3">
        <div className="col-md-8">
          <label className="form-label" htmlFor="accumul8-entity-name">Name</label>
          <input id="accumul8-entity-name" className="form-control" value={form.display_name} onChange={(e) => onFormChange((prev) => ({ ...prev, display_name: e.target.value }))} required />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="accumul8-entity-status">Status</label>
          <select id="accumul8-entity-status" className="form-select" value={String(form.is_active ?? 1)} onChange={(e) => onFormChange((prev) => ({ ...prev, is_active: Number(e.target.value) }))}>
            <option value="1">Active</option>
            <option value="0">Paused</option>
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="accumul8-entity-contact-type">Type</label>
          <select
            id="accumul8-entity-contact-type"
            className="form-select"
            value={form.contact_type}
            onChange={(e) => {
              const contactType = e.target.value as Accumul8ContactType;
              onFormChange((prev) => ({
                ...prev,
                contact_type: contactType,
                is_payee: contactType === 'payee' ? 1 : 0,
                is_payer: contactType === 'payer' ? 1 : 0,
                is_balance_person: contactType === 'repayment' ? 1 : 0,
              }));
            }}
          >
            <option value="payee">Payee</option>
            <option value="payer">Payer</option>
            <option value="repayment">Repayment</option>
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label d-block">Business</label>
          <label className="form-check-label d-flex align-items-center gap-2 mt-2">
            <input
              className="form-check-input m-0"
              type="checkbox"
              checked={isBusinessSelected(form)}
              onChange={(e) => onFormChange((prev) => ({
                ...prev,
                entity_kind: e.target.checked ? 'business' : 'contact',
                is_vendor: e.target.checked ? 1 : 0,
              }))}
            />
            <span>{isBusinessSelected(form) ? 'Yes' : 'No'}</span>
          </label>
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="accumul8-entity-default-amount">Default Amount</label>
          <input id="accumul8-entity-default-amount" className="form-control" type="number" step="0.01" value={form.default_amount ?? 0} onChange={(e) => onFormChange((prev) => ({ ...prev, default_amount: Number(e.target.value) }))} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="accumul8-entity-email">Email</label>
          <input id="accumul8-entity-email" className="form-control" type="email" value={form.email || ''} onChange={(e) => onFormChange((prev) => ({ ...prev, email: e.target.value }))} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="accumul8-entity-phone">Phone</label>
          <input id="accumul8-entity-phone" className="form-control" value={form.phone_number || ''} onChange={(e) => onFormChange((prev) => ({ ...prev, phone_number: e.target.value }))} />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="accumul8-entity-street">Street Address</label>
          <input id="accumul8-entity-street" className="form-control" value={form.street_address || ''} onChange={(e) => onFormChange((prev) => ({ ...prev, street_address: e.target.value }))} />
        </div>
        <div className="col-md-5">
          <label className="form-label" htmlFor="accumul8-entity-city">City</label>
          <input id="accumul8-entity-city" className="form-control" value={form.city || ''} onChange={(e) => onFormChange((prev) => ({ ...prev, city: e.target.value }))} />
        </div>
        <div className="col-md-3">
          <label className="form-label" htmlFor="accumul8-entity-state">State</label>
          <input id="accumul8-entity-state" className="form-control" value={form.state || ''} onChange={(e) => onFormChange((prev) => ({ ...prev, state: e.target.value }))} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="accumul8-entity-zip">ZIP</label>
          <input id="accumul8-entity-zip" className="form-control" value={form.zip || ''} onChange={(e) => onFormChange((prev) => ({ ...prev, zip: e.target.value }))} />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="accumul8-entity-notes">Notes</label>
          <textarea id="accumul8-entity-notes" className="form-control" rows={3} value={form.notes || ''} onChange={(e) => onFormChange((prev) => ({ ...prev, notes: e.target.value }))} />
        </div>
        {editing && entity ? (
          <div className="col-12">
            <label className="form-label">Alias List</label>
            <Accumul8EntityAliasEditor
              entity={entity}
              entities={entities}
              draft={aliasDraft}
              busy={busy}
              onDraftChange={onAliasDraftChange}
              onAddAlias={onAddAlias}
              onRemoveAlias={onDeleteAlias}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
