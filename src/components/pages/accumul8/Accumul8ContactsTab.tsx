import React from 'react';

import { Accumul8EntityAliasEditor } from '../../accumul8/Accumul8EntityAliasEditor';
import { Accumul8TableHeaderCell } from '../../accumul8/Accumul8TableHeaderCell';
import { ACCUMUL8_EDIT_BUTTON_EMOJI, ACCUMUL8_SAVE_BUTTON_EMOJI, ACCUMUL8_VIEW_BUTTON_EMOJI } from '../../accumul8/accumul8Ui';
import { PriorityTableSortState } from '../../../hooks/usePriorityTableLayout';
import { Accumul8ContactType, Accumul8Entity, Accumul8EntityAliasDraft } from '../../../types/accumul8';
import { formatInlineDate, formatInlineText } from './accumul8PageDateSearchUtils';
import { formatEntityContactSummary, formatEntityRoles, getActiveFilterClass, normalizeEntityContactType, normalizeEntityKind } from './accumul8PageEntityUtils';

type EntityInlineDraft = Partial<Pick<Accumul8Entity, 'display_name' | 'notes' | 'entity_kind' | 'contact_type' | 'is_vendor' | 'phone_number' | 'email' | 'street_address' | 'city' | 'state' | 'zip' | 'default_amount' | 'is_active'>>;
type EntityTransactionSummary = { count: number; lastAmount: number | null; lastDate: string };

interface Accumul8ContactsTabProps {
  activeEntityRowId: number | null;
  busy: boolean;
  defaultEntityAliasDraft: Accumul8EntityAliasDraft;
  entities: Accumul8Entity[];
  entitiesTable: {
    getColumnStyle: (key: string) => React.CSSProperties;
    requestSort: (columnKey: string) => void;
    rows: Accumul8Entity[];
    sortState: PriorityTableSortState;
    startResize: (columnKey: string, event: React.MouseEvent<HTMLSpanElement>) => void;
    tableStyle: React.CSSProperties;
  };
  entitiesTableRef: React.RefObject<HTMLTableElement | null>;
  entityAliasDraftById: Record<number, Accumul8EntityAliasDraft>;
  entityDraftById: Record<number, EntityInlineDraft>;
  entityTransactionSummaryById: Record<number, EntityTransactionSummary>;
  flashingSaveButtonKey: string | null;
  listSearchQuery: string;
  openCreateEntityModal: () => void;
  removeEntityAlias: (aliasId: number, entityId: number) => Promise<void>;
  saveEntityAlias: (entity: Accumul8Entity) => Promise<void>;
  saveEntityRow: (entity: Accumul8Entity) => Promise<void>;
  setEntityAliasDraftById: React.Dispatch<React.SetStateAction<Record<number, Accumul8EntityAliasDraft>>>;
  setEntityHistoryEntityId: (value: number | null) => void;
  setEntityRowDraft: (entity: Accumul8Entity, patch: EntityInlineDraft) => void;
  setInlineRowRef: (key: string, node: HTMLTableRowElement | null) => void;
  setListSearchQuery: (value: string) => void;
  activateEntityRow: (id: number) => void;
}

