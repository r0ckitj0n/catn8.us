# Litig8

Private legal-matter hub at https://catn8.us/litig8 for Jon Graves (admin) and opted-in litig8-users.

## Access

- Page entry: `litig8.php` (group `litig8-users` or site admin). Logged-out users redirect to `/login`.
- Menu: `LITIG8` appears only when `is_litig8_user` or admin (from `/api/auth/me.php`).
- Documents live under `private/litig8/` (outside webroot) and are served only by `/api/litig8_media.php` (session, agent bearer, or short-lived signed URL). Retired files move to `private/litig8/retired/Y/m/`.
- Sensitive fields (`ssn`, `account_number`, `case_number`, `claim_number`) are encrypted at rest via `secret_encrypt` and masked in UI (last 4). Admin reveal is audited.

## Browser API

`/api/litig8.php?action=...` (session + CSRF on mutations)

| Action | Method | Notes |
|--------|--------|-------|
| `bootstrap` | GET | entities + categories; ensures schema |
| `dashboard` | GET | upcoming/overdue deadlines, open matters by category, recent events, true `*_total` counts |
| `list` | GET | `entity`, optional `matter_id`, `limit` (1–1000), `offset` or `cursor`. Returns `records`, `total`, `limit`, `offset`, `next` |
| `get` | GET | `entity`, `id`. Rows include `documents[]` when linked. Document rows include `links[]` |
| `upsert` | POST | `{ entity, record }` |
| `delete` | POST | `{ entity, id or external_source_id, hard? }`. Default `hard=true` |
| `link_document` | POST | `{ document_id, entity, record_id or external_source_id, role?, note?, dry_run? }` |
| `unlink_document` | POST | `{ document_id, entity, record_id or external_source_id, dry_run? }` |
| `reveal_sensitive` | POST | admin only, audited |
| `upload_document` | POST multipart | `file`, `title`, optional `owner_user_id`, `doc_type`, `external_source_id` / `source_id`, `source_json`, `links` JSON |
| `list_audit` | GET | admin |

## Agent API (Litig8r)

Endpoint: `https://catn8.us/api/litig8_agent.php?action=...`

Auth: `Authorization: Bearer <token>` (or `X-Litig8-Agent-Token`).

Token hash secret key: `litig8.agent.api_token_hash`  
Token file on Compil8r (mode 600): `/Users/jongraves/.local/state/catn8/litig8/agent-api-token`  
Generate/rotate: `php scripts/litig8/generate_api_token.php` (does not print the token).

### Actions

| Action | Method | Body / query |
|--------|--------|--------------|
| `import` | POST | `{ "entity": "<type>", "records": [ ... ], "dry_run": false }` |
| `upsert` | POST | `{ "entity": "<type>", "record": { ... }, "dry_run": false }` |
| `delete` | POST | `{ "entity": "<type>", "id": 1 }` or `{ "entity": "<type>", "external_source_id": "..." }`. Optional `hard` (default `true`) |
| `upload_document` | POST multipart | `file`, `title`, optional `owner_user_id`, `doc_type`, `external_source_id` / `source_id`, `source_json`, `links` JSON array |
| `link_document` | POST | `{ "document_id": 12, "entity": "matters", "record_id": 44 }` or `external_source_id`. Optional `role`, `note`, `dry_run` |
| `unlink_document` | POST | `{ "document_id": 12, "entity": "matters", "record_id": 44 }` (or `external_source_id`). Optional `dry_run` |
| `list` | GET | `entity`, optional `matter_id`, `limit`, `offset` / `cursor` |
| `get` | GET | `entity`, `id` or `external_source_id` |
| `dashboard` | GET | upcoming deadlines, open matters by category, recent events, totals |
| `cleanup_duplicates` | POST | deletes synthetic test rows; returns counts |

`import` / `upsert` matching order:

1. Match by `external_source_id` / `source_id` if provided and a live row has that key → **UPDATE**
2. Else match by `id` if provided and that row exists → **UPDATE**
3. Else **CREATE**

Returns `created`, `updated`, `error_count`, `errors[]`, `results[]`.

`dry_run` on `import` / `upsert` / `link_document` / `unlink_document` writes **nothing** — including `litig8_sources` and audit rows.

