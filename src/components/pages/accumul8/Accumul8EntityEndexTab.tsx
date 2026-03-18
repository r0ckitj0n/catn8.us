import React from 'react';

import { Accumul8Entity, Accumul8EntityEndexGuide } from '../../../types/accumul8';
import { formatInlineDate } from './accumul8PageDateSearchUtils';
import { normalizeEntityAliasKey } from './accumul8PageEntityUtils';
import { EntityEndexLog } from './Accumul8EntityEndexLogOverlay';

type EntityTransactionSummary = { count: number; lastAmount: number | null; lastDate: string };

interface Accumul8EntityEndexTabProps {
  beginEditEntity: (id: number) => void;
  busy: boolean;
  entityEndexFindingAll: boolean;
  entityEndexGuideByParentKey: Record<string, Accumul8EntityEndexGuide>;
  entityEndexGuides: Accumul8EntityEndexGuide[];
  entityEndexParents: Accumul8Entity[];
  entityEndexQuery: string;
  entityEndexScanLogs: EntityEndexLog[];
  entityTransactionSummaryById: Record<number, EntityTransactionSummary>;
  linkedAliasEntitiesByParentId: Record<number, Accumul8Entity[]>;
  openEntityEndexGuideModal: (guideId?: number | null) => void;
  runEntityMaintenanceAliasScan: () => Promise<unknown>;
  setEntityEndexLogOpen: (value: boolean) => void;
  setEntityEndexQuery: (value: string) => void;
}

export function Accumul8EntityEndexTab({
  beginEditEntity,
  busy,
  entityEndexFindingAll,
  entityEndexGuideByParentKey,
  entityEndexGuides,
  entityEndexParents,
  entityEndexQuery,
  entityEndexScanLogs,
  entityTransactionSummaryById,
  linkedAliasEntitiesByParentId,
  openEntityEndexGuideModal,
  runEntityMaintenanceAliasScan,
  setEntityEndexLogOpen,
  setEntityEndexQuery,
}: Accumul8EntityEndexTabProps) {
  return (
    <div className="accumul8-panel accumul8-panel--entity-endex accumul8-panel--viewport-fill">
      <div className="accumul8-panel-toolbar mb-3">
        <div>
          <h3 className="mb-0">Entity Endex</h3>
          <p className="small text-muted mb-0">Search parent entities, inspect aliases, and jump straight into cleanup.</p>
        </div>
        <div className="accumul8-entity-endex-search">
          <input className="form-control form-control-sm" value={entityEndexQuery} onChange={(event) => setEntityEndexQuery(event.target.value)} placeholder="Search parents or aliases" />
        </div>
        <div className="accumul8-entity-endex-toolbar-actions">
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => openEntityEndexGuideModal()} disabled={busy}>New Group</button>
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void runEntityMaintenanceAliasScan()} disabled={busy} title="Run the full Entity Endex alias maintenance scan across all parent entities.">
            {entityEndexFindingAll ? 'Running Alias Scan...' : 'Entity Maintenance (Alias Scan)'}
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary accumul8-icon-action" onClick={() => setEntityEndexLogOpen(true)} disabled={busy && entityEndexScanLogs.length === 0} aria-label="View Entity Endex scan history" title="View Entity Endex scan history">
            <span aria-hidden="true">i</span>
          </button>
        </div>
      </div>
      <div className="accumul8-entity-endex-scroll">
        <div className="accumul8-entity-endex-guide mb-3">
          <div className="accumul8-entity-endex-guide-head">
            <h4>Grouping Guide</h4>
            <span className="small text-muted">Use these parent names when new statement imports create messy merchant variants.</span>
          </div>
          <div className="accumul8-entity-endex-guide-grid">
            {entityEndexGuides.map((guide) => (
              <button key={guide.id || guide.parent_name} type="button" className="accumul8-entity-endex-guide-card" onClick={() => openEntityEndexGuideModal(guide.id || null)} disabled={busy}>
                <strong>{guide.parent_name}</strong>
                <div className="accumul8-entity-endex-guide-rule">{guide.match_rule}</div>
                <div className="accumul8-entity-endex-guide-examples">
                  {guide.examples.map((example) => (
                    <span key={example} className="accumul8-entity-endex-chip">{example}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="accumul8-entity-endex-grid">
          {entityEndexParents.map((entity) => {
            const linkedChildren = linkedAliasEntitiesByParentId[entity.id] || [];
            const summary = entityTransactionSummaryById[entity.id] || { count: 0, lastAmount: null, lastDate: '' };
            const matchingGuide = entityEndexGuides.find((guide) => (
              Number(guide.parent_entity_id || 0) === entity.id
              || normalizeEntityAliasKey(guide.parent_name) === normalizeEntityAliasKey(entity.display_name)
            )) || entityEndexGuideByParentKey[normalizeEntityAliasKey(entity.display_name)] || null;

            return (
              <article key={entity.id} className="accumul8-entity-endex-card">
                <div className="accumul8-entity-endex-card-head">
                  <div>
                    <h4>{entity.display_name}</h4>
                    <div className="accumul8-entity-endex-meta">
                      {Number(entity.legacy_contact_id || 0) > 0 || Number(entity.legacy_debtor_id || 0) > 0 ? 'Budget parent' : 'Alias parent'}
                      {summary.count > 0 ? ` · ${summary.count} tx` : ''}
                      {summary.lastDate ? ` · ${formatInlineDate(summary.lastDate)}` : ''}
                    </div>
                  </div>
                  <div className="accumul8-entity-endex-card-actions">
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => beginEditEntity(entity.id)} disabled={busy}>Edit</button>
                  </div>
                </div>
                <div className="accumul8-entity-endex-section">
                  <span className="accumul8-entity-endex-label">Aliases</span>
                  <div className="accumul8-entity-endex-chip-row">
                    {entity.aliases.length > 0 ? entity.aliases.map((alias) => (
                      <span key={alias.id} className="accumul8-entity-endex-chip">{alias.alias_name}</span>
                    )) : <span className="small text-muted">No aliases yet.</span>}
                  </div>
                </div>
                {matchingGuide ? (
                  <div className="accumul8-entity-endex-section">
                    <span className="accumul8-entity-endex-label">Import Rule</span>
                    <div className="small text-muted mb-2">{matchingGuide.match_rule}</div>
                    <div className="accumul8-entity-endex-chip-row">
                      {matchingGuide.examples.map((example) => (
                        <span key={example} className="accumul8-entity-endex-chip">{example}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="accumul8-entity-endex-section">
                  <span className="accumul8-entity-endex-label">Hidden Linked Records</span>
                  <div className="accumul8-entity-endex-linked-list">
                    {linkedChildren.length > 0 ? linkedChildren.map((child) => {
                      const childSummary = entityTransactionSummaryById[child.id] || { count: 0, lastAmount: null, lastDate: '' };
                      return (
                        <button key={child.id} type="button" className="accumul8-entity-endex-linked-item" onClick={() => beginEditEntity(child.id)} disabled={busy}>
                          <span>{child.display_name}</span>
                          <span className="small text-muted">{childSummary.count} tx</span>
                        </button>
                      );
                    }) : <span className="small text-muted">No hidden linked records.</span>}
                  </div>
                </div>
              </article>
            );
          })}
          {entityEndexParents.length === 0 ? (
            <div className="text-muted">No parent entities matched the current search.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
