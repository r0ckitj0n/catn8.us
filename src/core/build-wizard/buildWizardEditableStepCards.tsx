import React from 'react';

import { IBuildWizardStep } from '../../types/buildWizard';
import { BuildWizardContactType } from './buildWizardPageRenderTypes';
import { BuildWizardEditableStepCard } from './buildWizardEditableStepCard';
import { BuildWizardEditableStepCardContext, BuildWizardEditableTreeRow } from './buildWizardEditableStepCardTypes';

interface BuildWizardEditableStepCardsProps {
  activeTabTreeRows: BuildWizardEditableTreeRow[];
  cardContext: BuildWizardEditableStepCardContext;
  dragOverInsertIndex: number;
  onDropReorder: (insertIndex: number) => Promise<void>;
  setDragOverInsertIndex: React.Dispatch<React.SetStateAction<number>>;
  setDragOverParentStepId: React.Dispatch<React.SetStateAction<number>>;
  stepCardAssigneeIdFilter: number;
  stepCardAssigneeTypeFilter: 'all' | BuildWizardContactType;
  stepCardTextFilterTokens: string[];
  stepSearchTextById: Map<number, string>;
  tabSteps: IBuildWizardStep[];
}

export function BuildWizardEditableStepCards({
  activeTabTreeRows,
  cardContext,
  dragOverInsertIndex,
  onDropReorder,
  setDragOverInsertIndex,
  setDragOverParentStepId,
  stepCardAssigneeIdFilter,
  stepCardAssigneeTypeFilter,
  stepCardTextFilterTokens,
  stepSearchTextById,
  tabSteps,
}: BuildWizardEditableStepCardsProps) {
  if (!tabSteps.length) {
    return <div className="build-wizard-muted">No steps in this tab yet.</div>;
  }

  const hasAssigneeFilters = stepCardAssigneeTypeFilter !== 'all' || stepCardAssigneeIdFilter > 0;
  const hasTextFilter = stepCardTextFilterTokens.length > 0;
  const visibleRows = activeTabTreeRows.filter((row) => {
    if (hasTextFilter) {
      const haystack = stepSearchTextById.get(row.step.id) || '';
      if (!stepCardTextFilterTokens.every((token) => haystack.includes(token))) {
        return false;
      }
    }
    if (!hasAssigneeFilters) {
      return true;
    }
    const allStepAssignees = cardContext.stepAssigneesByStepId.get(row.step.id) || [];
    return allStepAssignees.some((entry) => {
      const contactType = cardContext.normalizeContactType(entry.contact);
      if (stepCardAssigneeTypeFilter !== 'all' && contactType !== stepCardAssigneeTypeFilter) {
        return false;
      }
      if (stepCardAssigneeIdFilter > 0 && entry.contact.id !== stepCardAssigneeIdFilter) {
        return false;
      }
      return true;
    });
  });

  if (!visibleRows.length) {
    return <div className="build-wizard-muted">No steps match the current filter.</div>;
  }

  return (
    <div className="build-wizard-step-list">
      <div className={`build-wizard-drop-zone ${dragOverInsertIndex === 0 ? 'is-active' : ''}`} onDragOver={(e) => { if (cardContext.draggingStepId > 0) { e.preventDefault(); setDragOverInsertIndex(0); setDragOverParentStepId(0); } }} onDrop={(e) => { e.preventDefault(); void onDropReorder(0); }} />
      {visibleRows.map((row, rowIndex) => (
        <React.Fragment key={row.step.id}>
          <BuildWizardEditableStepCard context={cardContext} row={row} />
          <div className={`build-wizard-drop-zone ${dragOverInsertIndex === rowIndex + 1 ? 'is-active' : ''}`} onDragOver={(e) => { if (cardContext.draggingStepId > 0) { e.preventDefault(); setDragOverInsertIndex(rowIndex + 1); setDragOverParentStepId(0); } }} onDrop={(e) => { e.preventDefault(); void onDropReorder(rowIndex + 1); }} />
        </React.Fragment>
      ))}
    </div>
  );
}
