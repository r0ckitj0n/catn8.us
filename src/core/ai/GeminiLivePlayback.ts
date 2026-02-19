import { GeminiLiveAudio } from '../GeminiLiveAudio';

export class GeminiLivePlayback {
  playContext: AudioContext | null = null;
  playQueue: Uint8Array[] = [];
  playing: boolean = false;

  constructor() {}

  ensureContext() {
    if (this.playContext) return;
    const AnyWindow = window as any;
    this.playContext = new (AnyWindow.AudioContext || AnyWindow.webkitAudioContext)({ sampleRate: 24000 });
  }

  enqueue(b64: string) {
    const bin = GeminiLiveAudio.base64ToUint8Array(b64);
    if (!bin || bin.length === 0) return;

    this.ensureContext();
    this.playQueue.push(bin);
    if (!this.playing) {
      this.playing = true;
      void this.drainQueue();
    }
  }

  async drainQueue() {
    while (this.playQueue.length) {
      const chunk = this.playQueue.shift();
      if (!chunk) continue;

      const ctx = this.playContext;
      if (!ctx) break;

      const pcm = new Int16Array(chunk.buffer, chunk.byteOffset, Math.floor(chunk.byteLength / 2));
      const buf = ctx.createBuffer(1, pcm.length, 24000);
      const out = buf.getChannelData(0);
      for (let i = 0; i < pcm.length; i += 1) {
        out[i] = Math.max(-1, Math.min(1, pcm[i] / 32768));
      }

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);

      await new Promise<void>((resolve) => {
        src.onended = () => resolve();
        try {
          src.start();
        } catch (_) {
          resolve();
        }
      });
    }

    this.playing = false;
  }

  stop() {
    this.playQueue = [];
    this.playing = false;
    if (this.playContext) {
      try {
        void this.playContext.close();
      } catch (_) {}
      this.playContext = null;
    }
  }

  clearQueue() {
    this.playQueue = [];
  }
}
