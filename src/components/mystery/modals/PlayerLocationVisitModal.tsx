import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import './PlayerLocationVisitModal.css';

interface ILocationEntity {
  id: number;
  scenario_id: number;
  entity_id: number;
  role: string;
  roles: string[];
  override: {
    report?: string;
    hidden_clue?: string;
  };
  entity_type: string;
  entity_slug: string;
  entity_name: string;
  data: any;
}

interface PlayerLocationVisitModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  caseId: number;
  scenarioId: number;
  scenario?: any;
  onClose: () => void;
}

export function PlayerLocationVisitModal({
  modalRef,
  caseId,
  scenarioId,
  scenario,
  onClose,
}: PlayerLocationVisitModalProps) {
  const [locations, setLocations] = useState<ILocationEntity[]>([]);
  const [scenarioEntities, setScenarioEntities] = useState<ILocationEntity[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (caseId > 0) {
      loadData();
    }
  }, [caseId, scenarioId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Load all location entities for the case
      const entitiesRes = await ApiClient.get<{ success: boolean; entities: any[] }>(
        `/api/mystery/play.php?action=list_entities&case_id=${caseId}&entity_type=location`
      );
      
      let allLocs: ILocationEntity[] = [];
      if (entitiesRes.success) {
        allLocs = (entitiesRes.entities || []).map(e => ({
          id: e.id,
          scenario_id: scenarioId,
          entity_id: e.id,
          role: 'location',
          roles: e.roles || [],
          override: {},
          entity_type: e.entity_type,
          entity_slug: e.slug,
          entity_name: e.name,
          data: e.data || {}
        }));
      }

      // 2. Load scenario-specific overrides (reports)
      if (scenarioId > 0) {
        const scenarioRes = await ApiClient.get<{ success: boolean; scenario_entities: ILocationEntity[] }>(
          `/api/mystery/play.php?action=list_scenario_entities&scenario_id=${scenarioId}`
        );
        if (scenarioRes.success) {
          const sEntities = (scenarioRes.scenario_entities || []).filter(e => e.role === 'location' || e.entity_type === 'location');
          setScenarioEntities(sEntities);
          
          // Merge overrides into allLocs
          allLocs = allLocs.map(loc => {
            const match = sEntities.find(se => se.entity_id === loc.entity_id);
            if (match) {
              return { ...loc, override: match.override || {} };
            }
            return loc;
          });
        }
      }

      setLocations(allLocs);
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading locations');
    } finally {
      setLoading(false);
    }
  };

  const selectedLocation = locations.find(l => l.id === selectedLocationId);
  const override = selectedLocation?.override || {};
  const data = selectedLocation?.data || {};
  
  // Use the image from master data if available
  const imageUrl = data.image?.url || '/images/mystery/location_placeholder.png';

  return (
    <div className="modal fade catn8-mystery-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Visit a Location</h5>
            <button type="button" className="btn-close catn8-mystery-modal-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body">
            {loading && <div className="text-center py-4"><div className="spinner-border text-primary" role="status"></div></div>}
            {error && <div className="alert alert-danger">{error}</div>}
            
            {!loading && !error && (
              <div className="catn8-location-visit-container">
                <div className="mb-3">
                  <label htmlFor="locationSelect" className="form-label fw-bold">Select a Location to Investigate:</label>
                  <select 
                    id="locationSelect" 
                    className="form-select catn8-noir-input"
                    value={selectedLocationId || ''}
                    onChange={(e) => setSelectedLocationId(Number(e.target.value) || null)}
                  >
                    <option value="">-- Choose a Location --</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.entity_name}</option>
                    ))}
                  </select>
                </div>

                {selectedLocation && (
                  <div className="catn8-location-report-view animate-fade-in">
                    <div className="catn8-location-image-wrapper mb-4 text-center">
                      <img 
                        src={imageUrl} 
                        alt={selectedLocation.entity_name} 
                        className="img-fluid rounded shadow-sm catn8-location-img"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/images/mystery/location_placeholder.png'; }}
                      />
                    </div>
                    
                    <div className="catn8-report-section">
                      <h4 className="catn8-noir-subtitle mb-3 text-uppercase border-bottom pb-2">Forensic Report: {selectedLocation.entity_name}</h4>
                      
                      {scenario?.csi_report_text ? (
                        <div className="catn8-report-text mb-4 p-3 bg-dark bg-opacity-50 rounded border-start border-4 border-info shadow-sm">
                          <div className="d-flex align-items-center gap-2 mb-2 text-info opacity-75">
                            <i className="bi bi-clipboard-data"></i>
                            <small className="text-uppercase fw-bold" style={{ letterSpacing: '0.1em' }}>Master Forensic Analysis</small>
                          </div>
                          <p className="mb-0" style={{ fontSize: '0.95rem' }}>{scenario.csi_report_text}</p>
                          <hr className="my-3 border-secondary opacity-25" />
                          <div className="d-flex align-items-center gap-2 mb-1 text-info opacity-50">
                            <i className="bi bi-geo-alt"></i>
                            <small className="text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Location Specifics</small>
                          </div>
                          <p className="mb-0 lead italic">"{override.report || 'Standard sweep complete.'}"</p>
                        </div>
                      ) : (
                        <div className="catn8-report-text mb-4 p-3 bg-dark bg-opacity-50 rounded border-start border-4 border-info shadow-sm">
                          <p className="mb-0 lead italic">"{override.report || 'CSI has processed this location. No significant findings noted.'}"</p>
                        </div>
                      )}

                      <div className="catn8-clue-section p-3 border rounded bg-dark bg-opacity-25 border-secondary shadow-sm">
                        <h6 className="fw-bold text-info-emphasis mb-2 opacity-75"><i className="bi bi-search me-2"></i>Something CSI Missed...</h6>
                        <div className="catn8-report-text fs-6 opacity-90">
                          {override.hidden_clue || 'Upon further inspection, nothing out of the ordinary was discovered.'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {!selectedLocation && !loading && (
                  <div className="text-center py-5 text-muted">
                    <p className="mb-0 italic">Select a location from the list to view the forensic findings.</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
