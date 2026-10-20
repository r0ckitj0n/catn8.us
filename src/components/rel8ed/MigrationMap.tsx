import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import type { Rel8edPlace } from '../../types/rel8ed';

type Props = {
  places: Rel8edPlace[];
  onGeocode?: () => void;
  canGeocode?: boolean;
};

export function MigrationMap({ places, onGeocode, canGeocode }: Props) {
  const mapped = places.filter((p) => p.lat != null && p.lng != null);
  const unmapped = places.filter((p) => p.lat == null || p.lng == null);

  return (
    <div className="rel8ed-map-wrap">
      <div className="rel8ed-map-toolbar">
        <span>{mapped.length} geocoded · {unmapped.length} pending / list-only</span>
        {canGeocode && onGeocode ? (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onGeocode}>
            Geocode next batch
          </button>
        ) : null}
      </div>
      {mapped.length > 0 ? (
        <MapContainer
          center={[mapped[0].lat as number, mapped[0].lng as number]}
          zoom={3}
          scrollWheelZoom
          className="rel8ed-leaflet"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {mapped.map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.lat as number, p.lng as number]}
              radius={Math.min(18, 4 + Math.sqrt(p.event_count))}
              pathOptions={{ color: '#3d5a40', fillColor: '#6b8f71', fillOpacity: 0.65 }}
            >
              <Popup>
                <strong>{p.place_name}</strong>
                <br />
                {p.event_count} events
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      ) : (
        <div className="rel8ed-empty">No geocoded places yet. Showing place list below.</div>
      )}
      <ul className="rel8ed-place-list">
        {places.slice(0, 80).map((p) => (
          <li key={p.id}>
            <strong>{p.place_name}</strong>
            <span>{p.event_count} · {p.geocode_status || 'pending'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
