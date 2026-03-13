import React from 'react';
import { PriorityTableColumn, usePriorityTableLayout } from '../../hooks/usePriorityTableLayout';
import {
  Accumul8Account,
  Accumul8BankConnection,
  Accumul8BankConnectionUpsertRequest,
} from '../../types/accumul8';
import { Accumul8TableHeaderCell } from './Accumul8TableHeaderCell';

type SyncInstitutionFormState = {
  provider_name: string;
  institution_id: string;
  institution_name: string;
  teller_enrollment_id: string;
  teller_user_id: string;
  status: string;
};

const DEFAULT_FORM: SyncInstitutionFormState = {
  provider_name: 'teller',
  institution_id: '',
  institution_name: '',
  teller_enrollment_id: '',
  teller_user_id: '',
  status: 'setup_pending',
};

const STATUS_OPTIONS = [
  { value: 'setup_pending', label: 'Setup Pending' },
  { value: 'connected', label: 'Connected' },
  { value: 'sync_error', label: 'Sync Error' },
  { value: 'paused', label: 'Paused' },
];

interface Accumul8SyncInstitutionsManagerProps {
  bankConnections: Accumul8BankConnection[];
  linkedAccountsByConnectionId: Record<number, Accumul8Account[]>;
  busy: boolean;
  syncingConnectionId: number | null;
  onCreate: (payload: Accumul8BankConnectionUpsertRequest) => Promise<void>;
  onUpdate: (id: number, payload: Accumul8BankConnectionUpsertRequest) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onSync: (connectionId: number, institutionName: string) => Promise<void>;
  formatAccountMappingLabel: (account: Accumul8Account) => string;
  formatAccountBackfillNote: (account: Accumul8Account) => string;
  formatSyncStatusLabel: (status: string, lastError: string) => string;
  formatSyncStatusMessage: (lastError: string) => string;
  isTellerRateLimited: (message: string) => boolean;
}

function toFormState(connection?: Accumul8BankConnection | null): SyncInstitutionFormState {
  if (!connection) {
    return DEFAULT_FORM;
  }
  return {
    provider_name: String(connection.provider_name || 'teller'),
    institution_id: String(connection.institution_id || ''),
    institution_name: String(connection.institution_name || ''),
    teller_enrollment_id: String(connection.teller_enrollment_id || ''),
    teller_user_id: String(connection.teller_user_id || ''),
    status: String(connection.status || 'setup_pending'),
  };
}

function toPayload(form: SyncInstitutionFormState): Accumul8BankConnectionUpsertRequest {
  return {
    provider_name: form.provider_name,
    institution_id: form.institution_id.trim() || undefined,
    institution_name: form.institution_name.trim() || undefined,
    teller_enrollment_id: form.teller_enrollment_id.trim() || undefined,
    teller_user_id: form.teller_user_id.trim() || undefined,
    status: form.status.trim() || undefined,
  };
}

