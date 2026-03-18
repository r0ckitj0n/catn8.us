import React from 'react';

import { read, utils } from 'xlsx';

import { ApiClient } from '../ApiClient';
import { fileExtensionFromName, isPdfDocument } from '../../components/pages/build-wizard/buildWizardUtils';
import { IBuildWizardDocument } from '../../types/buildWizard';
import { LightboxPreview, SpreadsheetPreviewSheet, TaskDocumentPreview } from './buildWizardPageRenderTypes';
import { isTextLikeMime } from './buildWizardSearchCostUtils';

interface UseBuildWizardDocumentPreviewOptions {
  lightboxTextPreviewMaxChars: number;
  onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
  parseTaskDocumentPreview: (text: string) => TaskDocumentPreview | null;
  setLightboxDoc: React.Dispatch<React.SetStateAction<LightboxPreview | null>>;
  setLightboxSpreadsheetSheetIndex: React.Dispatch<React.SetStateAction<number>>;
  setLightboxZoom: React.Dispatch<React.SetStateAction<number>>;
}

const textPreviewExtensions = new Set(['TXT', 'MD', 'JSON', 'CSV', 'LOG', 'XML', 'YAML', 'YML']);

export function useBuildWizardDocumentPreview({
  lightboxTextPreviewMaxChars,
  onToast,
  parseTaskDocumentPreview,
  setLightboxDoc,
  setLightboxSpreadsheetSheetIndex,
  setLightboxZoom,
}: UseBuildWizardDocumentPreviewOptions) {
  const closeLightbox = React.useCallback(() => {
    setLightboxDoc(null);
    setLightboxSpreadsheetSheetIndex(0);
    setLightboxZoom(1);
  }, [setLightboxDoc, setLightboxSpreadsheetSheetIndex, setLightboxZoom]);

  const isSpreadsheetPreviewDoc = React.useCallback((doc: IBuildWizardDocument): boolean => {
    const ext = fileExtensionFromName(doc.original_name);
    if (ext === 'XLSX' || ext === 'XLSM' || ext === 'XLS') {
      return true;
    }
    const mime = String(doc.mime_type || '').toLowerCase();
    return mime.includes('spreadsheet') || mime.includes('excel');
  }, []);

  const isPlanPreviewDoc = React.useCallback((doc: IBuildWizardDocument): boolean => {
    return fileExtensionFromName(doc.original_name) === 'PLAN';
  }, []);

  const isTextPreviewDoc = React.useCallback((doc: IBuildWizardDocument): boolean => {
    const ext = fileExtensionFromName(doc.original_name);
    if (textPreviewExtensions.has(ext)) {
      return true;
    }
    return isTextLikeMime(doc.mime_type || '');
  }, []);

  const openDocumentPreview = React.useCallback(async (doc: IBuildWizardDocument) => {
    const src = String(doc.public_url || '').trim();
    const title = String(doc.original_name || 'Document');
    if (!src) {
      onToast?.({ tone: 'error', message: `Unable to open ${title}` });
      return;
    }

    if (Number(doc.is_image) === 1) {
      setLightboxZoom(1);
      setLightboxDoc({ mode: 'image', src, title });
      return;
    }

    if (isPdfDocument(doc)) {
      setLightboxDoc({ mode: 'embed', src, title });
      return;
    }

    setLightboxZoom(1);
    setLightboxDoc({ mode: 'loading', src, title });
    setLightboxSpreadsheetSheetIndex(0);

    try {
      if (!isSpreadsheetPreviewDoc(doc) && !isPlanPreviewDoc(doc) && !isTextPreviewDoc(doc)) {
        setLightboxDoc({ mode: 'embed', src, title });
        return;
      }

      const blob = await ApiClient.getBlob(src);

      if (isSpreadsheetPreviewDoc(doc)) {
        const bytes = await blob.arrayBuffer();
        const workbook = read(bytes, { type: 'array' });
        const maxRows = 120;
        const maxCols = 24;
        let truncated = false;

        const sheets: SpreadsheetPreviewSheet[] = workbook.SheetNames.map((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const rawRows = utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
            header: 1,
            raw: false,
            blankrows: false,
            defval: '',
          });
          const boundedRows = rawRows.slice(0, maxRows).map((row) => {
            const hasExtraCols = row.length > maxCols;
            if (hasExtraCols) {
              truncated = true;
            }
            return row.slice(0, maxCols).map((cell) => String(cell ?? ''));
          });
          if (rawRows.length > maxRows) {
            truncated = true;
          }
          return { name: sheetName, rows: boundedRows };
        });

        if (!sheets.length) {
          throw new Error('Spreadsheet has no visible sheets');
        }

        setLightboxDoc({ mode: 'spreadsheet', src, title, sheets, truncated });
        return;
      }

      if (isPlanPreviewDoc(doc)) {
        const textRaw = await blob.text();
        const text = textRaw.replace(/\u0000/g, '').trim();
        if (!text) {
          throw new Error('Plan file appears empty');
        }

        const sample = text.slice(0, 2000);
        const nonPrintableCount = sample.replace(/[\t\r\n\x20-\x7E]/g, '').length;
        if (sample.length > 0 && nonPrintableCount / sample.length > 0.2) {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const maxBytes = 4096;
          const bounded = bytes.slice(0, maxBytes);
          const lines: string[] = [];
          for (let offset = 0; offset < bounded.length; offset += 16) {
            const chunk = bounded.slice(offset, offset + 16);
            const hex = Array.from(chunk).map((b) => b.toString(16).padStart(2, '0')).join(' ');
            const ascii = Array.from(chunk).map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('');
            lines.push(`${offset.toString(16).padStart(6, '0')}  ${hex.padEnd(47, ' ')}  ${ascii}`);
          }
          setLightboxDoc({
            mode: 'plan',
            src,
            title,
            text: lines.join('\n'),
            truncated: bytes.length > maxBytes,
            format: 'hex',
          });
          return;
        }

        const maxChars = 60000;
        const truncated = text.length > maxChars;
        setLightboxDoc({
          mode: 'plan',
          src,
          title,
          text: truncated ? `${text.slice(0, maxChars)}\n\n...truncated for preview...` : text,
          truncated,
          format: 'text',
        });
        return;
      }

      const textRaw = await blob.text();
      const cleanedText = textRaw.replace(/\u0000/g, '');
      if (!cleanedText.trim()) {
        throw new Error('Text file appears empty');
      }
      const truncated = cleanedText.length > lightboxTextPreviewMaxChars;
      const boundedText = truncated
        ? `${cleanedText.slice(0, lightboxTextPreviewMaxChars)}\n\n...truncated for preview...`
        : cleanedText;
      setLightboxDoc({
        mode: 'text',
        src,
        title,
        text: boundedText,
        truncated,
        taskPreview: parseTaskDocumentPreview(boundedText),
      });
    } catch (err: any) {
      const detail = String(err?.message || '').trim() || 'Failed to load file preview';
      setLightboxDoc({ mode: 'error', src, title, message: detail });
      onToast?.({ tone: 'warning', message: `${title}: ${detail}` });
    }
  }, [
    isPlanPreviewDoc,
    isSpreadsheetPreviewDoc,
    isTextPreviewDoc,
    lightboxTextPreviewMaxChars,
    onToast,
    parseTaskDocumentPreview,
    setLightboxDoc,
    setLightboxSpreadsheetSheetIndex,
    setLightboxZoom,
  ]);

  return {
    closeLightbox,
    isPlanPreviewDoc,
    isSpreadsheetPreviewDoc,
    isTextPreviewDoc,
    openDocumentPreview,
  };
}
