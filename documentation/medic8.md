# Medic8

Private medical record hub at https://catn8.us/medic8 for Jon Graves (admin) and opted-in family/friends.

## Access

- Page entry: `medic8.php` (group `medic8-users` or site admin). Logged-out users redirect to `/login`.
- Menu: `MEDIC8` appears only when `is_medic8_user` or admin (from `/api/auth/me.php`).
- Per-person visibility uses `medic8_shares` (category + role). Default deny. `sensitivity=high` needs `include_high_sensitivity=1` even when category is `all`.
- Sensitive fields (`ssn`, `medicare_number`, `member_id`, `group_no`, `rx_number`, `case_number`) are encrypted at rest via `secret_encrypt` and masked in UI (last 4). Admin reveal is audited.
- Documents live under `private/medic8/` (outside webroot) and are served only by `/api/medic8_media.php` (session, agent bearer, or short-lived signed URL).

## Browser API

`/api/medic8.php?action=...` (session + CSRF on mutations)

| Action | Method | Notes |
|--------|--------|-------|
| `bootstrap` | GET | people list, ensures Jon person for admin |
| `dashboard` | GET | `person_id` |
| `emergency_summary` | GET | printable med/allergy/condition summary |
| `list` | GET | `entity`, optional `person_id` |
| `get` | GET | `entity`, `id` |
| `upsert` | POST | `{ entity, record }` |
| `delete` | POST | `{ entity, id }` |
| `reveal_sensitive` | POST | admin only, audited |
| `upload_document` | POST multipart | `file`, `person_id`, `title`, optional `doc_type`, `source_json` |
| `list_audit` | GET | admin |

## Agent API (Medic8r)

Endpoint: `https://catn8.us/api/medic8_agent.php?action=...`

Auth: `Authorization: Bearer <token>` (or `X-Medic8-Agent-Token`).

Token hash secret key: `medic8.agent.api_token_hash`  
Token file on Compil8r (mode 600): `~/.local/state/catn8/medic8/agent-api-token`  
Generate/rotate: `php scripts/medic8/generate_api_token.php` (does not print the token).

### Actions

| Action | Method | Body / query |
|--------|--------|--------------|
| `import` | POST | `{ "entity": "<type>", "records": [ ... ], "dry_run": false }` |
| `upsert` | POST | `{ "entity": "<type>", "record": { ... }, "dry_run": false }` |
| `upload_document` | POST multipart | `file`, `person_id`, `title`, optional `doc_type`, `external_source_id` / `source_id`, `source_json` |
| `list` | GET | `entity`, optional `person_id` |
| `get` | GET | `entity`, `id` |
| `list_people` | GET | |
| `dashboard` | GET | `person_id` |

`import` is idempotent upsert keyed by `external_source_id` (alias `source_id`). Returns `created`, `updated`, `error_count`, `errors[]`, `results[]`.

### Import format (common)

Every clinical/financial record may include either:

- nested `source`: `{ source_type, account, thread_id, message_id, message_date, file_path, record_type, record_id, note }`, or
- flat citation fields: `source_type`, `source_account` / `account`, `thread_id`, `message_id`, `message_date` / `record_date`, `source_file` / `file_path`, `record_type`, `record_id`

Dedupe key: `external_source_id` (preferred) or `source_id`. Stable across re-imports (e.g. FHIR id, Gmail message id + record type).

### Entity fields (required bold)

- **people**: **owner_user_id**, **display_name**; optional `catn8_user_id`, `relation_to_admin`, `dob`, `sensitivity_default`, `is_opted_in`
- **providers**: **name**; optional `person_id` (null = shared), specialty/practice/phone/fax/email/address/portal_*, `active`
- **medications**: **person_id**, **name**; optional generic_name, strength, dose_per_admin, frequency, schedule_json, route, prn, indication, status, sensitivity, prescriber_provider_id, pharmacy_provider_id, `rx_number`, dates, days_supply, qty, refills_left, next_refill_due, auto_refill, notes, confidence
- **med_fills**: **medication_id**, **fill_date**; optional qty, days_supply, pharmacy_id, cost
- **appointments**: **person_id**, **starts_at**; optional provider_id, location, purpose, status, telehealth_url, notes
- **conditions**: **person_id**, **name**; optional status, onset_date, sensitivity, notes, confidence
- **allergies**: **person_id**, **allergen**; optional reaction, status, recorded_at
- **labs**: **person_id**, **test**; optional category(`lab|vital|imaging`), taken_at, value, unit, ref_range, flag
- **procedures**: **person_id**, **name**; optional performed_at, impression, document_id
- **encounters**: **person_id**; optional occurred_at, provider_id, encounter_type, summary
- **disability_events**: **person_id**; optional event_date, program(`SSA|TRS|other`), event_type, description, `case_number`
- **insurance**: **person_id**, **plan_name**; optional carrier, plan_type, `member_id`, `group_no`, `medicare_number`, `ssn`, effective_from/to, phone, notes
- **documents**: prefer `upload_document`; metadata upsert needs **person_id**, **title**, **file_path**
- **portal_messages**: **person_id**; optional sent_at, direction, provider_id, subject, summary
- **invoices**: **person_id**; optional `date`/`invoice_date`, provider_id, items_json, amount, status
- **shares**: **owner_person_id**, **grantee_user_id**; optional category, role, include_high_sensitivity, expires_at, revoked_at

Plaintext sensitive aliases (`member_id`, `ssn`, …) are encrypted into `*_enc` columns.

### Example

```json
{
  "entity": "medications",
  "dry_run": true,
  "records": [
    {
      "external_source_id": "fhir:MedicationRequest/example-1",
      "person_id": 1,
      "name": "Examplecillin",
      "strength": "10 mg",
      "dose_per_admin": "10 mg",
      "frequency": "daily",
      "status": "current",
      "last_fill_date": "2026-09-01",
      "days_supply": 30,
      "source": {
        "source_type": "portal_export",
        "record_type": "MedicationRequest",
        "record_id": "example-1",
        "message_date": "2026-09-01"
      }
    }
  ]
}
```

## Security notes

- No PHI in git, logs, or fixtures. Tests use synthetic data only.
- Audit log is append-only for create/update/delete/reveal/document view.
- Do not load real patient data via agents except Medic8r through this API.
