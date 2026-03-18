import React from 'react';

import { Accumul8Entity, Accumul8MessageBoardMessage, Accumul8Transaction } from '../../../types/accumul8';
import { Accumul8EntityEndexLogOverlay, EntityEndexLog } from './Accumul8EntityEndexLogOverlay';
import { Accumul8EntityHistoryOverlay } from './Accumul8EntityHistoryOverlay';
import { Accumul8MessageBoardOverlay } from './Accumul8MessageBoardOverlay';
import { Accumul8SyncHelpOverlay } from './Accumul8SyncHelpOverlay';

interface Accumul8PageOverlaysProps {
  acknowledgeAllMessageBoardMessages: () => Promise<unknown>;
  acknowledgeMessageBoardMessage: (id: number) => Promise<unknown>;
  beginEditEntity: (id: number) => void;
  beginViewTransaction: (id: number) => void;
  formatAccountDisplayName: (accountId: number | null | undefined, accountName?: string | null, bankingOrganizationName?: string | null) => string;
  loadMessageBoard: () => Promise<unknown>;
  messageBoardLoading: boolean;
  messageBoardMessages: Accumul8MessageBoardMessage[];
  messageBoardOpen: boolean;
  messageBoardUnacknowledgedCount: number;
  onCloseEntityEndexLog: () => void;
  onCloseEntityHistory: () => void;
  onCloseMessageBoard: () => void;
  onCloseSyncHelp: () => void;
  onOpenStatementImportFallback: () => void;
  onOpenTransactionFromMessageBoard: (transactionId: number) => void;
  selectedEntityHistory: Accumul8Entity | null;
  selectedEntityTransactions: Accumul8Transaction[];
  setTabToLedger: () => void;
  syncHelpError: string;
  syncHelpOpen: boolean;
  syncHelpToken: string;
  entityEndexLogOpen: boolean;
  entityEndexScanLogs: EntityEndexLog[];
}

export function Accumul8PageOverlays({
  acknowledgeAllMessageBoardMessages,
  acknowledgeMessageBoardMessage,
  beginEditEntity,
  beginViewTransaction,
  formatAccountDisplayName,
  loadMessageBoard,
  messageBoardLoading,
  messageBoardMessages,
  messageBoardOpen,
  messageBoardUnacknowledgedCount,
  onCloseEntityEndexLog,
  onCloseEntityHistory,
  onCloseMessageBoard,
  onCloseSyncHelp,
  onOpenStatementImportFallback,
  onOpenTransactionFromMessageBoard,
  selectedEntityHistory,
  selectedEntityTransactions,
  setTabToLedger,
  syncHelpError,
  syncHelpOpen,
  syncHelpToken,
  entityEndexLogOpen,
  entityEndexScanLogs,
}: Accumul8PageOverlaysProps) {
  return (
    <>
      <Accumul8MessageBoardOverlay
        acknowledgeAllMessageBoardMessages={acknowledgeAllMessageBoardMessages}
        acknowledgeMessageBoardMessage={acknowledgeMessageBoardMessage}
        loadMessageBoard={loadMessageBoard}
        messageBoardLoading={messageBoardLoading}
        messageBoardMessages={messageBoardMessages}
        messageBoardOpen={messageBoardOpen}
        messageBoardUnacknowledgedCount={messageBoardUnacknowledgedCount}
        onCloseMessageBoard={onCloseMessageBoard}
        onOpenTransactionFromMessageBoard={onOpenTransactionFromMessageBoard}
        setTabToLedger={setTabToLedger}
      />
      <Accumul8SyncHelpOverlay
        onCloseSyncHelp={onCloseSyncHelp}
        onOpenStatementImportFallback={onOpenStatementImportFallback}
        syncHelpError={syncHelpError}
        syncHelpOpen={syncHelpOpen}
        syncHelpToken={syncHelpToken}
      />
      <Accumul8EntityHistoryOverlay
        beginEditEntity={beginEditEntity}
        formatAccountDisplayName={formatAccountDisplayName}
        onCloseEntityHistory={onCloseEntityHistory}
        selectedEntityHistory={selectedEntityHistory}
        selectedEntityTransactions={selectedEntityTransactions}
      />
      <Accumul8EntityEndexLogOverlay
        entityEndexLogOpen={entityEndexLogOpen}
        entityEndexScanLogs={entityEndexScanLogs}
        onCloseEntityEndexLog={onCloseEntityEndexLog}
      />
    </>
  );
}
