import React from 'react';

interface TopicFormSectionProps {
  mode: 'create' | 'edit';
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  busy: boolean;
  activeId: number | null;
  setActiveId: (id: number | null) => void;
  setMode: (mode: 'create' | 'edit') => void;
  remove: () => Promise<void>;
  save: (e: React.FormEvent) => Promise<void>;
}

export function TopicFormSection({
  mode, form, setForm, busy, activeId, setActiveId, setMode, remove, save
}: TopicFormSectionProps) {
  return (
    <div className="col-lg-8">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="fw-bold">{mode === 'edit' ? 'Edit topic' : 'Create topic'}</div>
        <div className="d-flex gap-2">
          {mode === 'edit' && (
            <>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => {
                setMode('create');
                setActiveId(null);
                setForm({ slug: '', title: '', description: '', words_per_page: 15, is_active: 1, wordsText: '' });
              }} disabled={busy}>
                New
              </button>
              <button type="button" className="btn btn-outline-danger btn-sm" onClick={remove} disabled={busy}>
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      <form onSubmit={save}>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label" htmlFor="topic-slug">Slug</label>
            <input
              id="topic-slug"
              className="form-control"
              value={form.slug}
              onChange={(e) => setForm((f: any) => ({ ...f, slug: e.target.value }))}
              disabled={busy}
              placeholder="my-topic"
              required
            />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="topic-title">Title</label>
            <input
              id="topic-title"
              className="form-control"
              value={form.title}
              onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))}
              disabled={busy}
              placeholder="My Topic"
              required
            />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="topic-desc">Description</label>
            <input
              id="topic-desc"
              className="form-control"
              value={form.description}
              onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))}
              disabled={busy}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="topic-words-per-page">Words per page</label>
            <input
              id="topic-words-per-page"
              className="form-control"
              type="number"
              min={5}
              max={60}
              step={1}
              value={String(form.words_per_page)}
              onChange={(e) => setForm((f: any) => ({ ...f, words_per_page: Number(e.target.value) }))}
              disabled={busy}
              required
            />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="topic-words">Words (one per line)</label>
            <textarea
              id="topic-words"
              className="form-control"
              rows={10}
              value={form.wordsText}
              onChange={(e) => setForm((f: any) => ({ ...f, wordsText: e.target.value }))}
              disabled={busy}
              required
            />
            <div className="form-text">Words are normalized to letters only.</div>
          </div>
          <div className="col-12">
            <div className="form-check">
              <input
                id="topic-active"
                className="form-check-input"
                type="checkbox"
                checked={!!form.is_active}
                onChange={(e) => setForm((f: any) => ({ ...f, is_active: e.target.checked ? 1 : 0 }))}
                disabled={busy}
              />
              <label className="form-check-label" htmlFor="topic-active">Active</label>
            </div>
          </div>
        </div>

        <button type="submit" className="btn btn-primary w-100 mt-3" disabled={busy}>
          {mode === 'edit' ? 'Save changes' : 'Create topic'}
        </button>
      </form>
    </div>
  );
}
