import React from 'react';

import { Valid8LookupManagerModal } from '../modals/Valid8LookupManagerModal';
import { Valid8EntryEditModal } from '../modals/Valid8EntryEditModal';

interface Valid8PageModalsProps {
  archiveCategory: React.ComponentProps<typeof Valid8LookupManagerModal>['onArchive'];
  archiveOwner: React.ComponentProps<typeof Valid8LookupManagerModal>['onArchive'];
  categories: React.ComponentProps<typeof Valid8LookupManagerModal>['items'];
  categoryModalOpen: boolean;
  createCategory: React.ComponentProps<typeof Valid8LookupManagerModal>['onCreate'];
  createOwner: React.ComponentProps<typeof Valid8LookupManagerModal>['onCreate'];
  creatingEntry: boolean;
  deleteCategory: React.ComponentProps<typeof Valid8LookupManagerModal>['onDelete'];
  deleteOwner: React.ComponentProps<typeof Valid8LookupManagerModal>['onDelete'];
  editingEntryId: string;
  entryEditBusy: boolean;
  entryEditEntry: React.ComponentProps<typeof Valid8EntryEditModal>['entry'];
  onCloseCategoryModal: () => void;
  onCloseEntryModal: () => void;
  onCloseOwnerModal: () => void;
  onCreateEntry: React.ComponentProps<typeof Valid8EntryEditModal>['onCreate'];
  onRefreshLookups: () => Promise<void>;
  onSaveEntry: React.ComponentProps<typeof Valid8EntryEditModal>['onSave'];
  ownerModalOpen: boolean;
  owners: React.ComponentProps<typeof Valid8LookupManagerModal>['items'];
  setCategoryArchived: (id: string, isArchived: number) => Promise<void>;
  setOwnerArchived: (id: string, isArchived: number) => Promise<void>;
  updateCategory: React.ComponentProps<typeof Valid8LookupManagerModal>['onUpdate'];
  updateOwner: React.ComponentProps<typeof Valid8LookupManagerModal>['onUpdate'];
}

export function Valid8PageModals({
  archiveCategory,
  archiveOwner,
  categories,
  categoryModalOpen,
  createCategory,
  createOwner,
  creatingEntry,
  deleteCategory,
  deleteOwner,
  editingEntryId,
  entryEditBusy,
  entryEditEntry,
  onCloseCategoryModal,
  onCloseEntryModal,
  onCloseOwnerModal,
  onCreateEntry,
  onRefreshLookups,
  onSaveEntry,
  ownerModalOpen,
  owners,
  setCategoryArchived,
  setOwnerArchived,
  updateCategory,
  updateOwner,
}: Valid8PageModalsProps) {
  return (
    <>
      <Valid8LookupManagerModal
        open={ownerModalOpen}
        onClose={onCloseOwnerModal}
        title="VALID8 Owners"
        itemLabel="Owner"
        items={owners}
        onRefresh={onRefreshLookups}
        onCreate={createOwner}
        onUpdate={updateOwner}
        onSetActive={(id, isActive) => setOwnerArchived(id, isActive ? 0 : 1)}
        onArchive={archiveOwner}
        onDelete={deleteOwner}
      />
      <Valid8LookupManagerModal
        open={categoryModalOpen}
        onClose={onCloseCategoryModal}
        title="VALID8 Categories"
        itemLabel="Category"
        items={categories}
        onRefresh={onRefreshLookups}
        onCreate={createCategory}
        onUpdate={updateCategory}
        onSetActive={(id, isActive) => setCategoryArchived(id, isActive ? 0 : 1)}
        onArchive={archiveCategory}
        onDelete={deleteCategory}
      />
      <Valid8EntryEditModal
        open={creatingEntry || editingEntryId !== ''}
        busy={entryEditBusy}
        entry={creatingEntry ? null : entryEditEntry}
        owners={owners}
        categories={categories}
        onClose={onCloseEntryModal}
        onCreate={onCreateEntry}
        onSave={onSaveEntry}
      />
    </>
  );
}
