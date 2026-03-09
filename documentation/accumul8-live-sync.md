# Accumul8 Live Sync

Use [`scripts/db/sync_accumul8_dev_to_live.php`](/Users/jongraves/Documents/Websites/catn8.us/scripts/db/sync_accumul8_dev_to_live.php) when live `accumul8` data has drifted from dev and you want to replace live `accumul8` tables with the current dev copy.

## What it does

- Exports only the scoped `accumul8_*` tables from the local MySQL dev database.
- Uploads a temporary token-guarded probe to live.
- Captures live `accumul8` row counts before the sync.
- Downloads a live `accumul8` SQL backup artifact before overwrite.
- Restores the dev `accumul8` dump to live through `/api/database_maintenance.php?action=restore_database`.
- Captures live `accumul8` row counts again and saves `inspect_accumul8` output.
- Removes the temporary live probe when finished.

## Dry Run

```bash
php scripts/db/sync_accumul8_dev_to_live.php
```

Dry-run still creates local artifacts and a live backup unless `--skip-live-backup` is passed. It does not restore dev data to live.

## Apply

```bash
php scripts/db/sync_accumul8_dev_to_live.php --apply
```

## Output

Artifacts are saved under:

```text
.local/state/accumul8-sync/<timestamp>/
```

Typical files:

- `dev-counts.json`
- `live-counts-before.json`
- `live-accumul8-backup.sql`
- `dev-accumul8-dump.sql`
- `restore-response.json`
- `live-counts-after.json`
- `inspect-accumul8.json`

## Notes

- This is a destructive live data replacement for the listed `accumul8_*` tables only.
- It does not touch non-`accumul8` tables.
- It uses the maintenance API path preferred in [`AGENTS.md`](/Users/jongraves/Documents/Websites/catn8.us/AGENTS.md).
- If live has an extra `accumul8_*` table that does not exist in dev, the script leaves it alone.
- The current allowlist includes `accumul8_statement_uploads`, so uploaded statement files and their processing metadata can move from dev to live when needed.
