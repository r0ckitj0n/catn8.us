# Rel8d

Private family-tree hub at https://catn8.us/rel8d owned by agent Rel8r for Jon Graves (admin) and opted-in `rel8d-users`.

## Access

- Page entry: `rel8d.php` (group `rel8d-users` or site admin). Logged-out users redirect to `/login`.
- Menu: `REL8D` appears when `is_rel8d_user` or admin (from `/api/auth/me.php`).
- `X-Robots-Tag: noindex, nofollow` on the page and media endpoints; `/rel8d` is Disallow’d in `robots.txt`.
- Living people (no death record and born within the last 100 years) default to private and are hidden from non-admin roles.
- Media lives under `private/rel8d/` and is served only by `/api/rel8d_media.php` (session, agent bearer / `X-Api-Key`, or short-lived signed URL).

## Browser API

`/api/rel8d.php?action=...` (session + CSRF on mutations)

| Action | Method | Notes |
|--------|--------|-------|
| `bootstrap` / `dashboard` | GET | counts, on-this-day, surnames |
| `list_people` / `search` | GET | `q`, `surname`, paging |
| `get_person` | GET | timeline, sources, notes, media |
| `pedigree` / `family_group` / `descendants` | GET | tree charts |
| `relationship` | GET | `from_id`, `to_id` |
| `quality_flags` / `on_this_day` / `map_places` / `dna` | GET | |
| `list_media` / `list_stories` / `list_audit` | GET | audit admin-only |
| `export_gedcom` | GET | download |
| `upsert_person` / `add_note` / `add_source` | POST | `dry_run` supported |
| `import_preview` / `import_apply` | POST | multipart GEDCOM + diff |
| `upload_media` / `save_dna` / `geocode_places` / `set_root` / `rebuild_quality` | POST | |

## Agent API (Rel8r)

Endpoint: `https://catn8.us/api/rel8d_agent.php?action=...`

Auth: `Authorization: Bearer <token>`, `X-Rel8d-Agent-Token`, or `X-Api-Key`.

Token hash secret key: `rel8d.agent.api_token_hash`  
Token file on Compil8r (mode 600): `/Users/jongraves/.local/state/catn8/rel8d/agent-api-token`  
Generate/rotate: `php scripts/rel8d/generate_api_token.php` (does not print the token) or `POST /api/rel8d_setup.php?admin_token=...`.

### Actions

| Action | Method | Notes |
|--------|--------|-------|
| `list` / `search` / `get` / `dashboard` / `pedigree` / `relationship` / `quality_flags` | GET | |
| `upsert_person` / `add_note` / `add_source` | POST | `dry_run` writes nothing |
| `import_preview` / `import_apply` | POST | `dry_run` on preview returns counts only |

## GEDCOM

Full 5.5.1 import preserves the nested tag tree in `raw_json` (individuals, families, events/attributes including custom `_` tags, sources/citations with PAGE/QUAY, OBJE refs, alternate names, relationship pedigree). Re-import shows a diff before apply. Export rebuilds from stored raw trees.

## Tests

```bash
php scripts/rel8d/synthetic_smoke_test.php
```

Uses `tests/fixtures/rel8d/synthetic.ged` only — never commit real genealogy files.

## Legacy path

`/rel8ed` and `/rel8ed/*` 301-redirect to `/rel8d` (and the matching subpath). The Rel8r bot-store data folder remains `/cursor/stores/bot/rel8ed/` and is not renamed.
