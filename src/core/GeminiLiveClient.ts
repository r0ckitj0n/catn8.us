import { GeminiLiveNetworking } from './ai/GeminiLiveNetworking';
import { GeminiLivePlayback } from './ai/GeminiLivePlayback';
import { GeminiLiveMic } from './ai/GeminiLiveMic';
import { GeminiLiveConfig } from './ai/GeminiLiveTypes';

/**
 * GeminiLiveClient - Refactored Main Orchestrator
 * COMPLIANCE: File size < 250 lines
 */
export class GeminiLiveClient {
  private config: GeminiLiveConfig;
  private ws: WebSocket | null = null;
  private playback: GeminiLivePlayback;
  private mic: GeminiLiveMic;
  private setupComplete: boolean = false;
  private closed: boolean = false;

  constructor(config: GeminiLiveConfig) {
    this.config = config;
    this.playback = new GeminiLivePlayback();
    this.mic = new GeminiLiveMic((b64) => this.sendAudio(b64));
  }

  private emitState(state: any) {
    if (this.config.onState) this.config.onState(state);
  }

  private emitError(err: any) {
    if (this.config.onError) this.config.onError(err);
  }

  private emitTranscript(evt: any) {
    if (this.config.onTranscript) this.config.onTranscript(evt);
  }

  async connect() {
    if (this.ws) return;
    if (!this.config.tokenName) throw new Error('Missing tokenName');

    const url = GeminiLiveNetworking.wsUrlForToken(this.config.tokenName);
    this.ws = new WebSocket(url);

    this.emitState({ status: 'connecting' });

    this.ws.onopen = () => {
      try {
        this.setupComplete = false;
        const setup = GeminiLiveNetworking.createSetupMessage(this.config.model, this.config.systemInstruction);
        this.ws?.send(JSON.stringify(setup));
        this.emitState({ status: 'connected' });
      } catch (e) {
        this.emitError(e);
      }
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev?.data || ''));
        this.handleServerMessage(msg);
      } catch (e) {
        this.emitError(e);
      }
    };

    this.ws.onerror = () => this.emitError(new Error('WebSocket error'));
    this.ws.onclose = () => {
      if (this.closed) return;
      this.emitState({ status: 'closed' });
    };
  }

  async disconnect() {
    this.closed = true;
    this.setupComplete = false;
    await this.mic.stop();
    this.playback.stop();

    if (this.ws && this.ws.readyState <= 1) {
      try {
        this.ws.close();
      } catch (e) {
        this.emitError(e);
      }
    }
    this.ws = null;
    this.emitState({ status: 'closed' });
  }

  private sendAudio(b64: string) {
    if (!this.ws || this.ws.readyState !== 1 || !this.setupComplete) return;
    try {
      this.ws.send(JSON.stringify(GeminiLiveNetworking.createAudioMessage(b64)));
    } catch (e) {
      this.emitError(e);
    }
  }

  sendTextTurn(text: string) {
    if (!this.ws || this.ws.readyState !== 1) throw new Error('Live session is not connected');
    if (!this.setupComplete) throw new Error('Live session is not ready');

    const t = String(text || '').trim();
    if (!t) return;

    try {
      this.ws.send(JSON.stringify(GeminiLiveNetworking.createTextMessage(t)));
    } catch (e) {
      this.emitError(e);
      throw e;
    }
  }

  private handleServerMessage(message: any) {
    if (!message || typeof message !== 'object') return;

    if (message?.setupComplete) {
      this.setupComplete = true;
      this.emitState({ status: 'setup_complete' });
      if (this.config.enableMic !== false) {
        this.mic.start()
          .then(() => this.emitState({ status: 'streaming' }))
          .catch((e) => this.emitError(e));
      } else {
        this.emitState({ status: 'ready' });
      }
      return;
    }

    const sc = message?.serverContent;
    if (!sc) return;

    if (sc.interrupted) {
      this.playback.clearQueue();
      this.emitState({ status: 'interrupted' });
    }

    const inTr = sc.inputTranscription?.text;
    if (inTr) this.emitTranscript({ kind: 'input', text: inTr });

    const outTr = sc.outputTranscription?.text;
    if (outTr) this.emitTranscript({ kind: 'output', text: outTr });

    const parts = sc.modelTurn?.parts;
    if (Array.isArray(parts)) {
      for (const part of parts) {
        const data = part?.inlineData?.data;
        if (data) this.playback.enqueue(data);
      }
    }
  }
}
