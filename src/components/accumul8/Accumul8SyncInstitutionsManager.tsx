import React from 'react';
import { PriorityTableColumn, usePriorityTableLayout } from '../../hooks/usePriorityTableLayout';
import {
  Accumul8Account,
  Accumul8BankConnection,
} from '../../types/accumul8';
import { Accumul8TableHeaderCell } from './Accumul8TableHeaderCell';
import { Accumul8SyncInstitutionEditor, SyncInstitutionFormState } from './Accumul8SyncInstitutionEditor';
import {
  DEFAULT_SYNC_INSTITUTION_FORM,
  SYNC_INSTITUTION_STATUS_OPTIONS,
  toSyncInstitutionFormState,
  toSyncInstitutionPayload,
} from './accumul8SyncInstitutionUtils';

interface Accumul8SyncInstitutionsManagerProps {
  bankConnections: Accumul8BankConnection[];
  linkedAccountsByConnectionId: Record<number, Accumul8Account[]>;
  busy: boolean;
  syncingConnectionId: number | null;
  onCreate: (payload: ReturnType<typeof toSyncInstitutionPayload>) => Promise<void>;
  onUpdate: (id: number, payload: ReturnType<typeof toSyncInstitutionPayload>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onReconnect: (connection: Accumul8BankConnection) => Promise<void>;
  onSync: (connectionId: number, institutionName: string) => Promise<void>;
  formatAccountMappingLabel: (account: Accumul8Account) => string;
  formatAccountBackfillNote: (account: Accumul8Account) => string;
  formatSyncStatusLabel: (status: string, lastError: string) => string;
  formatSyncStatusMessage: (lastError: string) => string;
  isTellerRateLimited: (message: string) => boolean;
}

export function Accumul8SyncInstitutionsManager({
  bankConnections,
  linkedAccountsByConnectionId,
  busy,
  syncingConnectionId,
  onCreate,
  onUpdate,
  onDelete,
  onReconnect,
  onSync,
  formatAccountMappingLabel,
  formatAccountBackfillNote,
  formatSyncStatusLabel,
  formatSyncStatusMessage,
  isTellerRateLimited,
}: Accumul8SyncInstitutionsManagerProps) {
  const tableRef = React.useRef<HTMLTableElement | null>(null);
  const [editingConnectionId, setEditingConnectionId] = React.useState<number | 'new' | null>(null);
  const [form, setForm] = React.useState<SyncInstitutionFormState>(DEFAULT_SYNC_INSTITUTION_FORM);

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
    setForm(DEFAULT_SYNC_INSTITUTION_FORM);
  }, []);

  const beginEdit = React.useCallback((connection: Accumul8BankConnection) => {
    setEditingConnectionId(connection.id);
    setForm(toSyncInstitutionFormState(connection));
  }, []);

  const cancelEdit = React.useCallback(() => {
    setEditingConnectionId(null);
    setForm(DEFAULT_SYNC_INSTITUTION_FORM);
  }, []);

  const submitForm = React.useCallback(async () => {
    const payload = toSyncInstitutionPayload(form);
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

  return (
    <>
      {editingConnectionId === 'new' ? (
        <Accumul8SyncInstitutionEditor
          busy={busy}
          editingConnectionId={editingConnectionId}
          form={form}
          onCancel={cancelEdit}
          onChange={setForm}
          onSubmit={() => void submitForm()}
          statusOptions={SYNC_INSTITUTION_STATUS_OPTIONS}
          title="Add Connected Institution"
        />
      ) : null}
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
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => void onReconnect(connection)}
                          disabled={busy}
                          title={`Reconnect ${connection.institution_name || connection.institution_id || 'Institution'} through Teller`}
                        >
                          Reconnect
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => beginEdit(connection)}
                          disabled={busy}
                          title={`Advanced metadata edit for ${connection.institution_name || connection.institution_id || 'Institution'}`}
                        >
                          {isEditing ? 'Advanced' : 'Advanced'}
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => void deleteConnection(connection)} disabled={busy}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isEditing ? (
                    <tr className="accumul8-sync-editor-row">
                      <td colSpan={4}>
                        <Accumul8SyncInstitutionEditor
                          busy={busy}
                          editingConnectionId={editingConnectionId}
                          form={form}
                          onCancel={cancelEdit}
                          onChange={setForm}
                          onSubmit={() => void submitForm()}
                          statusOptions={SYNC_INSTITUTION_STATUS_OPTIONS}
                          title={`Edit ${connection.institution_name || connection.institution_id || 'Institution'}`}
                        />
                      </td>
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
