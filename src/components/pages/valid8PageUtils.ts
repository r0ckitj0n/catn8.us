import { Valid8VaultEntryWithSecrets } from '../../types/valid8';

export type SortColumn = 'title' | 'username' | 'email_address' | 'category' | 'owner_name' | 'is_active' | 'updated_at';

export interface EntryDraft {
  title: string;
  username: string;
  email_address: string;
  password: string;
  owner_name: string;
  category: string;
  is_active: number;
}

export function buildOwnerOptions(
  owners: Array<{ name?: string | null; is_archived?: number | null }>,
  entries: Array<{ owner_name?: string | null }>,
): string[] {
  const set = new Set<string>();
  owners.forEach((owner) => {
    const name = String(owner.name || '').trim();
    if (name && Number(owner.is_archived || 0) !== 1) {
      set.add(name);
    }
  });
  entries.forEach((entry) => {
    const name = String(entry.owner_name || '').trim();
    if (name) {
      set.add(name);
    }
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function buildCategoryOptions(
  categories: Array<{ name?: string | null; is_archived?: number | null }>,
  entries: Array<{ category?: string | null }>,
): string[] {
  const set = new Set<string>();
  categories.forEach((category) => {
    const name = String(category.name || '').trim();
    if (name && Number(category.is_archived || 0) !== 1) {
      set.add(name);
    }
  });
  entries.forEach((entry) => {
    const name = String(entry.category || '').trim();
    if (name) {
      set.add(name);
    }
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function filterValid8Entries(
  entries: Valid8VaultEntryWithSecrets[],
  ownerFilter: string,
  query: string,
): Valid8VaultEntryWithSecrets[] {
  const needle = query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (ownerFilter && String(entry.owner_name || '') !== ownerFilter) {
      return false;
    }
    if (!needle) {
      return true;
    }
    const haystack = [
      entry.title,
      entry.username,
      entry.password,
      entry.email_address,
      entry.category,
      entry.owner_name,
      entry.url,
      entry.notes,
      entry.source_tab,
      entry.source_document,
      Number(entry.is_active) === 1 ? 'active' : 'inactive',
    ].map((value) => String(value || '').toLowerCase()).join(' ');
    return haystack.includes(needle);
  });
}

export function compareEntries(
  a: Valid8VaultEntryWithSecrets,
  b: Valid8VaultEntryWithSecrets,
  sortBy: SortColumn,
  sortDir: 'asc' | 'desc',
): number {
  const direction = sortDir === 'asc' ? 1 : -1;
  let result = 0;
  if (sortBy === 'updated_at') {
    result = Date.parse(a.updated_at || '') - Date.parse(b.updated_at || '');
  } else if (sortBy === 'is_active') {
    result = Number(a.is_active || 0) - Number(b.is_active || 0);
  } else {
    result = String(a[sortBy] || '').localeCompare(String(b[sortBy] || ''), undefined, { sensitivity: 'base' });
  }
  if (result === 0) {
    result = String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base' });
  }
  return result * direction;
}

export function makeDraft(entry: Valid8VaultEntryWithSecrets): EntryDraft {
  return {
    title: String(entry.title || ''),
    username: String(entry.username || ''),
    email_address: String(entry.email_address || ''),
    password: String(entry.password || ''),
    owner_name: String(entry.owner_name || 'Unassigned'),
    category: String(entry.category || 'General'),
    is_active: Number(entry.is_active || 0) ? 1 : 0,
  };
}

export function isDirty(entry: Valid8VaultEntryWithSecrets, draft: EntryDraft): boolean {
  return String(entry.title || '') !== draft.title
    || String(entry.username || '') !== draft.username
    || String(entry.email_address || '') !== draft.email_address
    || String(entry.password || '') !== draft.password
    || String(entry.owner_name || 'Unassigned') !== draft.owner_name
    || String(entry.category || 'General') !== draft.category
    || Number(entry.is_active || 0) !== Number(draft.is_active || 0);
}

export function blankToNull(value: string): string | null {
  const trimmed = String(value || '').trim();
  return trimmed === '' ? null : trimmed;
}
