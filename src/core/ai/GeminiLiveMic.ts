import { GeminiLiveAudio } from '../GeminiLiveAudio';

export class GeminiLiveMic {
  stream: MediaStream | null = null;
  context: AudioContext | null = null;
  source: MediaStreamAudioSourceNode | null = null;
  processor: ScriptProcessorNode | null = null;
  gain: GainNode | null = null;

  onAudio: ((b64: string) => void) | null = null;

  constructor(onAudio: (b64: string) => void) {
    this.onAudio = onAudio;
  }

  async start() {
    if (this.stream) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.stream = stream;

    const AnyWindow = window as any;
    const context = new (AnyWindow.AudioContext || AnyWindow.webkitAudioContext)();
    this.context = context;

    const source = context.createMediaStreamSource(stream);
    this.source = source;

    const processor = context.createScriptProcessor(4096, 1, 1);
    this.processor = processor;

    const gain = context.createGain();
    gain.gain.value = 0;
    this.gain = gain;

    processor.onaudioprocess = (event) => {
      if (!this.onAudio) return;
      const input = event.inputBuffer.getChannelData(0);
      const pcm16 = GeminiLiveAudio.downsampleTo16kPcm16(input, context.sampleRate);
      if (!pcm16 || pcm16.byteLength === 0) return;
      const b64 = GeminiLiveAudio.arrayBufferToBase64(pcm16.buffer);
      this.onAudio(b64);
    };

    source.connect(processor);
    processor.connect(gain);
    gain.connect(context.destination);
  }

  async stop() {
    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch (_) {}
      this.processor.onaudioprocess = null;
      this.processor = null;
    }

    if (this.gain) {
      try {
        this.gain.disconnect();
      } catch (_) {}
      this.gain = null;
    }

    if (this.source) {
      try {
        this.source.disconnect();
      } catch (_) {}
      this.source = null;
    }

    if (this.context) {
      try {
        await this.context.close();
      } catch (_) {}
      this.context = null;
    }

    if (this.stream) {
      try {
        this.stream.getTracks().forEach((t) => t.stop());
      } catch (_) {}
      this.stream = null;
    }
  }
}
