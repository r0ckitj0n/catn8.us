# Celebr8

Logged-in party planning section at `/celebr8`.

## Access

- Menu link **CELEBR8** appears only when the browser session is authenticated.
- `celebr8.php` redirects anonymous users to `/login?redirect=/celebr8`.
- Session API `/api/celebr8.php` returns **401** when anonymous.
- Event/guest edits, Ask Celebr8r, groups, and text queueing require **admin** (and CSRF) on the session API.
- Non-admin signed-in users can view events, guests, totals, and request threads.

## Ask Celebr8r flow

Jon’s AI party agent is **Celebr8r**. Texting is driven by asks, not a bulk compose box.

1. Jon (or admin) submits an ask from the party page or Celebr8 home **Ask Celebr8r** panel.
2. Row lands in `celebr8_requests` with `status=pending` (optional audience: guests / RSVP / group; “Show me before sending”).
3. Compil8r relay (`celebr8-text-relay.py`, once-mode every 60s) finishes any queued iMessages, then lists pending requests and POSTs a minimal wake to the Grok Bot routine webhook.
4. Relay marks the request `notified` (retries only if stuck in `notified` &gt; 15 minutes, at most 3 wakes).
5. Celebr8r claims the request (`working`), posts thread replies, optionally queues outbox texts with `request_id`, and sets `needs_jon` / `done` / `failed`.
6. A Jon follow-up in the thread sets the request back to `pending` so the relay wakes Celebr8r again.

Secondary escape hatch on the party page: **Send exact text** queues one guest with a fixed body.

## Guest groups

Named subsets per party (`celebr8_guest_groups` + members). Editable from the party guest list (**Groups** button and per-guest checkboxes). Celebr8r and Jon can target a group as ask audience.

## Tabul8 (live voting)

Live party voting (camera, big screen, public vote link, face-deduped votes) lives in **[documentation/tabul8.md](./tabul8.md)**. Request type `tabul8_label` is woken by the existing relay `list_pending_requests` (all pending types). Agent actions: `get_tabul8_board`, `list_tabul8_categories`, `list_tabul8_entries`, `get_tabul8_entry`, `set_tabul8_label`.

## Agent API

`/api/celebr8_agent.php` — Bearer token (or `X-Celebr8-Agent-Token`).

Party / catalog (existing):

- `GET list_events` / `get_event` / `list_guests`
- `GET list_templates` / `get_template` / `list_activities` / `get_activity` / `list_event_activities`

Activity detail fields (on `list_activities` / `get_activity` / `upsert_activity` / `copy_activity`):

- Narrative: `summary`, `objective`, `how_to_play[]`, `setup_instructions[]`, `teardown[]`, `rules_scoring`, `winning_notes`, `tips`, `variations[]`, `safety_notes`, `tech_needs`, `volunteers_needed`
- Supplies: legacy `supplies[]` plus structured `supplies_detail[]` (`item`, `qty`, `unit_cost_est`, `notes`, `have`)
- Comparison: `estimated_cost_low` / `estimated_cost_high` (2026 USD estimates), `setup_minutes`, `play_minutes`, `cleanup_minutes`, `min_players`, `max_players`, `age_range`, `kid_friendly`, `location_type` (`indoor`|`outdoor`|`both`), `space_needed`, `energy_level`, `mess_level`
- Senior / seated: `senior_friendly` (0|1), `seated_play` (0|1), `mobility_level` (`none`|`low`|`moderate`|`high`), `hearing_vision_notes`, `senior_role` (how older guests take part — judges, timekeepers, seated play, etc.)
- Printables: `printables[]` with `title`, `kind`, `content` (scorecards, ballots, signs, clue/bingo cards, large-print sheets, etc.). Titles containing “LARGE PRINT” (and scorecards/ballots) render at 18pt+ when printed.
- Meta: `details_filled_at`, `details_source`, `has_details`

UI:

- Library `/celebr8/activities` — click any activity; Cards or Compare table (sortable cost/time/players/kids/senior/seated/mobility/location/mess/energy/holiday); **Senior-friendly** / **Seated** filter chips; CSV export + print table
- Detail `/celebr8/activities/:id` — full read-only detail (including Elders’ role + hearing/vision notes) with **Edit**, **Copy**, and **Print** menu (Setup sheet, How to Play sheet, each printable, Print All)
- Party page — activity names link to detail; **Something for everyone** hint when picks lack a seated option; activity picker has Senior-friendly / Seated filters; **Print packet** prints setup/play/printables for every activity on that party. Does **not** auto-change Annual Halloween Bash picks.

Idempotent backfill (empty fields only): `php scripts/celebr8/backfill_activity_details.php --via-agent --apply`

