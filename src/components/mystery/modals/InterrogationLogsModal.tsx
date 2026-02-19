import React from 'react';
import './InterrogationLogsModal.css';

import { IConversationEvent } from '../../../types/game';

interface InterrogationLogsModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  logs: IConversationEvent[];
  busy: boolean;
}

export function InterrogationLogsModal({
  modalRef,
  logs,
  busy,
}: InterrogationLogsModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content catn8-mystery-modal-content">
          <div className="modal-header">
            <div className="fw-bold">Interrogation Room Logs</div>
            <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <div className="catn8-logs-container" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {logs.length === 0 ? (
                <div className="text-center p-4 text-muted">No logs available.</div>
              ) : (
                <div className="d-flex flex-column">
                  {logs.map((log) => (
                    <div key={log.id} className={`catn8-log-entry ${log.role === 'user' ? 'text-end' : ''}`}>
                      <div className="catn8-log-entity small mb-1">
                        {log.role === 'user' ? 'You' : (log.entity_name || log.speaker || 'Unknown')}
                      </div>
                      <div className="catn8-log-text">{log.content_text || log.content}</div>
                      <div className="catn8-log-time mt-1">
                        {new Date(log.created_at || log.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
