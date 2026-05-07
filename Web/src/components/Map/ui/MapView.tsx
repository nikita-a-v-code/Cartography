// Компонент карты Leaflet.
// Отображает маркеры точек учёта, сгруппированных по населённым пунктам.
// Для каждого н.п. создаётся отдельная группа кластеризации.
// Цвет маркера зависит от статуса показаний (зелёный/красный/серый).
// Также отображает маркеры УСПД (ручное размещение) и обрабатывает клик в режиме добавления.
import React from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { PointData, UspdPoint } from "../types";
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  KIROV_BOUNDS,
  createClusterIcon,
  getReadingStatus,
  statusIcon,
  statusLabel,
  extractLocality,
  uspdIcon,
} from "../utils/mapUtils";

interface Props {
  points: PointData[];
  uspdPoints: UspdPoint[];
  addingUspdMode: boolean;
  onMapClick: (lat: number, lng: number) => void;
  onUspdMarkerClick: (point: UspdPoint) => void;
}

/** Внутренний компонент: слушает клики по карте в режиме добавления УСПД */
const MapClickHandler: React.FC<{
  active: boolean;
  onClick: (lat: number, lng: number) => void;
}> = ({ active, onClick }) => {
  useMapEvents({
    click(e) {
      if (active) onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const MapView: React.FC<Props> = ({
  points,
  uspdPoints,
  addingUspdMode,
  onMapClick,
  onUspdMarkerClick,
}) => (
  <MapContainer
    center={DEFAULT_CENTER}
    zoom={DEFAULT_ZOOM}
    className={`map-container${addingUspdMode ? " placement-mode" : ""}`}
    maxBounds={KIROV_BOUNDS}
    maxBoundsViscosity={1.0}
    minZoom={7}
    maxZoom={18}
  >
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />

    <MapClickHandler active={addingUspdMode} onClick={onMapClick} />

    {/* Маркеры УСПД (ручное размещение) */}
    {uspdPoints.map((p) => (
      <Marker
        key={`uspd-${p.id}`}
        position={[p.latitude, p.longitude]}
        icon={uspdIcon}
        eventHandlers={{ click: () => onUspdMarkerClick(p) }}
      >
        <Popup>
          <div className="marker-popup">
            <h3>{p.name}</h3>
            {p.type_name && <p className="usd-name">Тип: {p.type_name}</p>}
            {p.description && <p className="address">{p.description}</p>}
            <p className="coords">
              {p.latitude.toFixed(6)}, {p.longitude.toFixed(6)}
            </p>
          </div>
        </Popup>
      </Marker>
    ))}

    {/* Маркеры счётчиков (геокодированные) */}
    {points.length > 0 &&
      Object.entries(
        points.reduce(
          (acc, point) => {
            const loc = extractLocality(point.address);
            if (!acc[loc]) acc[loc] = [];
            acc[loc].push(point);
            return acc;
          },
          {} as Record<string, PointData[]>,
        ),
      ).map(([locality, group]) => (
        <MarkerClusterGroup
          key={locality}
          chunkedLoading
          iconCreateFunction={createClusterIcon}
          maxClusterRadius={(zoom: number) => (zoom >= 13 ? 0 : 60)}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
        >
          {group.map((point) => {
            const status = getReadingStatus(point);
            return (
              <Marker
                key={point.source_id}
                position={[
                  parseFloat(point.latitude),
                  parseFloat(point.longitude),
                ]}
                icon={statusIcon[status]}
                alt={extractLocality(point.address)}
              >
                <Popup>
                  <div className="marker-popup">
                    <h3>
                      Счётчик {point.meter_model} № {point.serial_number}
                    </h3>
                    {point.usd_type && (
                      <p className="usd-name">Тип УСД: {point.usd_type}</p>
                    )}
                    {point.usd_name && (
                      <p className="usd-name">УСД: {point.usd_name}</p>
                    )}
                    <p className={`reading-status reading-${status}`}>
                      Показания: {statusLabel[status]}
                      {(status === "actual" || status === "stale") &&
                        point.last_reading_date && (
                          <span>
                            {" "}
                            (
                            {new Date(
                              point.last_reading_date,
                            ).toLocaleDateString("ru-RU")}
                            )
                          </span>
                        )}
                    </p>
                    <p className="address">{point.address}</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      ))}
  </MapContainer>
);

export default MapView;
