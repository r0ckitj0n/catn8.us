import React from 'react';

import { pushUrlState, toIsoDate } from '../../components/pages/build-wizard/buildWizardUtils';
import { WizardView } from '../../types/pages/buildWizardPage';

interface UseBuildWizardLauncherActionsOptions {
  buildEntryPoint: 'launcher' | 'template_editor';
  createProject: (title: string, templateKey: string, wastewaterKind: 'septic' | 'public_sewer', waterKind: 'county_water' | 'private_well', isTemplate?: boolean) => Promise<number>;
  isTemplateProject: boolean;
  newHomeWastewaterKind: 'septic' | 'public_sewer';
  newHomeWaterKind: 'county_water' | 'private_well';
  onSetLauncherView: (view: WizardView, entryPoint: 'launcher' | 'template_editor') => void;
  openProject: (projectId: number) => Promise<unknown>;
  projectId: number;
  setActiveTab: React.Dispatch<React.SetStateAction<any>>;
  templateProjectsLength: number;
  updateProject: (patch: Record<string, unknown>) => Promise<unknown>;
}

export function useBuildWizardLauncherActions({
  buildEntryPoint,
  createProject,
  isTemplateProject,
  newHomeWastewaterKind,
  newHomeWaterKind,
  onSetLauncherView,
  openProject,
  projectId,
  setActiveTab,
  templateProjectsLength,
  updateProject,
}: UseBuildWizardLauncherActionsOptions) {
  const openBuild = React.useCallback(async (nextProjectId: number, source: 'launcher' | 'template_editor' = 'launcher') => {
    await openProject(nextProjectId);
    setActiveTab('overview');
    onSetLauncherView('build', source);
    pushUrlState('build', nextProjectId);
  }, [onSetLauncherView, openProject, setActiveTab]);

  const onCreateNewBuild = React.useCallback(async () => {
    const nextId = await createProject(`New Home Plan ${toIsoDate(new Date())}`, 'blank', newHomeWastewaterKind, newHomeWaterKind);
    if (nextId > 0) {
      setActiveTab('start');
      onSetLauncherView('build', 'launcher');
      pushUrlState('build', nextId);
    }
  }, [createProject, newHomeWastewaterKind, newHomeWaterKind, onSetLauncherView, setActiveTab]);

  const onOpenTemplateEditor = React.useCallback(async () => {
    if (templateProjectsLength === 0) {
      await createProject('Build a House Template', 'blank', 'septic', 'county_water', true);
    }
    onSetLauncherView('template_editor', 'template_editor');
    pushUrlState('template_editor', null);
  }, [createProject, onSetLauncherView, templateProjectsLength]);

  const onCreateTemplate = React.useCallback(async () => {
    const nextId = await createProject(`New Template ${toIsoDate(new Date())}`, 'blank', 'septic', 'county_water', true);
    if (nextId > 0) {
      setActiveTab('start');
      onSetLauncherView('build', 'template_editor');
      pushUrlState('build', nextId);
    }
  }, [createProject, onSetLauncherView, setActiveTab]);

  const onBackToLauncher = React.useCallback(() => {
    onSetLauncherView('launcher', 'launcher');
    pushUrlState('launcher', null);
  }, [onSetLauncherView]);

  const onBackFromWorkspace = React.useCallback(() => {
    if (isTemplateProject || buildEntryPoint === 'template_editor') {
      onSetLauncherView('template_editor', 'template_editor');
      pushUrlState('template_editor', null);
      return;
    }
    onBackToLauncher();
  }, [buildEntryPoint, isTemplateProject, onBackToLauncher, onSetLauncherView]);

  const onSaveTemplate = React.useCallback(async () => {
    if (projectId <= 0) return;
    await updateProject({ is_template: 1 });
  }, [projectId, updateProject]);

  const onCloseWizard = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    const fallbackUrl = '/';
    const referrer = String(window.document.referrer || '').trim();
    if (!referrer) {
      window.location.assign(fallbackUrl);
      return;
    }
    try {
      const refUrl = new URL(referrer);
      const refHost = String(refUrl.hostname || '').toLowerCase();
      if (refHost === 'catn8.us' || refHost.endsWith('.catn8.us')) {
        window.location.assign(refUrl.toString());
        return;
      }
    } catch (_) {}
    window.location.assign(fallbackUrl);
  }, []);

  return { onBackFromWorkspace, onBackToLauncher, onCloseWizard, onCreateNewBuild, onCreateTemplate, onOpenTemplateEditor, onSaveTemplate, openBuild };
}
