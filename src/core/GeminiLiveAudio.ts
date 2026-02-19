export class GeminiLiveAudio {
  static downsampleTo16kPcm16(float32: Float32Array, inSampleRate: number) {
    const outSampleRate = 16000;
    if (!float32 || !float32.length) return new Int16Array(0);

    if (inSampleRate === outSampleRate) {
      const out = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i += 1) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return out;
    }

    const ratio = inSampleRate / outSampleRate;
    const newLen = Math.floor(float32.length / ratio);
    const out = new Int16Array(newLen);

    let offset = 0;
    for (let i = 0; i < newLen; i += 1) {
      const nextOffset = Math.floor((i + 1) * ratio);
      let sum = 0;
      let count = 0;
      for (let j = offset; j < nextOffset && j < float32.length; j += 1) {
        sum += float32[j];
        count += 1;
      }
      offset = nextOffset;
      const s = count ? sum / count : 0;
      const clamped = Math.max(-1, Math.min(1, s));
      out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }

    return out;
  }

  static arrayBufferToBase64(buf: ArrayBuffer) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  static base64ToUint8Array(b64: string) {
    const bin = atob(String(b64 || ''));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  }
}
