import { Accumul8StatementUpload } from '../types/accumul8';
import { buildAccumul8StatementOcrPopupHtml } from './accumul8StatementOcrHtml';

type PopupSide = 'left' | 'right';

function buildPopupFeatures(side: PopupSide): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const screenWidth = Math.max(window.screen.availWidth || window.innerWidth || 1440, 1024);
  const screenHeight = Math.max(window.screen.availHeight || window.innerHeight || 900, 720);
  const popupWidth = Math.max(Math.floor(screenWidth / 2), 640);
  const popupHeight = Math.max(screenHeight - 80, 640);
  const baseLeft = Math.max(window.screenX || 0, 0);
  const popupLeft = side === 'left'
    ? baseLeft
    : Math.max(baseLeft + screenWidth - popupWidth, 0);
  const popupTop = Math.max(window.screenY || 0, 0);
  return [
    `width=${popupWidth}`,
    `height=${popupHeight}`,
    `left=${popupLeft}`,
    `top=${popupTop}`,
    'popup=yes',
    'noopener=yes',
    'noreferrer=yes',
    'menubar=no',
    'toolbar=no',
    'location=no',
    'status=no',
    'personalbar=no',
    'resizable=yes',
    'scrollbars=yes',
  ].join(',');
}

export function openAccumul8StatementPdfPopup(
  href: string,
  uploadId: number,
  onBlocked?: () => void,
): void {
  if (typeof window === 'undefined') {
    return;
  }
  const features = buildPopupFeatures('left');
  if (!features) {
    return;
  }
  const popupWindow = window.open(href, `accumul8-statement-pdf-${uploadId}`, features);
  if (!popupWindow) {
    onBlocked?.();
    return;
  }
  popupWindow.focus();
}

export function openAccumul8StatementOcrPopup(
  upload: Accumul8StatementUpload,
  onBlocked?: () => void,
): void {
  if (typeof window === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || !upload.ocr_statement) {
    return;
  }
  const features = buildPopupFeatures('right');
  if (!features) {
    return;
  }
  const html = buildAccumul8StatementOcrPopupHtml(upload);
  const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const popupWindow = window.open(blobUrl, `accumul8-statement-ocr-${upload.id}`, features);
  if (!popupWindow) {
    URL.revokeObjectURL(blobUrl);
    onBlocked?.();
    return;
  }
  popupWindow.focus();
  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 60000);
}
