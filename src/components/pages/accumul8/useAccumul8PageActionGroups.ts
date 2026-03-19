import { useAccumul8EntityEndexActions } from './useAccumul8EntityEndexActions';
import { useAccumul8InlineRowActions } from './useAccumul8InlineRowActions';
import { useAccumul8ModalEditorActions } from './useAccumul8ModalEditorActions';
import { useAccumul8ModalHelperActions } from './useAccumul8ModalHelperActions';
import { useAccumul8ModalResetActions } from './useAccumul8ModalResetActions';
import { useAccumul8SyncActions } from './useAccumul8SyncActions';

export function useAccumul8PageActionGroups(options: {
  sync: Parameters<typeof useAccumul8SyncActions>[0];
  reset: Parameters<typeof useAccumul8ModalResetActions>[0];
  helperBase: Omit<Parameters<typeof useAccumul8ModalHelperActions>[0], 'resetContactForm' | 'resetDebtorForm' | 'resetEntityForm' | 'resetLedgerForm' | 'resetRecurringEditor'>;
  editorBase: Omit<Parameters<typeof useAccumul8ModalEditorActions>[0], 'closeContactModal' | 'closeDebtorModal' | 'closeEntityModal' | 'closeRecurringModal' | 'closeTransactionModal' | 'collectEntityAliasNames' | 'persistEntityAliases'>;
  inlineRowsBase: Omit<Parameters<typeof useAccumul8InlineRowActions>[0], 'persistEntityAliases'>;
  entityEndex: Parameters<typeof useAccumul8EntityEndexActions>[0];
}) {
  const syncActions = useAccumul8SyncActions(options.sync);
  const resetActions = useAccumul8ModalResetActions(options.reset);
  const helperActions = useAccumul8ModalHelperActions({
    ...options.helperBase,
    resetContactForm: resetActions.resetContactForm,
    resetDebtorForm: resetActions.resetDebtorForm,
    resetEntityForm: resetActions.resetEntityForm,
    resetLedgerForm: resetActions.resetLedgerForm,
    resetRecurringEditor: resetActions.resetRecurringEditor,
  });
  const editorActions = useAccumul8ModalEditorActions({
    ...options.editorBase,
    closeContactModal: helperActions.closeContactModal,
    closeDebtorModal: helperActions.closeDebtorModal,
    closeEntityModal: helperActions.closeEntityModal,
    closeRecurringModal: helperActions.closeRecurringModal,
    closeTransactionModal: helperActions.closeTransactionModal,
    collectEntityAliasNames: helperActions.collectEntityAliasNames,
    persistEntityAliases: helperActions.persistEntityAliases,
  });
  const inlineRowActions = useAccumul8InlineRowActions({
    ...options.inlineRowsBase,
    persistEntityAliases: helperActions.persistEntityAliases,
  });
  const entityEndexActions = useAccumul8EntityEndexActions(options.entityEndex);

  return {
    ...syncActions,
    ...resetActions,
    ...helperActions,
    ...editorActions,
    ...inlineRowActions,
    ...entityEndexActions,
  };
}
