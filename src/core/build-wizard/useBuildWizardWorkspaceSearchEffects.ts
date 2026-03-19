import React from 'react';

export function useBuildWizardWorkspaceSearchEffects(options: any) {
  const {
    documentManagerQuery,
    projectId,
    searchContent,
    setDocumentManagerSearchLoading,
    setDocumentManagerSearchResults,
    setTopbarSearchDocumentResults,
    setTopbarSearchLoading,
    setTopbarSearchOpen,
    steps,
    topbarSearchBoxRef,
    topbarSearchFocusStepId,
    topbarSearchOpen,
    topbarSearchQuery,
  } = options;

  React.useEffect(() => {
    if (!topbarSearchOpen) {
      return;
    }
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !topbarSearchBoxRef.current || topbarSearchBoxRef.current.contains(target)) {
        return;
      }
      setTopbarSearchOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [setTopbarSearchOpen, topbarSearchBoxRef, topbarSearchOpen]);

  React.useEffect(() => {
    if (!topbarSearchFocusStepId || !steps.length) {
      return;
    }
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`build-wizard-step-${topbarSearchFocusStepId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [steps.length, topbarSearchFocusStepId]);

  React.useEffect(() => {
    const query = topbarSearchQuery.trim();
    if (query.length < 2 || projectId <= 0) {
      setTopbarSearchLoading(false);
      setTopbarSearchDocumentResults([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setTopbarSearchLoading(true);
      void searchContent(query, 25)
        .then((res: any) => {
          if (!cancelled) {
            setTopbarSearchDocumentResults(Array.isArray(res?.results) ? res.results : []);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setTopbarSearchLoading(false);
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [projectId, searchContent, setTopbarSearchDocumentResults, setTopbarSearchLoading, topbarSearchQuery]);

  React.useEffect(() => {
    const query = documentManagerQuery.trim();
    if (query.length < 2 || projectId <= 0) {
      setDocumentManagerSearchLoading(false);
      setDocumentManagerSearchResults([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setDocumentManagerSearchLoading(true);
      void searchContent(query, 200)
        .then((res: any) => {
          if (!cancelled) {
            setDocumentManagerSearchResults(Array.isArray(res?.results) ? res.results : []);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setDocumentManagerSearchLoading(false);
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [documentManagerQuery, projectId, searchContent, setDocumentManagerSearchLoading, setDocumentManagerSearchResults]);
}
