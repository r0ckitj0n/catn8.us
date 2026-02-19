import React from 'react';

interface SeedStoriesSectionProps {
  busy: boolean;
  isAdmin: boolean;
  seedStories: any[];
  storyBookBusy: boolean;
  storyBookIncludeArchived: boolean;
  setStoryBookIncludeArchived: (val: boolean) => void;
  storyBookSelectedId: string;
  storyBookTitleDraft: string;
  setStoryBookTitleDraft: (val: string) => void;
  storyBookSlugDraft: string;
  setStoryBookSlugDraft: (val: string) => void;
  storyBookSourceDraft: string;
  setStoryBookSourceDraft: (val: string) => void;
  storyBookMetaDraft: string;
  setStoryBookMetaDraft: (val: string) => void;
  storyBookSelectedIsArchived: boolean;
  loadStoryBookEntries: () => void;
  loadStoryBookEntry: (id: string) => Promise<void>;
  createNewStoryBookEntry: () => void;
  saveStoryBookEntry: () => Promise<void>;
  archiveStoryBookEntry: () => Promise<void>;
  deleteStoryBookEntry: () => Promise<void>;
  mysteryId: string | number;
}

export function SeedStoriesSection({
  busy, isAdmin, seedStories, storyBookBusy, storyBookIncludeArchived, setStoryBookIncludeArchived,
  storyBookSelectedId, storyBookTitleDraft, setStoryBookTitleDraft, storyBookSlugDraft, setStoryBookSlugDraft,
  storyBookSourceDraft, setStoryBookSourceDraft, storyBookMetaDraft, setStoryBookMetaDraft,
  storyBookSelectedIsArchived, loadStoryBookEntries, loadStoryBookEntry, createNewStoryBookEntry,
  saveStoryBookEntry, archiveStoryBookEntry, deleteStoryBookEntry, mysteryId
}: SeedStoriesSectionProps) {
  return (
    <div className="catn8-card p-3 h-100">
      <div className="d-flex justify-content-between align-items-start gap-2">
        <div>
          <div className="fw-bold">Seed Stories</div>
          <div className="form-text">Manage Story Book entries (seed stories) used to inspire backstories.</div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <div className="form-check">
            <input
              id="stories-story-book-include-archived"
              className="form-check-input"
              type="checkbox"
              checked={storyBookIncludeArchived}
              onChange={(e) => setStoryBookIncludeArchived(e.target.checked)}
              disabled={busy || storyBookBusy}
            />
            <label className="form-check-label" htmlFor="stories-story-book-include-archived">Show archived</label>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={loadStoryBookEntries} disabled={busy || storyBookBusy}>
            Refresh
          </button>
          {isAdmin && (
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={createNewStoryBookEntry} disabled={busy || storyBookBusy}>
              New
            </button>
          )}
        </div>
      </div>

      <div className="row g-2 mt-2">
        <div className="col-lg-4">
          <label className="form-label" htmlFor="stories-story-book-select">Entry</label>
          <select
            id="stories-story-book-select"
            className="form-select"
            value={storyBookSelectedId}
            onChange={(e) => void loadStoryBookEntry(e.target.value)}
            disabled={busy || storyBookBusy}
          >
            <option value="">Select…</option>
            {seedStories.map((x) => (
              <option key={'sbe2' + String(x.id)} value={String(x.id)}>
                {String(x.title || x.slug || ('Entry #' + String(x.id)))}
              </option>
            ))}
          </select>
        </div>

        <div className="col-lg-4">
          <label className="form-label" htmlFor="stories-story-book-title">Title</label>
          <input
            id="stories-story-book-title"
            className="form-control"
            value={storyBookTitleDraft}
            onChange={(e) => setStoryBookTitleDraft(e.target.value)}
            disabled={busy || storyBookBusy || !isAdmin}
            placeholder="My Seed Story"
          />
        </div>

        <div className="col-lg-4">
          <label className="form-label" htmlFor="stories-story-book-slug">Slug (optional)</label>
          <input
            id="stories-story-book-slug"
            className="form-control"
            value={storyBookSlugDraft}
            onChange={(e) => setStoryBookSlugDraft(e.target.value)}
            disabled={busy || storyBookBusy || !isAdmin}
            placeholder="my-seed-story"
          />
        </div>
      </div>

      <div className="row g-2 mt-1">
        <div className="col-lg-8">
          <label className="form-label" htmlFor="stories-story-book-source">Seed Story Text</label>
          <textarea
            id="stories-story-book-source"
            className="form-control"
            rows={10}
            value={storyBookSourceDraft}
            onChange={(e) => setStoryBookSourceDraft(e.target.value)}
            disabled={busy || storyBookBusy || !isAdmin}
            spellCheck={false}
          />
        </div>
        <div className="col-lg-4">
          <label className="form-label" htmlFor="stories-story-book-meta">Meta (JSON object)</label>
          <textarea
            id="stories-story-book-meta"
            className="form-control"
            rows={10}
            value={storyBookMetaDraft}
            onChange={(e) => setStoryBookMetaDraft(e.target.value)}
            disabled={busy || storyBookBusy || !isAdmin}
            spellCheck={false}
          />
        </div>
      </div>

      {isAdmin && (
        <div className="d-flex justify-content-end gap-2 mt-2">
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={storyBookIncludeArchived && storyBookSelectedIsArchived ? deleteStoryBookEntry : archiveStoryBookEntry}
            disabled={busy || storyBookBusy || !storyBookSelectedId}
          >
            {storyBookIncludeArchived && storyBookSelectedIsArchived ? 'Delete' : 'Archive'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveStoryBookEntry}
            disabled={busy || storyBookBusy || !mysteryId}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
