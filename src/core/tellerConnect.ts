export interface TellerConnectEnrollment {
  id?: string;
  institution?: {
    id?: string;
    name?: string;
  };
}

export interface TellerConnectSuccessPayload {
  accessToken?: string;
  user?: {
    id?: string;
  };
  enrollment?: TellerConnectEnrollment;
}

export interface TellerConnectFailurePayload {
  code?: string;
  message?: string;
  type?: string;
}

export interface TellerConnectEvent {
  name: 'open' | 'init' | 'iframe_detected' | 'message' | 'success' | 'exit' | 'failure';
  payload?: TellerConnectSuccessPayload | TellerConnectFailurePayload | Record<string, unknown>;
}

interface TellerConnectInstance {
  open: () => void;
}

interface TellerConnectGlobal {
  setup: (config: {
    applicationId: string;
    environment: 'sandbox' | 'development' | 'production';
    products: string[];
    selectAccount?: 'disabled' | 'single' | 'multiple';
    onInit?: () => void;
    onSuccess: (payload: TellerConnectSuccessPayload) => void;
    onFailure?: (payload: TellerConnectFailurePayload) => void;
    onExit: () => void;
  }) => TellerConnectInstance;
}

declare global {
  interface Window {
    TellerConnect?: TellerConnectGlobal;
  }
}

const TELLER_CONNECT_SCRIPT_ID = 'catn8-teller-connect-sdk';
const TELLER_CONNECT_SCRIPT_SRC = 'https://cdn.teller.io/connect/connect.js';
const TELLER_CONNECT_PRODUCTS = ['transactions'];

export async function ensureTellerConnectLoaded(): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Browser environment is required');
  }

  if (window.TellerConnect && typeof window.TellerConnect.setup === 'function') {
    return;
  }

  const existing = document.getElementById(TELLER_CONNECT_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      const done = () => {
        if (window.TellerConnect && typeof window.TellerConnect.setup === 'function') resolve();
        else reject(new Error('Teller Connect failed to initialize'));
      };
      existing.addEventListener('load', done, { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Teller Connect script')), { once: true });
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = TELLER_CONNECT_SCRIPT_ID;
    script.src = TELLER_CONNECT_SCRIPT_SRC;
    script.onload = () => {
      if (window.TellerConnect && typeof window.TellerConnect.setup === 'function') resolve();
      else reject(new Error('Teller Connect script loaded but API was unavailable'));
    };
    script.onerror = () => reject(new Error('Failed to load Teller Connect script'));
    document.head.appendChild(script);
  });
}

export async function openTellerConnect(
  applicationId: string,
  environment: 'sandbox' | 'development' | 'production',
  options?: {
    selectAccount?: 'disabled' | 'single' | 'multiple';
    onEvent?: (event: TellerConnectEvent) => void;
  },
): Promise<{ outcome: 'linked'; payload: TellerConnectSuccessPayload } | { outcome: 'cancelled' }> {
  if (typeof applicationId !== 'string' || applicationId.trim() === '') {
    throw new Error('Teller application id is required');
  }

  await ensureTellerConnectLoaded();

  const teller = window.TellerConnect;
  if (!teller || typeof teller.setup !== 'function') {
    throw new Error('Teller Connect is unavailable');
  }

  return await new Promise((resolve, reject) => {
    let didSucceed = false;
    let isSettled = false;

    const emitEvent = (event: TellerConnectEvent) => {
      try {
        options?.onEvent?.(event);
      } catch (error) {
        console.warn('[TellerConnect] event hook failed', event.name, error);
      }
    };

    const summarizeMessageData = (data: unknown): Record<string, unknown> => {
      if (typeof data === 'string') {
        return {
          data_type: 'string',
          text_preview: data.slice(0, 240),
        };
      }
      if (!data || typeof data !== 'object') {
        return {
          data_type: typeof data,
        };
      }
      const record = data as Record<string, unknown>;
      const summary: Record<string, unknown> = {
        data_type: 'object',
        keys: Object.keys(record).slice(0, 20),
      };
      for (const key of ['type', 'event', 'name', 'status', 'code', 'message', 'institution', 'institution_id']) {
        const value = record[key];
        if (typeof value === 'string' && value.trim() !== '') {
          summary[key] = value.slice(0, 240);
        }
      }
      return summary;
    };

    const messageHandler = (browserEvent: MessageEvent) => {
      const origin = String(browserEvent.origin || '');
      if (!/https:\/\/([a-z0-9-]+\.)?teller\.io$/i.test(origin)) {
        return;
      }
      emitEvent({
        name: 'message',
        payload: {
          origin,
          ...summarizeMessageData(browserEvent.data),
        },
      });
    };
    window.addEventListener('message', messageHandler);

    const seenIframeSrcs = new Set<string>();
    const inspectIframe = (iframe: HTMLIFrameElement | null) => {
      if (!iframe) return;
      const src = String(iframe.getAttribute('src') || iframe.src || '');
      if (!/https:\/\/([a-z0-9-]+\.)?teller\.io\//i.test(src)) {
        return;
      }
      if (seenIframeSrcs.has(src)) {
        return;
      }
      seenIframeSrcs.add(src);
      const institutionMatch = src.match(/\/enroll\/([^/?#]+)/i);
      emitEvent({
        name: 'iframe_detected',
        payload: {
          src_preview: src.slice(0, 240),
          institution_id: institutionMatch ? institutionMatch[1] : '',
        },
      });
    };
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) {
            return;
          }
          if (node instanceof HTMLIFrameElement) {
            inspectIframe(node);
            return;
          }
          node.querySelectorAll('iframe').forEach((iframe) => inspectIframe(iframe as HTMLIFrameElement));
        });
      });
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    const cleanup = () => {
      window.removeEventListener('message', messageHandler);
      mutationObserver.disconnect();
    };

    const connection = teller.setup({
      applicationId,
      environment,
      products: TELLER_CONNECT_PRODUCTS,
      selectAccount: options?.selectAccount || 'disabled',
      onInit: () => {
        emitEvent({ name: 'init' });
      },
      onSuccess: (payload) => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        didSucceed = true;
        emitEvent({ name: 'success', payload });
        resolve({ outcome: 'linked', payload });
      },
      onFailure: (payload) => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        emitEvent({ name: 'failure', payload });
        const message = String(payload?.message || payload?.code || 'Teller Connect failed');
        reject(new Error(message));
      },
      onExit: () => {
        emitEvent({ name: 'exit' });
        if (didSucceed || isSettled) return;
        isSettled = true;
        cleanup();
        resolve({ outcome: 'cancelled' });
      },
    });

    if (!connection || typeof connection.open !== 'function') {
      cleanup();
      reject(new Error('Teller Connect did not initialize correctly'));
      return;
    }

    emitEvent({ name: 'open' });
    connection.open();
  });
}
