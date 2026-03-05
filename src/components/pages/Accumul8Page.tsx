import React from 'react';
import { PageLayout } from '../layout/PageLayout';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { useAccumul8 } from '../../hooks/useAccumul8';
import { ApiClient } from '../../core/ApiClient';
import { openPlaidLink } from '../../core/plaidLink';
import {
  Accumul8PlaidCreateLinkTokenResponse,
  Accumul8PlaidExchangeResponse,
  Accumul8PlaidSyncResponse,
} from '../../types/accumul8';
import './Accumul8Page.css';
interface Accumul8PageProps extends AppShellPageProps {
  onToast?: (toast: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}
type TabKey = 'ledger' | 'pay_bills' | 'contacts' | 'recurring' | 'notifications' | 'sync';
export function Accumul8Page({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle, onToast }: Accumul8PageProps) {
  const isAuthed = Boolean(viewer?.id);
  const isAdministrator = Number(viewer?.is_admin || 0) === 1 || Number(viewer?.is_administrator || 0) === 1;
  const isAccumul8User = Number(viewer?.is_accumul8_user || 0) === 1;
  const canAccess = isAuthed && (isAdministrator || isAccumul8User);
  const {
    busy,
    loaded,
    summary,
    contacts,
    recurringPayments,
    transactions,
    accounts,
    notificationRules,
    payBills,
    bankConnections,
    syncProvider,
    load,
    createContact,
    deleteContact,
    createRecurring,
    toggleRecurring,
    materializeDueRecurring,
    createTransaction,
    toggleTransactionPaid,
    toggleTransactionReconciled,
    createNotificationRule,
    toggleNotificationRule,
    sendNotification,
    syncBankConnection,
  } = useAccumul8(onToast);
  const [tab, setTab] = React.useState<TabKey>('ledger');
  const [contactForm, setContactForm] = React.useState({ contact_name: '', contact_type: 'both', default_amount: 0, email: '', notes: '' });
  const [recurringForm, setRecurringForm] = React.useState({ title: '', direction: 'outflow', amount: 0, frequency: 'monthly', interval_count: 1, next_due_date: '', contact_id: '', account_id: '', notes: '' });
  const [ledgerForm, setLedgerForm] = React.useState({ transaction_date: new Date().toISOString().slice(0, 10), due_date: '', entry_type: 'manual', description: '', memo: '', amount: 0, rta_amount: 0, is_paid: 0, is_reconciled: 0, contact_id: '', account_id: '' });
  const [notificationForm, setNotificationForm] = React.useState({ rule_name: '', trigger_type: 'upcoming_due', days_before_due: 3, target_scope: 'group' as 'group' | 'custom', custom_user_ids: '', email_subject_template: '', email_body_template: '' });
  const [syncHelpOpen, setSyncHelpOpen] = React.useState(false);
  const [syncHelpToken, setSyncHelpToken] = React.useState('');
  const [syncHelpError, setSyncHelpError] = React.useState('');
  const openSyncHelp = React.useCallback((opts?: { token?: string; error?: string }) => {
    setSyncHelpToken(String(opts?.token || ''));
    setSyncHelpError(String(opts?.error || ''));
    setSyncHelpOpen(true);
  }, []);
  const runPlaidLink = React.useCallback(async () => {
    if (!onToast) return;
    if (!syncProvider.configured) {
      onToast({ tone: 'error', message: 'Plaid is not configured. Save credentials in Settings first.' });
      return;
    }

    try {
      const tokenRes = await ApiClient.post<Accumul8PlaidCreateLinkTokenResponse>('/api/accumul8.php?action=plaid_create_link_token', { client_name: 'Accumul8' });
      const token = String(tokenRes?.link_token || '');
      if (!token) {
        throw new Error('No link token returned');
      }

      setSyncHelpError('');
      setSyncHelpToken(token);

      const linkResult = await openPlaidLink(token);

      if (linkResult.outcome === 'cancelled') {
        onToast({ tone: 'info', message: 'Plaid Link was closed before connecting an account.' });
        return;
      }

      const institutionId = String(linkResult.metadata?.institution?.institution_id || '');
      const institutionName = String(linkResult.metadata?.institution?.name || '');
      const exchangeRes = await ApiClient.post<Accumul8PlaidExchangeResponse>('/api/accumul8.php?action=plaid_exchange_public_token', {
        public_token: String(linkResult.publicToken || ''),
        institution_id: institutionId,
        institution_name: institutionName,
      });
      const connectionId = Number(exchangeRes?.connection_id || 0);
      if (connectionId <= 0) {
        throw new Error('Plaid exchange did not return a valid connection id');
      }
      const syncRes = await ApiClient.post<Accumul8PlaidSyncResponse>('/api/accumul8.php?action=plaid_sync_transactions', {
        connection_id: connectionId,
      });
      const added = Number(syncRes?.added || 0);
      onToast({ tone: 'success', message: `Plaid connected and synced (${added} transaction${added === 1 ? '' : 's'} imported).` });
      await load();
    } catch (error: any) {
      const message = String(error?.message || 'Failed to create Plaid link token');
      openSyncHelp({ error: message });
      onToast({ tone: 'error', message });
    }
  }, [load, onToast, openSyncHelp, syncProvider.configured]);
  if (!isAuthed) {
    return (
      <PageLayout page="accumul8" title="Accumul8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
        <section className="section">
          <div className="container">
            <h1 className="section-title">Accumul8</h1>
            <div className="catn8-card p-3">
              <p className="mb-2">Login required.</p>
              <button type="button" className="btn btn-primary" onClick={onLoginClick}>Log in</button>
            </div>
          </div>
        </section>
      </PageLayout>
    );
  }
  if (!canAccess) {
    return (
      <PageLayout page="accumul8" title="Accumul8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
        <section className="section">
          <div className="container">
            <h1 className="section-title">Accumul8</h1>
            <div className="catn8-card p-3">
              <p className="mb-0">Your account is not in the <strong>Accumul8 Users</strong> group. Ask an administrator to grant access.</p>
            </div>
          </div>
        </section>
      </PageLayout>
    );
  }
  return (
    <PageLayout page="accumul8" title="Accumul8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className="section">
        <div className="container accumul8-page">
          <h1 className="section-title mb-2">Accumul8</h1>
          <div className="accumul8-summary-grid">
            <div className="accumul8-summary-card"><span>Net</span><strong>${summary.net_amount.toFixed(2)}</strong></div>
            <div className="accumul8-summary-card"><span>Inflow</span><strong>${summary.inflow_total.toFixed(2)}</strong></div>
            <div className="accumul8-summary-card"><span>Outflow</span><strong>${summary.outflow_total.toFixed(2)}</strong></div>
            <div className="accumul8-summary-card"><span>Unpaid Bills</span><strong>${summary.unpaid_outflow_total.toFixed(2)}</strong></div>
          </div>
          <div className="accumul8-tabs mt-3">
            {[
              ['ledger', 'Ledger'],
              ['pay_bills', 'Pay Bills'],
              ['contacts', 'Payees/Payers'],
              ['recurring', 'Recurring'],
              ['notifications', 'Notifications'],
              ['sync', 'Sync'],
            ].map(([key, label]) => (
              <button key={key} type="button" className={`btn ${tab === key ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab(key as TabKey)}>{label}</button>
            ))}
          </div>
          {tab === 'ledger' && (
            <div className="accumul8-panel">
              <h3>Ledger (Checkbook Style)</h3>
              <form className="row g-2" onSubmit={(e) => { e.preventDefault(); void createTransaction({ ...ledgerForm, amount: Number(ledgerForm.amount), rta_amount: Number(ledgerForm.rta_amount), contact_id: ledgerForm.contact_id ? Number(ledgerForm.contact_id) : null, account_id: ledgerForm.account_id ? Number(ledgerForm.account_id) : null }); }}>
                <div className="col-md-2"><input className="form-control" type="date" value={ledgerForm.transaction_date} onChange={(e) => setLedgerForm((v) => ({ ...v, transaction_date: e.target.value }))} required /></div>
                <div className="col-md-2"><input className="form-control" type="date" value={ledgerForm.due_date} onChange={(e) => setLedgerForm((v) => ({ ...v, due_date: e.target.value }))} /></div>
                <div className="col-md-2"><select className="form-select" value={ledgerForm.entry_type} onChange={(e) => setLedgerForm((v) => ({ ...v, entry_type: e.target.value }))}><option value="manual">Manual</option><option value="auto">Auto</option><option value="transfer">Transfer</option><option value="deposit">Deposit</option><option value="bill">Bill</option></select></div>
                <div className="col-md-3"><input className="form-control" placeholder="Description" value={ledgerForm.description} onChange={(e) => setLedgerForm((v) => ({ ...v, description: e.target.value }))} required /></div>
                <div className="col-md-3"><input className="form-control" type="number" step="0.01" value={ledgerForm.amount} onChange={(e) => setLedgerForm((v) => ({ ...v, amount: Number(e.target.value) }))} required /></div>
                <div className="col-md-3"><select className="form-select" value={ledgerForm.contact_id} onChange={(e) => setLedgerForm((v) => ({ ...v, contact_id: e.target.value }))}><option value="">Contact</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.contact_name}</option>)}</select></div>
                <div className="col-md-3"><select className="form-select" value={ledgerForm.account_id} onChange={(e) => setLedgerForm((v) => ({ ...v, account_id: e.target.value }))}><option value="">Account</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}</select></div>
                <div className="col-md-2"><input className="form-control" placeholder="RTA" type="number" step="0.01" value={ledgerForm.rta_amount} onChange={(e) => setLedgerForm((v) => ({ ...v, rta_amount: Number(e.target.value) }))} /></div>
                <div className="col-md-2 d-grid"><button className="btn btn-success" type="submit" disabled={busy}>Add</button></div>
              </form>
              <div className="table-responsive mt-3">
                <table className="table table-sm accumul8-ledger-table">
                  <thead><tr><th>Date</th><th>Due</th><th>Payee/Payer</th><th>Memo</th><th className="text-end">Amount</th><th className="text-end">Balance</th><th>Paid</th><th>Reconciled</th></tr></thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className={tx.amount < 0 ? 'is-outflow' : 'is-inflow'}>
                        <td>{tx.transaction_date}</td>
                        <td>{tx.due_date || '-'}</td>
                        <td>{tx.description}</td>
                        <td>{tx.memo || tx.contact_name || '-'}</td>
                        <td className="text-end">{tx.amount.toFixed(2)}</td>
                        <td className="text-end">{tx.running_balance.toFixed(2)}</td>
                        <td><button type="button" className={`btn btn-sm ${tx.is_paid ? 'btn-success' : 'btn-outline-secondary'}`} onClick={() => void toggleTransactionPaid(tx.id)}>{tx.is_paid ? 'Yes' : 'No'}</button></td>
                        <td><button type="button" className={`btn btn-sm ${tx.is_reconciled ? 'btn-success' : 'btn-outline-secondary'}`} onClick={() => void toggleTransactionReconciled(tx.id)}>{tx.is_reconciled ? 'Yes' : 'No'}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === 'pay_bills' && (
            <div className="accumul8-panel">
              <h3>Pay Bills Queue</h3>
              <button type="button" className="btn btn-outline-primary btn-sm mb-2" onClick={() => void materializeDueRecurring()} disabled={busy}>Post Due Recurring Bills</button>
              <div className="table-responsive">
                <table className="table table-striped table-sm">
                  <thead><tr><th>Due Date</th><th>Description</th><th className="text-end">Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {payBills.map((bill) => (
                      <tr key={bill.id}>
                        <td>{bill.due_date || bill.transaction_date}</td>
                        <td>{bill.description}</td>
                        <td className="text-end">{bill.amount.toFixed(2)}</td>
                        <td>{bill.is_paid ? 'Paid' : 'Unpaid'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === 'contacts' && (
            <div className="accumul8-panel">
              <h3>Manage Payees and Payers</h3>
              <form className="row g-2" onSubmit={(e) => { e.preventDefault(); void createContact({ ...contactForm, default_amount: Number(contactForm.default_amount) }); }}>
                <div className="col-md-3"><input className="form-control" placeholder="Name" value={contactForm.contact_name} onChange={(e) => setContactForm((v) => ({ ...v, contact_name: e.target.value }))} required /></div>
                <div className="col-md-2"><select className="form-select" value={contactForm.contact_type} onChange={(e) => setContactForm((v) => ({ ...v, contact_type: e.target.value }))}><option value="payee">Payee</option><option value="payer">Payer</option><option value="both">Both</option></select></div>
                <div className="col-md-2"><input className="form-control" type="number" step="0.01" placeholder="Default Amount" value={contactForm.default_amount} onChange={(e) => setContactForm((v) => ({ ...v, default_amount: Number(e.target.value) }))} /></div>
                <div className="col-md-2"><input className="form-control" type="email" placeholder="Email" value={contactForm.email} onChange={(e) => setContactForm((v) => ({ ...v, email: e.target.value }))} /></div>
                <div className="col-md-2"><input className="form-control" placeholder="Notes" value={contactForm.notes} onChange={(e) => setContactForm((v) => ({ ...v, notes: e.target.value }))} /></div>
                <div className="col-md-1 d-grid"><button className="btn btn-success" type="submit" disabled={busy}>Add</button></div>
              </form>
              <ul className="list-group mt-3">
                {contacts.map((c) => (
                  <li key={c.id} className="list-group-item d-flex justify-content-between align-items-center">
                    <span>{c.contact_name} <small className="text-muted">({c.contact_type})</small></span>
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => void deleteContact(c.id)}>Delete</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {tab === 'recurring' && (
            <div className="accumul8-panel">
              <h3>Recurring Payments</h3>
              <form className="row g-2" onSubmit={(e) => { e.preventDefault(); void createRecurring({ ...recurringForm, amount: Number(recurringForm.amount), interval_count: Number(recurringForm.interval_count), contact_id: recurringForm.contact_id ? Number(recurringForm.contact_id) : null, account_id: recurringForm.account_id ? Number(recurringForm.account_id) : null }); }}>
                <div className="col-md-3"><input className="form-control" placeholder="Title" value={recurringForm.title} onChange={(e) => setRecurringForm((v) => ({ ...v, title: e.target.value }))} required /></div>
                <div className="col-md-2"><select className="form-select" value={recurringForm.direction} onChange={(e) => setRecurringForm((v) => ({ ...v, direction: e.target.value }))}><option value="outflow">Outflow</option><option value="inflow">Inflow</option></select></div>
                <div className="col-md-2"><input className="form-control" type="number" step="0.01" value={recurringForm.amount} onChange={(e) => setRecurringForm((v) => ({ ...v, amount: Number(e.target.value) }))} required /></div>
                <div className="col-md-2"><select className="form-select" value={recurringForm.frequency} onChange={(e) => setRecurringForm((v) => ({ ...v, frequency: e.target.value }))}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="monthly">Monthly</option></select></div>
                <div className="col-md-1"><input className="form-control" type="number" value={recurringForm.interval_count} min={1} max={365} onChange={(e) => setRecurringForm((v) => ({ ...v, interval_count: Number(e.target.value) }))} /></div>
                <div className="col-md-2"><input className="form-control" type="date" value={recurringForm.next_due_date} onChange={(e) => setRecurringForm((v) => ({ ...v, next_due_date: e.target.value }))} required /></div>
                <div className="col-md-3"><select className="form-select" value={recurringForm.contact_id} onChange={(e) => setRecurringForm((v) => ({ ...v, contact_id: e.target.value }))}><option value="">Contact</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.contact_name}</option>)}</select></div>
                <div className="col-md-3"><select className="form-select" value={recurringForm.account_id} onChange={(e) => setRecurringForm((v) => ({ ...v, account_id: e.target.value }))}><option value="">Account</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}</select></div>
                <div className="col-md-4"><input className="form-control" placeholder="Notes" value={recurringForm.notes} onChange={(e) => setRecurringForm((v) => ({ ...v, notes: e.target.value }))} /></div>
                <div className="col-md-2 d-grid"><button className="btn btn-success" type="submit" disabled={busy}>Save</button></div>
              </form>
              <div className="table-responsive mt-3">
                <table className="table table-sm">
                  <thead><tr><th>Title</th><th>Next Due</th><th className="text-end">Amount</th><th>Frequency</th><th>Status</th></tr></thead>
                  <tbody>
                    {recurringPayments.map((rp) => (
                      <tr key={rp.id}>
                        <td>{rp.title}</td>
                        <td>{rp.next_due_date}</td>
                        <td className="text-end">{rp.amount.toFixed(2)}</td>
                        <td>{rp.frequency}</td>
                        <td><button type="button" className={`btn btn-sm ${rp.is_active ? 'btn-success' : 'btn-outline-secondary'}`} onClick={() => void toggleRecurring(rp.id)}>{rp.is_active ? 'Active' : 'Paused'}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === 'notifications' && (
            <div className="accumul8-panel">
              <h3>Notification Rules</h3>
              <form className="row g-2" onSubmit={(e) => { e.preventDefault(); void createNotificationRule({ ...notificationForm, days_before_due: Number(notificationForm.days_before_due), custom_user_ids: notificationForm.custom_user_ids.split(',').map((v) => Number(v.trim())).filter((n) => Number.isFinite(n) && n > 0) }); }}>
                <div className="col-md-3"><input className="form-control" placeholder="Rule Name" value={notificationForm.rule_name} onChange={(e) => setNotificationForm((v) => ({ ...v, rule_name: e.target.value }))} required /></div>
                <div className="col-md-2"><select className="form-select" value={notificationForm.target_scope} onChange={(e) => setNotificationForm((v) => ({ ...v, target_scope: e.target.value as 'group' | 'custom' }))}><option value="group">Accumul8 Users + Admins</option><option value="custom">Custom user IDs</option></select></div>
                <div className="col-md-1"><input className="form-control" type="number" min={0} max={90} value={notificationForm.days_before_due} onChange={(e) => setNotificationForm((v) => ({ ...v, days_before_due: Number(e.target.value) }))} /></div>
                <div className="col-md-2"><input className="form-control" placeholder="User IDs (1,2,3)" value={notificationForm.custom_user_ids} onChange={(e) => setNotificationForm((v) => ({ ...v, custom_user_ids: e.target.value }))} /></div>
                <div className="col-md-4"><input className="form-control" placeholder="Email Subject" value={notificationForm.email_subject_template} onChange={(e) => setNotificationForm((v) => ({ ...v, email_subject_template: e.target.value }))} required /></div>
                <div className="col-md-10"><textarea className="form-control" rows={2} placeholder="Email Body" value={notificationForm.email_body_template} onChange={(e) => setNotificationForm((v) => ({ ...v, email_body_template: e.target.value }))} required /></div>
                <div className="col-md-2 d-grid"><button className="btn btn-success" type="submit" disabled={busy}>Save Rule</button></div>
              </form>
              <div className="mt-3 d-flex flex-column gap-2">
                {notificationRules.map((r) => (
                  <div key={r.id} className="catn8-card p-2 d-flex justify-content-between align-items-center gap-2">
                    <div>
                      <div className="fw-bold">{r.rule_name}</div>
                      <div className="text-muted small">{r.target_scope === 'group' ? 'Group recipients' : 'Custom recipients'} | {r.days_before_due} day lead</div>
                    </div>
                    <div className="d-flex gap-2">
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void sendNotification({ rule_id: r.id })} disabled={busy}>Send Now</button>
                      <button type="button" className={`btn btn-sm ${r.is_active ? 'btn-success' : 'btn-outline-secondary'}`} onClick={() => void toggleNotificationRule(r.id)}>{r.is_active ? 'Active' : 'Paused'}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === 'sync' && (
            <div className="accumul8-panel">
              <h3>Bank Sync Groundwork</h3>
              <p className="mb-2">Provider: <strong>{syncProvider.provider}</strong> ({syncProvider.env}). Configuration status: <strong>{syncProvider.configured ? 'Configured' : 'Missing API keys'}</strong>.</p>
              <div className="d-flex gap-2 flex-wrap mb-3">
                <button type="button" className="btn btn-outline-primary" onClick={() => void runPlaidLink()} disabled={busy || !syncProvider.configured}>Connect Bank via Plaid</button>
                <button type="button" className="btn btn-outline-secondary" onClick={() => openSyncHelp()}>Show Setup Guide</button>
              </div>
              <h4 className="h6">Connected Institutions</h4>
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead><tr><th>Institution</th><th>Status</th><th>Last Sync</th><th></th></tr></thead>
                  <tbody>
                    {bankConnections.map((c: any) => (
                      <tr key={c.id}>
                        <td>{c.institution_name || c.institution_id || 'Unknown'}</td>
                        <td>{c.status}</td>
                        <td>{c.last_sync_at || '-'}</td>
                        <td className="text-end"><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void syncBankConnection(Number(c.id || 0))} disabled={busy}>Sync</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small text-muted mb-0">Target institutions include Capital One, Navy Federal Credit Union, Barclays, Fifth Third, and Truist via the Plaid institution network.</p>
            </div>
          )}
          {syncHelpOpen && (
            <div className="accumul8-help-overlay" role="dialog" aria-modal="true" aria-label="Plaid setup guide">
              <div className="accumul8-help-modal">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <h4 className="h6 mb-0">Plaid Sync Setup Guide</h4>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSyncHelpOpen(false)}>Close</button>
                </div>
                {syncHelpError ? <div className="alert alert-warning py-2"><strong>Current error:</strong> {syncHelpError}</div> : null}
                {syncHelpToken ? <div className="alert alert-success py-2"><strong>Link token generated:</strong> <code>{syncHelpToken.slice(0, 40)}...</code></div> : null}
                <ol className="mb-2 ps-3">
                  <li>Create/get your Plaid credentials in <a href="https://dashboard.plaid.com/team/keys" target="_blank" rel="noreferrer">Plaid Dashboard Keys</a>.</li>
                  <li>Set `accumul8.plaid.client_id`, `accumul8.plaid.secret`, and optional `accumul8.plaid.env` in your server secret store.</li>
                  <li>Click <strong>Connect Bank via Plaid</strong> in this tab.</li>
                  <li>Complete Plaid Link and authorize your institution.</li>
                  <li>Accumul8 will automatically exchange token, save the connection, and sync transactions.</li>
                </ol>
                <div className="small">
                  Quick references: <a href="https://plaid.com/docs/quickstart/" target="_blank" rel="noreferrer">Plaid Quickstart</a> | <a href="https://plaid.com/docs/api/items/#itempublic_tokenexchange" target="_blank" rel="noreferrer">Public Token Exchange API</a>
                </div>
              </div>
            </div>
          )}
          {!loaded && <div className="text-muted mt-2">Loading Accumul8...</div>}
        </div>
      </section>
    </PageLayout>
  );
}
