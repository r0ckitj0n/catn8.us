# AIcountant Housekeeping Cron

Use this when you want AIcountant to run unattended on live and keep Accumul8 current.

## What the housekeeping run does

- Syncs all Teller-backed bank connections.
- Reconciles opening balances when the bank balance and Accumul8 ledger are still offset.
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
  --send-email=1 \
  --create-notification-rule=1 \
  --email-on-attention-only=1
```

### Admin-token API endpoint

Run from cron with `curl` when you prefer an HTTP trigger:

```bash
curl -sS -X POST "https://catn8.us/api/accumul8_housekeeping.php?admin_token=YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"owner_user_id":OWNER_USER_ID,"send_email":1,"create_notification_rule":1,"email_on_attention_only":1}'
```

If your IONOS control-panel scheduler only accepts a URL, use the GET form:

```text
https://catn8.us/api/accumul8_housekeeping.php?admin_token=YOUR_ADMIN_TOKEN&owner_user_id=OWNER_USER_ID&send_email=1&create_notification_rule=1&email_on_attention_only=1
```

## Recommended IONOS cron setup

If your IONOS package gives you SSH and server-side cron, use that path. If not, use the token-guarded URL form above in the IONOS cron UI.

Recommended crontab:

```cron
MAILTO=your-email@example.com
TZ=America/New_York

0 10 * * * /usr/bin/php /ABSOLUTE/PATH/TO/catn8.us/scripts/accumul8/run_aicountant_housekeeping.php --owner-user-id=OWNER_USER_ID --send-email=1 --create-notification-rule=1 --email-on-attention-only=1 >> /ABSOLUTE/PATH/TO/catn8.us/.local/state/aicountant-housekeeping.log 2>&1
0 15 * * * /usr/bin/php /ABSOLUTE/PATH/TO/catn8.us/scripts/accumul8/run_aicountant_housekeeping.php --owner-user-id=OWNER_USER_ID --send-email=1 --create-notification-rule=1 --email-on-attention-only=1 >> /ABSOLUTE/PATH/TO/catn8.us/.local/state/aicountant-housekeeping.log 2>&1
```

If `php` is not at `/usr/bin/php`, run `which php` over SSH and replace it.

## Notes

- The housekeeping run writes bookkeeping actions into live MySQL through the same Accumul8 code paths used by the app.
- No new schema change is required for this cron setup.
- The script assumes Teller credentials, AI provider settings, SMTP settings, and `CATN8_ADMIN_TOKEN` are already configured on live.
- If you use the API endpoint from cron, prefer a server-side cron command that runs `curl -X POST` instead of a plain URL cron.
