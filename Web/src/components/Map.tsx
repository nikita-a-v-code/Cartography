import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./Map.css";

// Исправление проблемы с иконками маркеров в React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

// Кастомная иконка для счётчика (электричество/потребитель)
const meterIcon = new L.DivIcon({
  className: "meter-marker",
  html: `<div class="meter-icon">
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
    <span class="meter-bolt">⚡</span>
  </div>`,
  iconSize: [32, 40] as L.PointExpression,
  iconAnchor: [16, 40] as L.PointExpression,
  popupAnchor: [0, -40] as L.PointExpression,
});

// Кировская область
const DEFAULT_CENTER: L.LatLngExpression = [58.6036, 49.6681]; // Киров
const DEFAULT_ZOOM = 8;

// Границы Кировской области
const KIROV_BOUNDS: L.LatLngBoundsExpression = [
  [56.3, 46.8],
  [61.1, 53.2],
];

interface PointData {
  source_id: number;
  address: string;
  latitude: string;
  longitude: string;
}

interface StatsData {
  total: number;
  geocoded: number;
  pending: number;
}

const MapComponent: React.FC = () => {
  const [points, setPoints] = useState<PointData[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Загружаем точки и статистику параллельно
        const [pointsRes, statsRes] = await Promise.all([
          fetch("http://localhost:6002/api/points"),
          fetch("http://localhost:6002/api/geocode/stats"),
        ]);

        if (!pointsRes.ok) throw new Error("Ошибка загрузки точек");

        const pointsData: PointData[] = await pointsRes.json();
        setPoints(pointsData);

        if (statsRes.ok) {
          const statsData: StatsData = await statsRes.json();
          setStats(statsData);
        }

        setError(null);
      } catch (err) {
        console.error("Ошибка загрузки данных:", err);
        const e = err as Error;
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="map-wrapper">
      {/* Панель статистики */}
      <div className="stats-panel">
        <h3>📊 Счётчики на карте</h3>
        {loading && <p>Загрузка...</p>}
        {error && <p className="error">⚠️ {error}</p>}
        {stats && (
          <div className="stats-info">
            <p>
              <span className="stat-icon">📍</span> На карте:{" "}
              <strong>{points.length}</strong>
            </p>
            <p>
              <span className="stat-icon">✅</span> Геокодировано:{" "}
              <strong>{stats.geocoded}</strong>
            </p>
            <p>
              <span className="stat-icon">⏳</span> Осталось:{" "}
              <strong>{stats.pending}</strong>
            </p>
            <p>
              <span className="stat-icon">📋</span> Всего адресов:{" "}
              <strong>{stats.total}</strong>
            </p>
          </div>
        )}
      </div>

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="map-container"
        maxBounds={KIROV_BOUNDS}
        maxBoundsViscosity={1.0}
        minZoom={7}
        maxZoom={18}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {points.map((point) => (
          <Marker
            key={point.source_id}
            position={[parseFloat(point.latitude), parseFloat(point.longitude)]}
            icon={meterIcon}
          >
            <Popup>
              <div className="marker-popup">
                <h3>⚡ Счётчик #{point.source_id}</h3>
                <p className="address">{point.address}</p>
                <p className="coords">
                  📍 {parseFloat(point.latitude).toFixed(5)},{" "}
                  {parseFloat(point.longitude).toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MapComponent;
