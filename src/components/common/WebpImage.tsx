import React from 'react';

type WebpImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
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

export function WebpImage({ src, onError, ...imgProps }: WebpImageProps) {
  const fallbackSrc = src;
  const primarySrc = React.useMemo(() => getWebpPrimary(src), [src]);
  const [resolvedSrc, setResolvedSrc] = React.useState(primarySrc);

  React.useEffect(() => {
    setResolvedSrc(primarySrc);
  }, [primarySrc]);

  const handleError = React.useCallback(
    (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
      if (resolvedSrc !== fallbackSrc) {
        setResolvedSrc(fallbackSrc);
      }
      onError?.(event);
    },
    [fallbackSrc, onError, resolvedSrc]
  );

  return <img {...imgProps} src={resolvedSrc} onError={handleError} />;
}
