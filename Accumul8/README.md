# Accumul8

Accumul8 is the catn8.us personal finance workspace.

## Access
- Allowed: users in group `accumul8-users` and administrators.
- Entry points:
  - `/accumul8.php`
  - `/Accumul8/index.php`

## Modules
- Ledger
- Pay Bills queue
- Payees/Payers management
- Recurring payments
- Notifications (PHPMailer)
- Bank sync (Plaid). New transactions arrive through `https://catn8.us/api/accumul8_plaid_webhook.php`, with housekeeping as a twice-daily fallback. The Sync tab badge and a single admin email report reconnect problems. Teller connections remain for history with status `retired_teller` and are not synced.