export function Accumul8ContactsTab({
  activeEntityRowId,
  activateEntityRow,
  busy,
  defaultEntityAliasDraft,
  entities,
  entitiesTable,
  entitiesTableRef,
  entityAliasDraftById,
  entityDraftById,
  entityTransactionSummaryById,
  flashingSaveButtonKey,
  listSearchQuery,
  openCreateEntityModal,
  removeEntityAlias,
  saveEntityAlias,
  saveEntityRow,
  setEntityAliasDraftById,
  setEntityHistoryEntityId,
  setEntityRowDraft,
  setInlineRowRef,
  setListSearchQuery,
}: Accumul8ContactsTabProps) {
  return (
    <div className="accumul8-panel accumul8-panel--entity-manager accumul8-panel--viewport-fill">
      <div className="accumul8-panel-toolbar mb-3">
        <h3 className="mb-0">Entity Manager</h3>
        <div className="accumul8-panel-toolbar-search">
          <input
            type="text"
            className={getActiveFilterClass('form-control form-control-sm', listSearchQuery.trim() !== '')}
            value={listSearchQuery}
            onChange={(e) => setListSearchQuery(e.target.value)}
            placeholder="Filter entity fields"
            aria-label="Filter entity fields"
          />
        </div>
        <button type="button" className="btn btn-success btn-sm" onClick={openCreateEntityModal} disabled={busy}>Add Entity</button>
      </div>
      <div className="table-responsive accumul8-scroll-area accumul8-scroll-area--list">
        <table
          ref={entitiesTableRef}
          className={[
            'table table-sm accumul8-table accumul8-table--measured accumul8-table--entities accumul8-sticky-head',
            activeEntityRowId !== null ? 'has-active-inline-edit' : '',
          ].filter(Boolean).join(' ')}
          style={entitiesTable.tableStyle}
        >
          <colgroup>
            <col style={entitiesTable.getColumnStyle('name')} />
            <col style={entitiesTable.getColumnStyle('roles')} />
            <col style={entitiesTable.getColumnStyle('contactInfo')} />
            <col style={entitiesTable.getColumnStyle('lastTransaction')} />
            <col style={entitiesTable.getColumnStyle('status')} />
            <col style={entitiesTable.getColumnStyle('actions')} />
          </colgroup>
          <thead>
            <tr>
              <Accumul8TableHeaderCell label="Name" columnKey="name" sortState={entitiesTable.sortState} onSort={entitiesTable.requestSort} onResizeStart={entitiesTable.startResize} />
              <Accumul8TableHeaderCell label="Roles" columnKey="roles" sortState={entitiesTable.sortState} onSort={entitiesTable.requestSort} onResizeStart={entitiesTable.startResize} />
              <Accumul8TableHeaderCell label="Contact Info" columnKey="contactInfo" sortState={entitiesTable.sortState} onSort={entitiesTable.requestSort} onResizeStart={entitiesTable.startResize} />
              <Accumul8TableHeaderCell label="Last Transaction" columnKey="lastTransaction" className="text-end" sortState={entitiesTable.sortState} onSort={entitiesTable.requestSort} onResizeStart={entitiesTable.startResize} />
              <Accumul8TableHeaderCell label="Status" columnKey="status" sortState={entitiesTable.sortState} onSort={entitiesTable.requestSort} onResizeStart={entitiesTable.startResize} />
              <Accumul8TableHeaderCell label="Actions" columnKey="actions" className="text-end" sortable={false} sortState={entitiesTable.sortState} onSort={entitiesTable.requestSort} onResizeStart={entitiesTable.startResize} />
            </tr>
          </thead>
          <tbody>
            {entitiesTable.rows.map((entity) => {
              const entityDraft = entityDraftById[entity.id];
              const entitySummary = entityTransactionSummaryById[entity.id] || { count: 0, lastAmount: null, lastDate: '' };
              const entityContactSummary = formatEntityContactSummary({
                phone_number: entityDraft?.phone_number ?? entity.phone_number,
                email: entityDraft?.email ?? entity.email,
                street_address: entityDraft?.street_address ?? entity.street_address,
                city: entityDraft?.city ?? entity.city,
                state: entityDraft?.state ?? entity.state,
                zip: entityDraft?.zip ?? entity.zip,
              });

              return (
                <tr
                  key={entity.id}
                  ref={(node) => setInlineRowRef(`entity-${entity.id}`, node)}
                  className={[
                    'accumul8-list-item',
                    activeEntityRowId === entity.id ? 'is-editing' : '',
                    entityDraft ? 'has-draft' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <td>
                    {activeEntityRowId === entity.id ? (
                      <div className="accumul8-inline-stack">
                        <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text" value={entityDraft?.display_name ?? entity.display_name} onChange={(e) => setEntityRowDraft(entity, { display_name: e.target.value })} disabled={busy} />
                        <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text accumul8-inline-editor--muted" value={entityDraft?.notes ?? entity.notes ?? ''} onChange={(e) => setEntityRowDraft(entity, { notes: e.target.value })} disabled={busy} placeholder="Notes" />
                        <Accumul8EntityAliasEditor
                          entity={entity}
                          entities={entities}
                          draft={entityAliasDraftById[entity.id] || defaultEntityAliasDraft}
                          busy={busy}
                          onDraftChange={(draft) => setEntityAliasDraftById((prev) => ({ ...prev, [entity.id]: draft }))}
                          onAddAlias={() => saveEntityAlias(entity)}
                          onRemoveAlias={(aliasId) => removeEntityAlias(aliasId, entity.id)}
                        />
                      </div>
                    ) : (
                      <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateEntityRow(entity.id)} disabled={busy}>
                        <span>{formatInlineText(entity.display_name, 'Unnamed entity')}</span>
                        {entity.notes ? <span className="small text-muted d-block">{entity.notes}</span> : null}
                        {entity.aliases.length > 0 ? (
                          <span className="small text-muted d-block accumul8-entity-alias-summary">
                            Aliases: {entity.aliases.map((alias) => alias.alias_name).join(' | ')}
                          </span>
                        ) : null}
                      </button>
                    )}
                  </td>
                  <td>
                    {activeEntityRowId === entity.id ? (
                      <div className="accumul8-inline-stack">
                        <select
                          className="form-select form-select-sm accumul8-inline-editor accumul8-inline-editor--select"
                          value={entityDraft?.contact_type ?? normalizeEntityContactType(entity)}
                          onChange={(e) => setEntityRowDraft(entity, { contact_type: e.target.value as Accumul8ContactType })}
                          disabled={busy}
                        >
                          <option value="payee">Payee</option>
                          <option value="payer">Payer</option>
                          <option value="repayment">Repayment</option>
                        </select>
                        <div className="accumul8-inline-check-grid">
                          <label className="accumul8-inline-check">
                            <input
                              type="checkbox"
                              checked={normalizeEntityKind(entityDraft?.entity_kind ?? entity.entity_kind, entityDraft?.is_vendor ?? entity.is_vendor) === 'business'}
                              onChange={(e) => setEntityRowDraft(entity, {
                                entity_kind: e.target.checked ? 'business' : 'contact',
                                is_vendor: e.target.checked ? 1 : 0,
                              })}
                              disabled={busy}
                            />
                            <span>Business</span>
                          </label>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateEntityRow(entity.id)} disabled={busy}>{formatEntityRoles(entity)}</button>
                    )}
                  </td>
                  <td>
                    {activeEntityRowId === entity.id ? (
                      <div className="accumul8-inline-stack">
                        <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text accumul8-inline-editor--muted" value={entityDraft?.phone_number ?? entity.phone_number ?? ''} onChange={(e) => setEntityRowDraft(entity, { phone_number: e.target.value })} disabled={busy} placeholder="Phone" />
                        <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text accumul8-inline-editor--muted" value={entityDraft?.email ?? entity.email ?? ''} onChange={(e) => setEntityRowDraft(entity, { email: e.target.value })} disabled={busy} placeholder="Email" />
                        <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text accumul8-inline-editor--muted" value={entityDraft?.street_address ?? entity.street_address ?? ''} onChange={(e) => setEntityRowDraft(entity, { street_address: e.target.value })} disabled={busy} placeholder="Street address" />
                        <div className="accumul8-inline-grid accumul8-inline-grid--triple">
                          <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text accumul8-inline-editor--muted" value={entityDraft?.city ?? entity.city ?? ''} onChange={(e) => setEntityRowDraft(entity, { city: e.target.value })} disabled={busy} placeholder="City" />
                          <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text accumul8-inline-editor--muted" value={entityDraft?.state ?? entity.state ?? ''} onChange={(e) => setEntityRowDraft(entity, { state: e.target.value })} disabled={busy} placeholder="State" />
                          <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text accumul8-inline-editor--muted" value={entityDraft?.zip ?? entity.zip ?? ''} onChange={(e) => setEntityRowDraft(entity, { zip: e.target.value })} disabled={busy} placeholder="ZIP" />
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateEntityRow(entity.id)} disabled={busy}>
                        {entityContactSummary.length > 0 ? entityContactSummary.map((line) => (
                          <span key={line} className="small text-muted d-block">{line}</span>
                        )) : <span className="small text-muted">No phone or email</span>}
                      </button>
                    )}
                  </td>
                  <td className="text-end">
                    <button type="button" className="accumul8-inline-cell-trigger accumul8-inline-cell-trigger--numeric" onClick={() => setEntityHistoryEntityId(entity.id)} disabled={busy}>
                      {entitySummary.lastAmount === null ? '-' : Number(entitySummary.lastAmount || 0).toFixed(2)}
                      <span className="small text-muted d-block accumul8-inline-cell-meta">
                        {entitySummary.lastDate ? `${formatInlineDate(entitySummary.lastDate)} · ${entitySummary.count} tx` : `${entitySummary.count} tx`}
                      </span>
                    </button>
                  </td>
                  <td>
                    {activeEntityRowId === entity.id ? (
                      <select className="form-select form-select-sm accumul8-inline-editor accumul8-inline-editor--select" value={String(entityDraft?.is_active ?? entity.is_active)} onChange={(e) => setEntityRowDraft(entity, { is_active: Number(e.target.value) })} disabled={busy}>
                        <option value="1">Active</option>
                        <option value="0">Paused</option>
                      </select>
                    ) : (
                      <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateEntityRow(entity.id)} disabled={busy}>{Number(entity.is_active || 0) === 1 ? 'Active' : 'Paused'}</button>
                    )}
                  </td>
                  <td className="text-end is-compact-actions">
                    <div className="accumul8-row-actions accumul8-row-actions--always-on">
                      <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => setEntityHistoryEntityId(entity.id)} disabled={busy} aria-label={`View transactions for ${entity.display_name}`} title={`View transactions for ${entity.display_name}`}>
                        <span aria-hidden="true">{ACCUMUL8_VIEW_BUTTON_EMOJI}</span>
                      </button>
                      <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => activateEntityRow(entity.id)} disabled={busy} aria-label={`Edit ${entity.display_name}`} title={`Edit ${entity.display_name}`}>
                        <span aria-hidden="true">{ACCUMUL8_EDIT_BUTTON_EMOJI}</span>
                      </button>
                      <button type="button" className={`btn btn-sm btn-outline-primary accumul8-icon-action${flashingSaveButtonKey === `entity-${entity.id}` ? ' is-flashing' : ''}`} onClick={() => void saveEntityRow(entity)} disabled={busy || !entityDraft} aria-label={`Save ${entity.display_name}`} title={entityDraft ? `Save ${entity.display_name}` : `No changes to save for ${entity.display_name}`}>
                        <span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {entitiesTable.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted py-4">No entities matched the current filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
