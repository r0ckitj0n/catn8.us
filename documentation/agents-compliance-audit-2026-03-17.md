# AGENTS Compliance Audit - 2026-03-17

## Scope
- Audited repository source files against the current `AGENTS.md` line-count guidance:
- React component/page files over `300` lines
- Hooks and utility modules over `220` lines

## Structural Refactors Completed
- `src/hooks/usePriorityTableLayout.ts`
  Moved text-width, sorting, and container-width helpers into `src/hooks/priorityTableLayoutUtils.ts`.
- `src/core/tellerConnect.ts`
  Moved cross-window message parsing and iframe tracking into `src/core/tellerConnectUtils.ts`.
- `src/hooks/useFrogger.ts`
  Moved runtime-state creation and level setup into `src/hooks/games/froggerEngine.ts`.
- `src/entries/app.tsx`
  Moved entry-page config/types into `src/entries/appConfig.ts` and modal backdrop cleanup into `src/entries/useModalBackdropCleanup.ts`.
- `src/hooks/useValid8.ts`
  Moved owner/category lookup loading and mutations into `src/hooks/valid8/useValid8Lookups.ts`.
- `src/hooks/useColoringBook.ts`
  Moved DB-page mapping and region helpers into `src/hooks/coloringBookUtils.ts`.
- `src/utils/photoAlbumText.ts`
  Moved theme inference types/data into `src/utils/photoAlbumThemes.ts`.
- `src/components/modals/hooks/useAIConfig.ts`
  Moved config types into `src/components/modals/hooks/aiConfigTypes.ts` and normalization/snapshot helpers into `src/components/modals/hooks/aiConfigUtils.ts`.
- `src/components/modals/hooks/useAIImageConfig.ts`
  Moved config types into `src/components/modals/hooks/aiImageConfigTypes.ts` and normalization/snapshot helpers into `src/components/modals/hooks/aiImageConfigUtils.ts`.
- `src/components/modals/hooks/useTellerConfig.ts`
  Moved Teller form/status defaults and normalization into `src/components/modals/hooks/tellerConfigUtils.ts` and extracted the bank-link/sync workflow into `src/components/modals/hooks/tellerConnectBank.ts`.

## Verified Results
- `npm run typecheck`
  Passed after each refactor batch and on the final edited batch.

## Remaining Violations
- `8279 / 300` `src/core/build-wizard/buildWizardPageRender.tsx`
- `5306 / 300` `src/components/pages/Accumul8Page.tsx`
- `1331 / 300` `src/components/accumul8/Accumul8StatementsPanel.tsx`
- `1261 / 220` `src/core/build-wizard/useBuildWizardInternal.ts`
- `1177 / 220` `src/types/accumul8.ts`
- `1091 / 300` `src/components/modals/Accumul8StatementModal.tsx`
- `1048 / 300` `src/components/photo-albums/PhotoAlbumAdminModal.tsx`
- `1034 / 220` `src/components/photo-albums/photoAlbumStageEngine.ts`
- `982 / 220` `src/hooks/useAccumul8.ts`
- `803 / 220` `src/components/mystery/lib/useMasterAssetsActionsInternal.ts`
- `776 / 300` `src/components/accumul8/Accumul8SpreadsheetView.tsx`
- `770 / 220` `scripts/dev/frontend-tests/overlay-smoke.mjs`
- `769 / 300` `src/components/modals/BankingOrganizationManagerModal.tsx`
- `738 / 220` `src/types/mysteryHooks.ts`
- `622 / 220` `src/data/coloringPages.ts`
- `605 / 300` `src/components/pages/Valid8Page.tsx`
- `522 / 220` `src/types/game.d.ts`
- `499 / 300` `src/components/pages/PhotoAlbumsPage.tsx`
- `479 / 220` `scripts/naming-convention-scan.mjs`
- `462 / 300` `src/components/pages/build-wizard/BuildWizardTimeline.tsx`
- `451 / 300` `src/components/modals/Accumul8TransactionModal.tsx`
- `439 / 220` `src/hooks/usePhotoAlbumsMutations.ts`
- `433 / 300` `src/components/accumul8/Accumul8CalendarView.tsx`
- `423 / 300` `src/components/modals/Accumul8StatementHistoryCard.tsx`
- `397 / 220` `src/types/buildWizard.ts`
- `393 / 300` `src/components/photo-albums/PhotoAlbumChronologicalList.tsx`
- `391 / 220` `src/components/pages/build-wizard/buildWizardUtils.ts`
- `389 / 300` `src/components/modals/SiteMaintenanceModal.tsx`
- `384 / 300` `src/components/accumul8/Accumul8SyncInstitutionsManager.tsx`
- `345 / 300` `src/components/modals/Accumul8EntityModal.tsx`
- `341 / 220` `scripts/headless-settings-dump.mjs`
- `320 / 300` `src/components/accumul8/Accumul8AIcountantPanel.tsx`
- `316 / 220` `src/utils/accumul8StatementPopup.ts`
- `314 / 220` `scripts/css-inventory.mjs`
- `311 / 220` `scripts/dev/mystery-master-asset-snapshots.mjs`
- `310 / 220` `scripts/dev/mystery-master-asset-lock-smoke.mjs`
- `295 / 220` `scripts/dev/refresh_tooltip_audit.mjs`
- `270 / 220` `src/utils/accumul8Spreadsheet.ts`
- `249 / 220` `scripts/dev/frontend-tests/attributes-inline.mjs`
- `248 / 220` `scripts/dev/seed-admin-tooltips.mjs`
- `225 / 220` `src/types/photoAlbums.ts`

## Exception / Review Candidate
- `src/core/build-wizard/buildWizardPageRender.tsx`
  This file already had a pre-existing uncommitted user edit in the worktree at audit time. A large split here is still possible, but it should be coordinated carefully against that live edit instead of being refactored blindly.
