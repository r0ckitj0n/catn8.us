import React from 'react';

import { useAccumul8AIcountant } from '../../hooks/useAccumul8AIcountant';
import {
  Accumul8AIcountantSidebar,
  Accumul8AIcountantThread,
} from './accumul8AIcountantViews';

import './Accumul8AIcountantPanel.css';

type ToastPayload = {
  tone: 'success' | 'error' | 'info' | 'warning';
  message: string;
};

interface Accumul8AIcountantPanelProps {
  ownerUserId: number;
  ownerUsername: string;
  runningHousekeeping: boolean;
  balancingBooks: boolean;
  runningWatchlist: boolean;
  messageBoardPendingCount: number;
  onRunHousekeeping: () => void;
  onBalanceBooks: () => void;
  onRunWatchlist: () => void;
  onOpenMessageBoard: () => void;
  onDataChanged?: () => Promise<void> | void;
  onToast?: (payload: ToastPayload) => void;
}

export function Accumul8AIcountantPanel({
  ownerUserId,
  ownerUsername,
  runningHousekeeping,
  balancingBooks,
  runningWatchlist,
  messageBoardPendingCount,
  onRunHousekeeping,
  onBalanceBooks,
  onRunWatchlist,
  onOpenMessageBoard,
  onDataChanged,
  onToast,
}: Accumul8AIcountantPanelProps) {
  const {
    loading,
    sending,
    conversations,
    activeConversation,
    messages,
    defaultSystemPrompt,
    createConversation,
    openConversation,
    renameConversation,
    deleteConversation,
    sendMessage,
  } = useAccumul8AIcountant(ownerUserId, onToast);
  const [draft, setDraft] = React.useState('');
  const [titleDraft, setTitleDraft] = React.useState('');
  const threadRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setTitleDraft(activeConversation?.title || '');
  }, [activeConversation?.id, activeConversation?.title]);

  React.useEffect(() => {
    const node = threadRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [messages.length, activeConversation?.id]);

  const submitMessage = React.useCallback(async () => {
    const normalized = draft.trim();
    if (!normalized || sending) {
      return;
    }
    setDraft('');
    try {
      await sendMessage(normalized, activeConversation?.id || null);
      await onDataChanged?.();
    } catch (error) {
      setDraft(normalized);
    }
  }, [activeConversation?.id, draft, onDataChanged, sendMessage, sending]);

  const hasActiveConversation = Boolean(activeConversation);
  const pendingMessageBoardLabel = messageBoardPendingCount === 1 ? '1 new alert' : `${messageBoardPendingCount} new alerts`;

  return (
    <div className="accumul8-aicountant">
      <Accumul8AIcountantSidebar
        loading={loading}
        sending={sending}
        ownerUsername={ownerUsername}
        activeConversationId={activeConversation?.id || null}
        conversations={conversations}
        defaultSystemPrompt={defaultSystemPrompt}
        onCreateConversation={() => {
          void createConversation();
        }}
        onOpenConversation={(conversationId) => {
          void openConversation(conversationId);
        }}
        onDeleteConversation={(conversationId, title) => {
          if (!window.confirm(`Delete "${title}"?`)) {
            return;
          }
          void deleteConversation(conversationId);
        }}
      />

      <section className="accumul8-aicountant-main">
        <header className="accumul8-aicountant-header">
          <div className="accumul8-aicountant-header-actions">
            <div className="accumul8-aicountant-action-group" aria-label="AIcountant tools">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onRunHousekeeping}
                disabled={runningHousekeeping || sending || balancingBooks || runningWatchlist}
                title="Run the full AIcountant housekeeping workflow: bank sync, opening-balance review, and risk review."
              >
                {runningHousekeeping ? 'Running Housekeeping...' : 'Run Full Housekeeping'}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={onBalanceBooks}
                disabled={runningHousekeeping || balancingBooks || sending || runningWatchlist}
                title="Manual-only tool: sync connected banks and reconcile opening balances without running the risk review."
              >
                {balancingBooks ? 'Syncing Banks + Balancing...' : 'Sync Banks + Balance Books'}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={onRunWatchlist}
                disabled={runningHousekeeping || runningWatchlist || sending || balancingBooks}
                title="Manual-only tool: run just the AI risk review for overdue bills, cash-flow issues, and reminders."
              >
                {runningWatchlist ? 'Reviewing...' : 'Review Risks Only'}
              </button>
              <button
                type="button"
                className={`accumul8-aicountant-message-board-pill${messageBoardPendingCount > 0 ? ' has-alerts' : ''}`}
                onClick={onOpenMessageBoard}
                title="Open the message board to read AIcountant alerts and run summaries."
              >
                Alerts: {pendingMessageBoardLabel}
              </button>
            </div>
            {hasActiveConversation ? (
              <div className="accumul8-aicountant-action-group accumul8-aicountant-action-group--conversation" aria-label="Conversation controls">
                <label className="accumul8-aicountant-title-field">
                  <span>Name this chat</span>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    placeholder="Conversation title"
                    disabled={loading || sending}
                    aria-label="Conversation title"
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => {
                    if (activeConversation) {
                      void renameConversation(activeConversation.id, titleDraft);
                    }
                  }}
                  disabled={loading || sending || titleDraft.trim() === ''}
                >
                  Rename Chat
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => {
                    if (!activeConversation) {
                      return;
                    }
                    if (!window.confirm(`Delete "${activeConversation.title}"?`)) {
                      return;
                    }
                    void deleteConversation(activeConversation.id);
                  }}
                  disabled={loading || sending}
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <Accumul8AIcountantThread messages={messages} sending={sending} threadRef={threadRef} />

        <footer className="accumul8-aicountant-composer">
          <textarea
            className="form-control"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            placeholder="Ask AIcountant about categorization, opening-balance fixes, cash-flow risks, recurring bills, reminders, or what to review next..."
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submitMessage();
              }
            }}
            disabled={sending}
          />
          <div className="accumul8-aicountant-composer-bar">
            <span>Saved per conversation. Press Enter to send, Shift+Enter for a new line.</span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                void submitMessage();
              }}
              disabled={sending || draft.trim() === ''}
            >
              Send
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
