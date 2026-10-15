# Fabric8

Logged-in construction project desk at `/fabric8` (build wizard).

## Project photo sections

Project-level photo albums that are **not** build steps:

- Table `build_wizard_photo_sections` + `build_wizard_documents.photo_section_id` / `content_hash` / `meta_json` (additive).
- Files for section uploads live under `private/build-wizard/{project_id}/` (`Require all denied`); served only via authenticated `get_document`.
- UI: **Project Photos & Key Paperwork** groups documents by section title (e.g. `Pre-rough-in (historical)`).

## Agent API

`/api/fabric8_agent.php` — `X-Api-Key` / Bearer with `CATN8_ADMIN_TOKEN`, or secret hash `fabric8.agent.api_token_hash`.

Mint/rotate agent token (admin): `POST /api/fabric8_setup.php` with admin token → stores SHA-256 under `fabric8.agent.api_token_hash`. Compil8r helper writes plaintext once to `~/.local/state/catn8/fabric8/agent-api-token` (mode 600):

```bash
php scripts/fabric8/generate_api_token.php
```

| Action | Method | Notes |
|--------|--------|-------|
| `list_projects` | GET | id, title, document_count |
| `get_project` | GET | `project_id` + photo_sections |
| `list_photo_sections` | GET | `project_id` |
| `list_section_photos` | GET | `project_id`, optional `section_id` |
| `list_steps` / `backup_steps` | GET | step list / backup payload |
| `update_step` | POST JSON | title/description/dates/status/costs; `notes` adds (or `replace_note:true` / `note_id` replaces) |
| `create_step` | POST JSON | new step |
| `attach_step_document` | POST multipart | receipt/doc attach |
| `ensure_photo_section` | POST JSON | `{ project_id, title, notes? }` — idempotent by slug |
| `upload_section_photo` | POST multipart | `project_id`, `section_id` or `section_title`, `file`, `caption?`, `kind?`, `meta_json?` — **idempotent** on SHA-256 `content_hash` |
| `attach_labeled_photos` | POST | ensures section; upload files via `upload_section_photo` |

## Reminders / ICS sync (OFF by default)

Jul 28 2026 ~23:18 ET produced 89 Apple Reminders in “Cabin Build Tasks” with notes `catn8-event-<step_id>`. No live CalDAV/VTODO publisher remains; Compil8r m8rix jobs `cabin-calendar` / `helper-reminder` are disabled.

- Env kill-switch: `FABRIC8_REMINDERS_SYNC_ENABLED=0` (default)
- Feed endpoint: `/api/fabric8_reminders_feed.php` and `/*.ics` routes → **410** while off

Import helper (Compil8r):

```bash
php scripts/fabric8/import_pre_roughin_photos.php \
  --dir="$HOME/Documents/Home/91 Singletree Ln/Pre-Rough-In-Photos-Labeled-2026-10-13" \
  --project-id=14 \
  --base-url=https://catn8.us
```

Papa's Cabin project URL: https://catn8.us/fabric8?project_id=14
