import React, { useState } from 'react';
import { IMysteryImage, IMasterMotive } from '../../../types/game';

export function useMotivesDraft() {
  const [motiveSlugDraft, setMotiveSlugDraft] = React.useState('');
  const [motiveNameDraft, setMotiveNameDraft] = React.useState('');
  const [motiveDescriptionDraft, setMotiveDescriptionDraft] = React.useState('');
  const [motiveIsArchivedDraft, setMotiveIsArchivedDraft] = React.useState(false);
  const [motiveImageDraft, setMotiveImageDraft] = useState<IMysteryImage>({ 
    title: '', url: '', alt_text: '', prompt_text: '', negative_prompt_text: '', provider: '', model: '' 
  });

  const resetDraft = React.useCallback(() => {
    setMotiveSlugDraft('');
    setMotiveNameDraft('');
    setMotiveDescriptionDraft('');
    setMotiveIsArchivedDraft(false);
    setMotiveImageDraft({ title: '', url: '', alt_text: '', prompt_text: '', negative_prompt_text: '', provider: '', model: '' });
  }, []);

  const setDraftFromMotive = React.useCallback((found: IMasterMotive) => {
    setMotiveSlugDraft(String(found?.slug || ''));
    setMotiveNameDraft(String(found?.name || ''));
    setMotiveDescriptionDraft(String(found?.description || ''));
    setMotiveIsArchivedDraft(Boolean(Number(found?.is_archived || 0) === 1));
    setMotiveImageDraft(found?.image && typeof found.image === 'object' ? found.image : { title: '', url: '', alt_text: '', prompt_text: '', negative_prompt_text: '', provider: '', model: '' });
  }, []);

  return {
    motiveSlugDraft, setMotiveSlugDraft,
    motiveNameDraft, setMotiveNameDraft,
    motiveDescriptionDraft, setMotiveDescriptionDraft,
    motiveIsArchivedDraft, setMotiveIsArchivedDraft,
    motiveImageDraft, setMotiveImageDraft,
    resetDraft, setDraftFromMotive
  };
}
