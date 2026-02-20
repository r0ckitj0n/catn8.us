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
import { BuildWizardSettingsModal } from '../modals/BuildWizardSettingsModal';
import { StandardizedIconsModal } from '../modals/StandardizedIconsModal';
import { SiteMaintenanceModal } from '../modals/SiteMaintenanceModal';
import { ColoringPagesModal } from '../modals/ColoringPagesModal';
import { IToast } from '../../types/common';
import { AppShellPageProps } from '../../types/pages/commonPageProps';

interface SettingsPageProps extends AppShellPageProps {
  onOpenAiImageConfig: () => void;
  onOpenAiConfig: () => void;
  onOpenAiVoiceCommunication: () => void;
  onToast: (toast: IToast) => void;
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
  const [buildWizardSettingsOpen, setBuildWizardSettingsOpen] = React.useState(false);
  const [iconsOpen, setIconsOpen] = React.useState(false);
  const [siteMaintenanceOpen, setSiteMaintenanceOpen] = React.useState(false);
  const [coloringPagesOpen, setColoringPagesOpen] = React.useState(false);
  const isAdmin = Number(viewer?.is_admin || 0) === 1;

  return (
    <>
      <PageLayout page="settings" title="Settings" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
        <section className="section">
          <div className="container">
            <h1 className="section-title">Settings</h1>
            <p className="lead text-center mb-4">Choose a settings area, then open the tool you need.</p>
            <div className="row g-3">
              <div className="col-12 col-lg-6">
                <div className="card h-100 shadow-sm">
                  <div className="card-body">
                    <h2 className="h5 mb-3">Account & Access</h2>
                    <div className="d-flex flex-wrap gap-2">
                      <button type="button" className="btn btn-primary" onClick={() => setUsersOpen(true)}>
                        User Accounts
                      </button>
                      {isAdmin ? (
                        <button type="button" className="btn btn-primary" onClick={() => setGroupsOpen(true)}>
                          Group Access
                        </button>
                      ) : null}
                      <button type="button" className="btn btn-primary" onClick={() => setPolicyOpen(true)}>
                        Account Policy
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12 col-lg-6">
                <div className="card h-100 shadow-sm">
                  <div className="card-body">
                    <h2 className="h5 mb-3">Communication & AI</h2>
                    <div className="d-flex flex-wrap gap-2">
                      <button type="button" className="btn btn-primary" onClick={() => setEmailOpen(true)}>
                        Email Configuration
                      </button>
                      <button type="button" className="btn btn-primary" onClick={() => {
                        if (typeof onOpenAiConfig === 'function') onOpenAiConfig();
                      }}>
                        AI Configuration
                      </button>
                      {isAdmin ? (
                        <button type="button" className="btn btn-primary" onClick={() => {
                          if (typeof onOpenAiVoiceCommunication === 'function') onOpenAiVoiceCommunication();
                        }}>
                          AI Voice Configuration
                        </button>
                      ) : null}
                      {isAdmin ? (
                        <button type="button" className="btn btn-primary" onClick={() => {
                          if (typeof onOpenAiImageConfig === 'function') onOpenAiImageConfig();
                        }}>
                          AI Image Configuration
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12 col-lg-6">
                <div className="card h-100 shadow-sm">
                  <div className="card-body">
                    <h2 className="h5 mb-3">Site & Experience</h2>
                    <div className="d-flex flex-wrap gap-2">
                      <button type="button" className="btn btn-primary" onClick={() => setAppearanceOpen(true)}>
                        Site Appearance
                      </button>
                      <button type="button" className="btn btn-primary" onClick={() => setIconsOpen(true)}>
                        Standardized Icons
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12 col-lg-6">
                <div className="card h-100 shadow-sm">
                  <div className="card-body">
                    <h2 className="h5 mb-3">Platform & Operations</h2>
                    <div className="d-flex flex-wrap gap-2">
                      <button type="button" className="btn btn-primary" onClick={() => setDbOpen(true)}>
                        Database Connection
                      </button>
                      <button type="button" className="btn btn-primary" onClick={() => setDeployOpen(true)}>
                        Deployment Configuration
                      </button>
                      {isAdmin ? (
                        <button type="button" className="btn btn-primary" onClick={() => setSiteMaintenanceOpen(true)}>
                          Site Maintenance
                        </button>
                      ) : null}
                      {isAdmin ? (
                        <button type="button" className="btn btn-primary" onClick={() => setBuildWizardSettingsOpen(true)}>
                          Build Wizard
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12">
                <div className="card shadow-sm">
                  <div className="card-body">
                    <h2 className="h5 mb-3">Game Tools</h2>
                    <div className="d-flex flex-wrap gap-2">
                      <button type="button" className="btn btn-primary" onClick={() => setWordsearchOpen(true)}>
                        Word Search Settings
                      </button>
                      {isAdmin ? (
                        <button type="button" className="btn btn-primary" onClick={() => setColoringPagesOpen(true)}>
                          Coloring Pages
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </PageLayout>

      <EmailConfigModal open={emailOpen} onClose={() => setEmailOpen(false)} onToast={onToast} />
      <UserAccountsModal open={usersOpen} onClose={() => setUsersOpen(false)} onToast={onToast} />
      <GroupMembershipsModal open={groupsOpen} onClose={() => setGroupsOpen(false)} onToast={onToast} />
      <AuthPolicyModal open={policyOpen} onClose={() => setPolicyOpen(false)} onToast={onToast} />
      <SiteAppearanceModal open={appearanceOpen} onClose={() => setAppearanceOpen(false)} onToast={onToast} page={page} />
      <WordsearchSettingsModal open={wordsearchOpen} onClose={() => setWordsearchOpen(false)} onToast={onToast} />
      <DbConfigModal open={dbOpen} onClose={() => setDbOpen(false)} onToast={onToast} />
      <DeployConfigModal open={deployOpen} onClose={() => setDeployOpen(false)} onToast={onToast} />
      <BuildWizardSettingsModal open={buildWizardSettingsOpen} onClose={() => setBuildWizardSettingsOpen(false)} onToast={onToast} />
      <StandardizedIconsModal open={iconsOpen} onClose={() => setIconsOpen(false)} onToast={onToast} />
      <SiteMaintenanceModal open={siteMaintenanceOpen} onClose={() => setSiteMaintenanceOpen(false)} onToast={onToast} />
      <ColoringPagesModal open={coloringPagesOpen} onClose={() => setColoringPagesOpen(false)} onToast={onToast} />
    </>
  );
}
