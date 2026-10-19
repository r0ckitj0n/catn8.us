export interface PlaidLinkMetadata {
  institution?: {
    institution_id?: string;
    name?: string;
  };
  accounts?: Array<{
    id?: string;
    name?: string;
    mask?: string;
    type?: string;
    subtype?: string;
  }>;
}

export interface PlaidLinkSuccess {
  publicToken: string;
  metadata: PlaidLinkMetadata;
}

interface PlaidHandler {
  open: () => void;
  exit: (options?: { force?: boolean }) => void;
  destroy: () => void;
}

interface PlaidGlobal {
  create: (config: {
    token: string;
    receivedRedirectUri?: string;
    onSuccess: (publicToken: string, metadata: PlaidLinkMetadata) => void;
    onExit: (error: { error_message?: string; error_code?: string; display_message?: string } | null, metadata: PlaidLinkMetadata) => void;
    onEvent?: (eventName: string, metadata: Record<string, unknown>) => void;
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
    script.onload = () => {
      if (window.Plaid && typeof window.Plaid.create === 'function') resolve();
      else reject(new Error('Plaid Link script loaded but API was unavailable'));
    };
    script.onerror = () => reject(new Error('Failed to load Plaid Link script'));
    document.head.appendChild(script);
  });
}

export const PLAID_RECEIVED_REDIRECT_URI = 'https://catn8.us/accumul8/';

function hrefHasOAuthStateId(href: string): boolean {
  try {
    const url = new URL(href);
    if (url.searchParams.has('oauth_state_id')) return true;
    const rawHash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
    if (!rawHash) return false;
    const hashQuery = rawHash.includes('?') ? rawHash.slice(rawHash.indexOf('?') + 1) : rawHash;
    const hashParams = new URLSearchParams(hashQuery);
    if (hashParams.has('oauth_state_id')) return true;
    return hashQuery.includes('oauth_state_id=');
  } catch {
    return false;
  }
}

/**
 * Plaid treats receivedRedirectUri as an OAuth return. Only supply it when
 * the current page actually has oauth_state_id (query or hash).
 */
export function plaidReceivedRedirectUri(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const href = window.location.href;
  if (!hrefHasOAuthStateId(href)) return undefined;
  return href;
}

export async function openPlaidLink(
  linkToken: string,
  options?: {
    receivedRedirectUri?: string;
    onEvent?: (eventName: string, metadata: Record<string, unknown>) => void;
  },
): Promise<{ outcome: 'linked'; payload: PlaidLinkSuccess } | { outcome: 'cancelled' }> {
  if (typeof linkToken !== 'string' || linkToken.trim() === '') {
    throw new Error('Plaid link_token is required');
  }

  await ensurePlaidLinkLoaded();
  const plaid = window.Plaid;
  if (!plaid || typeof plaid.create !== 'function') {
    throw new Error('Plaid Link is unavailable');
  }

  const oauthReturnUri = plaidReceivedRedirectUri();
  const requestedRedirectUri = String(options?.receivedRedirectUri || '').trim();
  const receivedRedirectUri = oauthReturnUri
    ? (hrefHasOAuthStateId(requestedRedirectUri) ? requestedRedirectUri : oauthReturnUri)
    : undefined;

  return await new Promise((resolve, reject) => {
    let isSettled = false;
    const createConfig: {
      token: string;
      receivedRedirectUri?: string;
      onSuccess: (publicToken: string, metadata: PlaidLinkMetadata) => void;
      onExit: (error: { error_message?: string; error_code?: string; display_message?: string } | null, metadata: PlaidLinkMetadata) => void;
      onEvent?: (eventName: string, metadata: Record<string, unknown>) => void;
    } = {
      token: linkToken,
      onSuccess: (publicToken, metadata) => {
        if (isSettled) return;
        isSettled = true;
        handler.destroy();
        resolve({
          outcome: 'linked',
          payload: {
            publicToken,
            metadata: metadata || {},
          },
        });
      },
      onExit: (error) => {
        if (isSettled) return;
        isSettled = true;
        handler.destroy();
        if (error) {
          reject(new Error(String(error.display_message || error.error_message || error.error_code || 'Plaid Link failed')));
          return;
        }
        resolve({ outcome: 'cancelled' });
      },
      onEvent: (eventName, metadata) => {
        try {
          options?.onEvent?.(eventName, metadata || {});
        } catch {
          // Event hooks must never break Link.
        }
      },
    };
    if (receivedRedirectUri) {
      createConfig.receivedRedirectUri = receivedRedirectUri;
    }
    const handler = plaid.create(createConfig);
    handler.open();
  });
}
