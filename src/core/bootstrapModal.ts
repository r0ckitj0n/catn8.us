export interface IBootstrapModalOptions {
  backdrop?: boolean | 'static';
  focus?: boolean;
  keyboard?: boolean;
}

export interface IBootstrapModal {
  show(): void;
  hide(): void;
  dispose(): void;
  handleUpdate(): void;
  [key: string]: any;
}

declare global {
  interface Window {
    bootstrap: any;
  }
}

export const CATN8_BOOTSTRAP_MODAL_DEFAULTS: IBootstrapModalOptions = {
  backdrop: true,
  focus: true,
  keyboard: true,
};

export function isBootstrapModalReady(): boolean {
  return Boolean(window.bootstrap && window.bootstrap.Modal);
}

export function createBootstrapModal(element: HTMLElement, options: IBootstrapModalOptions = {}): IBootstrapModal {
  if (!element) throw new Error('createBootstrapModal: element is required');
  if (!isBootstrapModalReady()) throw new Error('createBootstrapModal: Bootstrap Modal is not available');

  const merged = { ...CATN8_BOOTSTRAP_MODAL_DEFAULTS, ...options };
  const Modal = window.bootstrap.Modal;
  
  if (typeof Modal.getOrCreateInstance === 'function') {
    return Modal.getOrCreateInstance(element, merged) as IBootstrapModal;
  }
  return new Modal(element, merged) as IBootstrapModal;
}
