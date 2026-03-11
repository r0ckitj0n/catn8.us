import { Accumul8StatementUpload } from '../types/accumul8';

type PopupSide = 'left' | 'right';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'N/A';
  }
  return Number(value).toFixed(2);
}

function formatPeriod(start: string | null | undefined, end: string | null | undefined): string {
  const left = String(start || '').trim();
  const right = String(end || '').trim();
  if (left && right) return `${left} to ${right}`;
  return left || right || 'Period not detected';
}

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

function buildOcrPopupHtml(upload: Accumul8StatementUpload): string {
  const ocrStatement = upload.ocr_statement;
  if (!ocrStatement) {
    return '<!doctype html><html><body><p>OCR statement not available.</p></body></html>';
  }
  const verification = upload.catalog_verification;
  const sectionHtml = ocrStatement.sections.map((section) => {
    const verificationSection = verification?.sections.find((candidate) => candidate.statement_account_label === section.statement_account_label);
    const rowsHtml = section.rows.length > 0
      ? `
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Memo</th>
              <th>Amount</th>
              <th>Balance</th>
              <th>Page</th>
            </tr>
          </thead>
          <tbody>
            ${section.rows.map((row) => `
              <tr>
                <td>${escapeHtml(row.transaction_date || 'N/A')}</td>
                <td>
                  <div>${escapeHtml(row.description || 'Untitled transaction')}</div>
                  ${row.reason ? `<div class="error">${escapeHtml(row.reason)}</div>` : ''}
                </td>
                <td>${escapeHtml(row.memo || '')}</td>
                <td>${escapeHtml(formatAmount(row.amount))}</td>
                <td>${escapeHtml(formatAmount(row.running_balance))}</td>
                <td>${escapeHtml(row.page_number || 'N/A')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `
      : '<p class="muted">No transaction rows were cataloged for this account section.</p>';

    return `
      <section class="section">
        <div class="section-head">
          <div>
            <h2>${escapeHtml(section.statement_account_label || 'Unlabeled account section')}</h2>
            <div class="muted">${escapeHtml([
              section.statement_account_name_hint || '',
              section.statement_account_last4 ? `••${section.statement_account_last4}` : '',
              `${section.rows.length} row(s)`,
            ].filter(Boolean).join(' · '))}</div>
          </div>
          ${verificationSection ? `<span class="chip is-${escapeHtml(verificationSection.status)}">${escapeHtml(verificationSection.status)}</span>` : ''}
        </div>
        <div class="balances">
          <div><span>Opening</span><strong>${escapeHtml(formatAmount(section.opening_balance))}</strong></div>
          <div><span>Activity</span><strong>${escapeHtml(formatAmount(verificationSection?.transaction_total))}</strong></div>
          <div><span>Expected Closing</span><strong>${escapeHtml(formatAmount(verificationSection?.expected_closing_balance))}</strong></div>
          <div><span>Closing</span><strong>${escapeHtml(formatAmount(section.closing_balance))}</strong></div>
          <div><span>Delta</span><strong>${escapeHtml(formatAmount(verificationSection?.closing_delta))}</strong></div>
        </div>
        ${verificationSection?.note ? `<p class="muted">${escapeHtml(verificationSection.note)}</p>` : ''}
        ${rowsHtml}
      </section>
    `;
  }).join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(ocrStatement.original_filename)} OCR Statement</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5efdf;
        --surface: #fffaf0;
        --border: #b7a680;
        --text: #2c2418;
        --muted: #6d5d44;
        --link: #0d6efd;
        --verified: #1f6133;
        --warning: #7b4f10;
        --failed: #8b1e1e;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--text);
        background: var(--bg);
      }
      .page {
        padding: 1rem;
      }
      .header, .summary, .section {
        border: 1px solid var(--border);
        background: var(--surface);
      }
      .header, .summary {
        margin-bottom: 1rem;
        padding: 1rem;
      }
      .header h1 {
        margin: 0 0 0.35rem;
        font-size: 1.1rem;
      }
      .summary-grid, .balances {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
      }
      .balances {
        grid-template-columns: repeat(5, minmax(0, 1fr));
        margin-bottom: 0.75rem;
      }
      .summary-grid div, .balances div {
        border: 1px solid var(--border);
        padding: 0.65rem;
        background: rgba(255,255,255,0.45);
      }
      .summary-grid span, .balances span {
        display: block;
        font-size: 0.78rem;
        color: var(--muted);
        margin-bottom: 0.2rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .summary-grid strong, .balances strong {
        font-size: 1rem;
      }
      .section {
        padding: 1rem;
        margin-bottom: 1rem;
      }
      .section-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 0.75rem;
      }
      h2 {
        margin: 0;
        font-size: 1rem;
      }
      .muted {
        color: var(--muted);
      }
      .chip {
        border: 1px solid var(--border);
        padding: 0.25rem 0.5rem;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .chip.is-verified { color: var(--verified); }
      .chip.is-warning { color: var(--warning); }
      .chip.is-failed { color: var(--failed); }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.92rem;
      }
      th, td {
        border: 1px solid var(--border);
        padding: 0.45rem 0.5rem;
        vertical-align: top;
        text-align: left;
      }
      thead th {
        background: rgba(183, 166, 128, 0.18);
      }
      .error {
        color: var(--failed);
        font-size: 0.82rem;
        margin-top: 0.2rem;
      }
      @media (max-width: 900px) {
        .summary-grid, .balances {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="header">
        <h1>${escapeHtml(ocrStatement.original_filename)}</h1>
        <div class="muted">${escapeHtml([
          ocrStatement.institution_name || 'Institution not detected',
          formatPeriod(ocrStatement.period_start, ocrStatement.period_end),
          ocrStatement.statement_kind.replace('_', ' '),
        ].join(' · '))}</div>
      </section>
      ${verification ? `
        <section class="summary">
          <h2>Catalog Checksum</h2>
          <p class="muted">${escapeHtml(verification.summary)}</p>
          <div class="summary-grid">
            <div><span>Opening</span><strong>${escapeHtml(formatAmount(ocrStatement.opening_balance))}</strong></div>
            <div><span>Closing</span><strong>${escapeHtml(formatAmount(ocrStatement.closing_balance))}</strong></div>
            <div><span>Sections</span><strong>${escapeHtml(ocrStatement.sections.length)}</strong></div>
          </div>
        </section>
      ` : ''}
      ${sectionHtml}
    </main>
  </body>
</html>`;
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
  const html = buildOcrPopupHtml(upload);
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
