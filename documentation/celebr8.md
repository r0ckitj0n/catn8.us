# Celebr8

Logged-in party planning section at `/celebr8`.

## Access

- Menu link **CELEBR8** appears only when the browser session is authenticated.
- `celebr8.php` redirects anonymous users to `/login?redirect=/celebr8`.
- Session API `/api/celebr8.php` returns **401** when anonymous.
- Event/guest edits and text queueing require **admin** (and CSRF) on the session API.
- Non-admin signed-in users can view events, guests, and totals.

## Agent API

`/api/celebr8_agent.php` — Bearer token (or `X-Celebr8-Agent-Token`).

Actions:

- `GET list_events`
- `GET get_event` (`event_id` or `slug`)
- `GET list_guests` (`event_id`, optional `rsvp_status`)
- `POST update_event`
- `POST upsert_guest`
- `POST set_rsvp` (by `guest_id` or `phone`)

Token hash key in `secrets`: `celebr8.agent.api_token_hash`.

Generate locally:

```bash
php scripts/celebr8/generate_api_tokens.php --agent-only
```

Plaintext path (gitignored): `.local/state/celebr8/agent-api-token`

## Relay API (iMessage outbox)

`/api/celebr8_relay.php` — Bearer token (or `X-Celebr8-Relay-Token`).

Actions:

- `GET fetch_queued`
- `POST claim` (`message_ids`, optional `claimed_by`) — atomic `queued` → `claimed`
- `POST mark_sent` / `mark_failed`

Relay script:

```bash
CELEBR8_RELAY_ONCE=1 python3 scripts/celebr8-text-relay.py
```

Sample LaunchAgent: `scripts/com.catn8.celebr8-text-relay.plist.sample` (do not auto-install).

## Schema

Additive migration: `scripts/db/migrations/2026_10_08_celebr8.sql`

Runtime also calls `Celebr8Model::ensureSchema()` which creates tables and seeds **Halloween Party 2026** placeholders.
