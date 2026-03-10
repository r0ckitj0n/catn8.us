const ACCUMUL8_BANKING_ORGANIZATION_ICON_MAP: Record<string, string> = {
  'capital one 360': '/images/bank-organizations/capital-one-360-1024.png',
  'capital one': '/images/bank-organizations/capital-one-360-1024.png',
  'navy federal credit union': '/images/bank-organizations/navy-federal-credit-union-1024.png',
  'navy federal': '/images/bank-organizations/navy-federal-credit-union-1024.png',
};

function normalizeBankingOrganizationName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function resolveAccumul8BankingOrganizationIconPath(
  bankingOrganizationName: string,
  explicitIconPath?: string | null,
): string {
  const normalizedExplicitIconPath = String(explicitIconPath || '').trim();
  if (normalizedExplicitIconPath) {
    return normalizedExplicitIconPath;
  }

  return ACCUMUL8_BANKING_ORGANIZATION_ICON_MAP[normalizeBankingOrganizationName(bankingOrganizationName)] || '';
}
