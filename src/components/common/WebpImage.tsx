import React from 'react';

type WebpImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  finalFallbackSrc?: string;
};

const STATIC_IMAGE_PATH = /^(?:https?:\/\/[^/]+)?\/?images\//i;
const RASTER_IMAGE_EXT = /\.(?:avif|bmp|gif|jpe?g|png|tiff?)(?=[?#]|$)/i;

function getWebpPrimary(src: string): string {
  if (!STATIC_IMAGE_PATH.test(src)) {
    return src;
  }
  if (!RASTER_IMAGE_EXT.test(src)) {
    return src;
  }
  return src.replace(RASTER_IMAGE_EXT, '.webp');
}

function getPngCompatibilityFallback(src: string): string {
  if (!STATIC_IMAGE_PATH.test(src)) {
    return src;
  }
  if (!RASTER_IMAGE_EXT.test(src) && !/\.webp(?=[?#]|$)/i.test(src)) {
    return src;
  }
  return src.replace(/\.(?:avif|bmp|gif|jpe?g|png|tiff?|webp)(?=[?#]|$)/i, '.png');
}

export function WebpImage({ src, finalFallbackSrc, onError, ...imgProps }: WebpImageProps) {
  const originalFallbackSrc = src;
  const primarySrc = React.useMemo(() => getWebpPrimary(src), [src]);
  const compatibilityFallbackSrc = React.useMemo(() => getPngCompatibilityFallback(src), [src]);
  const tertiarySrc = finalFallbackSrc || '';
  const [resolvedSrc, setResolvedSrc] = React.useState(primarySrc);

  React.useEffect(() => {
    setResolvedSrc(primarySrc);
  }, [primarySrc]);

  const handleError = React.useCallback(
    (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
      if (resolvedSrc !== compatibilityFallbackSrc) {
        setResolvedSrc(compatibilityFallbackSrc);
      } else if (resolvedSrc !== originalFallbackSrc) {
        setResolvedSrc(originalFallbackSrc);
      } else if (tertiarySrc && resolvedSrc !== tertiarySrc) {
        setResolvedSrc(tertiarySrc);
      }
      onError?.(event);
    },
    [compatibilityFallbackSrc, onError, originalFallbackSrc, resolvedSrc, tertiarySrc]
  );

  return <img {...imgProps} src={resolvedSrc} onError={handleError} />;
}
