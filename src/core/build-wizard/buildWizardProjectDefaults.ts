import { IBuildWizardQuestionnaire } from '../../types/buildWizard';

export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function createEmptyBuildWizardQuestionnaire(): IBuildWizardQuestionnaire {
  return {
    title: '',
    status: 'planning',
    square_feet: null,
    home_style: '',
    home_type: '',
    room_count: null,
    bedrooms_count: null,
    kitchens_count: null,
    bathroom_count: null,
    stories_count: null,
    lot_size_sqft: null,
    garage_spaces: null,
    parking_spaces: null,
    year_built: null,
    hoa_fee_monthly: null,
    lot_address: '',
    target_start_date: null,
    target_completion_date: null,
    wizard_notes: '',
  };
}
