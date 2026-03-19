import { buildAccumul8LayerOptions } from './buildAccumul8LayerOptions';
import { buildAccumul8PresentationOptions } from './buildAccumul8PresentationOptions';
import { useAccumul8PageLayerSetup } from './useAccumul8PageLayerSetup';
import { useAccumul8PagePresentationSetup } from './useAccumul8PagePresentationSetup';

export function useAccumul8PageComposedProps(options: any) {
  const presentation = useAccumul8PagePresentationSetup(buildAccumul8PresentationOptions(options));
  const layers = useAccumul8PageLayerSetup(buildAccumul8LayerOptions(options));
  return { ...presentation, ...layers };
}
