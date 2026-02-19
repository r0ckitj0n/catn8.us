import { GeminiLiveConfig } from './GeminiLiveTypes';

export class GeminiLiveNetworking {
  static normalizeModelName(model: string) {
    const m = String(model || '').trim();
    if (!m) return '';
    if (m.startsWith('models/')) return m;
    return 'models/' + m;
  }

  static wsUrlForToken(tokenName: string) {
    const t = String(tokenName || '').trim();
    const q = encodeURIComponent(t);
    return 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=' + q;
  }

  static createSetupMessage(model: string, systemInstruction: string) {
    return {
      setup: {
        model: this.normalizeModelName(model),
        generationConfig: {
          responseModalities: ['AUDIO'],
        },
        systemInstruction: {
          parts: [{ text: systemInstruction || '' }],
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    };
  }

  static createAudioMessage(b64: string) {
    return {
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: b64,
        },
      },
    };
  }

  static createTextMessage(text: string) {
    return {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text: text }],
          },
        ],
        turnComplete: true,
      },
    };
  }
}
