import React from 'react';

import { Accumul8PageModals } from './Accumul8PageModals';

interface Accumul8PageModalAssemblyProps {
  props: React.ComponentProps<typeof Accumul8PageModals>;
}

export function Accumul8PageModalAssembly({ props }: Accumul8PageModalAssemblyProps) {
  return <Accumul8PageModals {...props} />;
}
