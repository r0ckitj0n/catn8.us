# Accumul8 Import Naming Guidelines

Use this guide any time you import statement data, budget sheets, or other merchant-heavy records into Accumul8.

## Parent Naming Rules

- Parent entity names should be the clean business, person, or institution name only.
- Do not keep store numbers, repeated words, card suffixes, city names, state abbreviations, addresses, web checkout boilerplate, or transfer scaffolding in the parent name.
- Prefer one stable parent for a merchant family even when the raw statement text varies heavily.
- Keep people and internal transfers human-readable and specific, but still strip transport noise like `Withdrawal From`, `Deposit From`, `Web Pmts`, or repeated city text.

## Alias Rules

- Raw statement variants should become aliases under the clean parent.
- If a merchant already has a clean parent, add the ugly variant as an alias instead of creating a new entity.
- If the import only gives a noisy version like `AMZN COM`, `Dawsonville Car Wa Dawsonville`, or `Windsurf Mountain View`, create or reuse the clean parent and attach the noisy value as the alias.
- The alias should preserve enough of the raw source text to help trace future imports, but the parent should stay clean.

## Existing Source Of Truth

- The grouping rules live in [`accumul8_entity_normalization.php`](/Users/jongraves/Documents/Websites/catn8.us/includes/accumul8_entity_normalization.php).
- The Entity Endex UI reads from `accumul8_entity_family_definitions()`, so update that definition list instead of inventing a side file or hidden script rule.
- After adding or changing naming families, rerun [`normalize_accumul8_entity_families.php`](/Users/jongraves/Documents/Websites/catn8.us/scripts/maintenance/normalize_accumul8_entity_families.php) on dev so the DB actually reflects the new definitions.

## Import Workflow

1. Import onto dev only.
2. Review the Entity Endex in Accumul8 and look for ugly one-off merchants, duplicate parent names, and transfer noise.
3. Expand the normalization families when you see repeated drift.
4. Re-run the normalization script on dev.
5. Verify the ledger, balances, entities, and any statement-upload metadata still look correct.

## Statement Upload Workflow

- Statement uploads now store the original file, OCR text, AI parsing results, reconciliation notes, and suspicious-spend flags in `accumul8_statement_uploads`.
- The upload pipeline uses OCR extraction first and then sends the extracted text through the site AI configured in Settings.
- Best results come from choosing the target account before upload, but the importer can attempt account inference if that is left blank.
- Suspicious-spend alerts are compared against roughly two years of prior merchant history.
- Reconciliation status should be reviewed after each import. `balanced` is safe; `needs_review` means the statement math or account match needs a human pass.

## Sync To Live

- When dev is ready, use [`sync_accumul8_dev_to_live.php`](/Users/jongraves/Documents/Websites/catn8.us/scripts/db/sync_accumul8_dev_to_live.php).
- Dry run first:

```bash
php scripts/db/sync_accumul8_dev_to_live.php
```

- Then apply:

```bash
php scripts/db/sync_accumul8_dev_to_live.php --apply
```

- The script uses the maintenance endpoint flow required in [`AGENTS.md`](/Users/jongraves/Documents/Websites/catn8.us/AGENTS.md), keeps a live backup, and records artifacts under `/.local/state/accumul8-sync/`.
- If you add new `accumul8_*` tables that must move from dev to live, update the table allowlist in the sync script before the next live push.
