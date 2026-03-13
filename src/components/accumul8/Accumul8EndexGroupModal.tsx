import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { Accumul8Entity, Accumul8EntityAliasDraft, Accumul8EntityEndexGuide, Accumul8EntityEndexGuideUpsertRequest } from '../../types/accumul8';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { StandardIconButton } from '../common/StandardIconButton';
import { Accumul8EntityAliasEditor } from './Accumul8EntityAliasEditor';
import './Accumul8EndexGroupModal.css';

interface Accumul8EndexGroupModalProps {
  open: boolean;
  busy: boolean;
  guide: Accumul8EntityEndexGuide | null;
  parentEntity: Accumul8Entity | null;
  entities: Accumul8Entity[];
  aliasDraft: Accumul8EntityAliasDraft;
  onClose: () => void;
  onSave: (payload: Accumul8EntityEndexGuideUpsertRequest) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onFindRelated: (entityId: number) => Promise<void>;
  onAliasDraftChange: (draft: Accumul8EntityAliasDraft) => void;
  onAddAlias: () => Promise<void>;
  onRemoveAlias: (aliasId: number) => Promise<void>;
}

interface GroupFormState {
  parent_name: string;
  parent_entity_id: string;
  match_rule: string;
  examples_text: string;
  match_fragments_text: string;
  match_contains_text: string;
  is_active: number;
}

const DEFAULT_FORM: GroupFormState = {
  parent_name: '',
  parent_entity_id: '',
  match_rule: '',
  examples_text: '',
  match_fragments_text: '',
  match_contains_text: '',
  is_active: 1,
};

function formFromGuide(guide: Accumul8EntityEndexGuide | null): GroupFormState {
  if (!guide) {
    return DEFAULT_FORM;
  }
  return {
    parent_name: String(guide.parent_name || ''),
    parent_entity_id: guide.parent_entity_id ? String(guide.parent_entity_id) : '',
    match_rule: String(guide.match_rule || ''),
    examples_text: (guide.examples || []).join('\n'),
    match_fragments_text: (guide.match_fragments || []).join('\n'),
    match_contains_text: (guide.match_contains || []).join('\n'),
    is_active: Number(guide.is_active ?? 1),
  };
}

