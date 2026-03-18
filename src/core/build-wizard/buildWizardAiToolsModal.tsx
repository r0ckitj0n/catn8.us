import React from 'react';

import { StandardIconButton } from '../../components/common/StandardIconButton';

interface BuildWizardAiToolsModalProps {
  aiBusy: boolean;
  aiPayloadJson: string;
  aiPromptText: string;
  deskAutoAssignBusy: boolean;
  onAutoAssignDeskStepsToTimeline: () => Promise<unknown>;
  onClose: () => void;
  onCompleteWithAi: () => Promise<unknown>;
  open: boolean;
  packageForAi: () => Promise<unknown>;
  sendToAiAndIngest: () => Promise<unknown>;
}

export function BuildWizardAiToolsModal({
  aiBusy,
  aiPayloadJson,
  aiPromptText,
  deskAutoAssignBusy,
  onAutoAssignDeskStepsToTimeline,
  onClose,
  onCompleteWithAi,
  open,
  packageForAi,
  sendToAiAndIngest,
}: BuildWizardAiToolsModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="build-wizard-doc-manager" onClick={onClose}>
      <div className="build-wizard-doc-manager-inner build-wizard-ai-tools-modal" onClick={(e) => e.stopPropagation()}>
        <div className="build-wizard-doc-manager-head">
          <h3>AI Tools</h3>
          <div className="build-wizard-doc-manager-actions">
            <StandardIconButton iconKey="close" ariaLabel="Close AI tools" title="Close" className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn" onClick={onClose} />
          </div>
        </div>

        <div className="build-wizard-ai-tools-grid">
          <section className="build-wizard-ai-tool-card">
            <h4>Complete w/ AI</h4>
            <p>Runs a full AI pass to reorder, add, and refine steps across phases using project data and linked documents.</p>
            <ol>
              <li>Upload key docs in Project Desk.</li>
              <li>Review phase assignments and major milestones.</li>
              <li>Run Complete w/ AI, then review step changes before final edits.</li>
            </ol>
            <button className="btn btn-primary" onClick={() => void onCompleteWithAi()} disabled={aiBusy}>
              {aiBusy ? 'AI Running...' : 'Complete w/ AI'}
            </button>
          </section>

          <section className="build-wizard-ai-tool-card">
            <h4>Build AI Package</h4>
            <p>Builds the packaged prompt and payload JSON from your current project so you can inspect exactly what AI will consume.</p>
            <ol>
              <li>Click Build AI Package.</li>
              <li>Review Prompt Text for context quality.</li>
              <li>Review Payload JSON for data completeness.</li>
            </ol>
            <button className="btn btn-success" disabled={aiBusy} onClick={() => void packageForAi()}>Build AI Package</button>
          </section>

          <section className="build-wizard-ai-tool-card">
            <h4>Send to AI + Ingest</h4>
            <p>Sends the current package to AI and immediately ingests the response back into your project steps and planning data.</p>
            <ol>
              <li>Build AI Package first.</li>
              <li>Run Send to AI + Ingest.</li>
              <li>Review generated updates and adjust as needed.</li>
            </ol>
            <button className="btn btn-primary" disabled={aiBusy} onClick={() => void sendToAiAndIngest()}>
              {aiBusy ? 'Sending to AI...' : 'Send to AI + Ingest'}
            </button>
          </section>

          <section className="build-wizard-ai-tool-card">
            <h4>Place Lost Steps on Timeline</h4>
            <p>Attempts an AI pass to place Project Desk steps into timeline phases, then applies local fallback rules for any remaining lost steps.</p>
            <button className="btn btn-outline-primary" onClick={() => void onAutoAssignDeskStepsToTimeline()} disabled={deskAutoAssignBusy || aiBusy} title="AI-assisted placement of Project Desk steps into timeline phases">
              {(deskAutoAssignBusy || aiBusy) ? 'Placing Lost Steps...' : 'Place Lost Steps on Timeline'}
            </button>
          </section>

          <section className="build-wizard-ai-tool-card build-wizard-ai-tool-card-readout">
            <h4>AI Package Readout</h4>
            <p>Use this panel to inspect what is being sent to AI.</p>
            <label>
              Prompt Text
              <textarea value={aiPromptText || ''} readOnly rows={6} />
            </label>
            <label>
              Payload JSON
              <textarea value={aiPayloadJson || ''} readOnly rows={10} />
            </label>
          </section>
        </div>
      </div>
    </div>
  );
}
