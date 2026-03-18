import React from 'react';

import { Accumul8EntityEndexGuideUpsertRequest } from '../../../types/accumul8';

interface UseAccumul8EntityEndexActionsOptions {
  closeEntityEndexGuideModal: () => void;
  createEntityEndexGuide: (payload: Accumul8EntityEndexGuideUpsertRequest) => Promise<unknown>;
  deleteEntityEndexGuide: (guideId: number) => Promise<unknown>;
  editingEntityEndexGuideId: number | null;
  findAllEntityAliases: () => Promise<unknown>;
  findEntityAliases: (params: { entity_id: number }) => Promise<unknown>;
  setEditingEntityEndexGuideId: React.Dispatch<React.SetStateAction<number | null>>;
  setEntityEndexFindingAll: React.Dispatch<React.SetStateAction<boolean>>;
  setEntityEndexGuideModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  updateEntityEndexGuide: (guideId: number, payload: Accumul8EntityEndexGuideUpsertRequest) => Promise<unknown>;
}

export function useAccumul8EntityEndexActions({
  closeEntityEndexGuideModal,
  createEntityEndexGuide,
  deleteEntityEndexGuide,
  editingEntityEndexGuideId,
  findAllEntityAliases,
  findEntityAliases,
  setEditingEntityEndexGuideId,
  setEntityEndexFindingAll,
  setEntityEndexGuideModalOpen,
  updateEntityEndexGuide,
}: UseAccumul8EntityEndexActionsOptions) {
  const openEntityEndexGuideModal = React.useCallback((guideId: number | null = null) => {
    setEditingEntityEndexGuideId(guideId);
    setEntityEndexGuideModalOpen(true);
  }, [setEditingEntityEndexGuideId, setEntityEndexGuideModalOpen]);

  const runEntityMaintenanceAliasScan = React.useCallback(async () => {
    setEntityEndexFindingAll(true);
    try {
      await findAllEntityAliases();
    } finally {
      setEntityEndexFindingAll(false);
    }
  }, [findAllEntityAliases, setEntityEndexFindingAll]);

  const saveEntityEndexGuide = React.useCallback(async (payload: Accumul8EntityEndexGuideUpsertRequest) => {
    if (editingEntityEndexGuideId) {
      await updateEntityEndexGuide(editingEntityEndexGuideId, payload);
    } else {
      await createEntityEndexGuide(payload);
    }
    closeEntityEndexGuideModal();
  }, [closeEntityEndexGuideModal, createEntityEndexGuide, editingEntityEndexGuideId, updateEntityEndexGuide]);

  const removeEntityEndexGuide = React.useCallback(async (guideId: number) => {
    await deleteEntityEndexGuide(guideId);
    closeEntityEndexGuideModal();
  }, [closeEntityEndexGuideModal, deleteEntityEndexGuide]);

  const runEntityEndexGuideFinder = React.useCallback(async (entityId: number) => {
    await findEntityAliases({ entity_id: entityId });
  }, [findEntityAliases]);

  return {
    openEntityEndexGuideModal,
    runEntityEndexGuideFinder,
    runEntityMaintenanceAliasScan,
    saveEntityEndexGuide,
    removeEntityEndexGuide,
  };
}
