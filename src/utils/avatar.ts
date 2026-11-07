export type AccountType = 'individual' | 'organization' | 'corporate' | 'municipality' | string | null | undefined;

export function getAccountTypeBorderColor(accountType: AccountType): string {
  if (accountType === 'municipality') {
    return 'var(--account-municipality)';
  }
  if (accountType === 'organization' || accountType === 'corporate') {
    return 'var(--account-corporate)';
  }
  return 'var(--account-individual)';
}

/**
 * Standard icons: border-2 (2px)
 * Large profile icons: border-[3px] (3px)
 */
export function getAccountTypeBorderClass(accountType: AccountType, borderWidth = 'border-2'): string {
  if (accountType === 'municipality') {
    return `${borderWidth} border-account-municipality`;
  }
  if (accountType === 'organization' || accountType === 'corporate') {
    return `${borderWidth} border-account-corporate`;
  }
  return `${borderWidth} border-account-individual`;
}

export function getAccountTypeRingClass(accountType: AccountType): string {
  if (accountType === 'municipality') {
    return 'ring-2 ring-account-municipality';
  }
  if (accountType === 'organization' || accountType === 'corporate') {
    return 'ring-2 ring-account-corporate';
  }
  return 'ring-2 ring-account-individual';
}

export function normalizeAccountType(accountType: AccountType): 'individual' | 'corporate' | 'municipality' {
  if (accountType === 'municipality') return 'municipality';
  if (accountType === 'organization' || accountType === 'corporate') return 'corporate';
  return 'individual';
}

export function getAccountTypeName(accountType: AccountType, language: 'ja' | 'en' = 'ja'): string {
  if (accountType === 'municipality') {
    return language === 'ja' ? '自治体' : 'Municipality';
  }
  if (accountType === 'organization' || accountType === 'corporate') {
    return language === 'ja' ? '法人' : 'Corporate';
  }
  return language === 'ja' ? '個人' : 'Individual';
}


