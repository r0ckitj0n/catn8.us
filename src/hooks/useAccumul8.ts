import React from 'react';
import { ApiClient } from '../core/ApiClient';
import {
  Accumul8Account,
  Accumul8BankingOrganization,
  Accumul8BankingOrganizationUpsertRequest,
  Accumul8AccountDeleteRequest,
  Accumul8AccountUpsertRequest,
  Accumul8AccessibleOwner,
  Accumul8BudgetRow,
  Accumul8BudgetRowUpsertRequest,
  Accumul8BillItem,
  Accumul8BankConnectionDeleteRequest,
  Accumul8BankConnectionUpsertRequest,
  Accumul8BootstrapResponse,
  Accumul8Contact,
  Accumul8ContactUpsertRequest,
  Accumul8Debtor,
  Accumul8DebtorUpsertRequest,
  Accumul8Entity,
  Accumul8EntityAlias,
  Accumul8EntityEndexScanLog,
  Accumul8EntityAliasGlobalScanResponse,
  Accumul8EntityAliasScanRequest,
  Accumul8EntityAliasScanResponse,
  Accumul8EntityEndexGuide,
  Accumul8EntityEndexGuideUpsertRequest,
  Accumul8EntityAliasUpsertRequest,
  Accumul8EntityUpsertRequest,
  Accumul8NotificationRule,
  Accumul8NotificationRuleUpsertRequest,
  Accumul8RecurringPayment,
  Accumul8RecurringUpsertRequest,
  Accumul8StatementUpload,
  Accumul8StatementArchiveRequest,
  Accumul8StatementArchiveResponse,
  Accumul8StatementRestoreResponse,
  Accumul8StatementDeleteArchivedResponse,
  Accumul8StatementAuditRun,
  Accumul8StatementAuditRequest,
  Accumul8StatementAuditResponse,
  Accumul8StatementImportResult,
  Accumul8ImportedTransactionCleanupAuditResponse,
  Accumul8ImportedTransactionCleanupPurgeResponse,
  Accumul8StatementSearchResult,
  Accumul8Transaction,
  Accumul8TransactionMoveRequest,
  Accumul8TransactionUpsertRequest,
  Accumul8IdResponse,
} from '../types/accumul8';
export function useAccumul8(
  onToast?: (payload: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void,
  selectedOwnerUserId?: number | null,
) {
  const [busy, setBusy] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [activeOwnerUserId, setActiveOwnerUserId] = React.useState<number>(0);
  const [accessibleAccountOwners, setAccessibleAccountOwners] = React.useState<Accumul8AccessibleOwner[]>([]);
  const [summary, setSummary] = React.useState({ net_amount: 0, inflow_total: 0, outflow_total: 0, unpaid_outflow_total: 0 });
  const [entities, setEntities] = React.useState<Accumul8Entity[]>([]);
  const [entityAliases, setEntityAliases] = React.useState<Accumul8EntityAlias[]>([]);
  const [entityEndexGuides, setEntityEndexGuides] = React.useState<Accumul8EntityEndexGuide[]>([]);
  const [entityEndexScanLogs, setEntityEndexScanLogs] = React.useState<Accumul8EntityEndexScanLog[]>([]);
  const [contacts, setContacts] = React.useState<Accumul8Contact[]>([]);
  const [recurringPayments, setRecurringPayments] = React.useState<Accumul8RecurringPayment[]>([]);
  const [transactions, setTransactions] = React.useState<Accumul8Transaction[]>([]);
  const [bankingOrganizations, setBankingOrganizations] = React.useState<Accumul8BankingOrganization[]>([]);
  const [accounts, setAccounts] = React.useState<Accumul8Account[]>([]);
  const [notificationRules, setNotificationRules] = React.useState<Accumul8NotificationRule[]>([]);
  const [payBills, setPayBills] = React.useState<Accumul8BillItem[]>([]);
  const [debtors, setDebtors] = React.useState<Accumul8Debtor[]>([]);
  const [debtorLedger, setDebtorLedger] = React.useState<Accumul8Transaction[]>([]);
  const [budgetRows, setBudgetRows] = React.useState<Accumul8BudgetRow[]>([]);
  const [bankConnections, setBankConnections] = React.useState<any[]>([]);
  const [statementUploads, setStatementUploads] = React.useState<Accumul8StatementUpload[]>([]);
  const [archivedStatementUploads, setArchivedStatementUploads] = React.useState<Accumul8StatementUpload[]>([]);
  const [statementAuditRuns, setStatementAuditRuns] = React.useState<Accumul8StatementAuditRun[]>([]);
  const [syncProvider, setSyncProvider] = React.useState({ provider: 'teller', env: 'sandbox', configured: 0 });
  const handleError = React.useCallback((error: any, fallback = 'Accumul8 request failed') => {
    const message = String(error?.message || fallback);
    if (onToast) {
      onToast({ tone: 'error', message });
    }
  }, [onToast]);
  const isTellerRateLimitError = React.useCallback((error: unknown) => {
    const message = String((error as any)?.message || '').toLowerCase();
    return message.includes('too_many_requests')
      || message.includes('request rate limit exceeded')
      || message.includes('http 429')
      || message.includes('status of 429');
  }, []);
  const scopedActionUrl = React.useCallback((action: string) => {
    const params = new URLSearchParams({ action });
    const ownerUserId = Number(selectedOwnerUserId || 0);
    if (ownerUserId > 0) {
      params.set('owner_user_id', String(ownerUserId));
    }
    return `/api/accumul8.php?${params.toString()}`;
  }, [selectedOwnerUserId]);
  const load = React.useCallback(async () => {
    setBusy(true);
    try {
      const res = await ApiClient.get<Accumul8BootstrapResponse>(scopedActionUrl('bootstrap'));
      setActiveOwnerUserId(Number(res?.selected_owner_user_id || 0));
      setAccessibleAccountOwners(Array.isArray(res?.accessible_account_owners) ? res.accessible_account_owners : []);
      setEntities(Array.isArray(res?.entities) ? res.entities : []);
      setEntityAliases(Array.isArray(res?.entity_aliases) ? res.entity_aliases : []);
      setEntityEndexGuides(Array.isArray(res?.entity_endex_guides) ? res.entity_endex_guides : []);
      setEntityEndexScanLogs(Array.isArray(res?.entity_endex_scan_logs) ? res.entity_endex_scan_logs : []);
      setContacts(Array.isArray(res?.contacts) ? res.contacts : []);
      setRecurringPayments(Array.isArray(res?.recurring_payments) ? res.recurring_payments : []);
      setTransactions(Array.isArray(res?.transactions) ? res.transactions : []);
      setBankingOrganizations(Array.isArray(res?.banking_organizations) ? res.banking_organizations : []);
      setAccounts(Array.isArray(res?.accounts) ? res.accounts : []);
      setNotificationRules(Array.isArray(res?.notification_rules) ? res.notification_rules : []);
      setPayBills(Array.isArray(res?.pay_bills) ? res.pay_bills : []);
      setDebtors(Array.isArray(res?.debtors) ? res.debtors : []);
      setDebtorLedger(Array.isArray(res?.debtor_ledger) ? res.debtor_ledger : []);
      setBudgetRows(Array.isArray(res?.budget_rows) ? res.budget_rows : []);
      setBankConnections(Array.isArray(res?.bank_connections) ? res.bank_connections : []);
      setStatementUploads(Array.isArray(res?.statement_uploads) ? res.statement_uploads : []);
      setArchivedStatementUploads(Array.isArray(res?.archived_statement_uploads) ? res.archived_statement_uploads : []);
      setStatementAuditRuns(Array.isArray(res?.statement_audit_runs) ? res.statement_audit_runs : []);
      setSyncProvider(res?.sync_provider || { provider: 'teller', env: 'sandbox', configured: 0 });
      setSummary(res?.summary || { net_amount: 0, inflow_total: 0, outflow_total: 0, unpaid_outflow_total: 0 });
      setLoaded(true);
    } catch (error: any) {
      handleError(error, 'Failed to load Accumul8 data');
    } finally {
      setBusy(false);
    }
  }, [handleError, scopedActionUrl]);
  const withReload = React.useCallback(async <T,>(action: () => Promise<T>, successMessage?: string): Promise<T> => {
    setBusy(true);
    try {
      const result = await action();
      await load();
      if (successMessage && onToast) {
        onToast({ tone: 'success', message: successMessage });
      }
      return result;
    } catch (error: any) {
      handleError(error);
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast]);
  const createContact = React.useCallback(async (form: Accumul8ContactUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('create_contact'), form),
      'Contact saved',
    );
  }, [scopedActionUrl, withReload]);
  const createEntity = React.useCallback(async (form: Accumul8EntityUpsertRequest) => {
    return withReload<Accumul8IdResponse>(
      () => ApiClient.post<Accumul8IdResponse>(scopedActionUrl('create_entity'), form),
      'Entity saved',
    );
  }, [scopedActionUrl, withReload]);
  const updateEntity = React.useCallback(async (id: number, form: Accumul8EntityUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('update_entity'), { id, ...form }),
      'Entity updated',
    );
  }, [scopedActionUrl, withReload]);
  const createEntityAlias = React.useCallback(async (payload: Accumul8EntityAliasUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('create_entity_alias'), payload),
      'Alias saved',
    );
  }, [scopedActionUrl, withReload]);
  const deleteEntityAlias = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('delete_entity_alias'), { id }),
      'Alias deleted',
    );
  }, [scopedActionUrl, withReload]);
  const findEntityAliases = React.useCallback(async (payload: Accumul8EntityAliasScanRequest) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<Accumul8EntityAliasScanResponse>(
        scopedActionUrl('scan_entity_aliases'),
        payload,
      );
      await load();
      if (onToast) {
        const createdCount = Number(res?.created_count || 0);
        const updatedCount = Number(res?.updated_count || 0);
        const conflictCount = Number(res?.conflict_count || 0);
        const skippedCount = Number(res?.skipped_count || 0);
        const reviewedCount = Number(res?.reviewed_count || 0);
        const rejectedCount = Number(res?.rejected_count || 0);
        const actionCount = createdCount + updatedCount;
        let message = actionCount > 0
          ? `Added ${actionCount} related name${actionCount === 1 ? '' : 's'} to the parent.`
          : 'No new related names were found for that parent.';
        if (reviewedCount > 0) {
          message += ` AI reviewed ${reviewedCount} candidate${reviewedCount === 1 ? '' : 's'}.`;
        }
        if (rejectedCount > 0) {
          message += ` ${rejectedCount} ${rejectedCount === 1 ? 'was' : 'were'} rejected and protected from repeat scans.`;
        }
        if (conflictCount > 0) {
          message += ` ${conflictCount} conflict${conflictCount === 1 ? ' was' : 's were'} skipped.`;
        } else if (skippedCount > 0 && actionCount > 0) {
          message += ` ${skippedCount} existing match${skippedCount === 1 ? ' was' : 'es were'} already covered.`;
        }
        onToast({ tone: actionCount > 0 ? 'success' : 'info', message });
      }
      return res;
    } catch (error: any) {
      handleError(error, 'Failed to scan for related entity names');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl]);
  const findAllEntityAliases = React.useCallback(async () => {
    setBusy(true);
    try {
      const res = await ApiClient.post<Accumul8EntityAliasGlobalScanResponse>(
        scopedActionUrl('scan_all_entity_aliases'),
        {},
      );
      await load();
      if (onToast) {
        const touchedEntityCount = Number(res?.touched_entity_count || 0);
        const createdCount = Number(res?.created_count || 0);
        const updatedCount = Number(res?.updated_count || 0);
        const conflictCount = Number(res?.conflict_count || 0);
        const reviewedCount = Number(res?.reviewed_count || 0);
        const rejectedCount = Number(res?.rejected_count || 0);
        const protectedSkipCount = Number(res?.protected_skip_count || 0);
        const actionCount = createdCount + updatedCount;
        let message = actionCount > 0
          ? `Updated ${touchedEntityCount} parent${touchedEntityCount === 1 ? '' : 's'} and added ${actionCount} related name${actionCount === 1 ? '' : 's'}.`
          : 'No new related names were found across the Entity Endex.';
        if (reviewedCount > 0) {
          message += ` AI reviewed ${reviewedCount} candidate${reviewedCount === 1 ? '' : 's'}.`;
        }
        if (rejectedCount > 0) {
          message += ` ${rejectedCount} ${rejectedCount === 1 ? 'was' : 'were'} rejected and protected.`;
        }
        if (protectedSkipCount > 0) {
          message += ` ${protectedSkipCount} protected match${protectedSkipCount === 1 ? ' was' : 'es were'} skipped automatically.`;
        }
        if (conflictCount > 0) {
          message += ` ${conflictCount} conflict${conflictCount === 1 ? ' was' : 's were'} skipped.`;
        }
        onToast({ tone: actionCount > 0 ? 'success' : 'info', message });
      }
      return res;
    } catch (error: any) {
      handleError(error, 'Failed to scan all entity parents for related names');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl]);
  const createEntityEndexGuide = React.useCallback(async (form: Accumul8EntityEndexGuideUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('create_entity_endex_guide'), form),
      'Grouping guide saved',
    );
  }, [scopedActionUrl, withReload]);
  const updateEntityEndexGuide = React.useCallback(async (id: number, form: Accumul8EntityEndexGuideUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('update_entity_endex_guide'), { id, ...form }),
      'Grouping guide updated',
    );
  }, [scopedActionUrl, withReload]);
  const deleteEntityEndexGuide = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('delete_entity_endex_guide'), { id }),
      'Grouping guide deleted',
    );
  }, [scopedActionUrl, withReload]);
  const createBankingOrganization = React.useCallback(async (form: Accumul8BankingOrganizationUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('create_banking_organization'), form),
      'Banking organization saved',
    );
  }, [scopedActionUrl, withReload]);
  const updateBankingOrganization = React.useCallback(async (id: number, form: Accumul8BankingOrganizationUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('update_banking_organization'), { id, ...form }),
      'Banking organization updated',
    );
  }, [scopedActionUrl, withReload]);
  const deleteBankingOrganization = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('delete_banking_organization'), { id }),
      'Banking organization deleted',
    );
  }, [scopedActionUrl, withReload]);
  const createBankConnection = React.useCallback(async (form: Accumul8BankConnectionUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('create_bank_connection'), form),
      'Connected institution saved',
    );
  }, [scopedActionUrl, withReload]);
  const updateBankConnection = React.useCallback(async (id: number, form: Accumul8BankConnectionUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('update_bank_connection'), { id, ...form }),
      'Connected institution updated',
    );
  }, [scopedActionUrl, withReload]);
  const deleteBankConnection = React.useCallback(async (request: Accumul8BankConnectionDeleteRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('delete_bank_connection'), request),
      'Connected institution deleted',
    );
  }, [scopedActionUrl, withReload]);
  const createAccount = React.useCallback(async (form: Accumul8AccountUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('create_account'), form),
      'Bank account saved',
    );
  }, [scopedActionUrl, withReload]);
  const updateAccount = React.useCallback(async (id: number, form: Accumul8AccountUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('update_account'), { id, ...form }),
      'Bank account updated',
    );
  }, [scopedActionUrl, withReload]);
  const deleteAccount = React.useCallback(async (request: Accumul8AccountDeleteRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('delete_account'), request),
      'Bank account deleted',
    );
  }, [scopedActionUrl, withReload]);
  const updateContact = React.useCallback(async (id: number, form: Accumul8ContactUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('update_contact'), { id, ...form }),
      'Contact updated',
    );
  }, [scopedActionUrl, withReload]);
  const deleteContact = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('delete_contact'), { id }),
      'Contact deleted',
    );
  }, [scopedActionUrl, withReload]);
  const createDebtor = React.useCallback(async (form: Accumul8DebtorUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('create_debtor'), form),
      'Debtor saved',
    );
  }, [scopedActionUrl, withReload]);
  const updateDebtor = React.useCallback(async (id: number, form: Accumul8DebtorUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('update_debtor'), { id, ...form }),
      'Debtor updated',
    );
  }, [scopedActionUrl, withReload]);
  const deleteDebtor = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('delete_debtor'), { id }),
      'Debtor deleted',
    );
  }, [scopedActionUrl, withReload]);
  const createRecurring = React.useCallback(async (form: Accumul8RecurringUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('create_recurring'), form),
      'Recurring payment saved',
    );
  }, [scopedActionUrl, withReload]);
  const updateRecurring = React.useCallback(async (id: number, form: Accumul8RecurringUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('update_recurring'), { id, ...form }),
      'Recurring payment updated',
    );
  }, [scopedActionUrl, withReload]);
  const toggleRecurring = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('toggle_recurring'), { id }),
      'Recurring payment updated',
    );
  }, [scopedActionUrl, withReload]);
  const deleteRecurring = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('delete_recurring'), { id }),
      'Recurring payment deleted',
    );
  }, [scopedActionUrl, withReload]);
  const materializeDueRecurring = React.useCallback(async () => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('materialize_due_recurring'), {}),
      'Recurring payments posted to ledger',
    );
  }, [scopedActionUrl, withReload]);
  const createTransaction = React.useCallback(async (form: Accumul8TransactionUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('create_transaction'), form),
      'Transaction saved',
    );
  }, [scopedActionUrl, withReload]);
  const updateTransaction = React.useCallback(async (id: number, form: Accumul8TransactionUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('update_transaction'), { id, ...form }),
      'Transaction updated',
    );
  }, [scopedActionUrl, withReload]);
  const deleteTransaction = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('delete_transaction'), { id }),
      'Transaction deleted',
    );
  }, [scopedActionUrl, withReload]);
  const moveTransactionsToAccount = React.useCallback(async (payload: Accumul8TransactionMoveRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('move_transactions_to_account'), payload),
      'Transactions moved',
    );
  }, [scopedActionUrl, withReload]);
  const toggleTransactionPaid = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('toggle_transaction_paid'), { id }),
    );
  }, [scopedActionUrl, withReload]);
  const toggleTransactionReconciled = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('toggle_transaction_reconciled'), { id }),
    );
  }, [scopedActionUrl, withReload]);
  const toggleTransactionBudgetPlanner = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('toggle_transaction_budget_planner'), { id }),
      'Budget planner inclusion updated',
    );
  }, [scopedActionUrl, withReload]);
  const createNotificationRule = React.useCallback(async (form: Accumul8NotificationRuleUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('create_notification_rule'), form),
      'Notification rule saved',
    );
  }, [scopedActionUrl, withReload]);
  const updateNotificationRule = React.useCallback(async (id: number, form: Accumul8NotificationRuleUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('update_notification_rule'), { id, ...form }),
      'Notification rule updated',
    );
  }, [scopedActionUrl, withReload]);
  const toggleNotificationRule = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('toggle_notification_rule'), { id }),
      'Notification rule updated',
    );
  }, [scopedActionUrl, withReload]);
  const deleteNotificationRule = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('delete_notification_rule'), { id }),
      'Notification rule deleted',
    );
  }, [scopedActionUrl, withReload]);
  const sendNotification = React.useCallback(async (payload: { rule_id?: number; subject?: string; body?: string; target_scope?: 'group' | 'custom'; custom_user_ids?: number[] }) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<any>(scopedActionUrl('send_notification'), payload);
      const sent = Number(res?.sent_count || 0);
      const failed = Number(res?.failed_count || 0);
      if (onToast) {
        onToast({ tone: failed > 0 ? 'warning' : 'success', message: `Email sent to ${sent} user(s)${failed > 0 ? `, failed for ${failed}` : ''}.` });
      }
      await load();
    } catch (error: any) {
      handleError(error, 'Failed to send notification');
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl]);
  const syncBankConnection = React.useCallback(async (connectionId: number) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<any>(scopedActionUrl('teller_sync_transactions'), { connection_id: connectionId });
      if (onToast) {
        onToast({ tone: 'success', message: `Synced bank transactions (added ${Number(res?.added || 0)}).` });
      }
      await load();
      return res;
    } catch (error: any) {
      if (isTellerRateLimitError(error) && onToast) {
        onToast({ tone: 'warning', message: 'Teller asked us to wait before syncing again. Give it a little time, then retry.' });
      } else {
        handleError(error, 'Bank sync failed');
      }
    } finally {
      setBusy(false);
    }
  }, [handleError, isTellerRateLimitError, load, onToast, scopedActionUrl]);
  const uploadStatement = React.useCallback(async (formData: FormData) => {
    setBusy(true);
    try {
      const res = await ApiClient.postFormData<{ success: boolean; upload: Accumul8StatementUpload }>(scopedActionUrl('upload_statement'), formData);
      await load();
      if (onToast) {
        onToast({ tone: 'success', message: 'Statement scanned. Review the import plan before approving.' });
      }
      return res?.upload;
    } catch (error: any) {
      if (Number(error?.status || 0) === 409 && Number(error?.payload?.duplicate ? 1 : 0) === 1) {
        const statementFile = formData.get('statement_file');
        const fallbackName = statementFile instanceof File ? statementFile.name : '';
        const existingName = String(error?.payload?.existing_upload?.original_filename || fallbackName);
        if (onToast) {
          onToast({
            tone: 'warning',
            message: existingName
              ? `Upload canceled because "${existingName}" is a duplicate statement.`
              : 'Upload canceled because this statement was already uploaded.',
          });
        }
        return;
      }
      handleError(error, 'Failed to upload statement');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl]);
  const rescanStatementUpload = React.useCallback(async (id: number, accountId?: number | null) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<{ success: boolean; upload: Accumul8StatementUpload }>(scopedActionUrl('rescan_statement_upload'), {
        id,
        account_id: accountId || null,
      });
      await load();
      if (onToast) {
        onToast({ tone: 'success', message: 'Statement rescanned. Review the refreshed import plan.' });
      }
      return res?.upload;
    } catch (error: any) {
      handleError(error, 'Failed to rescan statement');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl]);
  const updateStatementUploadMetadata = React.useCallback(async (payload: {
    id: number;
    statement_kind?: string;
    account_name_hint?: string;
    account_last4?: string;
  }) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<{ success: boolean; upload: Accumul8StatementUpload }>(
        scopedActionUrl('update_statement_upload_metadata'),
        payload,
      );
      await load();
      if (onToast) {
        onToast({ tone: 'success', message: 'Statement metadata updated.' });
      }
      return res;
    } catch (error: any) {
      handleError(error, 'Failed to update statement metadata');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl]);
  const archiveStatementUpload = React.useCallback(async (payload: Accumul8StatementArchiveRequest) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<Accumul8StatementArchiveResponse>(
        scopedActionUrl('archive_statement_upload'),
        payload,
      );
      await load();
      if (onToast) {
        onToast({ tone: 'success', message: 'Statement moved to the archive.' });
      }
      return res;
    } catch (error: any) {
      handleError(error, 'Failed to archive statement');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl]);
  const restoreStatementUpload = React.useCallback(async (id: number) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<Accumul8StatementRestoreResponse>(
        scopedActionUrl('restore_statement_upload'),
        { id },
      );
      await load();
      if (onToast) {
        onToast({ tone: 'success', message: 'Statement restored from the archive.' });
      }
      return res;
    } catch (error: any) {
      handleError(error, 'Failed to restore statement');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl]);
  const deleteArchivedStatementUpload = React.useCallback(async (id: number) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<Accumul8StatementDeleteArchivedResponse>(
        scopedActionUrl('delete_archived_statement_upload'),
        { id },
      );
      await load();
      if (onToast) {
        onToast({ tone: 'success', message: 'Archived statement deleted permanently.' });
      }
      return res;
    } catch (error: any) {
      handleError(error, 'Failed to delete archived statement');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl]);
  const confirmStatementImport = React.useCallback(async (payload: {
    id: number;
    account_id?: number | null;
    create_account?: {
      banking_organization_name?: string;
      account_name: string;
      account_type?: string;
      institution_name?: string;
      mask_last4?: string;
    } | null;
  }) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<{ success: boolean; upload: Accumul8StatementUpload; import_result: Accumul8StatementImportResult | null }>(
        scopedActionUrl('confirm_statement_import'),
        payload,
      );
      await load();
      if (onToast) {
        onToast({ tone: 'success', message: 'Statement import finished. Review imported, skipped, and failed rows below.' });
      }
      return res;
    } catch (error: any) {
      handleError(error, 'Failed to import statement');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl]);
  const reconcileStatementUpload = React.useCallback(async (payload: {
    id: number;
    account_id?: number | null;
    create_account?: {
      banking_organization_name?: string;
      account_name: string;
      account_type?: string;
      institution_name?: string;
      mask_last4?: string;
    } | null;
  }) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<{ success: boolean; upload: Accumul8StatementUpload }>(
        scopedActionUrl('reconcile_statement_upload'),
        payload,
      );
      await load();
      if (onToast) {
        onToast({ tone: 'success', message: 'Statement reconciliation finished. Review the reconciliation panel for the action log.' });
      }
      return res;
    } catch (error: any) {
      handleError(error, 'Failed to reconcile statement');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl]);
  const importStatementReviewRow = React.useCallback(async (payload: {
    id: number;
    row_index: number;
    transaction_date?: string;
    description?: string;
    memo?: string;
    amount?: number;
    account_id?: number | null;
  }) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<{ success: boolean; upload: Accumul8StatementUpload; transaction_id: number }>(
        scopedActionUrl('import_statement_review_row'),
        payload,
      );
      await load();
      if (onToast) {
        onToast({ tone: 'success', message: 'Statement row accepted into the ledger.' });
      }
      return res;
    } catch (error: any) {
      handleError(error, 'Failed to accept statement row');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl]);
  const linkStatementReviewRow = React.useCallback(async (payload: {
    id: number;
    row_index: number;
    transaction_id: number;
  }) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<{ success: boolean; upload: Accumul8StatementUpload; linked_transaction_id: number }>(
        scopedActionUrl('link_statement_review_row'),
        payload,
      );
      await load();
      if (onToast) {
        onToast({ tone: 'success', message: 'Ledger entry linked to statement row.' });
      }
      return res;
    } catch (error: any) {
      handleError(error, 'Failed to link ledger entry to statement row');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl]);
  const searchStatementUploads = React.useCallback(async (query: string) => {
    const normalized = String(query || '').trim();
    if (!normalized) {
      return [] as Accumul8StatementSearchResult[];
    }
    try {
      const res = await ApiClient.get<{ success: boolean; results: Accumul8StatementSearchResult[] }>(
        `${scopedActionUrl('search_statement_uploads')}&q=${encodeURIComponent(normalized)}`,
      );
      return Array.isArray(res?.results) ? res.results : [];
    } catch (error: any) {
      handleError(error, 'Failed to search bank statements');
      throw error;
    }
  }, [handleError, scopedActionUrl]);
  const auditStatementUploads = React.useCallback(async (payload: Accumul8StatementAuditRequest) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<Accumul8StatementAuditResponse>(
        scopedActionUrl('audit_statement_uploads'),
        payload,
      );
      await load();
      if (onToast) {
        onToast({ tone: 'success', message: 'Statement audit finished. Missing catalogs were refreshed and deterministic ledger fixes were applied where possible.' });
      }
      return res;
    } catch (error: any) {
      handleError(error, 'Failed to audit bank statements');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl]);
  const auditImportedTransactionCleanup = React.useCallback(async (payload?: { start_date?: string | null; end_date?: string | null; limit?: number }) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<Accumul8ImportedTransactionCleanupAuditResponse>(
        scopedActionUrl('audit_imported_transaction_cleanup'),
        payload || {},
      );
      return res?.report;
    } catch (error: any) {
      handleError(error, 'Failed to audit imported transaction cleanup candidates');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, scopedActionUrl]);
  const purgeImportedTransactionCleanup = React.useCallback(async (transactionIds: number[]) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<Accumul8ImportedTransactionCleanupPurgeResponse>(
        scopedActionUrl('purge_imported_transaction_cleanup'),
        { transaction_ids: transactionIds },
      );
      await load();
      if (onToast) {
        onToast({ tone: 'success', message: `Purged ${Number(res?.deleted_count || 0)} imported transaction${Number(res?.deleted_count || 0) === 1 ? '' : 's'}.` });
      }
      return res;
    } catch (error: any) {
      handleError(error, 'Failed to purge imported transactions');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl]);
  const purgeAllImportedStatementTransactions = React.useCallback(async () => {
    setBusy(true);
    try {
      const res = await ApiClient.post<Accumul8ImportedTransactionCleanupPurgeResponse>(
        scopedActionUrl('purge_all_imported_statement_transactions'),
        {},
      );
      await load();
      if (onToast) {
        onToast({ tone: 'success', message: `Purged ${Number(res?.deleted_count || 0)} bank-statement transaction${Number(res?.deleted_count || 0) === 1 ? '' : 's'}.` });
      }
      return res;
    } catch (error: any) {
      handleError(error, 'Failed to purge bank-statement transactions');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl]);
  const purgeAllStatementUploads = React.useCallback(async () => {
    setBusy(true);
    try {
      const res = await ApiClient.post<{ success: boolean; deleted_count: number }>(
        scopedActionUrl('purge_all_statement_uploads'),
        {},
      );
      await load();
      if (onToast) {
        onToast({ tone: 'success', message: `Deleted ${Number(res?.deleted_count || 0)} bank statement file${Number(res?.deleted_count || 0) === 1 ? '' : 's'}.` });
      }
      return res;
    } catch (error: any) {
      handleError(error, 'Failed to purge bank statement files');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl]);
  const createBudgetRow = React.useCallback(async (form: Accumul8BudgetRowUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('create_budget_row'), form),
      'Spreadsheet row saved',
    );
  }, [scopedActionUrl, withReload]);
  const updateBudgetRow = React.useCallback(async (id: number, form: Accumul8BudgetRowUpsertRequest) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('update_budget_row'), { id, ...form }),
      'Spreadsheet row updated',
    );
  }, [scopedActionUrl, withReload]);
  const deleteBudgetRow = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post(scopedActionUrl('delete_budget_row'), { id }),
      'Spreadsheet row deleted',
    );
  }, [scopedActionUrl, withReload]);
  React.useEffect(() => {
    void load();
  }, [load]);
  return {
    busy,
    loaded,
    summary,
    activeOwnerUserId,
    accessibleAccountOwners,
    entities,
    entityAliases,
    entityEndexGuides,
    entityEndexScanLogs,
    contacts,
    recurringPayments,
    transactions,
    bankingOrganizations,
    accounts,
    notificationRules,
    payBills,
    debtors,
    debtorLedger,
    budgetRows,
    bankConnections,
    statementUploads,
    archivedStatementUploads,
    statementAuditRuns,
    syncProvider,
    load,
    createEntity,
    updateEntity,
    createEntityAlias,
    deleteEntityAlias,
    findEntityAliases,
    findAllEntityAliases,
    createEntityEndexGuide,
    updateEntityEndexGuide,
    deleteEntityEndexGuide,
    createContact,
    createBankingOrganization,
    updateBankingOrganization,
    deleteBankingOrganization,
    createBankConnection,
    updateBankConnection,
    deleteBankConnection,
    createAccount,
    updateAccount,
    deleteAccount,
    updateContact,
    deleteContact,
    createDebtor,
    updateDebtor,
    deleteDebtor,
    createRecurring,
    updateRecurring,
    toggleRecurring,
    deleteRecurring,
    materializeDueRecurring,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    moveTransactionsToAccount,
    toggleTransactionPaid,
    toggleTransactionReconciled,
    toggleTransactionBudgetPlanner,
    createBudgetRow,
    updateBudgetRow,
    deleteBudgetRow,
    createNotificationRule,
    updateNotificationRule,
    toggleNotificationRule,
    deleteNotificationRule,
    sendNotification,
    syncBankConnection,
    uploadStatement,
    rescanStatementUpload,
    updateStatementUploadMetadata,
    archiveStatementUpload,
    restoreStatementUpload,
    deleteArchivedStatementUpload,
    confirmStatementImport,
    reconcileStatementUpload,
    importStatementReviewRow,
    linkStatementReviewRow,
    searchStatementUploads,
    auditStatementUploads,
    auditImportedTransactionCleanup,
    purgeImportedTransactionCleanup,
    purgeAllImportedStatementTransactions,
    purgeAllStatementUploads,
  };
}
