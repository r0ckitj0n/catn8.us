import type { TellerConnectEvent } from './tellerConnect';

const TELLER_ORIGIN_PATTERN = /https:\/\/([a-z0-9-]+\.)?teller\.io$/i;
const TELLER_IFRAME_PATTERN = /https:\/\/([a-z0-9-]+\.)?teller\.io\//i;

export function createTellerMessageHandler(emitEvent: (event: TellerConnectEvent) => void) {
  return (browserEvent: MessageEvent) => {
    const origin = String(browserEvent.origin || '');
    if (!TELLER_ORIGIN_PATTERN.test(origin)) {
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
}

export function startTellerIframeTracking(emitEvent: (event: TellerConnectEvent) => void): () => void {
  const seenIframeSrcs = new Set<string>();
  const trackedIframes = new Set<HTMLIFrameElement>();

  const inspectIframe = (iframe: HTMLIFrameElement | null) => {
    if (!iframe) {
      return;
    }
    const src = String(iframe.getAttribute('src') || iframe.src || '');
    if (!TELLER_IFRAME_PATTERN.test(src)) {
      return;
    }
    trackedIframes.add(iframe);
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

  const iframePollInterval = window.setInterval(() => {
    trackedIframes.forEach((iframe) => {
      if (!document.contains(iframe)) {
        trackedIframes.delete(iframe);
        return;
      }
      inspectIframe(iframe);
    });
    document.querySelectorAll('iframe').forEach((iframe) => inspectIframe(iframe as HTMLIFrameElement));
  }, 1000);

  return () => {
    mutationObserver.disconnect();
    window.clearInterval(iframePollInterval);
    trackedIframes.clear();
  };
}

function summarizeMessageData(data: unknown): Record<string, unknown> {
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
}
