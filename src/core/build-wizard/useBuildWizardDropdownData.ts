import React from 'react';

import { buildWizardTokenLabel } from '../buildWizardDropdownSettings';
import { LotSizeUnit } from '../../types/pages/buildWizardPage';
import { detectLotSizeUnit } from '../../components/pages/build-wizard/buildWizardUtils';

export function useBuildWizardDropdownData(options: {
  docKind: string;
  dropdownSettings: {
    document_kinds?: string[];
    permit_statuses?: string[];
    purchase_units?: string[];
  };
  lotSizeInput: string;
  setDocKind: React.Dispatch<React.SetStateAction<string>>;
}) {
  const lotSizeDetectedUnit = React.useMemo<LotSizeUnit>(() => detectLotSizeUnit(options.lotSizeInput), [options.lotSizeInput]);

  const permitStatusOptions = React.useMemo(() => (
    options.dropdownSettings.permit_statuses || []
  ), [options.dropdownSettings.permit_statuses]);

  const purchaseUnitOptions = React.useMemo(() => (
    options.dropdownSettings.purchase_units || []
  ), [options.dropdownSettings.purchase_units]);

  const docKindOptions = React.useMemo(() => (
    (options.dropdownSettings.document_kinds || []).map((value) => ({
      value,
      label: buildWizardTokenLabel(value, 'Other'),
    }))
  ), [options.dropdownSettings.document_kinds]);

  React.useEffect(() => {
    if (!docKindOptions.length) {
      return;
    }
    const validValues = new Set(docKindOptions.map((opt) => opt.value));
    if (!validValues.has(options.docKind)) {
      options.setDocKind(docKindOptions[0].value);
    }
  }, [docKindOptions, options.docKind, options.setDocKind]);

  return {
    docKindOptions,
    lotSizeDetectedUnit,
    permitStatusOptions,
    purchaseUnitOptions,
  };
}
