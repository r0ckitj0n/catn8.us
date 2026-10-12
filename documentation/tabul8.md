# Tabul8 — live party voting

Tabul8 is the live voting sub-site for Celebr8 parties: camera capture of contestants, big-screen display, and **logged-in kiosk voting** with a party-grade face check so each person votes once per contest.

## URLs

| Role | Path | Auth |
|------|------|------|
| Hub | `/tabul8` | login |
| Admin board | `/tabul8/party/{party_id}` | login |
| Camera station | `/tabul8/party/{party_id}/camera` | login |
| Big-screen display | `/tabul8/party/{party_id}/display` | login |
| **Kiosk vote** (primary) | `/tabul8/party/{party_id}/vote` | **login** |
| Phone / QR vote (optional) | `/tabul8/vote/{vote_token}?exp=&sig=` | short-lived signed token (no login); **off by default** |

Live base: **https://catn8.us** — e.g. kiosk `https://catn8.us/tabul8/party/{party_id}/vote`.

Nav: **TABUL8** appears only when logged in. Each Celebr8 party page links to Tabul8 voting.

## Data model (Addendum 4)

### Party guests (`celebr8_guests`)

The existing Celebr8 guest row **is** the party↔person join (party_guests). Additive fields:

- `costume_name` — per-party costume / dish display name
- `checked_in_at` — kiosk / camera check-in time
- `tabul8_identity_id` — linked persistent face identity

### Photos

Every photo captured at a party belongs to the **party’s private album**. Person and contest links are **tags** on `celebr8_photos` (`tagged_guest_id`, `tagged_identity_id`, `contest_id`) — not ownership. Contest/activity is an extra tag.

### Contests (replaces “categories” concept)

Contests live on the party board. Table remains `tabul8_categories` (FK stability) with:

| Field | Notes |
|-------|--------|
| `name` | e.g. Scariest, Best Chili |
| `contest_type` | `costume` \| `chili` \| `dish` \| `custom` |
| `voting_open` | per-contest gate |

**Default seeds** on first board create: Scariest, Funniest, Most Creative (`costume`); Best Chili (`chili`).

### Entries

An entry is either:

- **person** (`entry_kind=person`) — costume contestant, linked via `guest_id`
- **thing** (`entry_kind=thing`) — chili pot / dish, with `owner_guest_id` = who brought it

## Kiosk voting flow (Addendum 4)

Minimal UI, very large type. Steps: `boot` → `register` / `costume` → `home` → `contest` → `confirm` → `thanks` → auto-reset.

1. **Boot** — camera greets recognized faces (`Hi {Name}! 👻`). Unrecognized: tap **I’m new**. Idle ~45s or face leaves → reset.
2. **Unrecognized** — name (required) + costume name (optional). OpenAI vision suggests a funny/scary/fanciful costume name (~5–8s, same settings/key/caps as labels); on failure queues `request_type=tabul8_costume_name` to Celebr8r and **never blocks** the voter. Fuzzy-match typed name to existing guests (case/nickname-tolerant); confirm on fuzzy/ambiguous. **Never JT Whetstone.** Saving creates/links guest, party-guest fields, enrolls face, then voting.
3. **Recognized** — greet by name; if no `costume_name` for this party yet, optional costume prompt with the same suggestion path.
4. **Home** — list of **open** contests; ✓ on contests this identity already voted in.
5. **Contest** — entry tiles (photo + label / costume / dish name).
6. **Confirm** — popup: “Your vote for {contest}: {label}” → Confirm / Back.
7. **After confirm** — return to remaining unvoted contests; when all done → thank-you → auto-reset for next person.

**One vote per face identity per contest.**

## Voting modes (Addendum 2)

1. **Kiosk (default):** Jon logs a tablet/laptop into catn8 and opens **Kiosk vote**.
2. **Phone / QR:** Party-level toggle **`phone_voting_open`** (default **off**). When on, admin/display can mint a **~15 minute** signed link + QR.

## Labels (live)

Each contestant photo is labeled as it arrives (OpenAI vision on catn8 per Addendum 1, else `request_type=tabul8_label` to Celebr8r, else manual). Admin, display, and kiosk **poll ~2.5–3s** so label + photo appear on the big screen and voting board immediately.

## Session API — `/api/tabul8.php`

### Admin (session + CSRF; writes require admin)

