let savedModalScrollY: number | null = null;
let restoreScrollTimer: number | null = null;

function currentPageScrollY(): number {
  return Math.max(
    0,
    Number(window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0),
  );
}

function hasActiveModalElements(): boolean {
  return document.querySelectorAll('.modal.show, .modal.showing, .modal.hiding').length > 0;
}

export const captureScrollBeforeModalOpen = () => {
  try {
    if (savedModalScrollY !== null) {
      return;
    }
    savedModalScrollY = currentPageScrollY();
  } catch (_err) {
    // no-op
  }
};

export const restoreScrollAfterModalClose = (force = false) => {
  try {
    if (savedModalScrollY === null) {
      return;
    }
    if (restoreScrollTimer !== null) {
      window.clearTimeout(restoreScrollTimer);
      restoreScrollTimer = null;
    }
    restoreScrollTimer = window.setTimeout(() => {
      restoreScrollTimer = null;
      if (!force && hasActiveModalElements()) {
        return;
      }
      const targetScrollY = savedModalScrollY;
      savedModalScrollY = null;
      if (targetScrollY === null) {
        return;
      }
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: targetScrollY, left: 0, behavior: 'auto' });
        });
      });
    }, 80);
  } catch (_err) {
    // no-op
  }
};

export const cleanupModalArtifactsIfNoOpenModals = (force = false) => {
  try {
    const activeModals = document.querySelectorAll('.modal.show, .modal.showing');
    
    if (!force && activeModals.length > 0) return;
    
    // Remove Bootstrap classes from body
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    
    // Remove all backdrops
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(b => {
      if (force) {
        b.remove();
      } else if (activeModals.length === 0) {
        // Only remove if no active modals.
        b.classList.remove('show');
        window.setTimeout(() => {
          if (b.parentNode && document.querySelectorAll('.modal.show, .modal.showing').length === 0) {
            b.remove();
          }
        }, 150);
      }
    });

    // Cleanup our custom obscuring classes
    document.querySelectorAll('.catn8-mystery-modal-obscured').forEach(el => {
      el.classList.remove('catn8-mystery-modal-obscured');
    });
    
    // Reset layer classes
    document.querySelectorAll('.modal').forEach(el => {
      for (const c of Array.from(el.classList)) {
        if (String(c).startsWith('catn8-modal-layer-')) el.classList.remove(c);
      }
    });

    restoreScrollAfterModalClose(force);

  } catch (_err) {
    console.error('Failed to cleanup modal artifacts', _err);
  }
};
