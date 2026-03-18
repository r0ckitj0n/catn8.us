import React from 'react';

import { formatInlineDate } from './accumul8PageDateSearchUtils';

export type EntityEndexLog = {
  id: number;
  conflict_count: number;
  created_at: string;
  created_count: number;
  items: Array<{
    alias_name: string;
    parent_entity_id: number;
    parent_name: string;
    status: 'created' | 'updated';
  }>;
  scanned_entity_count: number;
  summary_text: string;
  touched_entity_count: number;
  updated_count: number;
};

interface Accumul8EntityEndexLogOverlayProps {
  entityEndexLogOpen: boolean;
  entityEndexScanLogs: EntityEndexLog[];
  onCloseEntityEndexLog: () => void;
}

export function Accumul8EntityEndexLogOverlay({
  entityEndexLogOpen,
  entityEndexScanLogs,
  onCloseEntityEndexLog,
}: Accumul8EntityEndexLogOverlayProps) {
  if (!entityEndexLogOpen) {
    return null;
  }

  return (
    <div className="accumul8-help-overlay" role="dialog" aria-modal="true" aria-label="Entity Endex scan history" onClick={onCloseEntityEndexLog}>
      <div className="accumul8-help-modal accumul8-entity-endex-log-modal" onClick={(e) => e.stopPropagation()}>
        <div className="accumul8-settings-modal-header">
          <div>
            <h2 className="accumul8-settings-modal-title mb-0">Entity Endex Scan History</h2>
            <div className="small text-muted">Recent global runs and the parent-to-alias changes they made.</div>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCloseEntityEndexLog}>Close</button>
        </div>
        <div className="accumul8-entity-endex-log-list accumul8-scroll-area accumul8-scroll-area--cards">
          {entityEndexScanLogs.length > 0 ? entityEndexScanLogs.map((log) => (
            <section key={log.id} className="accumul8-entity-endex-log-card">
              <div className="accumul8-entity-endex-log-card-head">
                <div>
                  <strong>{formatInlineDate(log.created_at)}</strong>
                  <div className="small text-muted">{log.summary_text}</div>
                </div>
                <div className="small text-muted">
                  {log.created_count + log.updated_count} change{log.created_count + log.updated_count === 1 ? '' : 's'}
                </div>
              </div>
              <div className="accumul8-entity-endex-log-meta">
                <span>{log.scanned_entity_count} scanned</span>
                <span>{log.touched_entity_count} touched</span>
                <span>{log.conflict_count} conflicts</span>
              </div>
              <div className="accumul8-entity-endex-log-items">
                {log.items.length > 0 ? log.items.map((item, index) => (
                  <div key={`${log.id}-${item.parent_entity_id}-${item.alias_name}-${index}`} className="accumul8-entity-endex-log-item">
                    <span className="accumul8-entity-endex-log-item-status">{item.status === 'created' ? 'Added' : 'Updated'}</span>
                    <span>{item.parent_name} ← {item.alias_name}</span>
                  </div>
                )) : <div className="small text-muted">This run did not record any parent-to-alias changes.</div>}
              </div>
            </section>
          )) : (
            <div className="text-muted">No Entity Endex scan history yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
