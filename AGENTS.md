# AGENTS.md - catn8.us Project Context

## 1. Project Identity & Environment
- **Project Name:** catn8.us
- **Developer:** Jon Graves
- **Live Site:** https://catn8.us
- **Dev Site (Vite):** http://localhost:5178
- **Dev Site (Backend):** http://localhost:8888
- **Database:** MySQL (Single Source of Truth). Do NOT use SQLite.
- **Codex File Names:** Keep this file named `AGENTS.md` and the ignore file named `.codexignore` so Codex loads them.

## 2. Tech Stack (Strict)
- **Frontend:** React 18, Vite ^7.0, TypeScript.
- **Backend:** PHP (API in `/api`, shared logic in `/includes`), MySQL.
- **Package Manager:** npm / Composer.

## 3. Critical Architecture Protocols

### The "Shared Types" Protocol
1. **Centralized Storage:** All API/data interfaces MUST reside in `src/types/`.
2. **Workflow:** Define request/response interfaces in `src/types/` first, then import into both frontend hooks/components and PHP endpoints.
3. **Prohibition:** Never duplicate API response/request shapes inside multiple components/hooks.

### The "Conductor" Pattern
- **Page-Level Components:** Keep page files focused on composition and orchestration; move dense logic into `src/hooks/` and reusable view blocks into `src/components/`.
- **Component Limit:** React component files over **300 lines** must be refactored.
- **Hook/Utility Limit:** Hooks or utility modules over **220 lines** should be split by concern.
- **Entry shell:** `index.html` is the frontend entry shell.
- **React mount:** React mounts into `#catn8-app`.

### Database & Error Handling
- **Transparency Mandate:** Silent `catch` blocks are prohibited for database/API failures.
- **Naming:** Tables and columns use snake_case.
- **Currency:** Use `DECIMAL(10,2)` or integer cents; never `FLOAT`.

## 4. Design & Styling
- Prefer existing project patterns and shared CSS variables.
- Avoid unnecessary inline styles.
- Keep accessibility and semantic HTML standards.

## 5. Repository Hygiene
- **Runtime State Convention:** Script/runtime state artifacts must be written under `/.local/state/` and never tracked in git.
- **Verification:** Verify changes via browser preview or `curl` when applicable.
- Keep runtime artifacts under ignored directories and never commit generated logs/secrets.
- Do not commit `.env` secrets or private keys.
