# Email multi-factor authentication

After a correct password, catn8.us emails a 6-digit code to the address on the account. Sign-in finishes only when that code is accepted, or when a still-valid trusted-device cookie is presented.

Codes are stored as password hashes. Each code expires after 10 minutes, works once, and allows 5 attempts. Resends are limited to one per minute and five per hour. Events are written to `catn8_diagnostics_events` with keys starting `auth.mfa.`.

Trust this device sets an httpOnly, Secure, SameSite=Lax cookie named `catn8_mfa_device` for 30 days. The cookie is signed and can be revoked. It skips the code at later sign-ins. It does not skip the Plaid check.

`plaid_link_token` asks for a code when the browser session has not completed MFA in the last 12 hours. Requests that present a valid `X-Api-Key` or `Authorization: Bearer` admin token are unchanged.

## Recovery

MFA stays on if mail fails. From the site root on the server:

```bash
php scripts/auth/mfa_admin_recovery.php --username=USERNAME --clear-lockout
php scripts/auth/mfa_admin_recovery.php --username=USERNAME --issue-code
php scripts/auth/mfa_admin_recovery.php --username=USERNAME --revoke-devices
```

`--issue-code` prints a single-use code that expires in 10 minutes. Sign in with the password first so the browser is on the Two-factor verification screen, then enter the printed code. `--revoke-devices` invalidates trusted-device cookies for that account. The script is CLI-only and is not reachable from the web.
