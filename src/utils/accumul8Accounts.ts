import { Accumul8Account } from '../types/accumul8';

export function getAccumul8AccountDisplayName(
  account?: Pick<Accumul8Account, 'account_name' | 'account_nickname'> | null,
  fallback = 'Unnamed account',
): string {
  const nickname = String(account?.account_nickname || '').trim();
  if (nickname) {
    return nickname;
  }
  const name = String(account?.account_name || '').trim();
  return name || fallback;
}
