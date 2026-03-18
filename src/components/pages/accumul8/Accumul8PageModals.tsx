import React from 'react';

import { BankingOrganizationManagerModal } from '../../modals/BankingOrganizationManagerModal';
import { Accumul8ContactModal } from '../../modals/Accumul8ContactModal';
import { Accumul8DebtorModal } from '../../modals/Accumul8DebtorModal';
import { Accumul8EntityModal } from '../../modals/Accumul8EntityModal';
import { Accumul8LedgerEntityModal } from '../../modals/Accumul8LedgerEntityModal';
import { Accumul8RecurringModal } from '../../modals/Accumul8RecurringModal';
import { Accumul8TransactionModal } from '../../modals/Accumul8TransactionModal';
import { Accumul8EndexGroupModal } from '../../accumul8/Accumul8EndexGroupModal';

interface Accumul8PageModalsProps {
  accountManagerProps: React.ComponentProps<typeof BankingOrganizationManagerModal>;
  bankingOrganizationManagerProps: React.ComponentProps<typeof BankingOrganizationManagerModal>;
  contactModalProps: React.ComponentProps<typeof Accumul8ContactModal>;
  debtorModalProps: React.ComponentProps<typeof Accumul8DebtorModal>;
  entityEndexModalProps: React.ComponentProps<typeof Accumul8EndexGroupModal>;
  entityModalProps: React.ComponentProps<typeof Accumul8EntityModal>;
  ledgerEntityModalProps: React.ComponentProps<typeof Accumul8LedgerEntityModal>;
  recurringModalProps: React.ComponentProps<typeof Accumul8RecurringModal>;
  transactionModalProps: React.ComponentProps<typeof Accumul8TransactionModal>;
}

export function Accumul8PageModals({
  accountManagerProps,
  bankingOrganizationManagerProps,
  contactModalProps,
  debtorModalProps,
  entityEndexModalProps,
  entityModalProps,
  ledgerEntityModalProps,
  recurringModalProps,
  transactionModalProps,
}: Accumul8PageModalsProps) {
  return (
    <>
      <Accumul8EntityModal {...entityModalProps} />
      <Accumul8LedgerEntityModal {...ledgerEntityModalProps} />
      <Accumul8EndexGroupModal {...entityEndexModalProps} />
      <Accumul8ContactModal {...contactModalProps} />
      <Accumul8DebtorModal {...debtorModalProps} />
      <Accumul8RecurringModal {...recurringModalProps} />
      <Accumul8TransactionModal {...transactionModalProps} />
      <BankingOrganizationManagerModal {...bankingOrganizationManagerProps} />
      <BankingOrganizationManagerModal {...accountManagerProps} />
    </>
  );
}
