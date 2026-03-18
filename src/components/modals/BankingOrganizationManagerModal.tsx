import React from 'react';

import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { useBrandedConfirm } from '../../hooks/useBrandedConfirm';
import { Accumul8Account, Accumul8AccountDeleteRequest, Accumul8AccountUpsertRequest, Accumul8BankingOrganization, Accumul8BankingOrganizationUpsertRequest } from '../../types/accumul8';
import { getAccumul8AccountDisplayName } from '../../utils/accumul8Accounts';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { BankingOrganizationManagerAccountSection } from './BankingOrganizationManagerAccountSection';
import { BankingOrganizationManagerBankingOrganizationSection } from './BankingOrganizationManagerBankingOrganizationSection';
import { DEFAULT_ACCOUNT_FORM, DEFAULT_BANKING_ORGANIZATION_FORM } from './bankingOrganizationManagerModalData';

type Mode = 'banking_organization' | 'account';

interface BankingOrganizationManagerModalProps {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  busy: boolean;
  bankingOrganizations: Accumul8BankingOrganization[];
  accounts: Accumul8Account[];
  createBankingOrganization: (form: Accumul8BankingOrganizationUpsertRequest) => Promise<void>;
  updateBankingOrganization: (id: number, form: Accumul8BankingOrganizationUpsertRequest) => Promise<void>;
  deleteBankingOrganization: (id: number) => Promise<void>;
  createAccount: (form: Accumul8AccountUpsertRequest) => Promise<void>;
  updateAccount: (id: number, form: Accumul8AccountUpsertRequest) => Promise<void>;
  deleteAccount: (request: Accumul8AccountDeleteRequest) => Promise<void>;
}

export function BankingOrganizationManagerModal({
  open,
  onClose,
  mode,
  busy,
  bankingOrganizations,
  accounts,
  createBankingOrganization,
  updateBankingOrganization,
  deleteBankingOrganization,
  createAccount,
  updateAccount,
  deleteAccount,
}: BankingOrganizationManagerModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const { confirm, confirmDialog } = useBrandedConfirm();
  const [editingBankingOrganizationId, setEditingBankingOrganizationId] = React.useState<number | null>(null);
  const [editingAccountId, setEditingAccountId] = React.useState<number | null>(null);
  const [bankingOrganizationForm, setBankingOrganizationForm] = React.useState<Accumul8BankingOrganizationUpsertRequest>(DEFAULT_BANKING_ORGANIZATION_FORM);
  const [accountForm, setAccountForm] = React.useState<Accumul8AccountUpsertRequest>(DEFAULT_ACCOUNT_FORM);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [modalApiRef, open]);
  React.useEffect(() => {
    if (!open) {
      setEditingBankingOrganizationId(null);
      setEditingAccountId(null);
      setBankingOrganizationForm(DEFAULT_BANKING_ORGANIZATION_FORM);
      setAccountForm(DEFAULT_ACCOUNT_FORM);
    }
  }, [open]);

  const resetBankingOrganizationForm = React.useCallback(() => {
    setEditingBankingOrganizationId(null);
    setBankingOrganizationForm(DEFAULT_BANKING_ORGANIZATION_FORM);
  }, []);
  const resetAccountForm = React.useCallback(() => {
    setEditingAccountId(null);
    setAccountForm(DEFAULT_ACCOUNT_FORM);
  }, []);
  const title = mode === 'banking_organization' ? 'Manage Banking Organizations' : 'Manage Bank Accounts';
  const visibleBankingOrganizations = React.useMemo(() => [...bankingOrganizations].sort((a, b) => a.banking_organization_name.localeCompare(b.banking_organization_name) || a.id - b.id), [bankingOrganizations]);
  const visibleAccounts = React.useMemo(() => [...accounts].sort((a, b) => getAccumul8AccountDisplayName(a).localeCompare(getAccumul8AccountDisplayName(b)) || a.id - b.id), [accounts]);

  const handleBankingOrganizationDelete = React.useCallback(async (bankingOrganization: Accumul8BankingOrganization) => {
    const confirmed = await confirm({ title: 'Delete Banking Organization?', message: `Delete "${bankingOrganization.banking_organization_name}"? This will be blocked if bank accounts are still attached.`, confirmLabel: 'Delete', tone: 'danger' });
    if (!confirmed) return;
    await deleteBankingOrganization(bankingOrganization.id);
    resetBankingOrganizationForm();
  }, [confirm, deleteBankingOrganization, resetBankingOrganizationForm]);
  const handleAccountDelete = React.useCallback(async (account: Accumul8Account) => {
    const confirmed = await confirm({ title: 'Delete Bank Account?', message: `Delete "${getAccumul8AccountDisplayName(account)}" and permanently remove every ledger and recurring entry tied to it? Saved statement files will stay in place, but their account link will be cleared.`, confirmLabel: 'Delete Everything', tone: 'danger' });
    if (!confirmed) return;
    await deleteAccount({ id: account.id, delete_associated_records: 1 });
    resetAccountForm();
  }, [confirm, deleteAccount, resetAccountForm]);

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <ModalCloseIconButton />
          </div>
          <div className="modal-body">
            {mode === 'banking_organization' ? (
              <BankingOrganizationManagerBankingOrganizationSection
                bankingOrganizationForm={bankingOrganizationForm}
                busy={busy}
                createBankingOrganization={createBankingOrganization}
                editingBankingOrganizationId={editingBankingOrganizationId}
                resetBankingOrganizationForm={resetBankingOrganizationForm}
                setBankingOrganizationForm={setBankingOrganizationForm}
                setEditingBankingOrganizationId={setEditingBankingOrganizationId}
                updateBankingOrganization={updateBankingOrganization}
                visibleBankingOrganizations={visibleBankingOrganizations}
                onDelete={(bankingOrganization) => { void handleBankingOrganizationDelete(bankingOrganization); }}
              />
            ) : (
              <BankingOrganizationManagerAccountSection
                accountForm={accountForm}
                busy={busy}
                createAccount={createAccount}
                editingAccountId={editingAccountId}
                resetAccountForm={resetAccountForm}
                setAccountForm={setAccountForm}
                setEditingAccountId={setEditingAccountId}
                updateAccount={updateAccount}
                visibleAccounts={visibleAccounts}
                visibleBankingOrganizations={visibleBankingOrganizations}
                onDelete={(account) => { void handleAccountDelete(account); }}
              />
            )}
          </div>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
