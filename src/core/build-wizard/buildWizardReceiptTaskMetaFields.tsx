import React from 'react';

import { toNumberOrNull, toStringOrNull } from '../../components/pages/build-wizard/buildWizardUtils';
import { IBuildWizardContact, IBuildWizardDocument } from '../../types/buildWizard';
import { BuildWizardTaskMeta, BuildWizardTaskType } from './buildWizardPageRenderTypes';

export interface BuildWizardReceiptDraftState {
  receipt_amount: string;
  receipt_date: string;
  receipt_notes: string;
  receipt_title: string;
  receipt_vendor: string;
  task_meta: BuildWizardTaskMeta;
}

interface BuildWizardReceiptTaskMetaFieldsProps {
  authorityContacts: IBuildWizardContact[];
  permitDocuments: IBuildWizardDocument[];
  permitStatusOptions: string[];
  purchaseUnitOptions: string[];
  receiptDraft: BuildWizardReceiptDraftState;
  setReceiptDraftByStep: React.Dispatch<React.SetStateAction<Record<number, BuildWizardReceiptDraftState>>>;
  stepId: number;
}

export function BuildWizardReceiptTaskMetaFields({
  authorityContacts,
  permitDocuments,
  permitStatusOptions,
  purchaseUnitOptions,
  receiptDraft,
  setReceiptDraftByStep,
  stepId,
}: BuildWizardReceiptTaskMetaFieldsProps) {
  return (
    <>
      {receiptDraft.task_meta.task_type === 'permit' ? (
        <>
          <label>
            Saved Permit
            <select
              value={Number(receiptDraft.task_meta.permit_document_id || 0) > 0 ? String(receiptDraft.task_meta.permit_document_id) : ''}
              onChange={(e) => {
                const permitDocumentId = Number(e.target.value || '0');
                const selectedPermitDoc = permitDocuments.find((doc) => doc.id === permitDocumentId);
                setReceiptDraftByStep((prev) => ({
                  ...prev,
                  [stepId]: {
                    ...receiptDraft,
                    task_meta: {
                      ...receiptDraft.task_meta,
                      permit_document_id: permitDocumentId > 0 ? permitDocumentId : null,
                      permit_name: permitDocumentId > 0 ? (selectedPermitDoc?.original_name || null) : receiptDraft.task_meta.permit_name,
                      permit_application_url: permitDocumentId > 0 ? (selectedPermitDoc?.public_url || null) : receiptDraft.task_meta.permit_application_url,
                    },
                  },
                }));
              }}
            >
              <option value="">Select permit</option>
              {permitDocuments.map((doc) => (
                <option key={`task-permit-${doc.id}`} value={doc.id}>{doc.original_name}</option>
              ))}
            </select>
          </label>
          <label>
            Permit Name
            <input
              type="text"
              value={receiptDraft.task_meta.permit_name || ''}
              onChange={(e) => setReceiptDraftByStep((prev) => ({
                ...prev,
                [stepId]: {
                  ...receiptDraft,
                  task_meta: { ...receiptDraft.task_meta, permit_name: toStringOrNull(e.target.value || '') },
                },
              }))}
            />
          </label>
          <label>
            Authority
            <select
              value={receiptDraft.task_meta.permit_authority || ''}
              onChange={(e) => setReceiptDraftByStep((prev) => ({
                ...prev,
                [stepId]: {
                  ...receiptDraft,
                  task_meta: { ...receiptDraft.task_meta, permit_authority: toStringOrNull(e.target.value || '') },
                },
              }))}
            >
              <option value="">Select authority</option>
              {authorityContacts.map((contact) => (
                <option key={`task-authority-${contact.id}`} value={contact.display_name || ''}>
                  {contact.display_name}
                  {contact.company ? ` (${contact.company})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Permit Status
            <select
              value={receiptDraft.task_meta.permit_status || ''}
              onChange={(e) => setReceiptDraftByStep((prev) => ({
                ...prev,
                [stepId]: {
                  ...receiptDraft,
                  task_meta: { ...receiptDraft.task_meta, permit_status: toStringOrNull(e.target.value || '') },
                },
              }))}
            >
              {permitStatusOptions.map((status) => (
                <option key={`task-status-${status}`} value={status}>{status === '' ? 'Select status' : status}</option>
              ))}
            </select>
          </label>
          <label>
            Permit URL
            <input
              type="url"
              value={receiptDraft.task_meta.permit_application_url || ''}
              onChange={(e) => setReceiptDraftByStep((prev) => ({
                ...prev,
                [stepId]: {
                  ...receiptDraft,
                  task_meta: { ...receiptDraft.task_meta, permit_application_url: toStringOrNull(e.target.value || '') },
                },
              }))}
            />
          </label>
        </>
      ) : null}
      {['purchase', 'utility', 'delivery', 'quote'].includes(receiptDraft.task_meta.task_type) ? (
        <>
          <label>
            Category
            <input
              type="text"
              value={receiptDraft.task_meta.purchase_category || ''}
              onChange={(e) => setReceiptDraftByStep((prev) => ({
                ...prev,
                [stepId]: {
                  ...receiptDraft,
                  task_meta: { ...receiptDraft.task_meta, purchase_category: toStringOrNull(e.target.value || '') },
                },
              }))}
            />
          </label>
          <label>
            Brand
            <input
              type="text"
              value={receiptDraft.task_meta.purchase_brand || ''}
              onChange={(e) => setReceiptDraftByStep((prev) => ({
                ...prev,
                [stepId]: {
                  ...receiptDraft,
                  task_meta: { ...receiptDraft.task_meta, purchase_brand: toStringOrNull(e.target.value || '') },
                },
              }))}
            />
          </label>
          <label>
            Model
            <input
              type="text"
              value={receiptDraft.task_meta.purchase_model || ''}
              onChange={(e) => setReceiptDraftByStep((prev) => ({
                ...prev,
                [stepId]: {
                  ...receiptDraft,
                  task_meta: { ...receiptDraft.task_meta, purchase_model: toStringOrNull(e.target.value || '') },
                },
              }))}
            />
          </label>
          <label>
            SKU
            <input
              type="text"
              value={receiptDraft.task_meta.purchase_sku || ''}
              onChange={(e) => setReceiptDraftByStep((prev) => ({
                ...prev,
                [stepId]: {
                  ...receiptDraft,
                  task_meta: { ...receiptDraft.task_meta, purchase_sku: toStringOrNull(e.target.value || '') },
                },
              }))}
            />
          </label>
          <label>
            Qty
            <input
              type="number"
              step="0.01"
              value={receiptDraft.task_meta.purchase_qty ?? ''}
              onChange={(e) => setReceiptDraftByStep((prev) => ({
                ...prev,
                [stepId]: {
                  ...receiptDraft,
                  task_meta: { ...receiptDraft.task_meta, purchase_qty: toNumberOrNull(e.target.value) },
                },
              }))}
            />
          </label>
          <label>
            Unit
            <select
              value={receiptDraft.task_meta.purchase_unit || ''}
              onChange={(e) => setReceiptDraftByStep((prev) => ({
                ...prev,
                [stepId]: {
                  ...receiptDraft,
                  task_meta: { ...receiptDraft.task_meta, purchase_unit: toStringOrNull(e.target.value || '') },
                },
              }))}
            >
              {purchaseUnitOptions.map((unit) => (
                <option key={`task-unit-${unit}`} value={unit}>{unit === '' ? 'Select unit' : unit}</option>
              ))}
            </select>
          </label>
          <label>
            Unit Price
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={receiptDraft.task_meta.purchase_unit_price ?? ''}
              onChange={(e) => setReceiptDraftByStep((prev) => ({
                ...prev,
                [stepId]: {
                  ...receiptDraft,
                  task_meta: { ...receiptDraft.task_meta, purchase_unit_price: toNumberOrNull(e.target.value) },
                },
              }))}
            />
          </label>
          <label>
            Vendor
            <input
              type="text"
              value={receiptDraft.task_meta.purchase_vendor || ''}
              onChange={(e) => setReceiptDraftByStep((prev) => ({
                ...prev,
                [stepId]: {
                  ...receiptDraft,
                  task_meta: { ...receiptDraft.task_meta, purchase_vendor: toStringOrNull(e.target.value || '') },
                },
              }))}
            />
          </label>
          <label>
            URL
            <input
              type="url"
              value={receiptDraft.task_meta.purchase_url || ''}
              onChange={(e) => setReceiptDraftByStep((prev) => ({
                ...prev,
                [stepId]: {
                  ...receiptDraft,
                  task_meta: { ...receiptDraft.task_meta, purchase_url: toStringOrNull(e.target.value || '') },
                },
              }))}
            />
          </label>
        </>
      ) : null}
      {['utility', 'delivery'].includes(receiptDraft.task_meta.task_type) ? (
        <label className="is-wide">
          Reference / Tracking
          <input
            type="text"
            value={receiptDraft.task_meta.source_ref || ''}
            onChange={(e) => setReceiptDraftByStep((prev) => ({
              ...prev,
              [stepId]: {
                ...receiptDraft,
                task_meta: { ...receiptDraft.task_meta, source_ref: toStringOrNull(e.target.value || '') },
              },
            }))}
          />
        </label>
      ) : null}
    </>
  );
}