- `GET ensure_board&party_id=` — create board if missing; seed contests Scariest, Funniest, Most Creative, Best Chili
- `GET get_board` / `get_tallies` / `list_categories` / `list_entries` / `list_votes`
- `GET kiosk_state&party_id=` — legacy single-category vote UI payload
- `POST update_board` `{ board_id, voting_open?, phone_voting_open?, show_bars?, reveal_winners? }`
- `POST rotate_vote_token` `{ board_id }`
- `POST mint_phone_vote_link` `{ board_id, ttl_seconds? }` — any logged-in user; empty path if phone voting off
- `POST upsert_category` / `delete_category` / `set_category_voting` — contests (optional `contest_type`)
- `POST upsert_entry` / `delete_entry` / `merge_entries` / `move_entry` / `request_entry_label`
- `POST upload_entry_photo` (multipart: `party_id`, `category_id`, `label?`, `guest_id?`, `owner_guest_id?`, `entry_kind?`, `identity_id?`, `request_label?`, `file`) — stores in party album + tags person/contest; may label via OpenAI
- `POST void_vote` `{ vote_id }`
- `POST purge_face_data` `{ party_id }`
- `POST save_results` `{ board_id }` — snapshot winners/counts onto the board (`results_json`)

### Kiosk writes (any logged-in user + CSRF)

| Action | Body | Notes |
|--------|------|--------|
| `cast_kiosk_vote` | `board_id`, `category_id`/`contest_id`, `entry_id`, `embedding`, `device_token`, `identity_id?` | one vote per identity per contest |
| `kiosk_voter_state` | `party_id`, `identity_id?` | open contests + `voted` flags + entries |
| `match_guest_name` | `party_id`, `name` | fuzzy guest match |
| `register_voter` | `party_id`, `name`, `embedding`, `costume_name?`, `confirm_guest_id?` | create/link guest, enroll face |
| `set_costume_name` | `guest_id`, `costume_name`, `identity_id?` | saves party-guest costume; syncs existing costume entry labels |
| `suggest_costume_name` | `party_id`, `image_data_url`, `guest_id?` | OpenAI suggest; soft-fail; may queue Celebr8r |
| `mint_phone_vote_link` | `board_id`, `ttl_seconds?` | |
| `match_embedding` / `checkin_enroll` | face identity APIs | |

### Phone (optional; signed token, no login)

- `GET public_state&vote_token=&exp=&sig=` — requires `phone_voting_open` + valid signature
- `POST cast_vote` `{ vote_token, exp, sig, category_id, entry_id, embedding, device_token }`

## OpenAI labels + costume names (server-side)

Shared settings/key/caps: Settings → **Tabul8 / AI Labels** (`/api/settings/tabul8.php`).

### Entry labels

1. Fast/cheap vision model (default **`gpt-4o-mini`**) — ~8s timeout.
2. On failure / timeout / AI off / no key / spend cap: fall back to **Celebr8r** (`request_type=tabul8_label`) or **manual**.
3. Camera snap never fails because of labeling — soft-fail after the entry is saved.

### Costume-name suggestions (`suggest_costume_name`) — Addendum 5

1. Same OpenAI key/model/caps; ~5–8s timeout. Prompt: **describe visible costume elements first** (clothes, hat, mask, makeup, props, what they carry/hold), then invent a 2–6 word `costume_name` from those cues. Funny/scary/fanciful only if there is **no good visual cue**. Do not comment on body, age, or appearance beyond the costume.
2. On failure with Celebr8r fallback: store the kiosk frame in the **party album** (tagged to the guest/identity when known), then queue **`request_type=tabul8_costume_name`** with a short-lived signed `photo_url` so Celebr8r can see the costume. Payload: `party_id`, `guest_id`, `identity_id?`, `photo_id`, `photo_url`, `subtype=costume_name`. Do **not** reuse `tabul8_label` — Celebr8r replies with `set_tabul8_costume_name`.
3. Never blocks the voter — they can always type their own.

### Request type `tabul8_label`

```json
{
  "entry_id": 12,
  "party_id": 1,
  "category_id": 3,
  "category": "Scariest",
  "photo_url": "/api/celebr8_media.php?photo=…&exp=…&sig=…",
  "current_label": ""
}
```

Celebr8r replies with `set_tabul8_label`.

### Request type `tabul8_costume_name`

```json
{
  "party_id": 1,
  "guest_id": 42,
  "identity_id": 7,
  "photo_id": 99,
  "photo_url": "/api/celebr8_media.php?photo=99&v=web&exp=…&sig=…",
  "subtype": "costume_name"
}
```

`photo_url` is short-lived (~30 min). Name from visible costume/props in that frame; funny only if no cue. Celebr8r replies with `set_tabul8_costume_name` `{ guest_id, costume_name, request_id? }`.

