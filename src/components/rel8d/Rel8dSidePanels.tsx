import React from 'react';

import type { Rel8dMedia, Rel8dNote } from '../../types/rel8d';

export function Rel8dRelatePanel({
  fromId,
  toId,
  onFrom,
  onTo,
  onSubmit,
  result,
}: {
  fromId: string;
  toId: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  onSubmit: () => void;
  result: Record<string, unknown> | null;
}) {
  return (
    <section className="rel8d-section">
      <h2>Relationship calculator</h2>
      <form
        className="rel8d-search"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <input value={fromId} onChange={(e) => onFrom(e.target.value)} placeholder="From person id" />
        <input value={toId} onChange={(e) => onTo(e.target.value)} placeholder="To person id" />
        <button type="submit" className="btn btn-sm btn-success">How related?</button>
      </form>
      {result ? (
        <div className="rel8d-relation">
          <strong>{String(result.relation || '')}</strong>
          <p>{Array.isArray(result.path_names) ? (result.path_names as string[]).join(' → ') : ''}</p>
        </div>
      ) : null}
      <p className="rel8d-meta">Open a person profile, then use numeric ids from search or the API.</p>
    </section>
  );
}

export function Rel8dQualityPanel({ rows }: { rows: Array<Record<string, unknown>> }) {
  return (
    <section className="rel8d-section">
      <h2>Data quality</h2>
      <ul className="rel8d-list">
        {rows.map((q) => (
          <li key={String(q.id)}>
            <strong>{String(q.flag_type)}</strong>
            <span className={'rel8d-badge ' + String(q.severity)}>{String(q.severity)}</span>
            <span>{String(q.name_display || '')} — {String(q.message)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Rel8dStoriesPanel({
  canEdit,
  noteTitle,
  noteBody,
  onTitle,
  onBody,
  onSubmit,
  stories,
}: {
  canEdit: boolean;
  noteTitle: string;
  noteBody: string;
  onTitle: (v: string) => void;
  onBody: (v: string) => void;
  onSubmit: () => void;
  stories: Rel8dNote[];
}) {
  return (
    <section className="rel8d-section">
      <h2>Stories &amp; notes</h2>
      {canEdit ? (
        <form
          className="rel8d-note-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <input value={noteTitle} onChange={(e) => onTitle(e.target.value)} placeholder="Title" />
          <textarea value={noteBody} onChange={(e) => onBody(e.target.value)} placeholder="Story text (plain)" rows={4} />
          <button type="submit" className="btn btn-sm btn-success">Add story</button>
        </form>
      ) : null}
      <ul className="rel8d-list">
        {stories.map((s) => (
          <li key={String(s.id)}>
            <strong>{s.title || 'Untitled'}</strong>
            <span>{s.name_display || ''}</span>
            <p>{s.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Rel8dGalleryPanel({
  canEdit,
  media,
  onUpload,
}: {
  canEdit: boolean;
  media: Rel8dMedia[];
  onUpload: (file: File) => void;
}) {
  return (
    <section className="rel8d-section">
      <h2>Photo &amp; document gallery</h2>
      {canEdit ? (
        <input
          type="file"
          accept="image/*,.pdf,.txt"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            onUpload(file);
            e.target.value = '';
          }}
        />
      ) : null}
      <div className="rel8d-gallery">
        {media.map((m) => (
          <a key={m.id} href={m.media_url} target="_blank" rel="noreferrer" className="rel8d-media-card">
            <strong>{m.title || m.file_name}</strong>
            <span>{m.media_type} · {m.name_display || 'unlinked'}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

export function Rel8dAuditPanel({ rows }: { rows: Array<Record<string, unknown>> }) {
  return (
    <section className="rel8d-section">
      <h2>Edit history</h2>
      <ul className="rel8d-list">
        {rows.map((a) => (
          <li key={String(a.id)}>
            <strong>{String(a.action)}</strong>
            <span>{String(a.actor_label || a.actor_user_id || '')} · {String(a.created_at || '')}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
