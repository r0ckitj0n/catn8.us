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

`rel8ed` is not a current route in this repo.

## Behaviour

- `.htaccess` maps product `Host` values onto the existing PHP entry wrappers; `/api`, `/dist`, `/login`, etc. stay shared.
- Session + MFA device cookies use `Domain=.catn8.us`, `Secure`, `SameSite=Lax` on live hosts.
- CSRF mutations require a trusted `Origin`/`Referer` on `catn8.us` or an allowlisted product host.
- Absolute URLs use the current request host via `catn8_public_origin()`; OAuth/Plaid callback URLs stay on the apex path.
- `X-Robots-Tag: noindex` on media endpoints is unchanged.

## SSL (IONOS)

Prefer **one wildcard certificate** for `*.catn8.us` (plus the apex `catn8.us` cert already in use). Alternatively issue one cert per subdomain. In the IONOS panel, add each hostname as a **subdomain / domain alias** pointing at the same webspace document root as `catn8.us` (not a separate site), then assign the wildcard (or per-host) SSL certificate.

DNS for `catn8.us` is currently on **GoDaddy** (`ns71.domaincontrol.com` / `ns72.domaincontrol.com`). Add only the new CNAME records; leave MX/TXT/NS/SOA untouched for iCloud Mail.
