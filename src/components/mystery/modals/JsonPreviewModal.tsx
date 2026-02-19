import React from 'react';

interface JsonPreviewModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  jsonPreviewTitle: string;
  jsonPreviewText: string;
}

export function JsonPreviewModal({
  modalRef,
  jsonPreviewTitle,
  jsonPreviewText,
}: JsonPreviewModalProps) {
  const copyToClipboard = async () => {
    const text = String(jsonPreviewText || '');
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch (_err) {
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'true');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (_err) {
    }
  };

  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{jsonPreviewTitle || 'JSON'}</h5>
            <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <textarea className="form-control" value={String(jsonPreviewText || '')} readOnly rows={18} spellCheck={false} />
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={copyToClipboard}
            >
              Copy
            </button>
            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
