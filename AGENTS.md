# AGENTS.md - catn8.us Project Context

## 1. Project Identity & Environment
- **Project Name:** catn8.us
- **Developer:** Jon Graves
- **Live Site:** https://catn8.us
- **Dev Site (Vite):** http://localhost:5178
- **Dev Site (Backend):** http://localhost:8888
- **Database:** MySQL (Single Source of Truth). Do NOT use SQLite.
- **Codex Native Files:** Keep this file named `AGENTS.md` and the ignore file named `.codexignore` so Codex loads them.
- **Secrets:** Never store plaintext credentials in repo rule files; use `.env` and local secret stores.

## 2. Tech Stack (Strict)
- **Frontend:** React 18, Vite ^7.0, TypeScript.
- **Backend:** PHP (API in `/api`, shared logic in `/includes`), MySQL.
- **Package Manager:** npm / Composer.
- **Major libs in use:** React Router, Chart.js, SortableJS.
- **AI services:** Gemini, Google Cloud TTS, Vertex/Imagen via `src/core/ai/*`.

## 3. Critical Architecture Protocols

### The Shared Types Protocol
1. All API/data interfaces MUST live in `src/types/`.
2. Define request/response interfaces in `src/types/` before frontend/backend implementation.
3. Never duplicate API contracts inside components/hooks.
4. Allowed local types: `*Props`, local `*State`, narrow helper unions.

### The Conductor Pattern
- Page-level files must focus on composition/orchestration.
- Move dense logic to `src/hooks/` and reusable view blocks to `src/components/`.
- `App.tsx` must remain composition-first (no dense business logic inline).
- React component files over **300 lines** must be refactored.
- Hooks/utilities over **220 lines** should be split by concern.

### Native Project Layout
- Frontend entry shell is `index.html`.
- React mounts into `#catn8-app`.
- `/api/`: PHP endpoints.
- `/includes/`: core PHP logic/classes/helpers.
- `/scripts/`: automation and maintenance scripts.

## 4. Security & API Baseline (Non-Negotiable)

### Endpoint Security
- Mutating endpoints MUST require explicit auth unless intentionally public.
- Public-write endpoints must enforce strict validation/abuse controls.
- Mutating operations must be `POST`/`PUT`/`DELETE`; `GET` is read-only.
- Endpoints with action switches must enforce explicit action allowlists.
- Never ship localhost/dev auth bypass code paths.

### Input & SQL Safety
- Validate/normalize all external input at API boundaries.
- Use strict allowlists for identifiers/enums and clamp numeric/string bounds.
- Reject invalid JSON/unsupported content types with explicit 4xx.
- Parameterize untrusted SQL values.
- Never concatenate request data into SQL (`ORDER BY`, `LIMIT`, table/column names, etc.).
- Dynamic SQL identifiers are prohibited unless validated by strict allowlist.

### Session, CORS, and Secrets
- Session/browser mutating endpoints must enforce CSRF tokens.
- Session cookies must stay `HttpOnly`, `Secure`, and `SameSite=Lax` or stricter.
- Avoid wildcard CORS on privileged endpoints.
- Secrets/tokens/keys must be env/secret-store only; never commit secrets.
- Password storage must use `password_hash`/`password_verify`.
- Never log secrets or sensitive personal data.

## 5. Database Standards & Sync
- MySQL is the single source of truth for dynamic/business data.
- Table and column names must use snake_case.
- Prefer plural snake_case table names.
- Foreign keys should follow `[singular_table]_id`.
- Booleans should use `TINYINT(1)` with `is_`/`has_` naming.
- Dates should use `DATETIME` or `TIMESTAMP`.
- Currency must use `DECIMAL(10,2)` or integer cents; never `FLOAT`/`DOUBLE`.

### Schema Change Workflow
1. Apply and validate schema changes locally.
2. Run local checks.
3. Dry-run sync for impacted table(s):
   - `php scripts/db/sync_local_schema_to_live.php --table=<table_name>`
4. Apply sync:
   - `php scripts/db/sync_local_schema_to_live.php --table=<table_name> --apply`
5. Verify live table structure and endpoint behavior.

### Schema Guardrails
- Avoid destructive sync patterns for routine schema additions.
- Add-only sync expected (`CREATE TABLE`, `ADD COLUMN`, `ADD INDEX`).
- If live DB connectivity fails, surface exact error and stop for corrected access.
- Update `src/data/database_schema.md` immediately when schema changes.

## 6. Frontend, CSS, and Accessibility
- Prefer existing project patterns and shared CSS variables.
- Avoid unnecessary inline styles.
- Use semantic HTML (`<button>` for actions, `<a>` for links).
- All meaningful images require `alt`; lazy-load below-the-fold images when appropriate.
- Avoid hardcoded IDs and magic values; use constants/enums.
- Do not use raw `fetch`/`axios` in UI components; use `src/core/ApiClient.ts`.
- Do not commit debug `console.log` statements.

### Z-Index Discipline
- Avoid arbitrary z-index values.
- Use project z-index tokens from shared styles.
- When layering fails, debug stacking contexts before raising z-index values.

## 7. Error Handling & Transparency Mandate
- Silent `catch` blocks are prohibited for DB/API failures.
- Do not mask failures with silent fallbacks that hide root causes.
- Return safe structured errors to clients; keep sensitive detail in server logs.
- Log auth failures, access denials, validation failures, and destructive admin actions.

## 8. Quality, Verification, and Hygiene
- Verify relevant changes with browser preview or `curl` as appropriate.
- Never claim a fix without verification evidence.
- If checks fail, continue iterating until resolved or blocked.
- Store runtime/script state artifacts only under `/.local/state/`.
- Keep runtime artifacts/logs/secrets out of git.

### Cleanup Protocol
- Run repository hygiene checks before finalizing substantial refactors.
- Archive genuinely orphaned files to `backups/`.
- If intentionally unreferenced files are required, document/whitelist with rationale.

## 9. Documentation Standards
- Prefer project documentation under `documentation/` with clear categorization.
- Use kebab-case for new documentation filenames.
- Keep architecture/schema docs aligned with implementation changes.

## 10. AI/Data Architecture Constraints
- AI provider usage must flow through abstractions in `src/core/ai/*`.
- Keep prompts isolated under `src/data/prompts/` when used.
- Do not bypass backend data authority with client-side persistence hacks for core data.
