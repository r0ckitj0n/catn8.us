import React from 'react';

import { Accumul8Contact, Accumul8ContactType, Accumul8Entity, Accumul8EntityAliasDraft } from '../../../types/accumul8';
import { normalizeEntityContactType, normalizeEntityKind } from './accumul8PageEntityUtils';

export type Accumul8EntityFormState = {
  display_name: string;
  entity_kind: string;
  contact_type: Accumul8ContactType;
  is_vendor: number;
  default_amount: number;
  email: string;
  phone_number: string;
  street_address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
  is_active: number;
};

interface UseAccumul8EntityContactLaunchActionsOptions {
  contacts: Accumul8Contact[];
  defaultEntityAliasDraft: Accumul8EntityAliasDraft;
  defaultEntityForm: Accumul8EntityFormState;
  entities: Accumul8Entity[];
  setContactForm: React.Dispatch<React.SetStateAction<{
    contact_name: string;
    contact_type: Accumul8ContactType;
    default_amount: number;
    email: string;
    phone_number: string;
    street_address: string;
    city: string;
    state: string;
    zip: string;
    notes: string;
  }>>;
  setContactModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingContactId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingEntityId: React.Dispatch<React.SetStateAction<number | null>>;
  setEntityAliasDraftById: React.Dispatch<React.SetStateAction<Record<number, Accumul8EntityAliasDraft>>>;
  setEntityForm: React.Dispatch<React.SetStateAction<Accumul8EntityFormState>>;
  setEntityModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useAccumul8EntityContactLaunchActions({
  contacts,
  defaultEntityAliasDraft,
  defaultEntityForm,
  entities,
  setContactForm,
  setContactModalOpen,
  setEditingContactId,
  setEditingEntityId,
  setEntityAliasDraftById,
  setEntityForm,
  setEntityModalOpen,
}: UseAccumul8EntityContactLaunchActionsOptions) {
  const beginEditContact = React.useCallback((id: number) => {
    const contact = contacts.find((v) => v.id === id);
    if (!contact) return;
    setEditingContactId(contact.id);
    setContactForm({
      contact_name: contact.contact_name || '',
      contact_type: ((String(contact.contact_type || '').trim().toLowerCase() === 'payer'
        ? 'payer'
        : String(contact.contact_type || '').trim().toLowerCase() === 'repayment'
          ? 'repayment'
          : 'payee') as Accumul8ContactType),
      default_amount: Number(contact.default_amount || 0),
      email: contact.email || '',
      phone_number: contact.phone_number || '',
      street_address: contact.street_address || '',
      city: contact.city || '',
      state: contact.state || '',
      zip: contact.zip || '',
      notes: contact.notes || '',
    });
    setContactModalOpen(true);
  }, [contacts, setContactForm, setContactModalOpen, setEditingContactId]);

  const beginEditEntity = React.useCallback((id: number) => {
    const entity = entities.find((v) => v.id === id);
    if (!entity) return;
    setEditingEntityId(entity.id);
    setEntityAliasDraftById((prev) => ({ ...prev, [entity.id]: defaultEntityAliasDraft }));
    setEntityForm({
      display_name: entity.display_name || '',
      entity_kind: normalizeEntityKind(entity.entity_kind, entity.is_vendor),
      contact_type: normalizeEntityContactType(entity),
      is_vendor: normalizeEntityKind(entity.entity_kind, entity.is_vendor) === 'business' ? 1 : 0,
      default_amount: Number(entity.default_amount || 0),
      email: entity.email || '',
      phone_number: entity.phone_number || '',
      street_address: entity.street_address || '',
      city: entity.city || '',
      state: entity.state || '',
      zip: entity.zip || '',
      notes: entity.notes || '',
      is_active: Number(entity.is_active || 0),
    });
    setEntityModalOpen(true);
  }, [defaultEntityAliasDraft, entities, setEditingEntityId, setEntityAliasDraftById, setEntityForm, setEntityModalOpen]);

  const openCreateEntityModal = React.useCallback((defaults?: Partial<Accumul8EntityFormState>) => {
    setEditingEntityId(null);
    setEntityForm({ ...defaultEntityForm, ...defaults });
    setEntityModalOpen(true);
  }, [defaultEntityForm, setEditingEntityId, setEntityForm, setEntityModalOpen]);

  return { beginEditContact, beginEditEntity, openCreateEntityModal };
}
