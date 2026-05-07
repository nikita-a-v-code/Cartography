// Утилиты и константы для компонента карты:
// - настройка Leaflet
// - создание иконок маркеров по статусу показаний
// - определение статуса показаний по дате
// - разбор адреса и создание иконки кластера

import L from "leaflet";
import { PointData, ReadingStatus } from "../types";

/** Базовый URL бэкенд-сервера */
export const API_BASE = "http://localhost:6002";

/** Координаты центра карты при первоначальной загрузке (г. Киров) */
export const DEFAULT_CENTER: L.LatLngExpression = [58.6036, 49.6681];
/** Начальный масштаб карты */
export const DEFAULT_ZOOM = 8;
/** Географические ограничения для панорамирования (Кировская область) */
export const KIROV_BOUNDS: L.LatLngBoundsExpression = [
  [56.3, 46.8],
  [61.1, 53.2],
];

// Исправление проблемы с иконками маркеров в React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

/** Встроенный SVG электросчётчика с fill="currentColor" для CSS-перекраски */
const ELECTRIC_METER_SVG = `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet">
<g transform="translate(0,512) scale(0.1,-0.1)" fill="currentColor" stroke="none">
<path d="M944 5106 c-59 -19 -129 -70 -162 -119 -61 -90 -57 32 -57 -1707 l0
-1595 26 -55 c47 -98 140 -168 246 -185 l42 -7 3 -597 3 -598 35 -69 c25 -49
49 -79 85 -106 94 -72 11 -68 1396 -68 1389 0 1298 -4 1395 69 35 26 59 56 84
105 l35 69 3 598 3 597 42 7 c108 17 199 86 246 185 l26 55 0 1600 0 1600 -25
50 c-31 64 -98 131 -158 158 l-47 22 -1590 2 c-1275 1 -1598 -1 -1631 -11z
m3216 -159 c30 -16 51 -37 67 -67 l23 -43 0 -1546 c0 -984 -4 -1559 -10 -1581
-12 -43 -62 -93 -109 -109 -19 -6 -97 -11 -177 -11 -131 0 -146 -2 -164 -20
-25 -25 -26 -71 -1 -101 14 -18 31 -23 80 -27 l61 -4 0 -84 0 -84 -1370 0
-1370 0 0 85 0 85 1176 0 1176 0 30 30 c24 25 29 36 24 58 -4 15 -16 35 -28
45 -19 16 -95 17 -1283 17 -915 0 -1271 3 -1296 11 -43 15 -88 55 -105 96 -12
27 -14 289 -14 1586 l0 1554 23 43 c16 30 37 51 67 67 l43 23 1557 0 1557 0
43 -23z m-232 -4254 c-3 -426 -3 -428 -26 -465 -13 -21 -40 -45 -66 -57 -42
-21 -49 -21 -1276 -21 -1227 0 -1234 0 -1276 21 -26 12 -53 36 -66 57 -23 37
-23 39 -26 465 l-3 427 1371 0 1371 0 -3 -427z"/>
<path d="M1069 4781 c-51 -41 -17 -131 50 -131 65 0 95 89 45 129 -33 26 -65
27 -95 2z"/>
<path d="M3956 4779 c-36 -28 -36 -80 0 -108 54 -42 118 -13 118 54 0 67 -64
96 -118 54z"/>
<path d="M1150 4473 c-37 -14 -74 -49 -91 -87 -18 -39 -19 -87 -19 -1025 0
-976 0 -985 21 -1027 12 -26 36 -53 57 -66 l37 -23 1405 0 1405 0 37 23 c21
13 45 40 57 66 21 42 21 51 21 1027 0 938 -1 986 -19 1025 -10 23 -34 52 -52
65 l-34 24 -1150 3 c-820 2 -1158 -1 -1177 -9 -52 -21 -58 -102 -9 -128 14 -8
374 -11 1155 -11 l1136 0 -2 -967 -3 -968 -1365 0 -1365 0 -3 968 -2 967 98 0
c90 0 100 2 120 23 31 33 29 80 -4 106 -23 18 -40 21 -133 20 -58 0 -113 -3
-121 -6z"/>
<path d="M1450 3978 c-33 -17 -51 -35 -68 -68 -22 -42 -23 -55 -20 -202 3
-173 8 -188 78 -235 l33 -23 1087 0 1087 0 33 23 c70 47 75 62 78 235 3 147 2
160 -20 202 -17 33 -35 51 -68 68 l-44 22 -1066 0 -1066 0 -44 -22z m230 -253
l0 -125 -85 0 -85 0 0 118 c0 65 3 122 7 125 3 4 42 7 85 7 l78 0 0 -125z
m320 0 l0 -125 -85 0 -85 0 0 125 0 125 85 0 85 0 0 -125z m320 0 l0 -125 -85
0 -85 0 0 118 c0 65 3 122 7 125 3 4 42 7 85 7 l78 0 0 -125z m328 -2 l3 -123
-91 0 -90 0 0 118 c0 65 3 122 7 126 4 4 43 5 88 4 l80 -3 3 -122z m320 0 l3
-123 -86 0 -85 0 0 125 0 126 83 -3 82 -3 3 -122z m322 2 l0 -125 -85 0 -85 0
0 125 0 125 85 0 85 0 0 -125z m318 -2 l3 -123 -86 0 -85 0 0 125 0 126 83 -3
82 -3 3 -122z"/>
<path d="M3343 3230 c-27 -11 -231 -264 -239 -297 -5 -17 0 -34 13 -51 18 -25
27 -27 102 -30 44 -2 81 -7 81 -11 0 -5 -22 -37 -50 -71 -55 -69 -63 -107 -30
-140 12 -12 33 -20 53 -20 39 0 54 14 181 174 92 116 104 148 67 185 -21 21
-55 29 -133 33 l-47 3 49 64 c36 46 50 72 50 96 0 49 -51 83 -97 65z"/>
<path d="M1494 3191 c-26 -11 -54 -49 -54 -72 0 -9 9 -28 21 -43 19 -24 26
-26 95 -26 84 0 114 18 114 69 0 51 -29 74 -96 78 -32 1 -69 -1 -80 -6z"/>
<path d="M1895 3191 c-49 -21 -64 -83 -30 -121 26 -29 156 -29 185 0 27 27 26
81 0 105 -23 21 -121 31 -155 16z"/>
<path d="M2295 3191 c-48 -21 -63 -84 -29 -122 26 -28 155 -28 184 1 27 27 26
81 0 105 -23 21 -121 31 -155 16z"/>
<path d="M1061 1884 c-29 -36 -26 -60 9 -96 25 -24 36 -29 58 -24 89 21 78
146 -12 146 -25 0 -40 -7 -55 -26z"/>
<path d="M3950 1890 c-40 -40 -16 -112 42 -126 22 -5 33 0 58 24 35 36 38 60
9 96 -26 33 -79 36 -109 6z"/>
<path d="M2518 939 c-21 -12 -38 -69 -38 -126 0 -30 -4 -43 -14 -43 -25 0
-104 -79 -121 -122 -64 -159 45 -322 215 -322 170 0 278 162 215 322 -17 43
-96 122 -121 122 -10 0 -14 13 -14 43 0 59 -18 115 -40 127 -24 13 -60 12 -82
-1z m97 -321 c47 -41 28 -129 -30 -144 -59 -15 -109 27 -107 89 1 40 41 77 82
77 16 0 41 -10 55 -22z"/>
</g>
</svg>`;

