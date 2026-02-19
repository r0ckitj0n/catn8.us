import React from 'react';

interface TopicListSectionProps {
  topics: any[];
  activeId: number | null;
  busy: boolean;
  loadTopic: (id: number) => Promise<void>;
  loadList: () => Promise<void>;
}

export function TopicListSection({ topics, activeId, busy, loadTopic, loadList }: TopicListSectionProps) {
  return (
    <div className="col-lg-4">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="fw-bold">Existing topics</div>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={loadList} disabled={busy}>
          Refresh
        </button>
      </div>
      <div className="list-group">
        {topics.map((t) => (
          <button
            key={t.id}
            type="button"
            className={'list-group-item list-group-item-action ' + (Number(t.id) === Number(activeId) ? 'active' : '')}
            onClick={() => void loadTopic(t.id)}
            disabled={busy}
          >
            <div className="fw-bold">{t.title}</div>
            <div className="small">{t.slug}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
