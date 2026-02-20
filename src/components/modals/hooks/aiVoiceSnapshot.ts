type SnapshotArgs = {
  mysteryGeminiKeyName: string;
  mysteryGeminiProjectName: string;
  mysteryGeminiProjectNumber: string;
  ttsVoiceMapActive: string;
  ttsOutputFormat: string;
  ttsLanguageCode: string;
  ttsVoiceName: string;
  ttsSpeakingRate: number;
  ttsPitch: number;
};

export function buildAiVoiceSnapshot(args: SnapshotArgs) {
  return JSON.stringify({
    mysteryServiceAccountJson: '',
    mysteryGeminiApiKey: '',
    mysteryGeminiKeyName: String(args.mysteryGeminiKeyName || ''),
    mysteryGeminiProjectName: String(args.mysteryGeminiProjectName || ''),
    mysteryGeminiProjectNumber: String(args.mysteryGeminiProjectNumber || ''),
    ttsVoiceMapActive: String(args.ttsVoiceMapActive || ''),
    ttsOutputFormat: String(args.ttsOutputFormat || ''),
    ttsLanguageCode: String(args.ttsLanguageCode || ''),
    ttsVoiceName: String(args.ttsVoiceName || ''),
    ttsSpeakingRate: Number(args.ttsSpeakingRate),
    ttsPitch: Number(args.ttsPitch),
  });
}
