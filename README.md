# catn8.us

## Codebase Navigation & Map (Context Guide)

### Directory Responsibilities

#### Frontend (`src/`)
- **`src/entries/`**: **Entry Points.**
  - `App.tsx`: The "Conductor" (Routing, Layout, Context Providers).
  - `app.css`: Global styles (Variables, Resets).
- **`src/components/pages/`**: **Top-level Views.**
  - `MysteryPage.tsx`: Main game loop container.
  - `HomePage.tsx`: Landing page logic.
  - `SettingsPage.tsx`: User/AI configuration UI.
- **`src/components/mystery/`**: **Game-Specific Logic.**
  - `modals/`: Specialized interfaces (e.g., `InterrogationModal.tsx`, `CrimeLabModal.tsx`, `RapSheetModal.tsx`).
  - `sections/`: Sub-components for game views (e.g., `AdminGameModals.tsx`, `CaseModals.tsx`).
  - `hooks/`: Domain-specific state logic.
    - `useMysteryState.ts`: Orchestrates the global game state.
    - `useInterrogation.ts`: Manages AI suspect chat logic.
    - `useMasterAssets.ts`: Handles CRUD for game narrative entities.
- **`src/components/modals/`**: **Global UI Modals.** Shared components like `LoginModal.tsx`.
- **`src/components/ui/`**: **Dumb/Atom Components.** Buttons, inputs, and layout frames.
- **`src/hooks/`**: **Global Hooks.** Shared logic (e.g., `useBootstrapModal.ts`).
- **`src/core/`**: **System Infrastructure.**
  - `ApiClient.ts`: Single point for network requests (Fetch wrapper).
  - `ai/`: Providers (e.g., `GeminiProvider.ts`, `TTSProvider.ts`).
  - `GeminiLiveClient.ts`: Integration for real-time voice interactions.
- **`src/types/`**: **TypeScript Definitions.**
  - `game.d.ts`: Single source of truth for all game-related interfaces (Suspects, Clues, Cases).

#### Backend (`api/`)
- **`api/mystery/`**: **Game Logic Endpoints.**
  - `play.php`: Handles core gameplay actions (start, resume, catalog access).
  - `interrogate.php`: Orchestrates AI suspect interrogation flows.
  - `admin_actions_*.php`: Administrative tools for content creation and cleanup.
  - `sheriff_live_bootstrap.php`: Initialization for the Sheriff's voice persona.
- **`api/auth/`**: **Identity.** `login.php`, `register.php`, `me.php` (session check).
- **`api/settings/`**: **Configuration.** `ai.php`, `db.php`, `mystery_gcp.php`.
- **`api/bootstrap*.php`**: System initialization (DB, HTTP, Handlers).

#### Shared Infrastructure (`includes/`)
- `database.php`: MySQL wrapper (The only way to talk to DB).
- `secret_store.php`: Encrypted runtime secret management.
- `react_shell.php`: The PHP container that mounts the React app.
- `google_cloud_tts.php`, `vertex_ai_gemini.php`: Server-side AI integration.

#### Automation (`scripts/`)
- **`scripts/db/`**: **SQL migrations & Schema Maintenance.**
  - `import_mystery_instructions.php`: Large-scale data ingestion for game logic.
  - `migrate_mystery_*.php`: Scripts for evolving the game database schema.
- **`scripts/dev/`**: **Local Development Tools.**
  - `frontend-tests/`: Puppeteer/E2E test suite.
  - `run-vite-5178.sh`: Dedicated Vite server script.
- **`scripts/maintenance/`**: **Cleanup & Audit Utilities.**
  - `run_mystery_generation_worker.php`: Background worker for AI content generation.
  - `find_stale_assets.mjs`: Cleanup for orphaned images/files.
- **`scripts/secrets/`**: **Deployment-time credential fetching.**
  - `env_or_keychain.sh`: Resolves secrets from local environment or macOS Keychain.
- `dev.sh`, `prod.sh`, `deploy.sh`: Lifecycle management scripts.

### Key Architectural Flows
1.  **State Management:** `GameContext` (Frontend) <-> `play.php` (Backend).
2.  **AI Pipeline:** `useInterrogation` -> `ApiClient` -> `interrogate.php` -> `GeminiProvider`.
3.  **Authentication:** `api/auth/` set cookies/CSRF tokens consumed by `ApiClient.ts`.

### Naming Conventions
- **`*Page.tsx`**: Top-level route component.
- **`*Modal.tsx`**: Independent view controller (often full-screen).
- **`use*.ts`**: Encapsulated state/behavior logic.
- **`admin_actions_*.php`**: Restricted backend administrative tools.
