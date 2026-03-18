import React from 'react';

import { WebpImage } from '../../common/WebpImage';
import { resolveAccumul8BankingOrganizationIconPath } from '../../../utils/accumul8BankingOrganizationBranding';
import { formatAccountOptionLabel, formatCurrencyAmount, formatSummaryWindowLabel } from './accumul8PageDateSearchUtils';
import { getActiveFilterClass, normalizeEntityKind } from './accumul8PageEntityUtils';
import { Accumul8Account } from '../../../types/accumul8';

interface Accumul8PageHeaderProps {
  accessibleAccountOwners: Array<{ owner_user_id: number; username: string; is_self?: number }>;
  activeOwnerUserId: number;
  bankingOrganizations: Array<{ id: number; banking_organization_name: string }>;
  busy: boolean;
  entitiesSorted: Array<{ entity_kind?: string | null; is_vendor?: number | null; is_payee?: number | null; is_payer?: number | null; is_balance_person?: number | null }>;
  formatAccountOptionLabel: typeof formatAccountOptionLabel;
  formatCurrencyAmount: typeof formatCurrencyAmount;
  formatSummaryWindowLabel: typeof formatSummaryWindowLabel;
  getActiveFilterClass: typeof getActiveFilterClass;
  handleProjectedBalanceCardClick: () => void;
  headerSummary: { currentBalance: number; unpaidBills: number; windfalls: number };
  isHeaderLogoSpinning: boolean;
  launchableBankingOrganizations: Array<{ id: number; banking_organization_name: string; icon_path?: string | null; login_url?: string | null }>;
  messageBoardUnacknowledgedCount: number;
  normalizeEntityKind: typeof normalizeEntityKind;
  onOpenBankingOrganizationManager: () => void;
  onOpenAccountManager: () => void;
  onOpenMessageBoard: () => void;
  onOpenPopup: (loginUrl: string | null | undefined, organizationName: string) => void;
  onSelectBankAccount: (value: string) => void;
  onSelectBankingOrganization: (value: string) => void;
  onSelectOwner: (ownerId: number) => void;
  onSelectTab: (tab: 'aicountant' | 'spreadsheet' | 'calendar' | 'debtors' | 'ledger' | 'pay_bills' | 'contacts' | 'entity_endex' | 'notifications' | 'recurring' | 'sync' | 'statements') => void;
  projectedBalanceForWindow: number;
  selectedBankAccountId: string;
  selectedBankingOrganizationId: string;
  settingsButtonRef: React.RefObject<HTMLButtonElement | null>;
  settingsMenuOpen: boolean;
  settingsMenuPosition: { top: number; left: number; width: number };
  settingsMenuRef: React.RefObject<HTMLDivElement | null>;
  setSettingsMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  summaryWindow: 'current' | 7 | 30 | 60 | 90;
  tab: string;
  visibleAccounts: Accumul8Account[];
}

