import React from 'react';
import { createPortal } from 'react-dom';
import { Accumul8Entity, Accumul8EntityAliasDraft } from '../../types/accumul8';
import './Accumul8EntityAliasEditor.css';

interface Accumul8EntityAliasEditorProps {
  entity: Accumul8Entity;
  entities: Accumul8Entity[];
  draft: Accumul8EntityAliasDraft;
  busy: boolean;
  placeholder?: string;
  onDraftChange: (draft: Accumul8EntityAliasDraft) => void;
  onAddAlias: () => Promise<void> | void;
  onRemoveAlias: (aliasId: number) => Promise<void> | void;
}

function normalizeKey(value: string): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function Accumul8EntityAliasEditor({
  entity,
  entities,
  draft,
  busy,
  placeholder = 'Add alias',
  onDraftChange,
  onAddAlias,
  onRemoveAlias,
}: Accumul8EntityAliasEditorProps) {
  const [isFocused, setIsFocused] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const portalRef = React.useRef<HTMLDivElement | null>(null);
  const [portalStyle, setPortalStyle] = React.useState<React.CSSProperties | null>(null);
  const aliasKeys = React.useMemo(() => {
    const keys = new Set<string>();
    keys.add(normalizeKey(entity.display_name));
    entity.aliases.forEach((alias) => {
      keys.add(normalizeKey(alias.alias_name));
    });
    return keys;
  }, [entity]);
  const pendingAliasNames = React.useMemo(
    () => (draft.pending_alias_names || []).map((value) => String(value || '').trim()).filter(Boolean),
    [draft.pending_alias_names],
  );
  const pendingAliasKeys = React.useMemo(
    () => new Set(pendingAliasNames.map((value) => normalizeKey(value))),
    [pendingAliasNames],
  );
  const suggestions = React.useMemo(() => {
    const query = String(draft.alias_name || '').trim().toLowerCase();
    return entities
      .filter((candidate) => candidate.id !== entity.id)
      .map((candidate) => ({
        entity_id: candidate.id,
        alias_name: String(candidate.display_name || '').trim(),
        alias_key: normalizeKey(candidate.display_name),
      }))
      .filter((candidate) => candidate.alias_name !== '' && !aliasKeys.has(candidate.alias_key) && !pendingAliasKeys.has(candidate.alias_key))
      .filter((candidate) => (query === '' ? true : candidate.alias_name.toLowerCase().includes(query)))
      .sort((a, b) => a.alias_name.localeCompare(b.alias_name));
  }, [aliasKeys, draft.alias_name, entities, entity.id, pendingAliasKeys]);

  const queueAliasName = React.useCallback((aliasName: string) => {
    const trimmed = String(aliasName || '').trim();
    const aliasKey = normalizeKey(trimmed);
    if (!trimmed || !aliasKey || aliasKeys.has(aliasKey) || pendingAliasKeys.has(aliasKey)) {
      return;
    }
    setIsFocused(true);
    onDraftChange({
      ...draft,
      alias_name: '',
      merge_entity_id: null,
      pending_alias_names: [...pendingAliasNames, trimmed],
    });
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [aliasKeys, draft, onDraftChange, pendingAliasKeys, pendingAliasNames]);

  const removePendingAlias = React.useCallback((aliasName: string) => {
    const trimmed = String(aliasName || '').trim();
    onDraftChange({
      ...draft,
      pending_alias_names: pendingAliasNames.filter((value) => value !== trimmed),
    });
  }, [draft, onDraftChange, pendingAliasNames]);

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const targetNode = event.target as Node;
      if (!wrapperRef.current?.contains(targetNode) && !portalRef.current?.contains(targetNode)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  const showSuggestions = isFocused && suggestions.length > 0;

  React.useEffect(() => {
    if (!showSuggestions || typeof window === 'undefined') {
      setPortalStyle(null);
      return undefined;
    }

    const updatePortalPosition = () => {
      const input = inputRef.current;
      if (!input) {
        setPortalStyle(null);
        return;
      }
      const rect = input.getBoundingClientRect();
      setPortalStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };

    updatePortalPosition();
    window.addEventListener('resize', updatePortalPosition);
    window.addEventListener('scroll', updatePortalPosition, true);
    return () => {
      window.removeEventListener('resize', updatePortalPosition);
      window.removeEventListener('scroll', updatePortalPosition, true);
    };
  }, [showSuggestions]);

  return (
    <div className="accumul8-entity-aliases" ref={wrapperRef}>
      <div className="accumul8-entity-aliases-list">
        {entity.aliases.map((alias) => (
          <span key={alias.id} className="accumul8-entity-alias-chip">
            <span>{alias.alias_name}</span>
            <button type="button" className="accumul8-entity-alias-remove" onClick={() => void onRemoveAlias(alias.id)} disabled={busy} aria-label={`Remove alias ${alias.alias_name}`}>x</button>
          </span>
        ))}
        {pendingAliasNames.map((aliasName) => (
          <span key={`pending-${aliasName}`} className="accumul8-entity-alias-chip accumul8-entity-alias-chip--pending">
            <span>{aliasName}</span>
            <button
              type="button"
              className="accumul8-entity-alias-remove"
              onClick={() => removePendingAlias(aliasName)}
              disabled={busy}
              aria-label={`Remove pending alias ${aliasName}`}
            >
              x
            </button>
          </span>
        ))}
      </div>
      <div className="accumul8-entity-alias-add">
        <div className="accumul8-entity-alias-input-wrap">
          <input
            ref={inputRef}
            className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text accumul8-inline-editor--muted"
            value={draft.alias_name}
            onFocus={() => setIsFocused(true)}
            onChange={(event) => onDraftChange({ ...draft, alias_name: event.target.value, merge_entity_id: null })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                queueAliasName(draft.alias_name);
              }
            }}
            disabled={busy}
            placeholder={placeholder}
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary accumul8-icon-action"
          onClick={() => void onAddAlias()}
          disabled={busy || (pendingAliasNames.length === 0 && !String(draft.alias_name || '').trim())}
          title="Save queued aliases"
        >
          <span aria-hidden="true">💾</span>
        </button>
      </div>
      {pendingAliasNames.length > 0 ? <div className="accumul8-entity-alias-merge-note">Queued aliases: {pendingAliasNames.length}</div> : null}
      {showSuggestions && portalStyle && typeof document !== 'undefined' ? createPortal(
        <div
          ref={portalRef}
          className="accumul8-entity-alias-suggestions accumul8-entity-alias-suggestions--portal"
          role="listbox"
          aria-label={`Alias suggestions for ${entity.display_name}`}
          style={portalStyle}
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.entity_id}
              type="button"
              className={[
                'accumul8-entity-alias-suggestion',
                draft.merge_entity_id === suggestion.entity_id ? 'is-selected' : '',
              ].join(' ')}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={() => {
                queueAliasName(suggestion.alias_name);
              }}
              disabled={busy}
            >
              {suggestion.alias_name}
            </button>
          ))}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
