export interface GeminiLiveConfig {
  tokenName: string;
  model: string;
  systemInstruction: string;
  enableMic?: boolean;
  onState?: (state: any) => void;
  onTranscript?: (evt: any) => void;
  onError?: (err: any) => void;
}

export interface GeminiLiveState {
  status: 'idle' | 'connecting' | 'connected' | 'setup_complete' | 'streaming' | 'ready' | 'interrupted' | 'closed';
}

export interface GeminiLiveTranscript {
  kind: 'input' | 'output';
  text: string;
}
