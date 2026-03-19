import React from 'react';

import { Accumul8PageModals } from './Accumul8PageModals';
import { Accumul8PageOverlays } from './Accumul8PageOverlays';

export function useAccumul8PageLayerPropsBuilder(options: any): {
  modalProps: React.ComponentProps<typeof Accumul8PageModals>;
  overlayProps: React.ComponentProps<typeof Accumul8PageOverlays>;
} {
  return React.useMemo(() => ({
    overlayProps: {
      acknowledgeAllMessageBoardMessages: options.acknowledgeAllMessageBoardMessages,
      acknowledgeMessageBoardMessage: options.acknowledgeMessageBoardMessage,
      beginEditEntity: options.beginEditEntity,
      beginViewTransaction: options.beginViewTransaction,
      entityEndexLogOpen: options.entityEndexLogOpen,
      entityEndexScanLogs: options.entityEndexScanLogs,
      formatAccountDisplayName: options.getAccountDisplayName,
      loadMessageBoard: options.loadMessageBoard,
      messageBoardLoading: options.messageBoardLoading,
      messageBoardMessages: options.messageBoardMessages,
      messageBoardOpen: options.messageBoardOpen,
      messageBoardUnacknowledgedCount: options.messageBoardUnacknowledgedCount,
      onCloseEntityEndexLog: () => options.setEntityEndexLogOpen(false),
      onCloseEntityHistory: () => options.setEntityHistoryEntityId(null),
      onCloseMessageBoard: () => options.setMessageBoardOpen(false),
      onCloseSyncHelp: () => options.setSyncHelpOpen(false),
      onOpenStatementImportFallback: options.openStatementImportFallback,
      onOpenTransactionFromMessageBoard: options.beginViewTransaction,
      selectedEntityHistory: options.selectedEntityHistory,
      selectedEntityTransactions: options.selectedEntityTransactions,
      setTabToLedger: () => options.setTab('ledger'),
      syncHelpError: options.syncHelpError,
      syncHelpOpen: options.syncHelpOpen,
      syncHelpToken: options.syncHelpToken,
    },
    modalProps: {
      entityModalProps: {
        open: options.entityModalOpen,
        busy: options.busy,
        initialForm: options.entityForm,
        entity: options.editingEntity,
        entities: options.entities,
        aliasDraft: options.editingEntity && options.entityAliasDraftById[options.editingEntity.id] ? options.entityAliasDraftById[options.editingEntity.id] : options.DEFAULT_ENTITY_ALIAS_DRAFT,
        entitySummary: options.editingEntity ? (options.entityTransactionSummaryById[options.editingEntity.id] || { count: 0, lastAmount: null, lastDate: '' }) : null,
        editing: options.editingEntityId !== null,
        onClose: options.closeEntityModal,
        onAliasDraftChange: (draft: any) => {
          if (!options.editingEntity) return;
          options.setEntityAliasDraftById((prev: any) => ({ ...prev, [options.editingEntity.id]: draft }));
        },
        onAddAlias: async () => {
          if (!options.editingEntity) return;
          await options.saveEntityAlias(options.editingEntity);
        },
        onDeleteAlias: options.removeEntityAlias,
        onSave: options.submitEntityForm,
      },
      ledgerEntityModalProps: {
        open: options.ledgerEntityModalTransactionId !== null,
        busy: options.busy || options.ledgerEntityModalSaving,
        transaction: options.ledgerEntityModalTransactionId !== null
          ? (options.transactions.find((tx: any) => tx.id === options.ledgerEntityModalTransactionId) || null)
          : null,
        entities: options.entitiesSorted,
        onClose: options.closeLedgerEntityModal,
        onSave: options.saveLedgerEntityRule,
      },
      entityEndexModalProps: {
        open: options.entityEndexGuideModalOpen,
        busy: options.busy,
        guide: options.selectedEntityEndexGuide,
        parentEntity: options.selectedEntityEndexParentEntity,
        entities: options.entitiesWithResolvedAliases,
        aliasDraft: options.selectedEntityEndexParentEntity && options.entityAliasDraftById[options.selectedEntityEndexParentEntity.id]
          ? options.entityAliasDraftById[options.selectedEntityEndexParentEntity.id]
          : options.DEFAULT_ENTITY_ALIAS_DRAFT,
        onClose: options.closeEntityEndexGuideModal,
        onSave: options.saveEntityEndexGuide,
        onDelete: options.removeEntityEndexGuide,
        onFindRelated: options.runEntityEndexGuideFinder,
        onAliasDraftChange: (draft: any) => {
          if (!options.selectedEntityEndexParentEntity) return;
          options.setEntityAliasDraftById((prev: any) => ({ ...prev, [options.selectedEntityEndexParentEntity.id]: draft }));
        },
        onAddAlias: async () => {
          if (!options.selectedEntityEndexParentEntity) return;
          await options.saveEntityAlias(options.selectedEntityEndexParentEntity);
        },
        onRemoveAlias: options.removeEntityAlias,
      },
      contactModalProps: {
        open: options.contactModalOpen,
        busy: options.busy,
        initialForm: options.contactForm,
        editing: options.editingContactId !== null,
        onClose: options.closeContactModal,
        onSave: options.submitContactForm,
      },
      debtorModalProps: {
        open: options.debtorModalOpen,
        busy: options.busy,
        initialForm: options.debtorForm,
        editing: options.editingDebtorId !== null,
        onClose: options.closeDebtorModal,
        onSave: options.submitDebtorModal,
      },
      recurringModalProps: {
        open: options.recurringModalOpen,
        busy: options.busy,
        initialForm: options.editingRecurringForm,
        entities: options.contactEntities,
        accounts: options.visibleAccounts,
        onClose: options.closeRecurringModal,
        onSave: options.submitRecurringModal,
      },
      transactionModalProps: {
        open: options.transactionModalOpen,
        busy: options.busy,
        initialForm: options.ledgerForm,
        mode: options.transactionModalMode,
        variant: options.transactionModalVariant,
        transaction: options.editingTransactionId !== null
          ? (options.transactions.find((tx: any) => tx.id === options.editingTransactionId) || null)
          : options.viewingTransactionId !== null
            ? (options.transactions.find((tx: any) => tx.id === options.viewingTransactionId) || null)
            : null,
        entities: options.entitiesSorted,
        debtors: options.groupedDebtors,
        accounts: options.transactionModalVariant === 'iou' ? options.iouVisibleAccounts : options.visibleAccounts,
        statementUploads: options.statementUploads,
        ownerUserId: options.selectedOwnerUserId || options.activeOwnerUserId || 0,
        onClose: options.closeTransactionModal,
        onEdit: options.transactionModalMode === 'view' && options.viewingTransactionId !== null ? () => options.beginEditTransaction(options.viewingTransactionId) : undefined,
        onSave: options.submitTransactionModal,
      },
      bankingOrganizationManagerProps: {
        open: options.bankingOrganizationManagerOpen,
        onClose: () => options.setBankingOrganizationManagerOpen(false),
        mode: 'banking_organization',
        busy: options.busy,
        bankingOrganizations: options.bankingOrganizations,
        accounts: options.accounts,
        createBankingOrganization: options.createBankingOrganization,
        updateBankingOrganization: options.updateBankingOrganization,
        deleteBankingOrganization: options.deleteBankingOrganization,
        createAccount: options.createAccount,
        updateAccount: options.updateAccount,
        deleteAccount: options.deleteAccount,
      },
      accountManagerProps: {
        open: options.accountManagerOpen,
        onClose: () => options.setAccountManagerOpen(false),
        mode: 'account',
        busy: options.busy,
        bankingOrganizations: options.bankingOrganizations,
        accounts: options.accounts,
        createBankingOrganization: options.createBankingOrganization,
        updateBankingOrganization: options.updateBankingOrganization,
        deleteBankingOrganization: options.deleteBankingOrganization,
        createAccount: options.createAccount,
        updateAccount: options.updateAccount,
        deleteAccount: options.deleteAccount,
      },
    },
  }), [options]);
}