function parseLines(value: string): string[] {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function Accumul8EndexGroupModal({
  open,
  busy,
  guide,
  parentEntity,
  entities,
  aliasDraft,
  onClose,
  onSave,
  onDelete,
  onFindRelated,
  onAliasDraftChange,
  onAddAlias,
  onRemoveAlias,
}: Accumul8EndexGroupModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [form, setForm] = React.useState<GroupFormState>(DEFAULT_FORM);

  React.useEffect(() => {
    setForm(formFromGuide(guide));
  }, [guide]);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) {
      modal.show();
    } else {
      modal.hide();
    }
  }, [modalApiRef, open]);

  const handleSave = React.useCallback(() => {
    if (busy || !String(form.parent_name || '').trim()) {
      return;
    }
    void onSave({
      parent_name: String(form.parent_name || '').trim(),
      parent_entity_id: form.parent_entity_id ? Number(form.parent_entity_id) : null,
      match_rule: String(form.match_rule || '').trim(),
      examples: parseLines(form.examples_text),
      match_fragments: parseLines(form.match_fragments_text),
      match_contains: parseLines(form.match_contains_text),
      is_active: Number(form.is_active || 0),
    });
  }, [busy, form, onSave]);

  return (
    <div className="modal fade accumul8-endex-group-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{guide ? `Grouping Guide: ${guide.parent_name}` : 'New Grouping Guide'}</h5>
            <div className="d-flex align-items-center gap-2">
              {guide?.id ? (
                <StandardIconButton
                  iconKey="delete"
                  ariaLabel="Delete grouping guide"
                  title="Delete grouping guide"
                  className="btn btn-outline-danger btn-sm catn8-action-icon-btn"
                  onClick={() => {
                    if (!guide?.id || busy || !window.confirm(`Delete grouping guide "${guide.parent_name}"?`)) return;
                    void onDelete(guide.id);
                  }}
                  disabled={busy}
                />
              ) : null}
              <StandardIconButton
                iconKey="save"
                ariaLabel="Save grouping guide"
                title="Save grouping guide"
                className="btn btn-outline-primary btn-sm catn8-action-icon-btn"
                onClick={handleSave}
                disabled={busy || !String(form.parent_name || '').trim()}
              />
              <ModalCloseIconButton />
            </div>
          </div>
          <div className="modal-body d-grid gap-3">
            <div className="row g-3">
              <div className="col-md-5">
                <label className="form-label" htmlFor="accumul8-endex-parent-name">Group Name</label>
                <input
                  id="accumul8-endex-parent-name"
                  className="form-control"
                  value={form.parent_name}
                  onChange={(event) => setForm((prev) => ({ ...prev, parent_name: event.target.value }))}
                  disabled={busy}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-endex-parent-entity">Linked Parent Entity</label>
                <select
                  id="accumul8-endex-parent-entity"
                  className="form-select"
                  value={form.parent_entity_id}
                  onChange={(event) => {
                    const nextEntityId = event.target.value;
                    const nextEntity = entities.find((entity) => entity.id === Number(nextEntityId)) || null;
                    setForm((prev) => ({
                      ...prev,
                      parent_entity_id: nextEntityId,
                      parent_name: nextEntity ? nextEntity.display_name : prev.parent_name,
                    }));
                  }}
                  disabled={busy}
                >
                  <option value="">No linked entity</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>{entity.display_name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="accumul8-endex-status">Status</label>
                <select
                  id="accumul8-endex-status"
                  className="form-select"
                  value={String(form.is_active)}
                  onChange={(event) => setForm((prev) => ({ ...prev, is_active: Number(event.target.value) }))}
                  disabled={busy}
                >
                  <option value="1">Active</option>
                  <option value="0">Paused</option>
                </select>
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="accumul8-endex-match-rule">Match Rule Summary</label>
                <input
                  id="accumul8-endex-match-rule"
                  className="form-control"
                  value={form.match_rule}
                  onChange={(event) => setForm((prev) => ({ ...prev, match_rule: event.target.value }))}
                  placeholder='Example: Contains "home depot"'
                  disabled={busy}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-endex-fragments">Match Fragments</label>
                <textarea
                  id="accumul8-endex-fragments"
                  className="form-control"
                  rows={6}
                  value={form.match_fragments_text}
                  onChange={(event) => setForm((prev) => ({ ...prev, match_fragments_text: event.target.value }))}
                  placeholder="One normalized fragment per line"
                  disabled={busy}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-endex-contains">Match Contains</label>
                <textarea
                  id="accumul8-endex-contains"
                  className="form-control"
                  rows={6}
                  value={form.match_contains_text}
                  onChange={(event) => setForm((prev) => ({ ...prev, match_contains_text: event.target.value }))}
                  placeholder="One text fragment per line"
                  disabled={busy}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-endex-examples">Examples</label>
                <textarea
                  id="accumul8-endex-examples"
                  className="form-control"
                  rows={6}
                  value={form.examples_text}
                  onChange={(event) => setForm((prev) => ({ ...prev, examples_text: event.target.value }))}
                  placeholder="One example per line"
                  disabled={busy}
                />
              </div>
            </div>

            <div className="accumul8-endex-group-modal-section">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div>
                  <h6 className="mb-1">Related Names For This Group</h6>
                  <div className="small text-muted">
                    {parentEntity ? `Linked to ${parentEntity.display_name}` : 'Link a parent entity to run scans and manage aliases inside this group.'}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => {
                    if (!parentEntity) return;
                    void onFindRelated(parentEntity.id);
                  }}
                  disabled={busy || !parentEntity}
                >
                  Find Related Names
                </button>
              </div>
              {parentEntity ? (
                <Accumul8EntityAliasEditor
                  entity={parentEntity}
                  entities={entities}
                  draft={aliasDraft}
                  busy={busy}
                  placeholder={`Add alias to ${parentEntity.display_name}`}
                  onDraftChange={onAliasDraftChange}
                  onAddAlias={onAddAlias}
                  onRemoveAlias={onRemoveAlias}
                />
              ) : (
                <div className="small text-muted">Alias management becomes available after you link this group to a parent entity.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
