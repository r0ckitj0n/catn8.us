export interface IViewer {
  id: string | number;
  username: string;
  email: string;
  is_admin?: number;
  is_administrator?: number;
  [key: string]: any;
}

export interface IToast {
  id?: string;
  tone: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
  persist?: boolean;
  className?: string;
  overlayClassName?: string;
}

export type AiLooseObject = Record<string, any>;
