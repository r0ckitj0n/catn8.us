import React from 'react';

import { Accumul8MessageBoardMessage } from '../../../types/accumul8';
import { OpeningBalanceMessageMeta, formatCurrencyAmount, formatInlineDate, formatInlineDateTime, getOpeningBalanceMessageMeta } from './accumul8PageDateSearchUtils';

interface Accumul8MessageBoardOverlayProps {
  acknowledgeAllMessageBoardMessages: () => Promise<unknown>;
  acknowledgeMessageBoardMessage: (id: number) => Promise<unknown>;
  loadMessageBoard: () => Promise<unknown>;
  messageBoardLoading: boolean;
  messageBoardMessages: Accumul8MessageBoardMessage[];
  messageBoardOpen: boolean;
  messageBoardUnacknowledgedCount: number;
  onCloseMessageBoard: () => void;
  onOpenTransactionFromMessageBoard: (transactionId: number) => void;
  setTabToLedger: () => void;
}

function getMessageSourceEmoji(message: Accumul8MessageBoardMessage) {
  switch (message.source_kind) {
    case 'aicountant_housekeeping':
      return '🧹';
    case 'aicountant_watchlist':
      return '👀';
    case 'aicountant_balance_books':
      return '🏦';
    case 'aicountant_opening_balance':
      return '⚖️';
    case 'aicountant_entity_maintenance':
      return '🧠';
    default:
      return '📌';
  }
}

function renderOpeningBalanceMeta(meta: OpeningBalanceMessageMeta) {
  return (
    <div className="accumul8-message-board-item-meta">
      {meta.accountName ? <span>Account: {meta.accountName}</span> : null}
      {meta.transactionDate ? <span>Adjustment date: {formatInlineDate(meta.transactionDate)}</span> : null}
      {meta.adjustmentAmount !== null ? <span>Adjustment: {formatCurrencyAmount(meta.adjustmentAmount)}</span> : null}
      {meta.priorLedgerBalance !== null ? <span>Ledger before: {formatCurrencyAmount(meta.priorLedgerBalance)}</span> : null}
      {meta.bankBalance !== null ? <span>Bank target: {formatCurrencyAmount(meta.bankBalance)}</span> : null}
    </div>
  );
}

type ParsedMessageSection =
  | { type: 'paragraph'; text: string }
  | { type: 'label'; label: string; value: string }
  | { type: 'list'; items: string[] }
  | { type: 'chips'; label: string; items: string[] };

function normalizeMessageParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseMessageParagraph(paragraph: string): ParsedMessageSection[] {
  const trimmed = paragraph.trim();
  if (!trimmed) {
    return [];
  }

  const bulletLines = trimmed
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (bulletLines.every((line) => /^-\s+/.test(line))) {
    return [{
      type: 'list',
      items: bulletLines.map((line) => line.replace(/^-+\s*/, '').trim()).filter(Boolean),
    }];
  }

  const labelMatch = trimmed.match(/^([^:\n]{2,40}):\s*(.+)$/s);
  if (labelMatch) {
    const label = String(labelMatch[1] || '').trim();
    const value = String(labelMatch[2] || '').trim();
    if (label !== '' && value !== '') {
      if (/;\s*/.test(value) && /top|spending|sent|failed|accounts|recipients/i.test(label)) {
        const items = value.split(/\s*;\s*/).map((item) => item.trim()).filter(Boolean);
        if (items.length > 1) {
          return [{ type: 'chips', label, items }];
        }
      }
      return [{ type: 'label', label, value }];
    }
  }

  const inlineBulletSplit = trimmed
    .split(/\s+-\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (inlineBulletSplit.length > 1) {
    const [intro, ...items] = inlineBulletSplit;
    const sections: ParsedMessageSection[] = [];
    if (intro) {
      sections.push({ type: 'paragraph', text: intro });
    }
    if (items.length > 0) {
      sections.push({ type: 'list', items });
    }
    return sections;
  }

  return [{ type: 'paragraph', text: trimmed }];
}

function renderParsedMessageBody(message: Accumul8MessageBoardMessage) {
  const body = String(message.body_text || '').trim();
  if (!body) {
    return null;
  }

  const sections = normalizeMessageParagraphs(body).flatMap(parseMessageParagraph);
  if (sections.length === 0) {
    return <div className="accumul8-message-board-item-text">{body}</div>;
  }

  return (
    <div className="accumul8-message-board-rich-text">
      {sections.map((section, index) => {
        if (section.type === 'paragraph') {
          return (
            <div key={`section-${index}`} className="accumul8-message-board-item-text">
              {section.text}
            </div>
          );
        }
        if (section.type === 'label') {
          return (
            <div key={`section-${index}`} className="accumul8-message-board-rich-row">
              <div className="accumul8-message-board-rich-label">{section.label}</div>
              <div className="accumul8-message-board-item-text">{section.value}</div>
            </div>
          );
        }
        if (section.type === 'chips') {
          return (
            <div key={`section-${index}`} className="accumul8-message-board-rich-row">
              <div className="accumul8-message-board-rich-label">{section.label}</div>
              <div className="accumul8-message-board-chip-list">
                {section.items.map((item, itemIndex) => (
                  <span key={`chip-${index}-${itemIndex}`} className="accumul8-message-board-chip">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          );
        }
        return (
          <ul key={`section-${index}`} className="accumul8-message-board-list-block">
            {section.items.map((item, itemIndex) => (
              <li key={`item-${index}-${itemIndex}`}>{item}</li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}

export function Accumul8MessageBoardOverlay({
  acknowledgeAllMessageBoardMessages,
  acknowledgeMessageBoardMessage,
  loadMessageBoard,
  messageBoardLoading,
  messageBoardMessages,
  messageBoardOpen,
  messageBoardUnacknowledgedCount,
  onCloseMessageBoard,
  onOpenTransactionFromMessageBoard,
  setTabToLedger,
}: Accumul8MessageBoardOverlayProps) {
  if (!messageBoardOpen) {
    return null;
  }

  return (
    <div className="accumul8-help-overlay" role="dialog" aria-modal="true" aria-label="AIcountant message board" onClick={onCloseMessageBoard}>
      <div className="accumul8-help-modal accumul8-message-board-modal" onClick={(e) => e.stopPropagation()}>
        <div className="accumul8-settings-modal-header">
          <div>
            <h2 className="accumul8-settings-modal-title mb-0">AIcountant Message Board</h2>
            <div className="small text-muted">
              {messageBoardUnacknowledgedCount} unacknowledged message{messageBoardUnacknowledgedCount === 1 ? '' : 's'}
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-success"
              onClick={() => { void acknowledgeAllMessageBoardMessages(); }}
              disabled={messageBoardLoading || messageBoardUnacknowledgedCount <= 0}
            >
              Acknowledge All
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => { void loadMessageBoard(); }} disabled={messageBoardLoading}>Refresh</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCloseMessageBoard}>Close</button>
          </div>
        </div>
        <div className="accumul8-message-board-list">
          {messageBoardMessages.map((message) => {
            const openingBalanceMeta = getOpeningBalanceMessageMeta(message);
            const duplicateCount = Math.max(1, Number(message.duplicate_count || 1));
            const sourceEmoji = getMessageSourceEmoji(message);
            return (
              <label key={message.id} className={`accumul8-message-board-item is-${message.message_level}${Number(message.is_acknowledged || 0) === 1 ? ' is-acknowledged' : ''}`}>
                <div className="accumul8-message-board-item-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={Number(message.is_acknowledged || 0) === 1}
                    disabled={Number(message.is_acknowledged || 0) === 1 || messageBoardLoading}
                    onChange={() => {
                      void acknowledgeMessageBoardMessage(message.id);
                    }}
                    aria-label={`Acknowledge ${message.title || 'message'}`}
                  />
                </div>
                <div className="accumul8-message-board-item-body">
                  <div className="accumul8-message-board-item-header">
                    <strong>
                      <span aria-hidden="true">{sourceEmoji}</span>{' '}
                      {duplicateCount > 1 ? <span aria-hidden="true">🔁 </span> : null}
                      {message.title || 'Update'}
                      {duplicateCount > 1 ? ` x${duplicateCount}` : ''}
                    </strong>
                    <span>{formatInlineDateTime(message.created_at)}</span>
                  </div>
                  {renderParsedMessageBody(message)}
                  {openingBalanceMeta ? renderOpeningBalanceMeta(openingBalanceMeta) : null}
                  {openingBalanceMeta?.transactionId ? (
                    <div className="accumul8-message-board-item-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setTabToLedger();
                          onOpenTransactionFromMessageBoard(openingBalanceMeta.transactionId || 0);
                          onCloseMessageBoard();
                        }}
                      >
                        Open ledger entry
                      </button>
                    </div>
                  ) : null}
                </div>
              </label>
            );
          })}
          {!messageBoardMessages.length ? (
            <div className="text-muted">No message board items yet.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
