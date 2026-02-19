import { GeminiLiveClient } from '../GeminiLiveClient';

export class GeminiProvider {
  static sanitizeUserText(text: string, opts?: { maxLen?: number }): string {
    const maxLen = Number(opts?.maxLen || 2000);
    const raw = String(text || '');
    const noCtl = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');
    const collapsed = noCtl.replace(/\s+/g, ' ').trim();
    if (!collapsed) return '';
    if (!Number.isFinite(maxLen) || maxLen <= 0) return collapsed;
    return collapsed.length > maxLen ? collapsed.slice(0, maxLen) : collapsed;
  }

  static createLiveClient({ tokenName, model, systemInstruction, enableMic, onState, onTranscript, onError }: {
    tokenName: string;
    model: string;
    systemInstruction: string;
    enableMic?: boolean;
    onState?: (state: unknown) => void;
    onTranscript?: (evt: unknown) => void;
    onError?: (err: unknown) => void;
  }): GeminiLiveClient {
    return new GeminiLiveClient({
      tokenName,
      model,
      systemInstruction,
      enableMic,
      onState,
      onTranscript,
      onError,
    });
  }
}