### Nested matter import

A `matters` record may include nested arrays that are normalized into child tables after the matter upsert:

```json
{
  "entity": "matters",
  "dry_run": true,
  "records": [
    {
      "external_source_id": "synthetic:matter:cabin-permit-1",
      "title": "Cabin shed permit (synthetic)",
      "category": "cabin permits/zoning",
      "status": "open",
      "case_number": "CASE-SYN-001",
      "claim_number": "CLM-SYN-001",
      "summary": "Synthetic zoning matter for smoke tests only.",
      "key_dates": [
        { "date": "2026-08-01", "title": "Application filed" }
      ],
      "deadlines": [
        { "due_at": "2026-11-01", "title": "Hearing response due", "status": "open" }
      ],
      "parties": [
        { "name": "Synthetic Opposing LLC", "role": "opposing", "contact_type": "opposing" }
      ],
      "attorneys": [
        { "name": "Ada Counsel (synthetic)", "role": "counsel", "organization": "Counsel & Co" }
      ],
      "source": {
        "source_type": "manual",
        "record_type": "matters",
        "record_id": "cabin-permit-1",
        "message_date": "2026-08-01"
      }
    }
  ]
}
```

- `key_dates[]` → `events` (`event_date` from `date` / `event_date`, `title` from `title` / `label`)
- `deadlines[]` → `deadlines` (matter_id set)
- `parties[]` / `attorneys[]` → `contacts` + `matter_contacts`

Response includes `nested_results` counts when nested arrays are present.

### Document upsert and links

`upload_document` with an existing `external_source_id` **upserts** metadata; replaces the file only when SHA-256 differs; retires the previous file under `private/litig8/retired/`.

`links` JSON:

```json
[
  { "entity": "matters", "record_id": 44, "role": "pleading" },
  { "entity": "deadlines", "external_source_id": "synthetic:deadline:1" }
]
```

### Import format (common)

Every record may include either:

- nested `source`: `{ source_type, account, thread_id, message_id, message_date, file_path, record_type, record_id, note }`, or
- flat citation fields: `source_type`, `source_account` / `account`, `thread_id`, `message_id`, `message_date` / `record_date`, `source_file` / `file_path`, `record_type`, `record_id`

Dedupe key: `external_source_id` (preferred) or `source_id`.

### Entity fields (required bold)

- **matters**: **title**; optional `owner_user_id` (defaults to primary admin), `category` / `category_slug`, `status`, `case_number`, `claim_number`, `parties_summary`, `attorneys_summary`, `summary`, nested `key_dates` / `deadlines` / `parties` / `attorneys`, `external_source_id`, nested `source`
- **events**: **matter_id**, **event_date**, **title**; optional description, location
- **deadlines**: **due_at**, **title**; optional matter_id, description, status, completed_at
- **contacts**: **name**; optional `owner_user_id`, `contact_type` (`attorney|adjuster|agency|opposing|party|other`), organization, role_title, phone, email, address, notes, `ssn`, `account_number`
- **matter_contacts**: **matter_id**, **contact_id**; optional role, notes
- **documents**: prefer `upload_document`; metadata upsert needs **title**, **file_path**, `owner_user_id`
- **categories**: **slug**, **label**; optional sort_order, active, `external_source_id`, nested `source` / `source_ref_id`
- **sources**: citation upsert via nested/flat fields on other entities

`dry_run` on `import` / `upsert` executes the same INSERT/UPDATE SQL inside a rolled-back transaction (so a missing column cannot pass dry_run and fail on apply). Medic8’s dry_run still short-circuits before SQL — same class of gap there if you import entities whose columns are missing.

Default categories (editable): disputes, contracts, property-deeds, cabin-permits-zoning, estate, tax, business-filings, insurance-claims, disability-legal, citations.

## Security notes

- No real case data in git, logs, or fixtures. Tests use synthetic data only; clean up with `cleanup_duplicates` / `deleteSyntheticTestRows`.
- Audit log is append-only for create/update/delete/soft_delete/reveal/document view/link/unlink.
- Live migrations are additive. Do not DROP tables or wipe existing rows except documented synthetic cleanup.