Relay: `list_pending_requests` returns **all** pending types (no Compil8r script change required).

## Agent API — `/api/celebr8_agent.php` (bearer)

| Action | Method | Fields |
|--------|--------|--------|
| `get_tabul8_board` | GET | `party_id` or `board_id` |
| `list_tabul8_categories` | GET | `party_id` or `board_id` |
| `list_tabul8_entries` | GET | `party_id`/`board_id`, optional `category_id` |
| `get_tabul8_entry` | GET | `entry_id` |
| `set_tabul8_label` | POST | `entry_id`, `label`, optional `description`, optional `request_id` |
| `set_tabul8_costume_name` | POST | `guest_id`, `costume_name`, optional `request_id` |
| `upsert_tabul8_entry` | POST | `category_id` (create) or `id` (update), `label?`, `description?`, `photo_id?`, `guest_id?`, `request_label?` |
| `delete_tabul8_entry` | POST | `entry_id` |
| `update_tabul8_board` | POST | `board_id`, `voting_open?`, `show_bars?`, `reveal_winners?` |
| `set_tabul8_category_voting` | POST | `category_id`, `voting_open` |
| `purge_tabul8_face_data` | POST | `party_id` |
| `get_request` | GET | supports `tabul8_label` and `tabul8_costume_name` payloads |

### Agent API — identities (Addendum 3)

| Action | Method |
|--------|--------|
| `list_tabul8_identities` | GET |
| `get_tabul8_identity` | GET |
| `tabul8_upsert_identity_embeddings` | POST |
| `name_tabul8_identity` | POST |
| `merge_tabul8_identities` | POST |
| `purge_tabul8_identity` | POST |
| `purge_tabul8_identities` | POST (`confirm=1`) |

## Face identities (Addendum 3 — full recognition)

Persistent across parties (**no 7-day auto-delete** of the identity store).

### Model (browser = Compil8r)

| Item | Value |
|------|--------|
| Recognition | InsightFace buffalo_s **MobileFaceNet** (`w600k_mbf.onnx` → `assets/tabul8/onnx/mobilefacenet.onnx`) |
| Alignment | ArcFace 5-point similarity → 112×112 (`model_version=2.0-arcface`) |
| Landmarks | **SCRFD `det_500m.onnx` 5-pt** on both Compil8r (onnxruntime) and kiosk (onnxruntime-web); face-api 68→5 fallback only |
| Runtime | Browser: `onnxruntime-web`; Compil8r: `onnxruntime` (Python) |
| Detection (browser) | face-api TinyFaceDetector + landmarks |
| Input | Aligned 112×112 RGB, NCHW, `(pixel−127.5)/128` |
| Output | **512-d**, L2-normalized |
| **Greet threshold** | cosine ≥ **0.40** → `Hi {Name}! 👻` (greetable only: guest-linked or admin-named) |
| **Match threshold** | cosine ≥ **0.35** → link identity for vote / check-in |

Fetch assets: `bash scripts/tabul8/fetch_model.sh`

### Tables

- `tabul8_identities` — `display_name`, nullable `guest_id`, `source` (`photos|checkin|vote|manual|agent`), `photos_person_uuid`, `unknown_seq`
- `tabul8_identity_embeddings` — `vector_enc` (secret_encrypt), `model_name/version`, `quality`, `source_face_uuid` (idempotent)
- `tabul8_votes.identity_id` + `match_confidence`

Unknown faces become **Unknown #n**; admin can name, merge into a guest/identity, purge one or all. **JT Whetstone is never linked.**

Embeddings are admin/kiosk-pack only — never dumped to anonymous clients. Kiosk loads a **short-lived signed party pack** at session start for local greeting match (server `match_embedding` fallback).

### Compil8r Photos preload

See **`scripts/tabul8/README.md`**. Script: `scripts/tabul8/photos_face_preload.py`. Do not run on Compil8r from this agent — Jon installs there.

### Caveats

Accuracy drops with kids, costumes, side profiles, poor lighting, and motion blur. Client embeddings can be spoofed — party-grade, not bank security. Legacy party-scoped `tabul8_embeddings` may still auto-clean after party+7d; **persistent identities do not**.

## Defaults & results

- First board open seeds: Scariest, Funniest, Most Creative (costume), Best Chili (chili).
- Contests open/close independently; party-level `voting_open` master switch; `phone_voting_open` defaults **off**.
- Display polls tallies ~2.5s; hide bars until reveal; winner card animates when `reveal_winners` is on.
- Save results writes winners/counts/photos into `tabul8_boards.results_json` for the Celebr8 party.
