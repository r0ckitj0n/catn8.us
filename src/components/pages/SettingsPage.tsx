import React from 'react';
import { PageLayout } from '../layout/PageLayout';
import { EmailConfigModal } from '../modals/EmailConfigModal';
import { UserAccountsModal } from '../modals/UserAccountsModal';
import { GroupMembershipsModal } from '../modals/GroupMembershipsModal';
import { AuthPolicyModal } from '../modals/AuthPolicyModal';
import { SiteAppearanceModal } from '../modals/SiteAppearanceModal';
import { WordsearchSettingsModal } from '../modals/WordsearchSettingsModal';
import { DbConfigModal } from '../modals/DbConfigModal';
import { DeployConfigModal } from '../modals/DeployConfigModal';
import { DocumentSettingsModal } from '../modals/DocumentSettingsModal';
import { StandardizedIconsModal } from '../modals/StandardizedIconsModal';
import { CustomCssSettingsModal } from '../modals/CustomCssSettingsModal';
import { IToast } from '../../types/common';

interface SettingsPageProps {
  viewer: any;
  onLoginClick: () => void;
  onLogout: () => void;
  onAccountClick: () => void;
  onOpenAiImageConfig: () => void;
  onOpenAiConfig: () => void;
  onOpenAiVoiceCommunication: () => void;
  onToast: (toast: IToast) => void;
  mysteryTitle?: string;
  page: string;
}

export function SettingsPage({
  viewer,
  onLoginClick,
  onLogout,
  onAccountClick,
  onOpenAiImageConfig,
  onOpenAiConfig,
  onOpenAiVoiceCommunication,
  onToast,
  mysteryTitle,
  page,
}: SettingsPageProps) {
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [usersOpen, setUsersOpen] = React.useState(false);
  const [groupsOpen, setGroupsOpen] = React.useState(false);
  const [policyOpen, setPolicyOpen] = React.useState(false);
  const [appearanceOpen, setAppearanceOpen] = React.useState(false);
  const [wordsearchOpen, setWordsearchOpen] = React.useState(false);
  const [dbOpen, setDbOpen] = React.useState(false);
  const [deployOpen, setDeployOpen] = React.useState(false);
  const [documentSettingsOpen, setDocumentSettingsOpen] = React.useState(false);
  const [iconsOpen, setIconsOpen] = React.useState(false);
  const [customCssOpen, setCustomCssOpen] = React.useState(false);

  return (
    <>
      <PageLayout page="settings" title="Settings" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
        <section className="section">
          <div className="container">
            <h1 className="section-title">Settings</h1>
            <p className="lead text-center mb-4">Configure site tools using modals.</p>
            <div className="d-flex flex-wrap gap-2 justify-content-center">
              <button type="button" className="btn btn-primary" onClick={() => setEmailOpen(true)}>
                Email Configuration
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setUsersOpen(true)}>
                User Accounts
              </button>
              {Number(viewer?.is_admin || 0) === 1 ? (
                <button type="button" className="btn btn-primary" onClick={() => setGroupsOpen(true)}>
                  Group Access
                </button>
              ) : null}
              <button type="button" className="btn btn-primary" onClick={() => setPolicyOpen(true)}>
                Account Policy
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setAppearanceOpen(true)}>
                Site Appearance
              </button>
              <button type="button" className="btn btn-primary" onClick={() => {
                if (typeof onOpenAiConfig === 'function') onOpenAiConfig();
              }}>
                AI Configuration
              </button>
              {Number(viewer?.is_admin || 0) === 1 ? (
                <button type="button" className="btn btn-primary" onClick={() => {
                  if (typeof onOpenAiVoiceCommunication === 'function') onOpenAiVoiceCommunication();
                }}>
                  AI Voice Configuration
                </button>
              ) : null}
              {Number(viewer?.is_admin || 0) === 1 ? (
                <button type="button" className="btn btn-primary" onClick={() => {
                  if (typeof onOpenAiImageConfig === 'function') onOpenAiImageConfig();
                }}>
                  AI Image Configuration
                </button>
              ) : null}
              <button type="button" className="btn btn-primary" onClick={() => setWordsearchOpen(true)}>
                Word Search Settings
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setDbOpen(true)}>
                Database Connection
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setDeployOpen(true)}>
                Deployment Configuration
              </button>
              {Number(viewer?.is_admin || 0) === 1 ? (
                <button type="button" className="btn btn-primary" onClick={() => setDocumentSettingsOpen(true)}>
                  Document Settings
                </button>
              ) : null}
              <button type="button" className="btn btn-primary" onClick={() => setIconsOpen(true)}>
                Standardized Icons
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setCustomCssOpen(true)}>
                Custom CSS Settings
              </button>
            </div>
          </div>
        </section>
      </PageLayout>

      <EmailConfigModal open={emailOpen} onClose={() => setEmailOpen(false)} onToast={onToast} />
      <UserAccountsModal open={usersOpen} onClose={() => setUsersOpen(false)} onToast={onToast} />
      <GroupMembershipsModal open={groupsOpen} onClose={() => setGroupsOpen(false)} onToast={onToast} />
      <AuthPolicyModal open={policyOpen} onClose={() => setPolicyOpen(false)} onToast={onToast} />
      <SiteAppearanceModal open={appearanceOpen} onClose={() => setAppearanceOpen(false)} onToast={onToast} />
      <WordsearchSettingsModal open={wordsearchOpen} onClose={() => setWordsearchOpen(false)} onToast={onToast} />
      <DbConfigModal open={dbOpen} onClose={() => setDbOpen(false)} onToast={onToast} />
      <DeployConfigModal open={deployOpen} onClose={() => setDeployOpen(false)} onToast={onToast} />
      <DocumentSettingsModal open={documentSettingsOpen} onClose={() => setDocumentSettingsOpen(false)} onToast={onToast} />
      <StandardizedIconsModal open={iconsOpen} onClose={() => setIconsOpen(false)} onToast={onToast} />
      <CustomCssSettingsModal open={customCssOpen} onClose={() => setCustomCssOpen(false)} onToast={onToast} page={page} />
    </>
  );
}
