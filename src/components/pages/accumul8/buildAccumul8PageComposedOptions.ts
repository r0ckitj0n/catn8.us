export function buildAccumul8PageComposedOptions(options: any) {
  return {
    constants: {
      ACCUMUL8_OWNER_STORAGE_KEY: options.ACCUMUL8_OWNER_STORAGE_KEY,
      DEFAULT_ENTITY_ALIAS_DRAFT: options.DEFAULT_ENTITY_ALIAS_DRAFT,
      LEDGER_FILTER_PRESET_OPTIONS: options.LEDGER_FILTER_PRESET_OPTIONS,
      formatAccountBackfillNote: options.formatAccountBackfillNote,
      formatAccountMappingLabel: options.formatAccountMappingLabel,
      formatAccountOptionLabel: options.formatAccountOptionLabel,
      formatCurrencyAmount: options.formatCurrencyAmount,
      formatSummaryWindowLabel: options.formatSummaryWindowLabel,
      formatSyncStatusLabel: options.formatSyncStatusLabel,
      formatSyncStatusMessage: options.formatSyncStatusMessage,
      formatSyncSummaryAccountLabel: options.formatSyncSummaryAccountLabel,
      formatSyncSummaryBackfillNote: options.formatSyncSummaryBackfillNote,
      getActiveFilterClass: options.getActiveFilterClass,
      isTellerRateLimited: options.isTellerRateLimited,
      normalizeEntityKind: options.normalizeEntityKind,
    },
    data: options.data,
    derived: options.derived,
    entityDerived: options.entityDerived,
    helpers: options.helpers,
    messageBoard: options.messageBoard,
    scope: options.scope,
    tables: options.tables,
    ui: options.ui,
  };
}
