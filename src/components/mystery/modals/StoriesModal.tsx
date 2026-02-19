import React, { useState } from 'react';
import { IBackstory, IMasterLocation } from '../../../types/game';
import { SeedStoriesSection } from './sections/SeedStoriesSection';
import { BackstoriesSection } from './sections/BackstoriesSection';

interface StoriesModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  mysteryId: string | number;
  isAdmin: boolean;
  busy: boolean;
  
  // Seed Stories state
  seedStories: any[];
  storyBookBusy: boolean;
  storyBookIncludeArchived: boolean;
  setStoryBookIncludeArchived: (val: boolean) => void;
  storyBookSelectedId: string;
  storyBookTitleDraft: string;
  setStoryBookTitleDraft: (val: string) => void;
  storyBookSlugDraft: string;
  setStoryBookSlugDraft: (val: string) => void;
  storyBookSourceDraft: string;
  setStoryBookSourceDraft: (val: string) => void;
  storyBookMetaDraft: string;
  setStoryBookMetaDraft: (val: string) => void;
  storyBookSelectedIsArchived: boolean;
  
  // Seed Stories Actions
  loadStoryBookEntries: () => void;
  loadStoryBookEntry: (id: string) => Promise<void>;
  createNewStoryBookEntry: () => void;
  saveStoryBookEntry: () => Promise<void>;
  archiveStoryBookEntry: () => Promise<void>;
  deleteStoryBookEntry: () => Promise<void>;

  // Backstories state
  backStoryCreateSource: string;
  setBackStoryCreateSource: (val: string) => void;
  backStoryCreateTitle: string;
  setBackStoryCreateTitle: (val: string) => void;
  backStoryCreateLocationMasterId: string;
  setBackStoryCreateLocationMasterId: (val: string) => void;
  backStoryCreateFromSeed: boolean;
  setBackStoryCreateFromSeed: (val: boolean) => void;
  masterLocations: IMasterLocation[];
  
  // Backstories Actions
  loadMasterLocations: () => Promise<IMasterLocation[]>;
  loadBackstories: (mid: string | number) => Promise<IBackstory[]>;
  createBackstory: (params?: any) => Promise<any>;
}

export function StoriesModal(props: StoriesModalProps) {
  const [activeTab, setActiveTab] = useState<'seed' | 'backstories'>('seed');

  React.useEffect(() => {
    if (activeTab === 'backstories' && props.mysteryId) {
      void props.loadMasterLocations();
    }
  }, [activeTab, props.mysteryId, props.loadMasterLocations]);

  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={props.modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl catn8-modal-wide">
        <div className="modal-content">
          <div className="modal-header d-flex flex-column align-items-stretch pb-0">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="fw-bold">Story Management</div>
              <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            
            <ul className="nav nav-tabs border-bottom-0">
              <li className="nav-item">
                <button 
                  className={`nav-link ${activeTab === 'seed' ? 'active' : ''}`}
                  onClick={() => setActiveTab('seed')}
                  type="button"
                >
                  Seed Stories
                </button>
              </li>
              <li className="nav-item">
                <button 
                  className={`nav-link ${activeTab === 'backstories' ? 'active' : ''}`}
                  onClick={() => setActiveTab('backstories')}
                  type="button"
                >
                  Backstories
                </button>
              </li>
            </ul>
          </div>

          <div className="modal-body">
            {activeTab === 'seed' && (
              <SeedStoriesSection 
                busy={props.busy}
                isAdmin={props.isAdmin}
                seedStories={props.seedStories}
                storyBookBusy={props.storyBookBusy}
                storyBookIncludeArchived={props.storyBookIncludeArchived}
                setStoryBookIncludeArchived={props.setStoryBookIncludeArchived}
                storyBookSelectedId={props.storyBookSelectedId}
                storyBookTitleDraft={props.storyBookTitleDraft}
                setStoryBookTitleDraft={props.setStoryBookTitleDraft}
                storyBookSlugDraft={props.storyBookSlugDraft}
                setStoryBookSlugDraft={props.setStoryBookSlugDraft}
                storyBookSourceDraft={props.storyBookSourceDraft}
                setStoryBookSourceDraft={props.setStoryBookSourceDraft}
                storyBookMetaDraft={props.storyBookMetaDraft}
                setStoryBookMetaDraft={props.setStoryBookMetaDraft}
                storyBookSelectedIsArchived={props.storyBookSelectedIsArchived}
                loadStoryBookEntries={props.loadStoryBookEntries}
                loadStoryBookEntry={props.loadStoryBookEntry}
                createNewStoryBookEntry={props.createNewStoryBookEntry}
                saveStoryBookEntry={props.saveStoryBookEntry}
                archiveStoryBookEntry={props.archiveStoryBookEntry}
                deleteStoryBookEntry={props.deleteStoryBookEntry}
                mysteryId={props.mysteryId}
              />
            )}

            {activeTab === 'backstories' && (
              <BackstoriesSection 
                busy={props.busy}
                isAdmin={props.isAdmin}
                mysteryId={props.mysteryId}
                backStoryCreateSource={props.backStoryCreateSource}
                setBackStoryCreateSource={props.setBackStoryCreateSource}
                backStoryCreateTitle={props.backStoryCreateTitle}
                setBackStoryCreateTitle={props.setBackStoryCreateTitle}
                backStoryCreateLocationMasterId={props.backStoryCreateLocationMasterId}
                setBackStoryCreateLocationMasterId={props.setBackStoryCreateLocationMasterId}
                backStoryCreateFromSeed={props.backStoryCreateFromSeed}
                setBackStoryCreateFromSeed={props.setBackStoryCreateFromSeed}
                masterLocations={props.masterLocations}
                seedStories={props.seedStories}
                loadBackstories={props.loadBackstories}
                createBackstory={props.createBackstory}
                loadStoryBookEntry={props.loadStoryBookEntry}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
