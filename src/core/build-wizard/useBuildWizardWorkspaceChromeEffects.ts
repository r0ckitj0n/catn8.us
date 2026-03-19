import React from 'react';

import { BUILD_WIZARD_DROPDOWN_SETTINGS_UPDATED_EVENT, fetchBuildWizardDropdownSettings } from '../buildWizardDropdownSettings';
import { PHASE_PROGRESS_ORDER } from '../../components/pages/build-wizard/buildWizardConstants';
import { parseUrlState } from '../../components/pages/build-wizard/buildWizardUtils';

export function useBuildWizardWorkspaceChromeEffects(options: any) {
  React.useEffect(() => {
    if (options.initialUrlState.view === 'build' && options.initialUrlState.projectId && options.initialUrlState.projectId !== options.projectId) {
      void options.openProject(options.initialUrlState.projectId);
      options.setActiveTab('overview');
    }
  }, [options.initialUrlState.projectId, options.initialUrlState.view, options.openProject, options.projectId, options.setActiveTab]);

  React.useEffect(() => {
    options.setVerifiedActualCostSignatureByStepId({});
    options.setRefreshingActualCostByStepId({});
  }, [options.projectId, options.setRefreshingActualCostByStepId, options.setVerifiedActualCostSignatureByStepId]);

  React.useEffect(() => {
    const updateStickyOffset = () => {
      const nav = document.querySelector<HTMLElement>('.navbar.sticky-top, .navbar.fixed-top');
      if (!nav) {
        options.setStickyTopOffset(8);
        return;
      }
      const navRect = nav.getBoundingClientRect();
      const navStyle = window.getComputedStyle(nav);
      const marginBottom = Number.parseFloat(navStyle.marginBottom || '0') || 0;
      options.setStickyTopOffset(Math.max(8, Math.ceil(navRect.height + marginBottom + 8)));
    };
    updateStickyOffset();
    window.addEventListener('resize', updateStickyOffset);
    return () => window.removeEventListener('resize', updateStickyOffset);
  }, [options.setStickyTopOffset]);

  React.useEffect(() => {
    const node = options.stickyHeadRef.current;
    if (!node) {
      options.setStickyHeadHeight(0);
      return;
    }
    const measure = () => options.setStickyHeadHeight(Math.ceil(node.getBoundingClientRect().height));
    measure();
    window.addEventListener('resize', measure);
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      return () => {
        observer.disconnect();
        window.removeEventListener('resize', measure);
      };
    }
    return () => window.removeEventListener('resize', measure);
  }, [options.activeTab, options.projectId, options.setStickyHeadHeight, options.stickyHeadRef, options.view]);

  React.useEffect(() => {
    const onPopState = () => {
      const state = parseUrlState();
      options.setView(state.view);
      if (state.view === 'template_editor') {
        options.setBuildEntryPoint('template_editor');
      } else if (state.view === 'launcher') {
        options.setBuildEntryPoint('launcher');
      }
      if (state.view === 'build' && state.projectId && state.projectId !== options.projectId) {
        void options.openProject(state.projectId);
        options.setActiveTab('overview');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [options.openProject, options.projectId, options.setActiveTab, options.setBuildEntryPoint, options.setView]);

  React.useEffect(() => {
    const previousActiveTab = options.previousActiveTabRef.current;
    options.previousActiveTabRef.current = options.activeTab;
    if (previousActiveTab === options.activeTab || !PHASE_PROGRESS_ORDER.includes(options.activeTab)) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    const node = options.phaseTaskListCardRef.current;
    if (!node) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      const nextTop = window.scrollY + node.getBoundingClientRect().top - options.stickyTopOffset - options.stickyHeadHeight - 12;
      window.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [options.activeTab, options.phaseTaskListCardRef, options.previousActiveTabRef, options.stickyHeadHeight, options.stickyTopOffset]);

  React.useEffect(() => {
    let cancelled = false;
    void fetchBuildWizardDropdownSettings()
      .then((loaded) => {
        if (!cancelled) options.setDropdownSettings(loaded);
      })
      .catch((err: any) => {
        if (Number(err?.status || 0) !== 403) {
          options.onToast?.({ tone: 'warning', message: err?.message || 'Failed to load Build Wizard dropdown settings' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [options.onToast, options.setDropdownSettings]);

  React.useEffect(() => {
    const onSettingsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<any>;
      if (customEvent?.detail) options.setDropdownSettings(customEvent.detail);
    };
    window.addEventListener(BUILD_WIZARD_DROPDOWN_SETTINGS_UPDATED_EVENT, onSettingsUpdated as EventListener);
    return () => window.removeEventListener(BUILD_WIZARD_DROPDOWN_SETTINGS_UPDATED_EVENT, onSettingsUpdated as EventListener);
  }, [options.setDropdownSettings]);

  React.useEffect(() => {
    options.setProjectDraft(options.questionnaire);
    options.setLotSizeInput(options.lotSizeSqftToDisplayInput(options.questionnaire.lot_size_sqft));
  }, [options.lotSizeSqftToDisplayInput, options.questionnaire, options.setLotSizeInput, options.setProjectDraft]);
}
