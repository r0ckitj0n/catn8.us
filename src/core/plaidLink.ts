export interface PlaidLinkExitError {
  display_message?: string;
  error_message?: string;
}

export interface PlaidLinkInstitutionMetadata {
  institution_id?: string;
  name?: string;
}

export interface PlaidLinkSuccessMetadata {
  institution?: PlaidLinkInstitutionMetadata;
}

interface PlaidHandler {
  open: () => void;
}

interface PlaidGlobal {
  create: (cfg: {
    token: string;
    onSuccess: (publicToken: string, metadata: PlaidLinkSuccessMetadata) => void;
    onExit: (err: PlaidLinkExitError | null, metadata: unknown) => void;
  }) => PlaidHandler;
}

declare global {
  interface Window {
    Plaid?: PlaidGlobal;
  }
}

const PLAID_LINK_SCRIPT_ID = 'catn8-plaid-link-sdk';
const PLAID_LINK_SCRIPT_SRC = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';

export async function ensurePlaidLinkLoaded(): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Browser environment is required');
  }

  if (window.Plaid && typeof window.Plaid.create === 'function') {
    return;
  }

  const existing = document.getElementById(PLAID_LINK_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      const done = () => {
        if (window.Plaid && typeof window.Plaid.create === 'function') resolve();
        else reject(new Error('Plaid Link failed to initialize'));
      };
      existing.addEventListener('load', done, { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Plaid Link script')), { once: true });
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = PLAID_LINK_SCRIPT_ID;
    script.src = PLAID_LINK_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.Plaid && typeof window.Plaid.create === 'function') resolve();
      else reject(new Error('Plaid Link script loaded but API was unavailable'));
    };
    script.onerror = () => reject(new Error('Failed to load Plaid Link script'));
    document.head.appendChild(script);
  });
}

export async function openPlaidLink(token: string): Promise<{ outcome: 'linked'; publicToken: string; metadata: PlaidLinkSuccessMetadata } | { outcome: 'cancelled' }> {
  if (typeof token !== 'string' || token.trim() === '') {
    throw new Error('Plaid link token is required');
  }

  await ensurePlaidLinkLoaded();

  const plaid = window.Plaid;
  if (!plaid || typeof plaid.create !== 'function') {
    throw new Error('Plaid Link is unavailable');
  }

  return await new Promise((resolve, reject) => {
    let didSucceed = false;

    const handler = plaid.create({
      token,
      onSuccess: (publicToken, metadata) => {
        didSucceed = true;
        resolve({ outcome: 'linked', publicToken: String(publicToken || ''), metadata });
      },
      onExit: (err) => {
        if (didSucceed) return;
        if (err) {
          const msg = String(err.display_message || err.error_message || 'Plaid Link exited with an error');
          reject(new Error(msg));
          return;
        }
        resolve({ outcome: 'cancelled' });
      },
    });

    handler.open();
  });
}