export function Accumul8PageHeader({
  accessibleAccountOwners,
  activeOwnerUserId,
  bankingOrganizations,
  busy,
  entitiesSorted,
  formatAccountOptionLabel,
  formatCurrencyAmount,
  formatSummaryWindowLabel,
  getActiveFilterClass,
  handleProjectedBalanceCardClick,
  headerSummary,
  isHeaderLogoSpinning,
  launchableBankingOrganizations,
  messageBoardUnacknowledgedCount,
  normalizeEntityKind,
  onOpenAccountManager,
  onOpenBankingOrganizationManager,
  onOpenMessageBoard,
  onOpenPopup,
  onSelectBankAccount,
  onSelectBankingOrganization,
  onSelectOwner,
  onSelectTab,
  projectedBalanceForWindow,
  selectedBankAccountId,
  selectedBankingOrganizationId,
  settingsButtonRef,
  settingsMenuOpen,
  settingsMenuPosition,
  settingsMenuRef,
  setSettingsMenuOpen,
  summaryWindow,
  tab,
  visibleAccounts,
}: Accumul8PageHeaderProps) {
  return (
    <div className="accumul8-page-header mb-2">
      <div className="accumul8-page-title-row">
        <h1 className="section-title mb-0 accumul8-title-mark">
          <button
            type="button"
            className={`accumul8-title-mark-button${messageBoardUnacknowledgedCount > 0 ? ' has-alert' : ''}`}
            onClick={onOpenMessageBoard}
            aria-label={`Open message board${messageBoardUnacknowledgedCount > 0 ? ` (${messageBoardUnacknowledgedCount} new)` : ''}`}
          >
            <span className="visually-hidden">ACCUMUL8</span>
            <picture className="accumul8-title-mark-picture" aria-hidden="true">
              <source srcSet="/images/branding/accumul8-title.webp" type="image/webp" />
              <img className="accumul8-title-mark-image" src="/images/branding/accumul8-title.png" alt="" />
            </picture>
          </button>
        </h1>
        <div className="accumul8-header-control-deck">
          <div className="accumul8-header-primary-row">
            <div className="accumul8-tabs accumul8-tabs--header">
              <div className="accumul8-tabs accumul8-tabs--header-buttons">
                {[
                  ['aicountant', 'AIcountant'],
                  ['spreadsheet', 'Budget'],
                  ['calendar', 'Calendar'],
                  ['debtors', 'IOU'],
                  ['ledger', 'Ledger'],
                  ['pay_bills', 'Bills'],
                ].map(([key, label]) => (
                  <button key={key} type="button" className={`btn ${tab === key ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => onSelectTab(key as never)}>{label}</button>
                ))}
                <div className="accumul8-settings-menu-anchor" ref={settingsMenuRef}>
                  <button
                    ref={settingsButtonRef}
                    type="button"
                    className={`btn ${settingsMenuOpen ? 'btn-primary' : 'btn-outline-primary'}`}
                    aria-haspopup="dialog"
                    aria-expanded={settingsMenuOpen}
                    onClick={() => setSettingsMenuOpen((current) => !current)}
                  >
                    Tools
                  </button>
                  {settingsMenuOpen ? (
                    <div
                      className="accumul8-settings-modal"
                      role="dialog"
                      aria-label="Accumul8 tools sections"
                      style={{ top: `${settingsMenuPosition.top}px`, left: `${settingsMenuPosition.left}px`, width: `${settingsMenuPosition.width}px` }}
                    >
                      <div className="accumul8-settings-modal-actions">
                        <button type="button" className="btn btn-outline-primary" onClick={() => { onSelectTab('statements'); setSettingsMenuOpen(false); }}>
                          Bank Statements
                        </button>
                        {[
                          ['contacts', 'Entities'],
                          ['entity_endex', 'Entity Endex'],
                          ['notifications', 'Notifications'],
                          ['recurring', 'Recurring'],
                          ['sync', 'Sync'],
                        ].map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            className={`btn ${tab === key ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => { onSelectTab(key as never); setSettingsMenuOpen(false); }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="accumul8-owner-selector">
              <select
                id="accumul8-owner-select"
                className="form-select form-select-sm"
                aria-label="Viewing owner"
                value={activeOwnerUserId > 0 ? String(activeOwnerUserId) : ''}
                onChange={(e) => {
                  const next = Number(e.target.value || 0);
                  if (!Number.isFinite(next) || next <= 0) return;
                  onSelectOwner(next);
                }}
                disabled={busy || accessibleAccountOwners.length <= 1}
              >
                {accessibleAccountOwners.map((owner) => (
                  <option key={owner.owner_user_id} value={owner.owner_user_id}>
                    {owner.username}
                    {Number(owner.is_self || 0) === 1 ? ' (You)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="accumul8-page-toolbar accumul8-page-toolbar--embedded">
            <div className="accumul8-page-filters">
              <div className="accumul8-filter-stack">
                <div className="accumul8-toolbar-field accumul8-toolbar-field--banking-org">
                  <div className="accumul8-filter-control-row">
                    <button type="button" className="btn btn-outline-secondary btn-sm accumul8-filter-gear" onClick={onOpenBankingOrganizationManager} aria-label="Manage banking organizations" title="Manage banking organizations">
                      <i className="bi bi-gear"></i>
                    </button>
                    <select
                      id="accumul8-group-filter"
                      className={getActiveFilterClass('form-select form-select-sm', selectedBankingOrganizationId !== '')}
                      aria-label="Banking Organization"
                      value={selectedBankingOrganizationId}
                      onChange={(e) => onSelectBankingOrganization(e.target.value)}
                    >
                      <option value="">All Banking Organizations</option>
                      {bankingOrganizations.map((organization) => (
                        <option key={organization.id} value={organization.id}>{organization.banking_organization_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="accumul8-toolbar-field accumul8-toolbar-field--bank-account">
                  <div className="accumul8-filter-control-row">
                    <button type="button" className="btn btn-outline-secondary btn-sm accumul8-filter-gear" onClick={onOpenAccountManager} aria-label="Manage bank accounts" title="Manage bank accounts">
                      <i className="bi bi-gear"></i>
                    </button>
                    <select
                      id="accumul8-bank-filter"
                      className={getActiveFilterClass('form-select form-select-sm', selectedBankAccountId !== '')}
                      aria-label="Bank account"
                      value={selectedBankAccountId}
                      onChange={(e) => onSelectBankAccount(e.target.value)}
                    >
                      <option value="">All bank accounts</option>
                      {visibleAccounts.map((account, index) => (
                        <option key={String(account.id ?? index)} value={String(account.id ?? '')}>{formatAccountOptionLabel(account)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              {launchableBankingOrganizations.length ? (
                <div className="accumul8-bank-launcher-panel">
                  <div className="accumul8-bank-launcher-group" aria-label="Banking organization quick links">
                    {launchableBankingOrganizations.map((organization) => {
                      const organizationIconPath = resolveAccumul8BankingOrganizationIconPath(organization.banking_organization_name, organization.icon_path);
                      return (
                        <button
                          key={organization.id}
                          type="button"
                          className={`btn btn-outline-secondary btn-sm accumul8-bank-launcher${selectedBankingOrganizationId === String(organization.id) ? ' accumul8-bank-launcher--selected' : ''}`}
                          onClick={() => onOpenPopup(organization.login_url, organization.banking_organization_name)}
                          aria-label={`Open ${organization.banking_organization_name}`}
                          title={`Open ${organization.banking_organization_name}`}
                        >
                          {organizationIconPath ? (
                            <img className="accumul8-bank-launcher-icon" src={organizationIconPath} alt="" aria-hidden="true" />
                          ) : (
                            <span className="accumul8-bank-launcher-emoji" aria-hidden="true">🏦</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {tab === 'contacts' ? (
                <div className="accumul8-toolbar-summary" aria-label="Entity summary">
                  <div className="accumul8-summary-card"><span>Total</span><strong>{entitiesSorted.length}</strong></div>
                  <div className="accumul8-summary-card"><span>Payees/Payers</span><strong>{entitiesSorted.filter((entity) => Number(entity.is_payee || 0) === 1 || Number(entity.is_payer || 0) === 1).length}</strong></div>
                  <div className="accumul8-summary-card"><span>Businesses</span><strong>{entitiesSorted.filter((entity) => normalizeEntityKind(entity.entity_kind, entity.is_vendor) === 'business').length}</strong></div>
                  <div className="accumul8-summary-card"><span>Balance People</span><strong>{entitiesSorted.filter((entity) => Number(entity.is_balance_person || 0) === 1).length}</strong></div>
                </div>
              ) : null}
            </div>
            <div className="accumul8-summary-grid">
              <div className="accumul8-summary-card"><span>Current Balance</span><strong>{formatCurrencyAmount(headerSummary.currentBalance)}</strong></div>
              <button type="button" className="accumul8-summary-card accumul8-summary-card--button" onClick={handleProjectedBalanceCardClick} aria-label={`${formatSummaryWindowLabel(summaryWindow)} projected balance. Click to change summary window.`} title={`Showing selected-account balance for ${formatSummaryWindowLabel(summaryWindow).toLowerCase()}. Click to cycle Current, 7 days, 30 days, 60 days, and 90 days.`}>
                <span>{`Balance (${formatSummaryWindowLabel(summaryWindow)})`}</span>
                <strong>{formatCurrencyAmount(projectedBalanceForWindow)}</strong>
              </button>
              <button type="button" className="accumul8-summary-card accumul8-summary-card--button" onClick={handleProjectedBalanceCardClick} aria-label={`${formatSummaryWindowLabel(summaryWindow)} unpaid bills. Click to change summary window.`} title={`Showing unpaid bills for ${formatSummaryWindowLabel(summaryWindow).toLowerCase()}. Click to cycle Current, 7 days, 30 days, 60 days, and 90 days.`}>
                <span>{`Unpaid Bills (${formatSummaryWindowLabel(summaryWindow)})`}</span>
                <strong>{formatCurrencyAmount(headerSummary.unpaidBills)}</strong>
              </button>
              <button type="button" className="accumul8-summary-card accumul8-summary-card--button" onClick={handleProjectedBalanceCardClick} aria-label={`${formatSummaryWindowLabel(summaryWindow)} windfalls. Click to change summary window.`} title={`Showing non-recurring deposits for ${formatSummaryWindowLabel(summaryWindow).toLowerCase()}. Click to cycle Current, 7 days, 30 days, 60 days, and 90 days.`}>
                <span>{`Windfalls (${formatSummaryWindowLabel(summaryWindow)})`}</span>
                <strong>{formatCurrencyAmount(headerSummary.windfalls)}</strong>
              </button>
            </div>
          </div>
        </div>
        <a className={`accumul8-header-brand-logo${isHeaderLogoSpinning ? ' accumul8-header-brand-logo--syncing' : ''}`} href="https://catn8.us" aria-label="Go to catn8.us">
          <WebpImage className="accumul8-header-brand-logo-image" src="/images/catn8_logo.png" alt="catn8.us Logo" />
        </a>
      </div>
    </div>
  );
}
