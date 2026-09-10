# Keep Dev Current with Live

Use this workflow so local/dev trees stay aligned with https://catn8.us and older local images/code do not overwrite newer live copies.

## Why this exists

Deploy is primarily **local → live** over SFTP. Shared hosting has no reliable content checksums, so a size-based upload can replace a newer live image with an older local file when sizes differ.

## Default protections (deploy)

`scripts/deploy.sh` now:

1. **Refreshes local images from live** before image upload (`--sync-from-live`, on by default).
2. **Uploads missing images only** by default (never replaces an existing live image).
3. Still **excludes** live-generated trees from upload by default:
   `images/mystery/**`, `images/build-wizard/**`, `images/wordsearch/**`, `images/backgrounds/**`
4. Honors **`--code-only`** (skips image sync/upload entirely).

To intentionally replace live images from local:

```bash
./scripts/deploy.sh --lite --force-image-updates
```

To skip the pre-deploy live→local refresh:

```bash
./scripts/deploy.sh --lite --no-sync-from-live
```

## Refresh local from live anytime

```bash
# Prefer SFTP when CATN8_DEPLOY_* + lftp are available; otherwise HTTP
./scripts/sync_from_live.sh

# Explicit modes
./scripts/sync_from_live.sh --images --refresh
./scripts/sync_from_live.sh --images --missing-only
./scripts/sync_from_live.sh --http-only --dry-run

# Emergency: pull live PHP hotfixes (SFTP only; review git status after)
./scripts/sync_from_live.sh --sftp-only --code-hotfixes --refresh
```

npm aliases:

```bash
npm run sync:from-live
npm run sync:from-live:dry
```

### Transport notes

| Transport | Needs | Can refresh existing local files | Can pull live-only files |
|-----------|-------|----------------------------------|--------------------------|
| SFTP (`lftp`) | `CATN8_DEPLOY_HOST/USER/PASS` | Yes | Yes |
| HTTP | Public HTTPS only | Yes (size compare via `Content-Length`) | No |

Artifacts land under `.local/state/sync-from-live/<timestamp>/`.

## Recommended day-to-day flow

1. Start / resume work: `npm run sync:from-live` (or rely on deploy’s pre-sync).
2. Optional inventory: `./scripts/compare_images_local_live.sh` (SFTP).
3. Deploy code normally: `./scripts/deploy_lite.sh` / `./scripts/deploy.sh --lite`.
4. Only use `--force-image-updates` when you intentionally changed an existing image locally and need that change on live.

## Cloud / agent environments

`.cursor/install.sh` runs a best-effort HTTP image refresh after bootstrap when the network can reach the live site. It never fails the install if live is unreachable.
