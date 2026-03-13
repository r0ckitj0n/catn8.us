import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { Accumul8Entity, Accumul8Transaction } from '../../types/accumul8';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { StandardIconButton } from '../common/StandardIconButton';
import './Accumul8ContactModal.css';

interface Accumul8LedgerEntityModalProps {
  open: boolean;
  busy: boolean;
  transaction: Accumul8Transaction | null;
  entities: Accumul8Entity[];
  onClose: () => void;
  onSave: (payload: { mode: 'existing' | 'new'; entityId: number | null; newEntityName: string }) => Promise<void>;
}

interface LedgerEntityModalFormState {
  mode: 'existing' | 'new';
  entityId: string;
  newEntityName: string;
}

const DEFAULT_FORM: LedgerEntityModalFormState = {
  mode: 'existing',
  entityId: '',
  newEntityName: '',
};

function buildInitialForm(transaction: Accumul8Transaction | null): LedgerEntityModalFormState {
  if (!transaction) {
    return DEFAULT_FORM;
  }
  return {
    mode: 'existing',
    entityId: transaction.entity_id ? String(transaction.entity_id) : '',
    newEntityName: transaction.entity_name || '',
  };
}

export function Accumul8LedgerEntityModal({
  open,
  busy,
  transaction,
  entities,
  onClose,
  onSave,
}: Accumul8LedgerEntityModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [form, setForm] = React.useState<LedgerEntityModalFormState>(DEFAULT_FORM);

  React.useEffect(() => {
    setForm(buildInitialForm(transaction));
  }, [transaction]);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) {
      return;
    }
    if (open) {
      modal.show();
      return;
    }
    modal.hide();
  }, [modalApiRef, open]);

  const handleSave = React.useCallback(() => {
    if (!transaction || busy) {
      return;
    }
    if (form.mode === 'existing' && !form.entityId) {
      return;
    }
    if (form.mode === 'new' && !String(form.newEntityName || '').trim()) {
      return;
    }
    void onSave({
      mode: form.mode,
      entityId: form.mode === 'existing' ? Number(form.entityId) : null,
      newEntityName: String(form.newEntityName || '').trim(),
    });
  }, [busy, form, onSave, transaction]);

  return (
    <div className="modal fade accumul8-contact-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Entity Name Rule</h5>
            <div className="d-flex align-items-center gap-2">
              <StandardIconButton
                iconKey="save"
                ariaLabel="Save entity name rule"
                title="Save entity name rule"
                className="btn btn-outline-primary btn-sm catn8-action-icon-btn"
                onClick={handleSave}
                disabled={busy || !transaction || (form.mode === 'existing' ? !form.entityId : !String(form.newEntityName || '').trim())}
              />
              <ModalCloseIconButton />
            </div>
          </div>
          <form
            className="modal-body d-grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              handleSave();
            }}
          >
            <div className="small text-muted">
              {transaction ? (
                <>Assign <strong>{transaction.description}</strong> to an entity and update its matching rule so similar names can be recognized later.</>
              ) : 'Choose an entity for this ledger name.'}
            </div>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="accumul8-ledger-entity-mode">Action</label>
                <select
                  id="accumul8-ledger-entity-mode"
                  className="form-select"
                  value={form.mode}
                  onChange={(event) => setForm((prev) => ({ ...prev, mode: event.target.value as 'existing' | 'new' }))}
                  disabled={busy}
                >
                  <option value="existing">Choose existing entity</option>
                  <option value="new">Create new entity</option>
                </select>
              </div>
              {form.mode === 'existing' ? (
                <div className="col-md-6">
                  <label className="form-label" htmlFor="accumul8-ledger-entity-id">Existing Entity</label>
                  <select
                    id="accumul8-ledger-entity-id"
                    className="form-select"
                    value={form.entityId}
                    onChange={(event) => setForm((prev) => ({ ...prev, entityId: event.target.value }))}
                    disabled={busy}
                  >
                    <option value="">Select an entity</option>
                    {entities
                      .filter((entity) => Number(entity.is_balance_person || 0) === 0)
                      .map((entity) => (
                        <option key={entity.id} value={entity.id}>{entity.display_name}</option>
                      ))}
                  </select>
                </div>
              ) : (
                <div className="col-md-6">
                  <label className="form-label" htmlFor="accumul8-ledger-new-entity-name">New Entity Name</label>
                  <input
                    id="accumul8-ledger-new-entity-name"
                    className="form-control"
                    value={form.newEntityName}
                    onChange={(event) => setForm((prev) => ({ ...prev, newEntityName: event.target.value }))}
                    placeholder="New entity name"
                    disabled={busy}
                  />
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
