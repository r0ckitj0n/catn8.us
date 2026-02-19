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

  } catch (_err) {
    console.error('Failed to cleanup modal artifacts', _err);
  }
};
