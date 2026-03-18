import React from 'react';

import { IBuildWizardQuestionnaire } from '../../types/buildWizard';
import { LotSizeUnit } from '../../types/pages/buildWizardPage';

interface BuildWizardStartSectionProps {
  changeCurrencyEdit: (key: string, value: string) => void;
  finishCurrencyEdit: (key: string, onCommit: (value: number | null) => void) => void;
  formatCurrency: (value: number | null | undefined) => string;
  lotSizeDetectedUnit: LotSizeUnit;
  lotSizeInput: string;
  lotSizeInputToSqftAuto: (value: string) => number | null;
  projectDraft: IBuildWizardQuestionnaire;
  projectPhotosSection: React.ReactNode;
  projectTotals: { doneCount: number; totalActual: number; totalCount: number; totalEstimated: number };
  renderCurrencyInputValue: (key: string, value: number | null | undefined) => string;
  setLotSizeInput: React.Dispatch<React.SetStateAction<string>>;
  setProjectDraft: React.Dispatch<React.SetStateAction<IBuildWizardQuestionnaire>>;
  startCurrencyEdit: (key: string, value: number | null | undefined) => void;
  toNumberOrNull: (value: string) => number | null;
  toStringOrNull: (value: string) => string | null;
  updateProject: (patch: Partial<IBuildWizardQuestionnaire>) => Promise<unknown>;
}

