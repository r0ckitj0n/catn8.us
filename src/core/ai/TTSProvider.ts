export type TtsResult = {
  audioUrl: string;
  audioEncoding?: string;
};

export class TTSProvider {
  static async synthesize(): Promise<TtsResult> {
    throw new Error('TTSProvider.synthesize is not implemented. Use server-side TTS via /api/mystery/interrogate.php.');
  }
}
