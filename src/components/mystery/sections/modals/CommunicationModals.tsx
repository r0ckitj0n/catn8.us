import React from 'react';
import { SheriffTalkModal } from '../../modals/SheriffTalkModal';
import { CsiTalkModal } from '../../modals/CsiTalkModal';

interface CommunicationModalsProps {
  busy: boolean;
  liveSessions: any;
  modalRefs: any;
}

export function CommunicationModals({
  busy,
  liveSessions,
  modalRefs
}: CommunicationModalsProps) {
  return (
    <>
      <SheriffTalkModal
        modalRef={modalRefs.sheriffTalkRef}
        sheriffName={liveSessions.scenarioSheriffName || 'Sheriff'}
        sheriffImageUrl={''}
        sheriffStatus={liveSessions.sheriffLiveStatus}
        sheriffInputText={liveSessions.sheriffLiveInputText}
        sheriffOutputText={liveSessions.sheriffLiveOutputText}
        busy={busy}
        onStartStreaming={liveSessions.startSheriffLiveStreaming}
        onStopStreaming={liveSessions.stopSheriffLiveStreaming}
      />

      <CsiTalkModal
        modalRef={modalRefs.csiTalkRef}
        csiName={liveSessions.scenarioCsiDetectiveName || 'CSI Detective'}
        csiImageUrl={''}
        csiStatus={liveSessions.csiLiveStatus}
        csiInputText={liveSessions.csiLiveInputText}
        csiOutputText={liveSessions.csiLiveOutputText}
        busy={busy}
        onStartStreaming={liveSessions.startCsiLiveStreaming}
        onStopStreaming={liveSessions.stopCsiLiveStreaming}
      />
    </>
  );
}
