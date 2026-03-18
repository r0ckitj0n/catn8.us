import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { Accumul8ContactType, Accumul8Entity, Accumul8EntityAliasDraft, Accumul8EntityUpsertRequest } from '../../types/accumul8';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { StandardIconButton } from '../common/StandardIconButton';
import { Accumul8EntityModalFields, isBusinessSelected } from './accumul8EntityModalFields';
import './Accumul8ContactModal.css';

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
  const buildPayload = React.useCallback((): Accumul8EntityUpsertRequest => {
    const contactType = (form.contact_type || 'payee') as Accumul8ContactType;
    const isBusiness = isBusinessSelected(form);
    return {
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
    };
  }, [form]);
  const isDirty = React.useMemo(
    () => JSON.stringify(buildPayload()) !== JSON.stringify((() => {
      const contactType = (initialForm.contact_type || 'payee') as Accumul8ContactType;
      const isBusiness = isBusinessSelected(initialForm);
      return {
        display_name: String(initialForm.display_name || '').trim(),
        entity_kind: isBusiness ? 'business' : 'contact',
        contact_type: contactType,
        is_payee: contactType === 'payee' ? 1 : 0,
        is_payer: contactType === 'payer' ? 1 : 0,
        is_vendor: isBusiness ? 1 : 0,
        is_balance_person: contactType === 'repayment' ? 1 : 0,
        default_amount: Number(initialForm.default_amount || 0),
        email: String(initialForm.email || '').trim(),
        phone_number: String(initialForm.phone_number || '').trim(),
        street_address: String(initialForm.street_address || '').trim(),
        city: String(initialForm.city || '').trim(),
        state: String(initialForm.state || '').trim(),
        zip: String(initialForm.zip || '').trim(),
        notes: String(initialForm.notes || '').trim(),
        is_active: Number(initialForm.is_active || 0),
      };
    })()),
    [buildPayload, initialForm],
  );
  const handleSave = React.useCallback(() => {
    if (busy || !isDirty || !String(form.display_name || '').trim()) return;
    void onSave(buildPayload());
  }, [buildPayload, busy, form.display_name, isDirty, onSave]);

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
            <div className="d-flex align-items-center gap-2">
              <StandardIconButton
                iconKey="save"
                ariaLabel={editing ? 'Save entity changes' : 'Add entity'}
                title={isDirty ? (editing ? 'Save entity changes' : 'Add entity') : 'No changes to save'}
                className="btn btn-outline-primary btn-sm catn8-action-icon-btn"
                onClick={handleSave}
                disabled={busy || !isDirty || !String(form.display_name || '').trim()}
              />
              <ModalCloseIconButton />
            </div>
          </div>
          <form
            ref={bodyRef}
            className="modal-body d-grid gap-3"
            tabIndex={-1}
            onSubmit={(event) => {
              event.preventDefault();
              handleSave();
            }}
          >
            <Accumul8EntityModalFields
              busy={busy}
              editing={editing}
              form={form}
              entity={entity}
              entities={entities}
              aliasDraft={aliasDraft}
              entitySummary={entitySummary}
              onFormChange={setForm}
              onAliasDraftChange={onAliasDraftChange}
              onAddAlias={onAddAlias}
              onDeleteAlias={onDeleteAlias}
            />
          </form>
        </div>
      </div>
    </div>
  );
}
