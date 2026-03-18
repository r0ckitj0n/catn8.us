import React from 'react';

import { StandardIconButton } from '../../components/common/StandardIconButton';
import { StandardIconLink } from '../../components/common/StandardIconLink';
import { WebpImage } from '../../components/common/WebpImage';
import { withDownloadFlag } from '../../components/pages/build-wizard/buildWizardUtils';
import { LightboxPreview } from './buildWizardPageRenderTypes';

interface BuildWizardLightboxModalProps {
  closeLightbox: () => void;
  lightboxDoc: LightboxPreview | null;
  lightboxSpreadsheetSheetIndex: number;
  lightboxSupportsZoom: boolean;
  lightboxZoom: number;
  lightboxZoomMax: number;
  lightboxZoomMin: number;
  lightboxZoomStep: number;
  onLightboxWheelZoom: React.WheelEventHandler<HTMLDivElement>;
  open: boolean;
  resetLightboxZoom: () => void;
  setLightboxSpreadsheetSheetIndex: (index: number) => void;
  zoomLightboxBy: (delta: number) => void;
}

export function BuildWizardLightboxModal({
  closeLightbox,
  lightboxDoc,
  lightboxSpreadsheetSheetIndex,
  lightboxSupportsZoom,
  lightboxZoom,
  lightboxZoomMax,
  lightboxZoomMin,
  lightboxZoomStep,
  onLightboxWheelZoom,
  open,
  resetLightboxZoom,
  setLightboxSpreadsheetSheetIndex,
  zoomLightboxBy,
}: BuildWizardLightboxModalProps) {
  if (!open || !lightboxDoc) {
    return null;
  }

  return (
    <div className="build-wizard-lightbox" onClick={closeLightbox}>
      <div className="build-wizard-lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <div className="build-wizard-lightbox-actions">
          {lightboxSupportsZoom ? (
            <>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm build-wizard-lightbox-zoom-btn"
                onClick={() => zoomLightboxBy(-lightboxZoomStep)}
                title="Zoom out"
                aria-label="Zoom out"
                disabled={lightboxZoom <= lightboxZoomMin}
              >
                -
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm build-wizard-lightbox-zoom-btn"
                onClick={resetLightboxZoom}
                title="Reset zoom"
                aria-label="Reset zoom"
              >
                {Math.round(lightboxZoom * 100)}%
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm build-wizard-lightbox-zoom-btn"
                onClick={() => zoomLightboxBy(lightboxZoomStep)}
                title="Zoom in"
                aria-label="Zoom in"
                disabled={lightboxZoom >= lightboxZoomMax}
              >
                +
              </button>
            </>
          ) : null}
          <StandardIconLink
            iconKey="download"
            ariaLabel="Download"
            title="Download"
            href={withDownloadFlag(lightboxDoc.src)}
            className="btn btn-outline-secondary btn-sm catn8-action-icon-btn build-wizard-lightbox-download"
          />
          <StandardIconButton
            iconKey="close"
            ariaLabel="Close preview"
            title="Close"
            className="btn btn-outline-secondary btn-sm catn8-action-icon-btn build-wizard-lightbox-close"
            onClick={closeLightbox}
          />
        </div>
        <div className={`build-wizard-lightbox-zoom-frame ${lightboxSupportsZoom ? 'is-zoomable' : ''}`} onWheel={onLightboxWheelZoom}>
          <div className="build-wizard-lightbox-zoom-content" style={lightboxSupportsZoom ? { transform: `scale(${lightboxZoom})` } : undefined}>
            {lightboxDoc.mode === 'image' ? (
              <WebpImage src={lightboxDoc.src} alt={lightboxDoc.title} className="build-wizard-lightbox-image" />
            ) : null}
            {lightboxDoc.mode === 'loading' ? (
              <div className="build-wizard-lightbox-message">Loading preview...</div>
            ) : null}
            {lightboxDoc.mode === 'error' ? (
              <div className="build-wizard-lightbox-message">
                <div>{lightboxDoc.message}</div>
                <div>
                  <a href={lightboxDoc.src} target="_blank" rel="noreferrer">Open original file</a>
                </div>
              </div>
            ) : null}
            {lightboxDoc.mode === 'embed' ? (
              <div className="build-wizard-lightbox-embed-wrap">
                <iframe
                  src={lightboxDoc.src}
                  title={lightboxDoc.title}
                  className="build-wizard-lightbox-embed"
                />
              </div>
            ) : null}
            {lightboxDoc.mode === 'plan' ? (
              <div className="build-wizard-lightbox-plan-wrap">
                <pre className="build-wizard-lightbox-plan">{lightboxDoc.text}</pre>
                <div className="build-wizard-lightbox-note">
                  {lightboxDoc.format === 'hex' ? 'Binary .plan preview (hex + ASCII).' : 'Text preview.'}
                  {lightboxDoc.truncated ? ' Preview truncated for performance.' : ''}
                </div>
              </div>
            ) : null}
            {lightboxDoc.mode === 'text' ? (
              <div className="build-wizard-lightbox-text-wrap">
                {lightboxDoc.taskPreview ? (
                  <div className="build-wizard-lightbox-task-preview">
                    {lightboxDoc.taskPreview.summaryFields.length ? (
                      <section>
                        <h4>Task Summary</h4>
                        <dl className="build-wizard-lightbox-task-fields">
                          {lightboxDoc.taskPreview.summaryFields.map((field) => (
                            <React.Fragment key={`summary-${field.label}`}>
                              <dt>{field.label}</dt>
                              <dd>{field.value}</dd>
                            </React.Fragment>
                          ))}
                        </dl>
                      </section>
                    ) : null}
                    {lightboxDoc.taskPreview.noteLines.length ? (
                      <section>
                        <h4>Notes</h4>
                        <div className="build-wizard-lightbox-task-notes">
                          {lightboxDoc.taskPreview.noteLines.map((line, idx) => (
                            <p key={`note-${idx}`}>{line}</p>
                          ))}
                        </div>
                      </section>
                    ) : null}
                    {lightboxDoc.taskPreview.metaFields.length ? (
                      <section>
                        <h4>Task Metadata</h4>
                        <dl className="build-wizard-lightbox-task-fields">
                          {lightboxDoc.taskPreview.metaFields.map((field) => (
                            <React.Fragment key={`meta-${field.label}`}>
                              <dt>{field.label}</dt>
                              <dd>{field.value}</dd>
                            </React.Fragment>
                          ))}
                        </dl>
                      </section>
                    ) : null}
                    {lightboxDoc.taskPreview.systemLines.length ? (
                      <section>
                        <h4>Source</h4>
                        <ul className="build-wizard-lightbox-task-system">
                          {lightboxDoc.taskPreview.systemLines.map((line, idx) => (
                            <li key={`source-${idx}`}>{line}</li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                  </div>
                ) : null}
                <details className="build-wizard-lightbox-text-raw">
                  <summary>Raw document text</summary>
                  <pre className="build-wizard-lightbox-plan">{lightboxDoc.text}</pre>
                </details>
                {lightboxDoc.truncated ? (
                  <div className="build-wizard-lightbox-note">Text preview truncated for performance.</div>
                ) : null}
              </div>
            ) : null}
            {lightboxDoc.mode === 'spreadsheet' ? (
              <div className="build-wizard-lightbox-sheet-wrap">
                <div className="build-wizard-lightbox-sheet-tabs" role="tablist" aria-label="Spreadsheet sheets">
                  {lightboxDoc.sheets.map((sheet, idx) => (
                    <button
                      key={sheet.name}
                      type="button"
                      className={`build-wizard-lightbox-sheet-tab ${lightboxSpreadsheetSheetIndex === idx ? 'is-active' : ''}`}
                      onClick={() => setLightboxSpreadsheetSheetIndex(idx)}
                    >
                      {sheet.name}
                    </button>
                  ))}
                </div>
                <div className="build-wizard-lightbox-sheet-table-wrap">
                  <table className="build-wizard-lightbox-sheet-table">
                    <tbody>
                      {(lightboxDoc.sheets[lightboxSpreadsheetSheetIndex]?.rows || []).map((row, rowIndex) => (
                        <tr key={`${lightboxSpreadsheetSheetIndex}-${rowIndex}`}>
                          {row.map((cell, cellIndex) => (
                            <td key={`${lightboxSpreadsheetSheetIndex}-${rowIndex}-${cellIndex}`}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {lightboxDoc.truncated ? <div className="build-wizard-lightbox-note">Preview is limited to 120 rows and 24 columns per sheet.</div> : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className="build-wizard-lightbox-title">{lightboxDoc.title}</div>
      </div>
    </div>
  );
}
