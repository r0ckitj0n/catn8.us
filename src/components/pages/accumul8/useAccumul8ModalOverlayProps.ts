import React from 'react';

import { Accumul8PageModals } from './Accumul8PageModals';
import { Accumul8PageOverlays } from './Accumul8PageOverlays';

interface UseAccumul8ModalOverlayPropsOptions {
  modalProps: React.ComponentProps<typeof Accumul8PageModals>;
  overlayProps: React.ComponentProps<typeof Accumul8PageOverlays>;
}

export function useAccumul8ModalOverlayProps({
  modalProps,
  overlayProps,
}: UseAccumul8ModalOverlayPropsOptions) {
  return React.useMemo(() => ({
    modalProps,
    overlayProps,
  }), [modalProps, overlayProps]);
}
