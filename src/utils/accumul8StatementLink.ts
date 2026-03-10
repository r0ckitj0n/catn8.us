import { Accumul8StatementUpload, Accumul8Transaction } from '../types/accumul8';

function normalizeLocatorText(value: string): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function parseStatementUploadId(sourceRef: string): number | null {
  const match = String(sourceRef || '').trim().match(/^statement_upload:(\d+)$/i);
  if (!match) {
    return null;
  }
  const uploadId = Number(match[1]);
  return Number.isInteger(uploadId) && uploadId > 0 ? uploadId : null;
}

function scoreStatementLocatorMatch(
  transaction: Accumul8Transaction,
  locator: Accumul8StatementUpload['transaction_locators'][number],
): number {
  const transactionDate = String(transaction.transaction_date || '');
  const locatorDate = String(locator.transaction_date || '');
  const transactionAmount = Number(transaction.amount || 0);
  const locatorAmount = Number(locator.amount || 0);
  const transactionDescription = normalizeLocatorText(transaction.description);
  const locatorDescription = normalizeLocatorText(locator.description);

  let score = 0;
  if (transactionDate !== '' && transactionDate === locatorDate) {
    score += 6;
  }
  if (Math.abs(transactionAmount - locatorAmount) <= 0.01) {
    score += 6;
  }
  if (transactionDescription !== '' && transactionDescription === locatorDescription) {
    score += 8;
  } else if (
    transactionDescription !== ''
    && locatorDescription !== ''
    && (transactionDescription.includes(locatorDescription) || locatorDescription.includes(transactionDescription))
  ) {
    score += 4;
  }
  return score;
}

function resolveStatementPageNumber(
  transaction: Accumul8Transaction,
  upload: Accumul8StatementUpload | null,
): number | null {
  if (!upload || !Array.isArray(upload.transaction_locators) || upload.transaction_locators.length === 0) {
    return null;
  }

  let bestPageNumber: number | null = null;
  let bestScore = 0;
  for (const locator of upload.transaction_locators) {
    const pageNumber = Number(locator.page_number || 0);
    if (!Number.isInteger(pageNumber) || pageNumber <= 0) {
      continue;
    }
    const score = scoreStatementLocatorMatch(transaction, locator);
    if (score > bestScore) {
      bestScore = score;
      bestPageNumber = pageNumber;
    }
  }

  return bestScore >= 12 ? bestPageNumber : null;
}

export function resolveAccumul8StatementLink(
  transaction: Accumul8Transaction | null,
  statementUploads: Accumul8StatementUpload[],
  ownerUserId: number,
): { href: string; label: string } | null {
  if (!transaction || ownerUserId <= 0) {
    return null;
  }

  const sourceKind = String(transaction.source_kind || '').trim().toLowerCase();
  const sourceRef = String(transaction.source_ref || '').trim();
  if (!sourceRef || (sourceKind !== 'statement_pdf' && sourceKind !== 'statement_upload')) {
    return null;
  }

  const directUploadId = Number(transaction.statement_upload_id || 0) > 0
    ? Number(transaction.statement_upload_id)
    : parseStatementUploadId(sourceRef);
  let candidates = directUploadId !== null
    ? statementUploads.filter((upload) => upload.id === directUploadId)
    : statementUploads.filter((upload) => upload.original_filename === sourceRef);

  if (Number(transaction.account_id || 0) > 0) {
    const accountScoped = candidates.filter((upload) => Number(upload.account_id || 0) === Number(transaction.account_id || 0));
    if (accountScoped.length > 0) {
      candidates = accountScoped;
    }
  }

  if (candidates.length > 0) {
    const upload = candidates[0];
    const pageNumber = Number(transaction.statement_page_number || 0) > 0
      ? Number(transaction.statement_page_number)
      : resolveStatementPageNumber(transaction, upload);
    const pageSuffix = pageNumber ? `#page=${pageNumber}` : '';
    return {
      href: `/api/accumul8.php?action=download_statement_upload&id=${upload.id}&owner_user_id=${ownerUserId}${pageSuffix}`,
      label: pageNumber ? `Open statement page ${pageNumber}` : 'Open statement PDF',
    };
  }

  if (directUploadId !== null) {
    const pageNumber = Number(transaction.statement_page_number || 0) > 0
      ? Number(transaction.statement_page_number)
      : null;
    const pageSuffix = pageNumber ? `#page=${pageNumber}` : '';
    return {
      href: `/api/accumul8.php?action=download_statement_upload&id=${directUploadId}&owner_user_id=${ownerUserId}${pageSuffix}`,
      label: pageNumber ? `Open statement page ${pageNumber}` : 'Open statement PDF',
    };
  }

  return null;
}