Senior seated games seed (new activities + fill empty `senior_role` / set senior flags when currently off): `php scripts/celebr8/seed_senior_activities.php --via-agent --apply`
- `POST update_event` / `create_event` / `delete_event` / `duplicate_event`
- `POST upsert_guest` / `set_rsvp` / `set_rsvp_note` / `record_historical_invite`
- Catalog write actions for templates and activities

Guest RSVP history:

- `POST set_rsvp_note` — append one RSVP history row; optionally update the guest’s **current** status in the same call.
  - Fields: `guest_id` **or** `phone`, `party_id` (alias `event_id`), `status` (optional), `note` (short), `quote` (exact quoted text), `received_at`, `source` (`text`|`site`|`manual`), `message_guid` (dedupe key; repeat guid does not insert a second row).
  - `status` rules:
    - `going`|`maybe`|`not_going` (alias `cant_go` → `not_going`): write history **and** update the guest’s current RSVP.
    - `reaction`: store `reaction` on the history row only; **do not** change the guest’s current status (for tapbacks).
    - omitted, empty, or `unchanged`: write a history row using the guest’s **current** status value; **do not** change the guest’s current status.
  - Response: `guest`, `note`, `deduped`, `status_updated`, `totals`.
- `GET list_rsvp_history` — `guest_id` required; optional `party_id` / `event_id`, `limit`. Returns `history[]` with `status`, `note`, `quote`, `received_at`, `source`, `message_guid`.

Celebr8r requests:

- `GET list_requests` — default `status=pending,notified` (override with `status=`, optional `party_id`, `limit`)
- `GET get_request` — `request_id`; returns `request` (includes `request_type` / `type` and `payload` when set), `thread`, `outbox`
- `POST claim_request` — `{ request_id, claimed_by? }` → `working`
- `POST reply_request` — `{ request_id, body, author_role?: celebr8r|system, status? }`
- `POST set_request_status` — `{ request_id, status }` (`pending`|`notified`|`working`|`needs_jon`|`done`|`failed`)
- `POST delete_request` — `{ request_id }`
- `POST queue_outbound_texts` — `{ request_id, messages: [{ guest_id?|phone?, body }] }`  
  Enforces JT Whetstone blocklist and a per-request queue cap (default **50**, override secret `celebr8.queue_cap_per_request` or env `CELEBR8_QUEUE_CAP_PER_REQUEST`).

Guest groups:

- `GET list_guest_groups` / `get_guest_group`
- `POST upsert_guest_group` / `delete_guest_group`

Photo albums (one album per party; private storage):

- `GET get_album` — `party_id` or `album_id` (creates on demand when resolving by `party_id`). Album includes `cover_photo_id` / `cover_url`.
- `GET list_photos` — `party_id` or `album_id`, optional `limit` (default 200). Returns `album` + `photos` ordered by `sort_order`, with short-lived `thumb_url` / `url` / `original_url` (≈15 min) and `is_cover`.
- `POST ensure_album` — JSON `{ party_id, title? }`
- `POST upload_photo` — **multipart/form-data** (not JSON):
  - `file` (required; also accepts `photo` or `image`)
  - `party_id` or `album_id` (one required; `event_id` alias for party)
  - `caption` (optional)
  - `capture_time` (optional ISO/MySQL datetime; EXIF DateTimeOriginal used if omitted)
  - `source_uuid` (optional; dedupe key within album)
  - Response includes `photo`, `album`, `deduped`, `dedupe_reason` (`source_uuid`|`content_hash`|null)
- `POST update_photo` — JSON `{ photo_id, caption?, capture_time? }`
- `POST set_cover_photo` — JSON `{ photo_id }` — sets album cover; party cards use it as `flyer_image_url` (session media URL)
- `POST clear_cover_photo` — JSON `{ party_id }` or `{ album_id }`
- `POST reorder_photos` — JSON `{ photo_ids: number[], party_id?|album_id? }` — full ordered id list for that album
- `POST move_photo` — JSON `{ photo_id }` or `{ photo_ids: number[] }`, plus required `to_party_id` (alias `destination_party_id`)
- `POST delete_photo` — JSON `{ photo_id }` or `{ photo_ids: number[] }` (bulk delete)

Limits: images only (jpeg/png/webp/gif), max **25 MB**. EXIF GPS is stripped on store; capture time is kept in the DB. Dedupe is per-album on `source_uuid` and on SHA-256 `content_hash`.

Media URL: `/api/celebr8_media.php?photo={id}&v={thumb|web|original}&exp={unix}&sig={hmac}` — also accepts session cookie or agent bearer without a signature. Direct hits on `private/celebr8/...` return **403**. Party card covers use the session form (`?photo=&v=web`) so they do not expire while logged in.

