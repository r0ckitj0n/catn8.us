import React, { useState, useEffect } from 'react';

interface BackstoryStepSectionProps {
  busy: boolean;
  isAdmin: boolean;
  mysteryId: string | number;
  backstoryId: string;
  setBackstoryId: (val: string) => void;
  backstories: any[];
  backStoryCreateSource: string;
  setBackStoryCreateSource: (val: string) => void;
  seedStories: any[];
  loadBackstories: (mid: string | number) => Promise<any[]>;
  onOpenSeedStoryModal: () => void;
  onOpenBackstoryModal: () => void;
  loadStoryBookEntry: (id: string) => Promise<void>;
  createBackstory: (params?: any) => Promise<any>;
  showMysteryToast: (t: any) => void;
  jobs?: any[];
  setCaseId: (val: string) => void;
}

export function BackstoryStepSection({
  busy, isAdmin, mysteryId, backstoryId, setBackstoryId, backstories,
  backStoryCreateSource, setBackStoryCreateSource, seedStories,
  loadBackstories, onOpenSeedStoryModal, onOpenBackstoryModal,
  loadStoryBookEntry, createBackstory, showMysteryToast, jobs,
  setCaseId
}: BackstoryStepSectionProps) {
  const [subFlow, setSubFlow] = useState<'none' | 'existing'>('none');
  const [activeJobId, setActiveJobId] = useState<number | null>(null);

  // Monitor job status if we started one
  React.useEffect(() => {
    if (activeJobId && jobs) {
      const job = jobs.find(j => j.id === activeJobId);
      if (job) {
        if (job.status === 'completed') {
          showMysteryToast({ 
            tone: 'success', 
            message: 'Backstory generated!', 
            duration: 3000,
            id: 'backstory-gen-progress' 
          });
          setActiveJobId(null);
          if (job.result_id) {
             setBackstoryId(String(job.result_id));
          }
        } else if (job.status === 'failed') {
          showMysteryToast({ 
            tone: 'danger', 
            message: 'Backstory generation failed.', 
            duration: 5000,
            id: 'backstory-gen-progress'
          });
          setActiveJobId(null);
        }
      }
    }
  }, [activeJobId, jobs, setBackstoryId, showMysteryToast]);

  const handleGenerate = async () => {
    const seed = seedStories.find(s => String(s.id) === String(backStoryCreateSource));
    if (!seed) return;

    try {
      showMysteryToast({ 
        tone: 'info', 
        message: 'Generating backstory... please wait.', 
        persistent: true,
        id: 'backstory-gen-progress'
      });
      
      const res = await createBackstory({ 
        source_id: seed.id,
        title: seed.title || seed.slug || 'New Backstory',
        source_text: seed.source_text || ''
      });

      if (res?.job_id) {
        setActiveJobId(res.job_id);
      } else if (res?.backstory_id || (typeof res === 'number' || typeof res === 'string')) {
        // Immediate completion fallback
        const bid = res?.backstory_id || res;
        showMysteryToast({ 
          tone: 'success', 
          message: 'Backstory generated!', 
          duration: 3000,
          id: 'backstory-gen-progress'
        });
        setBackstoryId(String(bid));
      }
    } catch (e) {
      console.error("Backstory generation failed", e);
      showMysteryToast({ 
        tone: 'danger', 
        message: 'Failed to start generation.',
        id: 'backstory-gen-progress'
      });
    }
  };

  const isGenerating = !!activeJobId;

  return (
    <div className="catn8-card p-3 mb-3">
      <div className="d-flex justify-content-between align-items-start gap-2">
        <div>
          <div className="fw-bold">Step 1 — Choose Backstory</div>
          <div className="form-text">Select a seed story to begin, then choose your next step.</div>
        </div>
        <div className="d-flex gap-2">
          <button 
            type="button" 
            className="btn btn-sm btn-outline-secondary" 
            onClick={() => void loadBackstories(mysteryId)} 
            disabled={busy || isGenerating || !mysteryId}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-12">
          <label className="form-label" htmlFor="mystery-seed-story-select">Seed Story</label>
          <div className="d-flex gap-2">
            <select
              id="mystery-seed-story-select"
              className="form-select"
              value={backStoryCreateSource}
              onChange={(e) => {
                const v = e.target.value;
                setBackStoryCreateSource(v);
                setBackstoryId('');
                setCaseId('');
                if (v && v !== 'scratch') {
                  void loadStoryBookEntry(v);
                }
              }}
              disabled={busy || isGenerating || !mysteryId}
            >
              <option value="">Select a Seed Story...</option>
              {seedStories.map((x) => (
                <option key={'seed-opt-' + String(x.id)} value={String(x.id)}>
                  {String(x.title || x.slug || ('Seed Story #' + String(x.id)))}
                </option>
              ))}
            </select>
            <button 
              type="button" 
              className="btn btn-outline-secondary"
              onClick={onOpenSeedStoryModal}
              disabled={busy || isGenerating || !mysteryId}
              title="Manage Story Book"
            >
              <i className="bi bi-pencil-square"></i>
            </button>
          </div>
        </div>

        {backStoryCreateSource && backStoryCreateSource !== 'scratch' && (
          <div className="col-12 mt-3">
            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={onOpenSeedStoryModal}
                disabled={busy || isGenerating}
              >
                View/Edit Seed Story
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleGenerate}
                  disabled={busy || isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Generating...
                    </>
                  ) : 'Generate Backstory'}
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setSubFlow('existing')}
                disabled={busy || isGenerating}
              >
                Use Existing Backstory
              </button>
            </div>
          </div>
        )}

        {subFlow === 'existing' && (
          <div className="col-12 mt-3 border-top pt-3">
            <label className="form-label" htmlFor="mystery-backstory-select">Select from existing backstories in this mystery</label>
            <div className="d-flex gap-2">
              <select
                id="mystery-backstory-select"
                className="form-select"
                value={backstoryId}
                onChange={(e) => setBackstoryId(e.target.value)}
                disabled={busy || isGenerating || !mysteryId}
              >
                <option value="">Select a Backstory</option>
                {backstories.map((b: any) => (
                  <option key={'backstory-opt-' + String(b?.id || '')} value={String(b?.id || '')}>
                    {String(b?.title || ('Backstory #' + String(b?.id || '')))}{Number(b?.is_archived || 0) === 1 ? ' (archived)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={onOpenBackstoryModal}
                disabled={busy || isGenerating || !backstoryId}
              >
                View/Edit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



