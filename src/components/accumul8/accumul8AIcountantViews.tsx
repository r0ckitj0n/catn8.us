import React from 'react';

import {
  Accumul8AIcountantConversation,
  Accumul8AIcountantMessage,
} from '../../types/accumul8';

export function formatConversationTime(value: string): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

interface Accumul8AIcountantSidebarProps {
  loading: boolean;
  sending: boolean;
  ownerUsername: string;
  activeConversationId: number | null;
  conversations: Accumul8AIcountantConversation[];
  defaultSystemPrompt: string;
  onCreateConversation: () => void;
  onOpenConversation: (conversationId: number) => void;
  onDeleteConversation: (conversationId: number, title: string) => void;
}

export function Accumul8AIcountantSidebar({
  loading,
  sending,
  ownerUsername,
  activeConversationId,
  conversations,
  defaultSystemPrompt,
  onCreateConversation,
  onOpenConversation,
  onDeleteConversation,
}: Accumul8AIcountantSidebarProps) {
  return (
    <aside className="accumul8-aicountant-sidebar">
      <div className="accumul8-aicountant-sidebar-top">
        <button type="button" className="btn btn-primary accumul8-aicountant-new-chat" onClick={onCreateConversation} disabled={loading || sending}>
          New Chat
        </button>
        <div className="accumul8-aicountant-note">
          <strong>AIcountant</strong>
          <span>ChatGPT-style bookkeeping assistant for {ownerUsername || 'this owner'}.</span>
        </div>
      </div>

      <div className="accumul8-aicountant-sidebar-list">
        {conversations.map((conversation) => (
          <div key={conversation.id} className={`accumul8-aicountant-conversation-card${activeConversationId === conversation.id ? ' is-active' : ''}`}>
            <button type="button" className="accumul8-aicountant-conversation-card-button" onClick={() => onOpenConversation(conversation.id)}>
              <strong>{conversation.title || 'Untitled Chat'}</strong>
              <span>{conversation.last_message_preview || 'No messages yet.'}</span>
              <small>{formatConversationTime(conversation.updated_at)}</small>
            </button>
            <button
              type="button"
              className="accumul8-aicountant-conversation-delete"
              aria-label={`Delete ${conversation.title || 'Untitled Chat'}`}
              title="Delete this saved chat"
              onClick={() => onDeleteConversation(conversation.id, conversation.title || 'Untitled Chat')}
              disabled={loading || sending}
            >
              🗑️
            </button>
          </div>
        ))}
        {!conversations.length ? (
          <div className="accumul8-aicountant-empty-rail">Start a new chat to create your first saved AIcountant conversation.</div>
        ) : null}
      </div>

      <details className="accumul8-aicountant-system-prompt">
        <summary>Prompt Template</summary>
        <textarea className="form-control" value={defaultSystemPrompt} readOnly rows={12} />
      </details>
    </aside>
  );
}

interface Accumul8AIcountantThreadProps {
  messages: Accumul8AIcountantMessage[];
  sending: boolean;
  threadRef: React.RefObject<HTMLDivElement | null>;
}

export function Accumul8AIcountantThread({ messages, sending, threadRef }: Accumul8AIcountantThreadProps) {
  return (
    <div className="accumul8-aicountant-thread" ref={threadRef}>
      {messages.length ? (
        messages.map((message) => (
          <article
            key={message.id}
            className={`accumul8-aicountant-message accumul8-aicountant-message--${message.role === 'assistant' ? 'assistant' : 'user'}`}
          >
            <div className="accumul8-aicountant-avatar">{message.role === 'assistant' ? 'AI' : 'You'}</div>
            <div className="accumul8-aicountant-bubble">
              <div className="accumul8-aicountant-bubble-meta">
                <strong>{message.role === 'assistant' ? 'AIcountant' : 'You'}</strong>
                <span>{formatConversationTime(message.created_at)}</span>
              </div>
              <div className="accumul8-aicountant-bubble-text">{message.content_text}</div>
            </div>
          </article>
        ))
      ) : null}
      {sending ? (
        <div className="accumul8-aicountant-message accumul8-aicountant-message--assistant">
          <div className="accumul8-aicountant-avatar">AI</div>
          <div className="accumul8-aicountant-bubble">
            <div className="accumul8-aicountant-typing">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
