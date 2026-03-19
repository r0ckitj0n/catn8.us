import React from 'react';

import { IBuildWizardStep } from '../../types/buildWizard';

export function useBuildWizardActiveTabTree(filteredTabSteps: IBuildWizardStep[]) {
  const activeTabTreeRows = React.useMemo(() => {
    const stepIdsInTab = new Set(filteredTabSteps.map((step) => step.id));
    const childrenByParent = new Map<number, IBuildWizardStep[]>();
    const roots: IBuildWizardStep[] = [];
    const sortedTabSteps = [...filteredTabSteps].sort((a, b) => (a.step_order - b.step_order) || (a.id - b.id));
    sortedTabSteps.forEach((step) => {
      const parentStepId = Number(step.parent_step_id || 0);
      if (parentStepId > 0 && stepIdsInTab.has(parentStepId)) {
        const siblings = childrenByParent.get(parentStepId) || [];
        siblings.push(step);
        childrenByParent.set(parentStepId, siblings);
      } else {
        roots.push(step);
      }
    });
    const rows: Array<{ step: IBuildWizardStep; level: number }> = [];
    const visited = new Set<number>();
    const walk = (node: IBuildWizardStep, level: number) => {
      if (visited.has(node.id)) return;
      visited.add(node.id);
      rows.push({ step: node, level });
      (childrenByParent.get(node.id) || []).forEach((child) => walk(child, level + 1));
    };
    roots.forEach((root) => walk(root, 0));
    sortedTabSteps.forEach((step) => {
      if (!visited.has(step.id)) walk(step, 0);
    });
    return rows;
  }, [filteredTabSteps]);

  const activeTabStepNumbers = React.useMemo(() => {
    const map = new Map<number, number>();
    activeTabTreeRows.forEach((row, idx) => map.set(row.step.id, idx + 1));
    return map;
  }, [activeTabTreeRows]);

  const incompleteDescendantCountByStepId = React.useMemo(() => {
    const childrenByParent = new Map<number, number[]>();
    filteredTabSteps.forEach((step) => {
      const parentStepId = Number(step.parent_step_id || 0);
      if (parentStepId > 0) {
        const children = childrenByParent.get(parentStepId) || [];
        children.push(step.id);
        childrenByParent.set(parentStepId, children);
      }
    });
    const completionById = new Map<number, boolean>();
    filteredTabSteps.forEach((step) => completionById.set(step.id, Number(step.is_completed) === 1));
    const countMap = new Map<number, number>();
    const countIncompleteDescendants = (stepId: number, stack: Set<number> = new Set()): number => {
      if (countMap.has(stepId)) return countMap.get(stepId) || 0;
      if (stack.has(stepId)) return 0;
      stack.add(stepId);
      let count = 0;
      (childrenByParent.get(stepId) || []).forEach((childId) => {
        if (!(completionById.get(childId) || false)) count += 1;
        count += countIncompleteDescendants(childId, stack);
      });
      stack.delete(stepId);
      countMap.set(stepId, count);
      return count;
    };
    filteredTabSteps.forEach((step) => countIncompleteDescendants(step.id));
    return countMap;
  }, [filteredTabSteps]);

  return { activeTabStepNumbers, activeTabTreeRows, incompleteDescendantCountByStepId };
}
