import React from 'react';

interface TtsDefaultsSectionProps {
  ttsVoiceMapActive: string;
  setTtsVoiceMapActive: (v: string) => void;
  ttsOutputFormat: string;
  setTtsOutputFormat: (v: string) => void;
  ttsLanguageCode: string;
  setTtsLanguageCode: (v: string) => void;
  ttsVoiceName: string;
  setTtsVoiceName: (v: string) => void;
  ttsSpeakingRate: number;
  setTtsSpeakingRate: (v: number) => void;
  ttsPitch: number;
  setTtsPitch: (v: number) => void;
  busy: boolean;
}

export function TtsDefaultsSection({
  ttsVoiceMapActive, setTtsVoiceMapActive,
  ttsOutputFormat, setTtsOutputFormat,
  ttsLanguageCode, setTtsLanguageCode,
  ttsVoiceName, setTtsVoiceName,
  ttsSpeakingRate, setTtsSpeakingRate,
  ttsPitch, setTtsPitch,
  busy
}: TtsDefaultsSectionProps) {
  return (
    <div className="border rounded p-3 h-100">
      <div className="fw-semibold mb-2">Mystery: TTS Defaults (Global)</div>
      <div className="form-text mb-3">These defaults apply game-wide (not per case/scenario).</div>

      <div className="row g-2">
        <div className="col-12">
          <label className="form-label" htmlFor="mystery-tts-defaults-active">Active Voice Map</label>
          <select
            id="mystery-tts-defaults-active"
            className="form-select"
            value={String(ttsVoiceMapActive || 'google')}
            onChange={(e) => setTtsVoiceMapActive(e.target.value)}
            disabled={busy}
          >
            <option value="google">Google Cloud TTS</option>
            <option value="live">Gemini Live</option>
          </select>
        </div>

        <div className="col-12">
          <label className="form-label" htmlFor="mystery-tts-defaults-format">Output format</label>
          <select
            id="mystery-tts-defaults-format"
            className="form-select"
            value={String(ttsOutputFormat || 'mp3')}
            onChange={(e) => setTtsOutputFormat(e.target.value)}
            disabled={busy}
          >
            <option value="mp3">MP3</option>
            <option value="wav">WAV</option>
          </select>
        </div>

        <div className="col-12">
          <label className="form-label" htmlFor="mystery-tts-defaults-language">Default language</label>
          <input
            id="mystery-tts-defaults-language"
            className="form-control"
            value={String(ttsLanguageCode || 'en-US')}
            onChange={(e) => setTtsLanguageCode(e.target.value)}
            disabled={busy}
            placeholder="en-US"
          />
        </div>

        <div className="col-12">
          <label className="form-label" htmlFor="mystery-tts-defaults-voice">Default Google voice name</label>
          <input
            id="mystery-tts-defaults-voice"
            className="form-control"
            value={String(ttsVoiceName || '')}
            onChange={(e) => setTtsVoiceName(e.target.value)}
            disabled={busy}
            placeholder="en-US-Standard-C"
            autoComplete="off"
          />
        </div>

        <div className="col-6">
          <label className="form-label" htmlFor="mystery-tts-defaults-rate">Default speaking rate</label>
          <input
            id="mystery-tts-defaults-rate"
            className="form-control"
            type="number"
            step="0.05"
            min="0.25"
            max="4"
            value={String(ttsSpeakingRate)}
            onChange={(e) => setTtsSpeakingRate(Number(e.target.value))}
            disabled={busy}
          />
        </div>

        <div className="col-6">
          <label className="form-label" htmlFor="mystery-tts-defaults-pitch">Default pitch</label>
          <input
            id="mystery-tts-defaults-pitch"
            className="form-control"
            type="number"
            step="0.5"
            min="-20"
            max="20"
            value={String(ttsPitch)}
            onChange={(e) => setTtsPitch(Number(e.target.value))}
            disabled={busy}
          />
        </div>
      </div>
    </div>
  );
}
