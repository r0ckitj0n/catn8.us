import React from 'react';

type WebpImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  finalFallbackSrc?: string;
};

const STATIC_IMAGE_PATH = /^(?:https?:\/\/[^/]+)?\/?images\//i;
const RASTER_IMAGE_EXT = /\.(?:jpe?g|png)(?=[?#]|$)/i;

function getWebpPrimary(src: string): string {
  if (!STATIC_IMAGE_PATH.test(src)) {
    return src;
  }
  if (!RASTER_IMAGE_EXT.test(src)) {
    return src;
  }
  return src.replace(RASTER_IMAGE_EXT, '.webp');
}

export function WebpImage({ src, finalFallbackSrc, onError, ...imgProps }: WebpImageProps) {
  const fallbackSrc = src;
  const primarySrc = React.useMemo(() => getWebpPrimary(src), [src]);
  const tertiarySrc = finalFallbackSrc || '';
  const [resolvedSrc, setResolvedSrc] = React.useState(primarySrc);

  React.useEffect(() => {
    setResolvedSrc(primarySrc);
  }, [primarySrc]);

  const handleError = React.useCallback(
    (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
      if (resolvedSrc !== fallbackSrc) {
        setResolvedSrc(fallbackSrc);
      } else if (tertiarySrc && resolvedSrc !== tertiarySrc) {
        setResolvedSrc(tertiarySrc);
      }
      onError?.(event);
    },
    [fallbackSrc, onError, resolvedSrc, tertiarySrc]
  );

  return <img {...imgProps} src={resolvedSrc} onError={handleError} />;
}
