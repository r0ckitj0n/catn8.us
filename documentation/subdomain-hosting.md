# Product subdomains (`*.catn8.us`)

Every product module that already has a clean path (`/medic8`, `/accumul8`, …) can also be reached on a matching host (`medic8.catn8.us`, …). Path URLs stay valid. Forced 301s from path → subdomain are **off** until DNS + SSL exist (`CATN8_FORCE_SUBDOMAIN_REDIRECTS=0`).

## Inventory (DNS label → path slug)

| DNS host | Path |
|----------|------|
| `accumul8.catn8.us` | `/accumul8` |
| `medic8.catn8.us` | `/medic8` |
| `litig8.catn8.us` | `/litig8` |
| `valid8.catn8.us` | `/valid8` |
| `celebr8.catn8.us` | `/celebr8` |
| `tabul8.catn8.us` | `/tabul8` |
| `fabric8.catn8.us` | `/fabric8` |
| `investig8.catn8.us` | `/investig8` |
| `sheriff-station.catn8.us` | `/sheriff_station` |
| `photo-m8.catn8.us` | `/photo-m8` |
| `loc8.catn8.us` | `/loc8` |
| `elucid8.catn8.us` | `/elucid8` |
| `activ8.catn8.us` | `/activ8` |
| `recre8.catn8.us` | `/recre8` |
| `illumin8.catn8.us` | `/illumin8` |
| `stimul8.catn8.us` | `/stimul8` |
| `narr8.catn8.us` | `/narr8` |
| `rel8d.catn8.us` | `/rel8d` |

Spell the genealogy product **Rel8d** (`rel8d`), not “rel8ed”.

## Behaviour

- `.htaccess` maps product `Host` values onto the existing PHP entry wrappers; `/api`, `/dist`, `/login`, etc. stay shared.
- Session + MFA device cookies use `Domain=.catn8.us`, `Secure`, `SameSite=Lax` on live hosts.
- CSRF mutations require a trusted `Origin`/`Referer` on `catn8.us` or an allowlisted product host.
- Absolute URLs use the current request host via `catn8_public_origin()`; OAuth/Plaid callback URLs stay on the apex path.
- `X-Robots-Tag: noindex` on media endpoints is unchanged.

## SSL plan (IONOS)

Prefer **one wildcard certificate** for `*.catn8.us` (covers every product host) in addition to the existing apex `catn8.us` cert. Per-subdomain certificates also work but are more clicks to renew. Do **not** enable HSTS `includeSubDomains` until every product host serves HTTPS.

DNS is on **GoDaddy** (`ns71.domaincontrol.com` / `ns72.domaincontrol.com`). Web hosting is **IONOS**. Mail (iCloud custom domain) uses existing MX/TXT — leave those alone.

## Jon steps (DNS + hosting panels)

### A. GoDaddy DNS (add CNAMEs only)

1. Open **GoDaddy → My Products → Domains → catn8.us → DNS** (DNS Management).
2. Confirm existing **MX** (`mx01/mx02.mail.icloud.com`) and **TXT** (SPF / Apple domain / verifications) are present — do not edit or delete them.
3. Open the agent-store zone fragment `dns/catn8-subdomains.zone` (BIND, `$ORIGIN catn8.us.`, `$TTL 3600`, CNAME-only; no SOA/NS/MX/TXT).
4. Prefer **manual add** (safer than full-zone replace): for each label in that file (`accumul8`, `medic8`, `litig8`, `valid8`, `celebr8`, `tabul8`, `fabric8`, `investig8`, `photo-m8`, `loc8`, `elucid8`, `activ8`, `recre8`, `illumin8`, `stimul8`, `narr8`, `sheriff-station`, `rel8d`) create a **CNAME** record:
   - Host/Name: the label (e.g. `medic8`)
   - Points to / Value: `catn8.us` (or `catn8.us.` if the UI wants a trailing dot)
   - TTL: `3600` (or “1 hour”)
5. If using **Zone File Editor → Import**, import **only** that fragment after confirming the importer merges records and does **not** wipe MX/TXT/NS. If unsure, use step 4 instead.
6. Wait for propagation (often a few minutes; up to the old TTL). Spot-check with `dig medic8.catn8.us CNAME +short` → `catn8.us.`.

### B. IONOS hosting (subdomains + SSL)

7. In **IONOS → Hosting → catn8.us webspace**, add each product hostname as a **subdomain** (or domain alias) of the **same** contract/document root as `catn8.us` — not a separate website.
8. Preferred SSL: order/assign a **wildcard** certificate for `*.catn8.us` and bind it to the webspace (keep the existing apex cert for `catn8.us` / `www`).
9. Alternative SSL: issue one certificate per subdomain and assign each under SSL management.
10. Confirm HTTPS loads for at least one host (e.g. `https://elucid8.catn8.us`) with a valid cert and no browser warning.
11. Only after every product host has working HTTPS, optionally set live env `CATN8_FORCE_SUBDOMAIN_REDIRECTS=1` so apex paths 301 to subdomains (keep `0` until then).
