import React from 'react';

interface DossierWizardHeaderProps {
  backstoryId: string;
  caseId: string;
}

export function DossierWizardHeader({ backstoryId, caseId }: DossierWizardHeaderProps) {
  return (
    <div className="catn8-card p-3 mb-3">
      <div className="fw-bold">Dossier Wizard</div>
      <div className="form-text">
        Foundation → Derived:
        {' '}
        <span className={backstoryId ? 'fw-semibold' : 'fw-semibold text-primary'}>Backstory</span>
        {' '}→{' '}
        <span className={(backstoryId && caseId) ? 'fw-semibold' : (backstoryId ? 'fw-semibold text-primary' : 'text-muted')}>Case</span>
        {' '}→{' '}
        <span className={(backstoryId && caseId) ? 'fw-semibold text-primary' : 'text-muted'}>Case Details</span>
      </div>
    </div>
  );
}
