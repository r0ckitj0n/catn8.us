import React from 'react';

import { Accumul8LogEntry, Accumul8LogListResponse, Accumul8LogType, Accumul8LogTypeOption } from '../../types/accumul8';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';

interface Accumul8LogsModalProps {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onLoadLogs: (logType: Accumul8LogType) => Promise<Accumul8LogListResponse>;
}

const DEFAULT_LOG_TYPES: Accumul8LogTypeOption[] = [
  { type: 'diagnostics', label: 'Diagnostics', description: 'Recent Accumul8 diagnostic events and failures.' },
  { type: 'entity_endex', label: 'Entity Endex', description: 'Alias scan history for Entity Endex maintenance.' },
  { type: 'notifications', label: 'Notifications', description: 'Sent notification runs and recipients.' },
  { type: 'statement_audits', label: 'Statement Audits', description: 'Statement audit runs and outcomes.' },
  { type: 'statement_reconciliations', label: 'Statement Reconciliation', description: 'Recent reconciliation runs for imported statements.' },
  { type: 'sync', label: 'Sync', description: 'Teller and housekeeping sync events.' },
];

export function Accumul8LogsModal({ open, busy, onClose, onLoadLogs }: Accumul8LogsModalProps) {
  const [activeLogType, setActiveLogType] = React.useState<Accumul8LogType>('sync');
  const [availableLogTypes, setAvailableLogTypes] = React.useState<Accumul8LogTypeOption[]>(DEFAULT_LOG_TYPES);
  const [entries, setEntries] = React.useState<Accumul8LogEntry[]>([]);
  const [filterText, setFilterText] = React.useState('');
  const [loadingLogs, setLoadingLogs] = React.useState(false);
  const [loadError, setLoadError] = React.useState('');

  const loadLogs = React.useCallback(async (logType: Accumul8LogType) => {
    setLoadingLogs(true);
    setLoadError('');
    try {
      const response = await onLoadLogs(logType);
      setActiveLogType(response.log_type);
      setEntries(Array.isArray(response.entries) ? response.entries : []);
      setAvailableLogTypes(Array.isArray(response.available_log_types) && response.available_log_types.length > 0 ? response.available_log_types : DEFAULT_LOG_TYPES);
    } catch (error: any) {
      setLoadError(String(error?.message || 'Failed to load logs.'));
      setEntries([]);
    } finally {
      setLoadingLogs(false);
    }
  }, [onLoadLogs]);

  React.useEffect(() => {
    if (!open) return;
    void loadLogs(activeLogType);
  }, [activeLogType, loadLogs, open]);

  React.useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, open]);

  const filteredEntries = React.useMemo(() => {
    const query = filterText.trim().toLowerCase();
    if (query === '') {
      return entries;
    }
    return entries.filter((entry) => String(entry.search_text || '').toLowerCase().includes(query));
  }, [entries, filterText]);

  if (!open) {
    return null;
  }

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div
        className="modal fade show"
        tabIndex={-1}
        aria-hidden={!open}
        aria-modal="true"
        role="dialog"
        style={{ display: 'block' }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <div>
              <div className="fw-bold">Accumul8 Logs</div>
              <div className="small text-muted">Open a log, then filter entries by text.</div>
            </div>
            <ModalCloseIconButton onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="row g-3">
              <div className="col-12 col-lg-4">
                <div className="list-group">
                  {availableLogTypes.map((logType) => (
                    <button
                      key={logType.type}
                      type="button"
                      className={`list-group-item list-group-item-action${activeLogType === logType.type ? ' active' : ''}`}
                      onClick={() => void loadLogs(logType.type)}
                      disabled={busy || loadingLogs}
                    >
                      <div className="fw-semibold">{logType.label}</div>
                      <div className={`small${activeLogType === logType.type ? ' text-white-50' : ' text-muted'}`}>{logType.description}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-12 col-lg-8">
                <div className="d-flex flex-column gap-3">
                  <input
                    type="text"
                    className="form-control"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Filter log entries by text"
                    aria-label="Filter log entries by text"
                  />
                  {loadError ? <div className="alert alert-danger py-2 mb-0">{loadError}</div> : null}
                  {loadingLogs ? <div className="text-muted">Loading log entries...</div> : null}
                  {!loadingLogs && filteredEntries.length === 0 ? (
                    <div className="text-muted">{filterText.trim() !== '' ? 'No log entries match that filter.' : 'No log entries found.'}</div>
                  ) : null}
                  {!loadingLogs && filteredEntries.length > 0 ? (
                    <div className="accumul8-logs-modal-list">
                      {filteredEntries.map((entry) => (
                        <article key={entry.id} className="accumul8-logs-modal-entry card shadow-sm">
                          <div className="card-body">
                            <div className="d-flex justify-content-between align-items-start gap-3">
                              <div>
                                <h3 className="h6 mb-1">{entry.title}</h3>
                                {entry.subtitle ? <div className="small text-muted mb-2">{entry.subtitle}</div> : null}
                              </div>
                              <div className="text-end">
                                <div className="small text-muted">{entry.created_at || 'Unknown time'}</div>
                                <div className="small text-uppercase">{entry.status || 'log'}</div>
                              </div>
                            </div>
                            {entry.body ? <p className="mb-2">{entry.body}</p> : null}
                            {entry.details.length > 0 ? (
                              <div className="small text-muted d-flex flex-column gap-1">
                                {entry.details.map((detail, index) => <div key={`${entry.id}-detail-${index}`}>{detail}</div>)}
                              </div>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