Printable party flyers (private storage under `private/celebr8/flyers/`):

- `GET get_flyer` — `party_id` (optional `history=0`). Returns `has_flyer`, `flyer`, `versions`/`history`, `flyer_brief`, `flyer_style_notes`, `legacy_url`, `active_flyer_request`.
  - Legacy: if `celebr8_events.flyer_image_url` is a non-media invite path and no current private flyer (e.g. Halloween 2026), that image is the flyer (`source=legacy`).
- `GET list_flyer_versions` — `party_id` → `{ versions: [...] }` (all private/archived versions, newest first).
- `POST upload_flyer` — **multipart/form-data**:
  - `file` (required; also `flyer`|`image`|`photo`)
  - `party_id` (required; `event_id` alias)
  - Replaces current; previous current becomes a history version (`is_current=0`).
- `POST update_flyer_brief` — JSON `{ party_id, flyer_brief?, flyer_style_notes? }` (aliases `brief`, `style_notes`) — saved on the party for the next request.
- `POST delete_flyer` — JSON `{ party_id }` — removes current flyer (confirm in UI); keeps history / archives legacy URL for restore. Does **not** wipe version rows.
- `POST restore_flyer_version` — JSON `{ flyer_id }` — makes that version current; previous current stays in history.
- `POST request_flyer` — JSON `{ party_id, style_notes?/extra_notes?, regenerate? }`:
  - `request_type` / `type` = **`flyer`**
  - Without `regenerate`: refuses if a flyer already exists; uses saved brief/notes (+ optional notes).
  - With `regenerate: true`: keeps the current flyer, queues a new job from saved brief + saved style notes + extra notes (e.g. “more purple”). Dedupes while `pending`|`notified`|`working`.
- `GET list_requests` / `get_request` include `request_type` and alias `type` (`text`|`flyer`|`rsvp`|`tabul8_label`|`tabul8_costume_name`). Filter with `type=` / `request_type=`. For `rsvp`, `request.payload` is the inbound reply array; for `tabul8_label`, payload includes `entry_id`, `party_id`, `category`, `photo_url`; for `tabul8_costume_name`, payload includes `party_id`, `guest_id`, `identity_id?`, `photo_id`, short-lived signed `photo_url` (kiosk frame in party album), `subtype=costume_name` — Celebr8r replies with `set_tabul8_costume_name`.

Flyer media: `/api/celebr8_media.php?flyer={id}&v={web|original}&exp=&sig=` (session/agent also OK without sig).

Token hash key in `secrets`: `celebr8.agent.api_token_hash`.

Generate locally (against local DB secret store):

```bash
php scripts/celebr8/generate_api_tokens.php --agent-only
```

Mint / rotate on **live** (admin token):

```bash
curl -X POST "https://catn8.us/api/celebr8_setup.php?admin_token=$CATN8_ADMIN_TOKEN"
```

Plaintext paths on this Mac (gitignored; never commit):

- `/Users/coden8r/agent-work/catn8.us/.local/state/celebr8/agent-api-token`
- `/Users/coden8r/.local/state/catn8/celebr8/agent-api-token`

## Session API (browser)

`/api/celebr8.php` — session + CSRF for writes.

Extra actions for Ask Celebr8r / groups:

- `GET list_requests` / `get_request`
- `POST create_request` / `reply_request` (Jon follow-up → `pending`)
- `GET list_guest_groups` / `get_guest_group`
- `POST upsert_guest_group` / `delete_guest_group`
- `GET list_rsvp_history` — same fields as agent; party guest modal shows history (exact quote + received time) when Jon clicks a guest

Photo albums (same contracts as agent API; writes require admin + CSRF):

- `GET get_album` / `list_photos`
- `POST ensure_album` / `upload_photo` (multipart fields above)
- `POST update_photo` / `set_cover_photo` / `clear_cover_photo` / `reorder_photos` / `move_photo` / `delete_photo`

Printable flyers (session + CSRF for writes):

- `GET get_flyer` / `list_flyer_versions`
- `POST upload_flyer` / `update_flyer_brief` / `delete_flyer` / `restore_flyer_version` / `request_flyer`

Party page UI: **Flyer** left of Edit / Send exact text. Modal is US Letter portrait with Print. Empty state (no flyer, no pending request): optional style notes + **Create Flyer** only — nothing is queued until that button is pressed (no auto-request on open; no missing-image error). Admin controls when a flyer exists: upload/replace, edit/save brief + style notes, delete (history kept), view/restore versions, regenerate (`type=flyer`, keeps current until `upload_flyer`).

Admin UI on each party page: multi-file upload (phone camera roll / desktop), gallery + lightbox, caption edit, set cover, reorder (↑↓ or drag), move to another party, delete one or selected many.

