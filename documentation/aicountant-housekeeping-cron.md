# AIcountant Housekeeping Cron

Use this when you want AIcountant to run unattended on live and keep Accumul8 current.

## What the housekeeping run does

- Syncs Plaid bank connections. Teller and retired Teller connections are skipped. This is the scheduled fallback for the Plaid webhook at `https://catn8.us/api/accumul8_plaid_webhook.php`.
- Checks Plaid health for each active connection: last successful sync older than 36 hours, `needs_reauth`, repeated errors, a missing webhook, and Plaid API or credential failures.
- Emails jon@catn8.us once when a Plaid problem appears or clears. A repeated healthy or unchanged problem does not send another email. The message names the bank and says to click Reconnect via Plaid on the Sync tab.
- Reconciles opening balances when the bank balance and Accumul8 ledger are still offset.
- Materializes recurring ledger transactions through the next 90 days by default.
- Runs the AIcountant watchlist over overdue bills, bills due soon, recurring outflows, and near-term cash-flow pressure.
- Posts start, progress, anomalies, and summary messages to the Accumul8 message board.
- Sends email only when attention is needed by default.
- Creates or refreshes the saved `AIcountant Bill Watch` notification rule.

## Live entry points

### CLI script

Run on the live host with PHP CLI:

```bash
php /ABSOLUTE/PATH/TO/catn8.us/scripts/accumul8/run_aicountant_housekeeping.php \
  --owner-user-id=OWNER_USER_ID \
  --days-ahead=90 \
  --send-email=1 \
  --create-notification-rule=1 \
  --email-on-attention-only=1
```

### Admin-token API endpoint

Run from cron with `curl` when you prefer an HTTP trigger:

```bash
curl -sS -X POST "https://catn8.us/api/accumul8_housekeeping.php" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"owner_user_id":OWNER_USER_ID,"days_ahead":90,"send_email":1,"create_notification_rule":1,"email_on_attention_only":1}'
```

If you cannot send headers, you may send the token in the JSON body instead:

```bash
curl -sS -X POST "https://catn8.us/api/accumul8_housekeeping.php" \
  -H "Content-Type: application/json" \
  --data '{"admin_token":"YOUR_ADMIN_TOKEN","owner_user_id":OWNER_USER_ID,"days_ahead":90,"send_email":1,"create_notification_rule":1,"email_on_attention_only":1}'
```

Legacy GET still works for now, but it is deprecated because it exposes the token in URLs, logs, and scheduler history:

```text
https://catn8.us/api/accumul8_housekeeping.php?admin_token=YOUR_ADMIN_TOKEN&owner_user_id=OWNER_USER_ID&days_ahead=90&send_email=1&create_notification_rule=1&email_on_attention_only=1
```

## Scheduled run

GitHub Actions workflow `.github/workflows/accumul8-housekeeping.yml` is the twice-daily fallback. It POSTs to `https://catn8.us/api/accumul8_housekeeping.php` at 14:00 and 19:00 UTC (10:00 and 15:00 America/New_York) and can also be started with `workflow_dispatch`. The admin token comes from the Actions secret `CATN8_ADMIN_TOKEN` and is sent only as an `Authorization: Bearer` header. The workflow fails when the endpoint returns a non-2xx status.

A second run the same day is safe if an IONOS cron is also installed. Plaid transaction sync continues from the saved cursor, the watchlist email is sent only for a new watchlist state, and the Plaid health email is sent only when a problem appears or clears.

## Optional IONOS cron

The live SSH login is SFTP-only, so the host crontab cannot be confirmed from deploy. The GitHub Actions schedule above does not depend on it. If you also add the host cron, use the header form and keep the token out of the URL.

Recommended crontab:

```cron
MAILTO=your-email@example.com
TZ=America/New_York

0 10 * * * /usr/bin/php /ABSOLUTE/PATH/TO/catn8.us/scripts/accumul8/run_aicountant_housekeeping.php --owner-user-id=OWNER_USER_ID --days-ahead=90 --send-email=1 --create-notification-rule=1 --email-on-attention-only=1 >> /ABSOLUTE/PATH/TO/catn8.us/.local/state/aicountant-housekeeping.log 2>&1
0 15 * * * /usr/bin/php /ABSOLUTE/PATH/TO/catn8.us/scripts/accumul8/run_aicountant_housekeeping.php --owner-user-id=OWNER_USER_ID --days-ahead=90 --send-email=1 --create-notification-rule=1 --email-on-attention-only=1 >> /ABSOLUTE/PATH/TO/catn8.us/.local/state/aicountant-housekeeping.log 2>&1
```

If `php` is not at `/usr/bin/php`, run `which php` over SSH and replace it.

## Notes

- The housekeeping run writes bookkeeping actions into live MySQL through the same Accumul8 code paths used by the app.
- The first Accumul8 request after deploy adds `plaid_consecutive_error_count` and `plaid_health_flags` on `accumul8_bank_connections`. That change is additive.
- In the Plaid dashboard, set the webhook URL to `https://catn8.us/api/accumul8_plaid_webhook.php`. Link tokens and item updates also send that URL.
- The script assumes Plaid credentials, AI provider settings, SMTP settings, and `CATN8_ADMIN_TOKEN` are already configured on live. Teller connections are retired and are not synced.
- Plaid health mail uses the same SMTP path as the rest of the site and is separate from the watchlist attention email.
- If you use the API endpoint from cron, prefer a server-side cron command that runs `curl -X POST` with an `Authorization: Bearer ...` header instead of a plain URL cron.