/** Создаёт иконку маркера счётчика на основе electric-meter.svg с CSS-перекраской по цвету статуса */
export const createMeterIcon = (color: string): L.DivIcon =>
  new L.DivIcon({
    className: `meter-marker meter-${color}`,
    html: `<div class="meter-icon">${ELECTRIC_METER_SVG}</div>`,
    iconSize: [36, 36] as L.PointExpression,
    iconAnchor: [18, 18] as L.PointExpression,
    popupAnchor: [0, -22] as L.PointExpression,
  });

/** Иконка маркера УСПД (вручную размещённая точка) */
export const createUspdIcon = (): L.DivIcon =>
  new L.DivIcon({
    className: "uspd-marker",
    html: `<div class="uspd-icon">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M20.2 5.9l.8-.8C19.6 3.7 17.8 3 16 3s-3.6.7-5 2.1l.8.8C12.9 4.7 14.4 4 16 4s3.1.7 4.2 1.9zM16 5c-1.3 0-2.5.5-3.4 1.4l.8.8C14 6.6 14.9 6.2 16 6.2s2 .4 2.6 1.1l.8-.8C18.5 5.5 17.3 5 16 5zm5 7h-2V9h-2v3H5c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7c0-.6-.2-1.1-.6-1.5L21 12zm-1 9H4v-7h16v7zM8 18H6v-4h2v4zm4 0h-2v-4h2v4zm4 0h-2v-4h2v4z"/>
      </svg>
    </div>`,
    iconSize: [38, 38] as L.PointExpression,
    iconAnchor: [19, 19] as L.PointExpression,
    popupAnchor: [0, -22] as L.PointExpression,
  });

/** Готовая иконка УСПД (одна на все точки) */
export const uspdIcon: L.DivIcon = createUspdIcon();

/** Готовые иконки для каждого статуса показаний */
export const statusIcon: Record<ReadingStatus, L.DivIcon> = {
  actual: createMeterIcon("green"),
  stale: createMeterIcon("red"),
  none: createMeterIcon("gray"),
};

/** Текстовые подписи для каждого статуса (используются во всплывающем окне маркера) */
export const statusLabel: Record<ReadingStatus, string> = {
  actual: "Актуальны",
  stale: "Устарели",
  none: "Нет",
};

/** Определяет статус показаний по дате последних показаний */
export const getReadingStatus = (point: PointData): ReadingStatus => {
  if (!point.last_reading_date) return "none";
  const readingDate = new Date(point.last_reading_date);
  const now = new Date();
  const diffDays =
    (now.getTime() - readingDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays < 3 ? "actual" : "stale";
};

/** Извлекает название населённого пункта из адреса (часть до первой запятой) */
export const extractLocality = (address: string): string =>
  address.split(",")[0]?.trim() || address;

/** Кастомная иконка кластера с меткой названия н.п.
 * m.options.alt содержит массив названий н.п. всех маркеров в кластере (берётся из alt атрибута маркера).
 */
export const createClusterIcon = (cluster: any): L.DivIcon => {
  const childMarkers = cluster.getAllChildMarkers();
  const count: number = childMarkers.length;
  const localities: string[] = childMarkers.map(
    (m: any) => m.options.alt || "",
  );
  const unique = Array.from(new Set(localities.filter(Boolean)));

  // Название н.п. показываем только у крупных кластеров (>=10 маркеров).
  // Мелкие кластеры — это дубликаты с одинаковыми координатами, им метка не нужна.
  let label = "";
  if (unique.length === 1 && count >= 6) {
    label = unique[0];
  }

  let sizeClass = "cluster-small";
  if (count >= 100) sizeClass = "cluster-large";
  else if (count >= 10) sizeClass = "cluster-medium";

  return new L.DivIcon({
    className: `marker-cluster ${sizeClass}`,
    html: `<div class="cluster-inner">
      ${label ? `<span class="cluster-label">${label}</span>` : ""}
      <span class="cluster-count">${count}</span>
    </div>`,
    iconSize: L.point(40, 40),
  });
};
