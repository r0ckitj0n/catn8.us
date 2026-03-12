# Live Secure Backup

Use the secure backup flow when you need a reusable encrypted export of the live database plus the live secret store material.

## What it exports

- Full live database dump, including the `secrets` table.
- Live [`config/secret.key`](/Users/jongraves/Documents/Websites/catn8.us/config/secret.key).
- Metadata about the export time and included components.

## Export

```bash
php scripts/secrets/export_live_secure_backup.php --passphrase="choose-a-strong-passphrase"
```

Environment fallbacks:

- `CATN8_DEPLOY_BASE_URL` or `CATN8_BASE_URL`
- `CATN8_ADMIN_TOKEN`
- `CATN8_SECURE_BACKUP_PASSPHRASE`

Artifacts are saved under:

```text
.local/state/secure-backups/<timestamp>/
```

## Import To Local

```bash
php scripts/secrets/import_secure_backup_to_local.php \
  --file=/absolute/path/to/live-secure-backup.json \
  --passphrase="choose-a-strong-passphrase"
```

This import intentionally overwrites the local database and local `config/secret.key` so local `secret_get()` uses the live secret store material.

## Safety Notes

- The export endpoint is protected by `CATN8_ADMIN_TOKEN`.
- The exported artifact is encrypted before it leaves the live server.
- The import script writes a copy of the decrypted manifest and SQL payload under `/.local/state/secure-backups/` for traceability.
