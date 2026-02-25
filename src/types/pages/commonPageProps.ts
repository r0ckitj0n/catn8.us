import { IToast } from '../common';

export interface AppShellPageProps {
  viewer: any;
  onLoginClick: () => void;
  onLogout: () => void;
  onAccountClick: () => void;
  mysteryTitle?: string;
  onToast?: (toast: IToast) => void;
}
