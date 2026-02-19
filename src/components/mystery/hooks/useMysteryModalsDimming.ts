import React from 'react';

export function useMysteryModalsDimming(cleanupModalArtifactsIfNoOpenModals: () => void) {
  const syncStackedMysteryModalDimming = React.useCallback(() => {
    try {
      const open = (Array.from(document.querySelectorAll('.catn8-stacked-modal.show, .catn8-stacked-modal.showing')) as HTMLElement[])
        .sort((a, b) => {
          const aSeq = Number(a?.dataset?.catn8OpenSeq || 0);
          const bSeq = Number(b?.dataset?.catn8OpenSeq || 0);
          return aSeq - bSeq;
        });
      
      const top = open.length ? open[open.length - 1] : null;
      for (let i = 0; i < open.length; i += 1) {
        const el = open[i];
        const layer = Math.min(i, 9);

        try {
          for (const c of Array.from(el.classList)) {
            if (String(c || '').startsWith('catn8-modal-layer-')) el.classList.remove(c);
          }
        } catch (_err) {}
        el.classList.add('catn8-modal-layer-' + String(layer));

        if (el === top) el.classList.remove('catn8-mystery-modal-obscured');
        else el.classList.add('catn8-mystery-modal-obscured');
      }

      const allActive = Array.from(document.querySelectorAll('.modal.show, .modal.showing, .modal.hiding'));
      const anyModalActive = allActive.length > 0;
      const isAnyHiding = allActive.some(el => el.classList.contains('hiding'));
      const isAnyStandardHiding = allActive.some(el => el.classList.contains('hiding') && !el.classList.contains('catn8-stacked-modal'));
      
      if (!anyModalActive) {
        cleanupModalArtifactsIfNoOpenModals();
        return;
      }

      if (isAnyHiding || isAnyStandardHiding) return;

      if (anyModalActive) {
        try {
          document.body.classList.add('modal-open');
        } catch (_err) {}

        try {
          const backdrops = Array.from(document.querySelectorAll('.modal-backdrop')) as HTMLElement[];
          const hasVisibleBackdrop = backdrops.some((b) => b.classList.contains('show'));
          
          if (!hasVisibleBackdrop) {
            const allOpen = Array.from(document.querySelectorAll('.modal.show, .modal.showing'));
            const onlyStacked = allOpen.length > 0 && allOpen.every(el => el.classList.contains('catn8-stacked-modal'));
            
            if (onlyStacked && backdrops.length === 0) {
              const bd = document.createElement('div');
              const isNoir = document.body.classList.contains('catn8-noir-mode');
              bd.className = `modal-backdrop fade show${isNoir ? ' catn8-pitch-black-backdrop' : ''}`;
              document.body.appendChild(bd);
            }
          }

          const allBackdrops = Array.from(document.querySelectorAll('.modal-backdrop')) as HTMLElement[];
          if (allBackdrops.length > 1) {
            const keep = allBackdrops.slice().reverse().find((b) => b.classList.contains('show')) || allBackdrops[allBackdrops.length - 1];
            for (const bd of allBackdrops) {
              if (bd !== keep) bd.remove();
            }
          }
        } catch (_err) {}
      }
    } catch (_err) {}
  }, [cleanupModalArtifactsIfNoOpenModals]);

  return { syncStackedMysteryModalDimming };
}
