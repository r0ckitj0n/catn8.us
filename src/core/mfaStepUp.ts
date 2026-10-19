export interface MfaStepUpRequest {
  emailMasked: string;
  note: string;
}

type Listener = () => void;

let current: MfaStepUpRequest | null = null;
let resolver: ((ok: boolean) => void) | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeMfaStepUp(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMfaStepUpRequest(): MfaStepUpRequest | null {
  return current;
}

export function promptMfaStepUp(emailMasked: string, note: string): Promise<boolean> {
  if (resolver) {
    resolver(false);
  }
  return new Promise((resolve) => {
    resolver = resolve;
    current = { emailMasked, note };
    emit();
  });
}

export function settleMfaStepUp(ok: boolean): void {
  const resolve = resolver;
  resolver = null;
  current = null;
  emit();
  if (resolve) {
    resolve(ok);
  }
}
