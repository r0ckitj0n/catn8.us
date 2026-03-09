import React from 'react';
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
  const aliasKeys = React.useMemo(() => {
    const keys = new Set<string>();
    keys.add(normalizeKey(entity.display_name));
    entity.aliases.forEach((alias) => {
      keys.add(normalizeKey(alias.alias_name));
    });
    return keys;
  }, [entity]);
  const suggestions = React.useMemo(() => {
    const query = String(draft.alias_name || '').trim().toLowerCase();
    return entities
      .filter((candidate) => candidate.id !== entity.id)
      .map((candidate) => ({
        entity_id: candidate.id,
        alias_name: String(candidate.display_name || '').trim(),
        alias_key: normalizeKey(candidate.display_name),
      }))
      .filter((candidate) => candidate.alias_name !== '' && !aliasKeys.has(candidate.alias_key))
      .filter((candidate) => (query === '' ? true : candidate.alias_name.toLowerCase().includes(query)))
      .sort((a, b) => {
        const aLower = a.alias_name.toLowerCase();
        const bLower = b.alias_name.toLowerCase();
        const aStarts = query !== '' && aLower.startsWith(query) ? 0 : 1;
        const bStarts = query !== '' && bLower.startsWith(query) ? 0 : 1;
        if (aStarts !== bStarts) {
          return aStarts - bStarts;
        }
        return aLower.localeCompare(bLower);
      })
      .slice(0, 8);
  }, [aliasKeys, draft.alias_name, entities, entity.id]);

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  const showSuggestions = isFocused && suggestions.length > 0;

  return (
    <div className="accumul8-entity-aliases" ref={wrapperRef}>
      <div className="accumul8-entity-aliases-list">
        {entity.aliases.map((alias) => (
          <span key={alias.id} className="accumul8-entity-alias-chip">
            <span>{alias.alias_name}</span>
            <button type="button" className="accumul8-entity-alias-remove" onClick={() => void onRemoveAlias(alias.id)} disabled={busy} aria-label={`Remove alias ${alias.alias_name}`}>x</button>
          </span>
        ))}
      </div>
      <div className="accumul8-entity-alias-add">
        <div className="accumul8-entity-alias-input-wrap">
          <input
            className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text accumul8-inline-editor--muted"
            value={draft.alias_name}
            onFocus={() => setIsFocused(true)}
            onChange={(event) => onDraftChange({ alias_name: event.target.value, merge_entity_id: null })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void onAddAlias();
              }
            }}
            disabled={busy}
            placeholder={placeholder}
            autoComplete="off"
          />
          {showSuggestions ? (
            <div className="accumul8-entity-alias-suggestions" role="listbox" aria-label={`Alias suggestions for ${entity.display_name}`}>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.entity_id}
                  type="button"
                  className={[
                    'accumul8-entity-alias-suggestion',
                    draft.merge_entity_id === suggestion.entity_id ? 'is-selected' : '',
                  ].join(' ')}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onDraftChange({ alias_name: suggestion.alias_name, merge_entity_id: suggestion.entity_id });
                    setIsFocused(false);
                  }}
                  disabled={busy}
                >
                  {suggestion.alias_name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary accumul8-icon-action"
          onClick={() => void onAddAlias()}
          disabled={busy || !String(draft.alias_name || '').trim()}
          title={draft.merge_entity_id ? 'Merge the selected name into this entity and save it as an alias' : 'Save alias'}
        >
          +
        </button>
      </div>
    </div>
  );
}
