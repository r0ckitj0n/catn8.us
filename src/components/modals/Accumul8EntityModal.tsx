import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { Accumul8EntityAliasEditor } from '../accumul8/Accumul8EntityAliasEditor';
import { Accumul8ContactType, Accumul8Entity, Accumul8EntityAliasDraft, Accumul8EntityUpsertRequest } from '../../types/accumul8';
import { ACCUMUL8_SAVE_BUTTON_EMOJI } from '../accumul8/accumul8Ui';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import './Accumul8ContactModal.css';

function isBusinessSelected(form: Accumul8EntityUpsertRequest): boolean {
  return String(form.entity_kind || '').trim().toLowerCase() === 'business' || Number(form.is_vendor || 0) === 1;
}

interface Accumul8EntityModalProps {
  open: boolean;
  busy: boolean;
  editing: boolean;
  initialForm: Accumul8EntityUpsertRequest;
  entity: Accumul8Entity | null;
  entities: Accumul8Entity[];
  aliasDraft: Accumul8EntityAliasDraft;
  entitySummary?: {
    count: number;
    lastAmount: number | null;
    lastDate: string;
  } | null;
  onClose: () => void;
  onAliasDraftChange: (draft: Accumul8EntityAliasDraft) => void;
  onAddAlias: () => Promise<void>;
  onDeleteAlias: (aliasId: number) => Promise<void>;
  onSave: (form: Accumul8EntityUpsertRequest) => Promise<void>;
}

export function Accumul8EntityModal({
  open,
  busy,
  editing,
  initialForm,
  entity,
  entities,
  aliasDraft,
  entitySummary,
  onClose,
  onAliasDraftChange,
  onAddAlias,
  onDeleteAlias,
  onSave,
}: Accumul8EntityModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [form, setForm] = React.useState<Accumul8EntityUpsertRequest>(initialForm);
  const bodyRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) {
      modal.show();
      return;
    }
    modal.hide();
  }, [modalApiRef, open]);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('accumul8-contact-modal-open', open);
    return () => {
      document.body.classList.remove('accumul8-contact-modal-open');
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      bodyRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  return (
    <div className="modal fade accumul8-contact-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
        <div
          className="modal-content"
          onWheelCapture={(event) => event.stopPropagation()}
          onTouchMoveCapture={(event) => event.stopPropagation()}
        >
          <div className="modal-header">
            <h5 className="modal-title">{editing ? 'Edit Entity' : 'Add Entity'}</h5>
            <ModalCloseIconButton />
          </div>
          <form
            ref={bodyRef}
            className="modal-body d-grid gap-3"
            tabIndex={-1}
            onSubmit={(event) => {
              event.preventDefault();
              const contactType = (form.contact_type || 'payee') as Accumul8ContactType;
              const isBusiness = isBusinessSelected(form);
              void onSave({
                display_name: String(form.display_name || '').trim(),
                entity_kind: isBusiness ? 'business' : 'contact',
                contact_type: contactType,
                is_payee: contactType === 'payee' ? 1 : 0,
                is_payer: contactType === 'payer' ? 1 : 0,
                is_vendor: isBusiness ? 1 : 0,
                is_balance_person: contactType === 'repayment' ? 1 : 0,
                default_amount: Number(form.default_amount || 0),
                email: String(form.email || '').trim(),
                phone_number: String(form.phone_number || '').trim(),
                street_address: String(form.street_address || '').trim(),
                city: String(form.city || '').trim(),
                state: String(form.state || '').trim(),
                zip: String(form.zip || '').trim(),
                notes: String(form.notes || '').trim(),
                is_active: Number(form.is_active || 0),
              });
            }}
          >
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
                <input
                  id="accumul8-entity-name"
                  className="form-control"
                  value={form.display_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, display_name: e.target.value }))}
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-entity-status">Status</label>
                <select
                  id="accumul8-entity-status"
                  className="form-select"
                  value={String(form.is_active ?? 1)}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: Number(e.target.value) }))}
                >
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
                    setForm((prev) => ({
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
                    onChange={(e) => setForm((prev) => ({
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
                <input
                  id="accumul8-entity-default-amount"
                  className="form-control"
                  type="number"
                  step="0.01"
                  value={form.default_amount ?? 0}
                  onChange={(e) => setForm((prev) => ({ ...prev, default_amount: Number(e.target.value) }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-entity-email">Email</label>
                <input
                  id="accumul8-entity-email"
                  className="form-control"
                  type="email"
                  value={form.email || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-entity-phone">Phone</label>
                <input
                  id="accumul8-entity-phone"
                  className="form-control"
                  value={form.phone_number || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone_number: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="accumul8-entity-street">Street Address</label>
                <input
                  id="accumul8-entity-street"
                  className="form-control"
                  value={form.street_address || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, street_address: e.target.value }))}
                />
              </div>
              <div className="col-md-5">
                <label className="form-label" htmlFor="accumul8-entity-city">City</label>
                <input
                  id="accumul8-entity-city"
                  className="form-control"
                  value={form.city || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="accumul8-entity-state">State</label>
                <input
                  id="accumul8-entity-state"
                  className="form-control"
                  value={form.state || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-entity-zip">ZIP</label>
                <input
                  id="accumul8-entity-zip"
                  className="form-control"
                  value={form.zip || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, zip: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="accumul8-entity-notes">Notes</label>
                <textarea
                  id="accumul8-entity-notes"
                  className="form-control"
                  rows={3}
                  value={form.notes || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
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
            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="submit" className="btn btn-success" disabled={busy || !String(form.display_name || '').trim()}>
                <span aria-hidden="true">{editing ? ACCUMUL8_SAVE_BUTTON_EMOJI : '➕'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