export function Accumul8SyncInstitutionsManager({
  bankConnections,
  linkedAccountsByConnectionId,
  busy,
  syncingConnectionId,
  onCreate,
  onUpdate,
  onDelete,
  onSync,
  formatAccountMappingLabel,
  formatAccountBackfillNote,
  formatSyncStatusLabel,
  formatSyncStatusMessage,
  isTellerRateLimited,
}: Accumul8SyncInstitutionsManagerProps) {
  const tableRef = React.useRef<HTMLTableElement | null>(null);
  const [editingConnectionId, setEditingConnectionId] = React.useState<number | 'new' | null>(null);
  const [form, setForm] = React.useState<SyncInstitutionFormState>(DEFAULT_FORM);

  const syncTableColumns = React.useMemo<Array<PriorityTableColumn<Accumul8BankConnection>>>(() => ([
    {
      key: 'institution',
      header: 'Institution',
      minWidth: 300,
      maxAutoWidth: 580,
      priority: 6,
      sortable: true,
      sortAccessor: (connection) => connection.institution_name || connection.institution_id || '',
      contentAccessor: (connection) => [
        connection.institution_name || connection.institution_id || 'Unknown',
        connection.teller_enrollment_id || 'Not stored yet',
        ...(linkedAccountsByConnectionId[Number(connection.id || 0)] || []).map((account) => formatAccountMappingLabel(account)),
      ],
    },
    {
      key: 'status',
      header: 'Status',
      minWidth: 96,
      maxAutoWidth: 120,
      sortable: true,
      sortAccessor: (connection) => formatSyncStatusLabel(connection.status || '', connection.last_error || ''),
      contentAccessor: (connection) => formatSyncStatusLabel(connection.status || '', connection.last_error || ''),
    },
    {
      key: 'lastSync',
      header: 'Last Sync',
      minWidth: 150,
      maxAutoWidth: 180,
      sortable: true,
      defaultSortDirection: 'desc',
      sortAccessor: (connection) => connection.last_sync_at || '',
      contentAccessor: (connection) => connection.last_sync_at || '-',
    },
    {
      key: 'actions',
      header: 'Actions',
      minWidth: 168,
      maxAutoWidth: 208,
      sortable: false,
      contentAccessor: () => 'Actions',
    },
  ]), [formatAccountMappingLabel, formatSyncStatusLabel, linkedAccountsByConnectionId]);

  const syncTable = usePriorityTableLayout({
    tableRef,
    rows: bankConnections,
    columns: syncTableColumns,
  });

  const beginCreate = React.useCallback(() => {
    setEditingConnectionId('new');
    setForm(DEFAULT_FORM);
  }, []);

  const beginEdit = React.useCallback((connection: Accumul8BankConnection) => {
    setEditingConnectionId(connection.id);
    setForm(toFormState(connection));
  }, []);

  const cancelEdit = React.useCallback(() => {
    setEditingConnectionId(null);
    setForm(DEFAULT_FORM);
  }, []);

  const submitForm = React.useCallback(async () => {
    const payload = toPayload(form);
    if (!payload.institution_id && !payload.institution_name) {
      return;
    }
    if (editingConnectionId === 'new') {
      await onCreate(payload);
    } else if (typeof editingConnectionId === 'number' && editingConnectionId > 0) {
      await onUpdate(editingConnectionId, payload);
    } else {
      return;
    }
    cancelEdit();
  }, [cancelEdit, editingConnectionId, form, onCreate, onUpdate]);

  const deleteConnection = React.useCallback(async (connection: Accumul8BankConnection) => {
    const name = connection.institution_name || connection.institution_id || 'this institution';
    const linkedCount = (linkedAccountsByConnectionId[connection.id] || []).length;
    const warning = linkedCount > 0
      ? `Delete "${name}"? ${linkedCount} linked local account${linkedCount === 1 ? '' : 's'} will stay in Accumul8 but lose the sync connection.`
      : `Delete "${name}"?`;
    if (!window.confirm(warning)) {
      return;
    }
    await onDelete(connection.id);
    if (editingConnectionId === connection.id) {
      cancelEdit();
    }
  }, [cancelEdit, editingConnectionId, linkedAccountsByConnectionId, onDelete]);

  const renderEditor = React.useCallback((title: string) => (
    <div className="accumul8-sync-editor card mb-3">
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h5 className="card-title mb-0">{title}</h5>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={cancelEdit} disabled={busy}>
            Cancel
          </button>
        </div>
        <div className="accumul8-sync-editor-grid">
          <label className="accumul8-sync-editor-field">
            <span>Institution Name</span>
            <input
              className="form-control form-control-sm"
              type="text"
              value={form.institution_name}
              onChange={(e) => setForm((current) => ({ ...current, institution_name: e.target.value }))}
              placeholder="Capital One"
              disabled={busy}
            />
          </label>
          <label className="accumul8-sync-editor-field">
            <span>Institution ID</span>
            <input
              className="form-control form-control-sm"
              type="text"
              value={form.institution_id}
              onChange={(e) => setForm((current) => ({ ...current, institution_id: e.target.value }))}
              placeholder="ins_123"
              disabled={busy}
            />
          </label>
          <label className="accumul8-sync-editor-field">
            <span>Enrollment ID</span>
            <input
              className="form-control form-control-sm"
              type="text"
              value={form.teller_enrollment_id}
              onChange={(e) => setForm((current) => ({ ...current, teller_enrollment_id: e.target.value }))}
              placeholder="enr_123"
              disabled={busy}
            />
          </label>
          <label className="accumul8-sync-editor-field">
            <span>Teller User ID</span>
            <input
              className="form-control form-control-sm"
              type="text"
              value={form.teller_user_id}
              onChange={(e) => setForm((current) => ({ ...current, teller_user_id: e.target.value }))}
              placeholder="usr_123"
              disabled={busy}
            />
          </label>
          <label className="accumul8-sync-editor-field">
            <span>Status</span>
            <select
              className="form-select form-select-sm"
              value={form.status}
              onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))}
              disabled={busy}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="accumul8-sync-editor-field">
            <span>Provider</span>
            <input className="form-control form-control-sm" type="text" value="Teller" disabled />
          </label>
        </div>
        <p className="accumul8-sync-editor-note mb-0">
          Manual entries help you organize/edit connected institutions here, but only Teller Connect stores the access token required for live sync.
        </p>
        <div className="d-flex justify-content-end mt-3">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void submitForm()}
            disabled={busy || (!form.institution_name.trim() && !form.institution_id.trim())}
          >
            {editingConnectionId === 'new' ? 'Add Institution' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  ), [busy, cancelEdit, editingConnectionId, form, submitForm]);

  return (
    <>
      {editingConnectionId === 'new' ? renderEditor('Add Connected Institution') : null}
      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
        <h4 className="h6 mb-0">Connected Institutions</h4>
        {editingConnectionId !== 'new' ? (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={beginCreate} disabled={busy}>
            Add Institution
          </button>
        ) : null}
      </div>
      <div className="table-responsive accumul8-scroll-area accumul8-scroll-area--sync">
        <table
          ref={tableRef}
          className="table table-sm accumul8-table accumul8-table--measured accumul8-table--sync-list accumul8-sticky-head"
          style={syncTable.tableStyle}
        >
          <colgroup>
            <col style={syncTable.getColumnStyle('institution')} />
            <col style={syncTable.getColumnStyle('status')} />
            <col style={syncTable.getColumnStyle('lastSync')} />
            <col style={syncTable.getColumnStyle('actions')} />
          </colgroup>
          <thead><tr>
            <Accumul8TableHeaderCell label="Institution" columnKey="institution" sortState={syncTable.sortState} onSort={syncTable.requestSort} onResizeStart={syncTable.startResize} />
            <Accumul8TableHeaderCell label="Status" columnKey="status" sortState={syncTable.sortState} onSort={syncTable.requestSort} onResizeStart={syncTable.startResize} />
            <Accumul8TableHeaderCell label="Last Sync" columnKey="lastSync" sortState={syncTable.sortState} onSort={syncTable.requestSort} onResizeStart={syncTable.startResize} />
            <Accumul8TableHeaderCell label="Actions" columnKey="actions" sortable={false} sortState={syncTable.sortState} onSort={syncTable.requestSort} onResizeStart={syncTable.startResize} />
          </tr></thead>
          <tbody>
            {syncTable.rows.map((connection) => {
              const isEditing = editingConnectionId === connection.id;
              const linkedAccounts = linkedAccountsByConnectionId[Number(connection.id || 0)] || [];
              const canSync = String(connection.teller_enrollment_id || '').trim() !== '';
              return (
                <React.Fragment key={connection.id}>
                  <tr>
                    <td>
                      <div className="accumul8-sync-institution-name">{connection.institution_name || connection.institution_id || 'Unknown'}</div>
                      <div className="accumul8-sync-meta">
                        Enrollment: {connection.teller_enrollment_id || 'Not stored yet'}
                      </div>
                      <div className="accumul8-sync-linked-accounts">
                        {linkedAccounts.length > 0 ? (
                          linkedAccounts.map((account) => (
                            <div key={account.id} className="accumul8-sync-linked-account">
                              {formatAccountMappingLabel(account)}
                              <div className="accumul8-sync-meta">
                                {formatAccountBackfillNote(account)}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="accumul8-sync-empty">No local account mappings yet. Run Sync to import and map Teller accounts.</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className={`accumul8-sync-status${isTellerRateLimited(String(connection.last_error || '')) ? ' is-rate-limited' : ''}`}>
                        {formatSyncStatusLabel(String(connection.status || ''), String(connection.last_error || ''))}
                      </div>
                      {connection.last_error ? <div className="accumul8-sync-error">{formatSyncStatusMessage(String(connection.last_error || ''))}</div> : null}
                    </td>
                    <td>{connection.last_sync_at || '-'}</td>
                    <td className="text-end">
                      <div className="accumul8-sync-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => void onSync(Number(connection.id || 0), String(connection.institution_name || connection.institution_id || 'Unknown'))}
                          disabled={busy || !canSync}
                          title={canSync ? 'Sync this institution now' : 'Finish Teller Connect before syncing'}
                        >
                          {syncingConnectionId === Number(connection.id || 0) ? 'Syncing...' : 'Sync'}
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => beginEdit(connection)} disabled={busy}>
                          {isEditing ? 'Editing' : 'Edit'}
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => void deleteConnection(connection)} disabled={busy}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isEditing ? (
                    <tr className="accumul8-sync-editor-row">
                      <td colSpan={4}>{renderEditor(`Edit ${connection.institution_name || connection.institution_id || 'Institution'}`)}</td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
            {syncTable.rows.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className="accumul8-sync-empty py-2">No connected institutions yet. Use Teller Connect or add one manually.</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