export function BuildWizardStartSection({
  changeCurrencyEdit,
  finishCurrencyEdit,
  formatCurrency,
  lotSizeDetectedUnit,
  lotSizeInput,
  lotSizeInputToSqftAuto,
  projectDraft,
  projectPhotosSection,
  projectTotals,
  renderCurrencyInputValue,
  setLotSizeInput,
  setProjectDraft,
  startCurrencyEdit,
  toNumberOrNull,
  toStringOrNull,
  updateProject,
}: BuildWizardStartSectionProps) {
  return (
    <div className="build-wizard-card">
      <h2>Initial Home Information</h2>
      <div className="build-wizard-grid">
        <label>
          Home Name
          <input type="text" value={projectDraft.title || ''} onChange={(e) => setProjectDraft((prev) => ({ ...prev, title: e.target.value }))} onBlur={() => void updateProject({ title: projectDraft.title || '' })} />
        </label>
        <label>
          Status
          <select value={projectDraft.status || 'planning'} onChange={(e) => setProjectDraft((prev) => ({ ...prev, status: e.target.value }))} onBlur={() => void updateProject({ status: projectDraft.status || 'planning' })}>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="planning">Planning</option>
          </select>
        </label>
        <label>
          Lot Address
          <input type="text" value={projectDraft.lot_address || ''} onChange={(e) => setProjectDraft((prev) => ({ ...prev, lot_address: e.target.value }))} onBlur={() => void updateProject({ lot_address: projectDraft.lot_address || '' })} />
        </label>
        <label>
          Square Feet
          <input type="number" value={projectDraft.square_feet ?? ''} onChange={(e) => setProjectDraft((prev) => ({ ...prev, square_feet: toNumberOrNull(e.target.value) }))} onBlur={() => void updateProject({ square_feet: projectDraft.square_feet })} />
        </label>
        <label>
          Home Style
          <input type="text" value={projectDraft.home_style || ''} onChange={(e) => setProjectDraft((prev) => ({ ...prev, home_style: e.target.value }))} onBlur={() => void updateProject({ home_style: projectDraft.home_style || '' })} />
        </label>
        <label>
          Home Type
          <select value={projectDraft.home_type || ''} onChange={(e) => setProjectDraft((prev) => ({ ...prev, home_type: e.target.value }))} onBlur={() => void updateProject({ home_type: projectDraft.home_type || '' })}>
            <option value="">Select type</option>
            <option value="single_family">Single Family</option>
            <option value="townhouse">Townhouse</option>
            <option value="condo">Condo</option>
            <option value="multi_family">Multi Family</option>
            <option value="manufactured">Manufactured</option>
            <option value="farm_ranch">Farm/Ranch</option>
          </select>
        </label>
        <label>
          Number of Rooms
          <input type="number" value={projectDraft.room_count ?? ''} onChange={(e) => setProjectDraft((prev) => ({ ...prev, room_count: toNumberOrNull(e.target.value) }))} onBlur={() => void updateProject({ room_count: projectDraft.room_count })} />
        </label>
        <label>
          Number of Bedrooms
          <input type="number" value={projectDraft.bedrooms_count ?? ''} onChange={(e) => setProjectDraft((prev) => ({ ...prev, bedrooms_count: toNumberOrNull(e.target.value) }))} onBlur={() => void updateProject({ bedrooms_count: projectDraft.bedrooms_count })} />
        </label>
        <label>
          Number of Kitchens
          <input type="number" value={projectDraft.kitchens_count ?? ''} onChange={(e) => setProjectDraft((prev) => ({ ...prev, kitchens_count: toNumberOrNull(e.target.value) }))} onBlur={(e) => void updateProject({ kitchens_count: toNumberOrNull(e.currentTarget.value) })} />
        </label>
        <label>
          Number of Bathrooms
          <input type="number" value={projectDraft.bathroom_count ?? ''} onChange={(e) => setProjectDraft((prev) => ({ ...prev, bathroom_count: toNumberOrNull(e.target.value) }))} onBlur={() => void updateProject({ bathroom_count: projectDraft.bathroom_count })} />
        </label>
        <label>
          Stories
          <input type="number" value={projectDraft.stories_count ?? ''} onChange={(e) => setProjectDraft((prev) => ({ ...prev, stories_count: toNumberOrNull(e.target.value) }))} onBlur={() => void updateProject({ stories_count: projectDraft.stories_count })} />
        </label>
        <label>
          Lot Size
          <input type="number" step="0.0001" value={lotSizeInput} onChange={(e) => setLotSizeInput(e.target.value)} onBlur={() => { const nextLotSizeSqft = lotSizeInputToSqftAuto(lotSizeInput); setProjectDraft((prev) => ({ ...prev, lot_size_sqft: nextLotSizeSqft })); void updateProject({ lot_size_sqft: nextLotSizeSqft }); }} />
          <div className="build-wizard-permit-usage-note">{lotSizeDetectedUnit === 'acres' ? '(acres)' : '(sq ft)'}</div>
        </label>
        <label>
          Garage Spaces
          <input type="number" value={projectDraft.garage_spaces ?? ''} onChange={(e) => setProjectDraft((prev) => ({ ...prev, garage_spaces: toNumberOrNull(e.target.value) }))} onBlur={() => void updateProject({ garage_spaces: projectDraft.garage_spaces })} />
        </label>
        <label>
          Parking Spaces
          <input type="number" value={projectDraft.parking_spaces ?? ''} onChange={(e) => setProjectDraft((prev) => ({ ...prev, parking_spaces: toNumberOrNull(e.target.value) }))} onBlur={() => void updateProject({ parking_spaces: projectDraft.parking_spaces })} />
        </label>
        <label>
          Year Built (if existing)
          <input type="number" value={projectDraft.year_built ?? ''} onChange={(e) => setProjectDraft((prev) => ({ ...prev, year_built: toNumberOrNull(e.target.value) }))} onBlur={() => void updateProject({ year_built: projectDraft.year_built })} />
        </label>
        <label>
          HOA Monthly Fee
          <input type="text" inputMode="decimal" className="build-wizard-currency-input" value={renderCurrencyInputValue('project-hoa_fee_monthly', projectDraft.hoa_fee_monthly)} onFocus={() => startCurrencyEdit('project-hoa_fee_monthly', projectDraft.hoa_fee_monthly)} onChange={(e) => changeCurrencyEdit('project-hoa_fee_monthly', e.target.value)} onBlur={() => finishCurrencyEdit('project-hoa_fee_monthly', (value) => { setProjectDraft((prev) => ({ ...prev, hoa_fee_monthly: value })); void updateProject({ hoa_fee_monthly: value }); })} />
        </label>
        <label>
          Target Start Date
          <input type="date" value={projectDraft.target_start_date || ''} onChange={(e) => setProjectDraft((prev) => ({ ...prev, target_start_date: toStringOrNull(e.target.value) }))} onBlur={() => void updateProject({ target_start_date: toStringOrNull(projectDraft.target_start_date || '') })} />
        </label>
        <label>
          Target Completion Date
          <input type="date" value={projectDraft.target_completion_date || ''} onChange={(e) => setProjectDraft((prev) => ({ ...prev, target_completion_date: toStringOrNull(e.target.value) }))} onBlur={() => void updateProject({ target_completion_date: toStringOrNull(projectDraft.target_completion_date || '') })} />
        </label>
      </div>

      <label className="build-wizard-notes-field">
        Home Notes
        <textarea rows={5} value={projectDraft.wizard_notes || ''} onChange={(e) => setProjectDraft((prev) => ({ ...prev, wizard_notes: e.target.value }))} onBlur={() => void updateProject({ wizard_notes: projectDraft.wizard_notes || '' })} />
      </label>

      <div className="build-wizard-stats-row">
        <span>Completed Steps: {projectTotals.doneCount}/{projectTotals.totalCount}</span>
        <span>Estimated Total: {formatCurrency(projectTotals.totalEstimated)}</span>
        <span>Actual Total: {formatCurrency(projectTotals.totalActual)}</span>
      </div>

      {projectPhotosSection}
    </div>
  );
}
