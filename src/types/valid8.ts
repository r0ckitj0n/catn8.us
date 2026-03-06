export interface Valid8VaultEntry {
  id: string;
  user_id: string;
  title: string;
  url: string | null;
  category: string;
  owner_name: string;
  email_address: string | null;
  is_favorite: number;
  password_strength: number;
  is_active: number;
  replaced_by_entry_id: string | null;
  source_tab: string | null;
  source_document: string | null;
  last_changed_at: string;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Valid8VaultEntryCreateRequest {
  user_id: string;
  title: string;
  url?: string | null;
  username: string;
  password: string;
  notes?: string | null;
  category: string;
  owner_name?: string;
  is_favorite?: number;
  password_strength?: number;
  source_tab?: string | null;
  source_document?: string | null;
  last_changed_at?: string;
}

export interface Valid8VaultEntrySecretPayload {
  username: string;
  password: string;
  notes: string | null;
}

export interface Valid8VaultEntryWithSecrets extends Valid8VaultEntry, Valid8VaultEntrySecretPayload {}

export interface Valid8VaultAttachment {
  id: string;
  entry_id: string;
  user_id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  download_url: string;
}

export interface Valid8VaultListResponse {
  success: boolean;
  entries: Valid8VaultEntryWithSecrets[];
  include_inactive: number;
}

export interface Valid8VaultAttachmentListResponse {
  success: boolean;
  attachments: Valid8VaultAttachment[];
}

export interface Valid8VaultAttachmentUploadResponse {
  success: boolean;
  attachment: Valid8VaultAttachment;
}

export interface Valid8VaultEntryUpdateRequest {
  entry_id: string;
  title?: string;
  url?: string | null;
  notes?: string | null;
  username?: string;
  password?: string;
  owner_name?: string;
  category?: string;
  email_address?: string | null;
  is_active?: number;
  source_tab?: string | null;
  source_document?: string | null;
}

export interface Valid8VaultEntryMutationResponse {
  success: boolean;
  entry?: Valid8VaultEntryWithSecrets;
  archived?: number;
  deleted?: number;
}

export interface Valid8LookupItem {
  id: string;
  user_id: string;
  name: string;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

export interface Valid8OwnersListResponse {
  success: boolean;
  owners: Valid8LookupItem[];
}

export interface Valid8CategoriesListResponse {
  success: boolean;
  categories: Valid8LookupItem[];
}

export interface Valid8OwnerMutationResponse {
  success: boolean;
  owner?: Valid8LookupItem;
  archived?: number;
  deleted?: number;
}

export interface Valid8CategoryMutationResponse {
  success: boolean;
  category?: Valid8LookupItem;
  archived?: number;
  deleted?: number;
}
