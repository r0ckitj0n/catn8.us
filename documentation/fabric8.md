# Fabric8

Logged-in construction project desk at `/fabric8` (build wizard).

## Project photo sections

Project-level photo albums that are **not** build steps:

- Table `build_wizard_photo_sections` + `build_wizard_documents.photo_section_id` / `content_hash` / `meta_json` (additive).
- Files for section uploads live under `private/build-wizard/{project_id}/` (`Require all denied`); served only via authenticated `get_document`.
- UI: **Project Photos & Key Paperwork** groups documents by section title (e.g. `Pre-rough-in (historical)`).

## Agent API

`/api/fabric8_agent.php` — `X-Api-Key` / Bearer with `CATN8_ADMIN_TOKEN`, or secret hash `fabric8.agent.api_token_hash`.

| Action | Method | Notes |
|--------|--------|-------|
| `list_projects` | GET | id, title, document_count |
| `get_project` | GET | `project_id` + photo_sections |
| `list_photo_sections` | GET | `project_id` |
| `list_section_photos` | GET | `project_id`, optional `section_id` |
| `ensure_photo_section` | POST JSON | `{ project_id, title, notes? }` — idempotent by slug |
| `upload_section_photo` | POST multipart | `project_id`, `section_id` or `section_title`, `file`, `caption?`, `kind?`, `meta_json?` — **idempotent** on SHA-256 `content_hash` |
| `attach_labeled_photos` | POST | ensures section; upload files via `upload_section_photo` |

Import helper (Compil8r):

```bash
php scripts/fabric8/import_pre_roughin_photos.php \
  --dir="$HOME/Documents/Home/91 Singletree Ln/Pre-Rough-In-Photos-Labeled-2026-10-13" \
  --project-id=14 \
  --base-url=https://catn8.us
```

Papa's Cabin project URL: https://catn8.us/fabric8?project_id=14
