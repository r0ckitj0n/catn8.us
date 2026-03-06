# VALID8

VALID8 is the catn8.us password manager workspace.

## Access
- Allowed: users in group `valid8-users` and administrators.
- Entry points:
  - `/valid8.php`
  - `/VALID8/index.php`

## Data Model
- Table: `vault_entries`
- Model: `includes/valid8_vault_entry_model.php`
- Behavior:
  - New password change creates a new active row.
  - Previous active row for the same account is kept and auto-marked inactive.
  - Inactive rows are hidden by default unless explicitly requested.