## Relay API (iMessage outbox + Celebr8r wake)

`/api/celebr8_relay.php` — Bearer token (or `X-Celebr8-Relay-Token`).

Actions:

- `GET fetch_queued`
- `POST claim` (`message_ids`, optional `claimed_by`) — atomic `queued` → `claimed`
- `POST mark_sent` / `mark_failed`
- `GET list_pending_requests` — pending wakes for **all** request types including `rsvp` (and stuck `notified` eligible for retry)
- `POST mark_request_notified` (`request_id`)
- `GET list_upcoming_guests` — upcoming parties + each guest’s `guest_id` + E.164 `phone` only (no notes/history)
- `POST create_rsvp_requests` — one Ask Celebr8r request per party with `request_type=rsvp`. Body: `{ party_id, messages: [...] }` or `{ parties: [{ party_id, messages: [...] }] }`. Each message: `{ guest_id, phone, message_guid, rowid, date, text, is_reaction }`. Dedupes by `message_guid` across prior rsvp requests and rsvp notes; caps payload (40). `get_request` returns that array as `request.payload`.
- `GET get_request` / `POST delete_request` — for relay verification / cleanup

### Relay on Compil8r (Jon installs; agents do not touch Compil8r)

- Script: `/Users/jongraves/bin/celebr8-text-relay.py` (source in repo: `scripts/celebr8-text-relay.py` — Jon installs; agents do not touch Compil8r)
- LaunchAgent: `com.catn8.celebr8-text-relay`
- Token file: `/Users/jongraves/.local/state/catn8/celebr8/relay-api-token`
- Runs every **60s** in **once-mode** (`CELEBR8_RELAY_ONCE=1`)
- Each tick: send queued iMessages → scan inbound guest replies (read-only `~/Library/Messages/chat.db`) → wake pending Celebr8r requests (`text`|`flyer`|`rsvp`)
- Inbound state: `~/.local/state/catn8/celebr8/imsg-last-rowid` (first run sets to max ROWID, **no backfill**)
- If chat.db cannot be opened (Full Disk Access), logs one clear line and continues the tick
- Never logs message bodies or unmatched Messages content

Repo sample:

```bash
CELEBR8_RELAY_ONCE=1 python3 scripts/celebr8-text-relay.py
```

Sample LaunchAgent: `scripts/com.catn8.celebr8-text-relay.plist.sample` (do not auto-install).

### Celebr8r webhook env (relay)

| Env | Purpose |
| --- | --- |
| `CELEBR8_AGENT_WEBHOOK_URL` | Grok Bot routine POST URL |
| `CELEBR8_AGENT_WEBHOOK_KEY_FILE` | File with routine sender key (never logged) |
| `CELEBR8_AGENT_WEBHOOK_KEY_HEADER` | Header name for the key (default `Authorization`) |

If URL or key file is unset, the wake step is skipped quietly.

**Webhook header behavior:** Grok Bot routines document `Authorization: Bearer <key>` (panel shows POST URL, key, and full header). With the default header name `Authorization`, the relay sends `Bearer <key>` (or passes through if the file already includes `Bearer `). For any other `CELEBR8_AGENT_WEBHOOK_KEY_HEADER`, the raw key is sent as that header’s value. Redirects are refused so the key cannot be forwarded. Response bodies are not printed.

Wake JSON body (minimal):

```json
{ "request_id": 12, "party_id": 1, "preview": "Remind maybes about chili…" }
```

Notify retries: re-wake only if status stays `notified` for over **15 minutes**, at most **3** times (`notify_count`).

## Schema

Additive migrations:

- `scripts/db/migrations/2026_10_08_celebr8.sql`
- `scripts/db/migrations/2026_10_08_celebr8_requests.sql`
- `scripts/db/migrations/2026_10_08_celebr8_albums.sql`
- `scripts/db/migrations/2026_10_08_celebr8_flyers.sql`
- `scripts/db/migrations/2026_10_08_celebr8_rsvp_notes.sql`
- `scripts/db/migrations/2026_10_09_celebr8_activity_details.sql`

Runtime `Celebr8Model::ensureSchema()` / `Celebr8AgentModel::ensureSchema()` / `Celebr8AlbumModel::ensureSchema()` / `Celebr8FlyerModel::ensureSchema()` create tables and add `celebr8_requests.request_type`, `celebr8_requests.payload_json`, and `celebr8_text_messages.request_id` safely.

Do **not** bulk-import Compil8r albums here. Celebr8r pushes via `upload_photo`, or Jon imports from `~/celebr8/albums/<date>-<slug>/manifest.json` once upload is live.
