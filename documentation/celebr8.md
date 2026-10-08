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

## Agent API

`/api/celebr8_agent.php` — Bearer token (or `X-Celebr8-Agent-Token`).

Party / catalog (existing):

- `GET list_events` / `get_event` / `list_guests`
- `GET list_templates` / `get_template` / `list_activities` / `get_activity` / `list_event_activities`
- `POST update_event` / `create_event` / `delete_event` / `duplicate_event`
- `POST upsert_guest` / `set_rsvp` / `record_historical_invite`
- Catalog write actions for templates and activities

Celebr8r requests:

- `GET list_requests` — default `status=pending,notified` (override with `status=`, optional `party_id`, `limit`)
- `GET get_request` — `request_id`; returns `request`, `thread`, `outbox`
- `POST claim_request` — `{ request_id, claimed_by? }` → `working`
- `POST reply_request` — `{ request_id, body, author_role?: celebr8r|system, status? }`
- `POST set_request_status` — `{ request_id, status }` (`pending`|`notified`|`working`|`needs_jon`|`done`|`failed`)
- `POST queue_outbound_texts` — `{ request_id, messages: [{ guest_id?|phone?, body }] }`  
  Enforces JT Whetstone blocklist and a per-request queue cap (default **50**, override secret `celebr8.queue_cap_per_request` or env `CELEBR8_QUEUE_CAP_PER_REQUEST`).

Guest groups:

- `GET list_guest_groups` / `get_guest_group`
- `POST upsert_guest_group` / `delete_guest_group`

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

## Relay API (iMessage outbox + Celebr8r wake)

`/api/celebr8_relay.php` — Bearer token (or `X-Celebr8-Relay-Token`).

Actions:

- `GET fetch_queued`
- `POST claim` (`message_ids`, optional `claimed_by`) — atomic `queued` → `claimed`
- `POST mark_sent` / `mark_failed`
- `GET list_pending_requests` — pending wakes (and stuck `notified` eligible for retry)
- `POST mark_request_notified` (`request_id`)

### Relay on Compil8r (Jon installs; agents do not touch Compil8r)

- Script: `/Users/jongraves/bin/celebr8-text-relay.py` (source in repo: `scripts/celebr8-text-relay.py`)
- LaunchAgent: `com.catn8.celebr8-text-relay`
- Token file: `/Users/jongraves/.local/state/catn8/celebr8/relay-api-token`
- Runs every **60s** in **once-mode** (`CELEBR8_RELAY_ONCE=1`)

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

Runtime `Celebr8Model::ensureSchema()` / `Celebr8AgentModel::ensureSchema()` create tables and add `celebr8_text_messages.request_id` safely.
