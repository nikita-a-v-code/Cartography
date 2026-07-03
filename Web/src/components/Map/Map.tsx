// Главный компонент карты.
// Содержит всё состояние приложения, загрузку данных, логику фильтрации и передаёт её в дочерние компоненты.
import React, { useState, useEffect, useCallback, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import "./Map.css";

import {
  PointData,
  LocalityData,
  StatsData,
  ReadingsProgress,
  GeocodingProgress,
  ReadingStatus,
  UspdPoint,
  UspdType,
} from "./types";
import { API_BASE, extractLocality, getReadingStatus } from "./utils/mapUtils";
import Toolbar, { ActivePanel } from "../common/Toolbar/Toolbar";

import FilterDropdown from "./utils/FilterDropdown";
import StatusIndicators from "./ui/StatusIndicators";
import MapView from "./ui/MapView";
import ReadingsPanel from "./ui/ReadingsPanel";
import UspdDialog from "./ui/UspdDialog";
import UspdTypesDialog from "./ui/UspdTypesDialog";

import { useAuth } from "../../context/AuthContext";
import GeocodingPanel from "./ui/GeocodingPanel";

interface MapComponentProps {
  onToggleSidebar: () => void;
}

const MapComponent: React.FC<MapComponentProps> = ({ onToggleSidebar }) => {
  // --- Состояние населённых пунктов и поиска ---
  // Список всех н.п. из справочника API
  const [localities, setLocalities] = useState<LocalityData[]>([]);
  // Множество выбранных н.п. для фильтрации точек на карте
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Строка текстового поиска в списке н.п.
  const [search, setSearch] = useState("");

  // --- Состояние точек учёта ---
  // Полный список точек учёта (счётчиков) с координатами
  const [points, setPoints] = useState<PointData[]>([]);
  // Статистика геокодирования: всего / обработано / ожидает (null так как изначально данных нет)
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  // Текст последней ошибки запроса (null — ошибок нет)
  const [error, setError] = useState<string | null>(null);
  // true — режим «показать все точки» без активных фильтров
  const [showAll, setShowAll] = useState(false);
  // Имя открытой панели фильтра (null — все закрыты)
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  // --- Состояние фильтров УСПД ---
  // Множество выбранных типов УСПД (верхний уровень фильтра УСПД)
  const [selectedUsdTypes, setSelectedUsdTypes] = useState<Set<string>>(
    new Set(),
  );
  // Множество выбранных конкретных наименований УСПД (нижний уровень)
  const [selectedUsd, setSelectedUsd] = useState<Set<string>>(new Set());
  // Строка поиска по типам УСПД в фильтре
  const [usdTypeSearch, setUsdTypeSearch] = useState("");
  // Строка поиска по наименованиям УСПД в фильтре
  const [usdSearch, setUsdSearch] = useState("");

  // --- Состояние фильтра моделей счётчиков ---
  // Множество выбранных моделей счётчиков
  const [selectedMeterTypes, setSelectedMeterTypes] = useState<Set<string>>(
    new Set(),
  );

  // --- Состояние фильтра по статусу показаний ---
  // Множество выбранных статусов: actual / stale / none
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ReadingStatus>>(
    new Set(),
  );

  // --- Прогресс фонового обновления показаний ---
  // Данные SSE-прогресса: null — обновление не запущено
  const [readingsProgress, setReadingsProgress] =
    useState<ReadingsProgress | null>(null);

  // --- Прогресс фонового обновления показаний ---
  // Данные SSE-прогресса: null — обновление не запущено
  const [geocodingProgress, setGeocodingProgress] =
    useState<GeocodingProgress | null>(null);

  // --- Состояние УСПД ---
  const [uspdPoints, setUspdPoints] = useState<UspdPoint[]>([]);
  const [uspdTypes, setUspdTypes] = useState<UspdType[]>([]);
  // Режим размещения: true — следующий клик по карте создаёт точку
  const [addingUspdMode, setAddingUspdMode] = useState(false);
  // Диалог: null — закрыт, { lat, lng } — создание, UspdPoint — редактирование
  const [uspdDialogState, setUspdDialogState] = useState<
    { lat: number; lng: number } | UspdPoint | null
  >(null);
  // Диалог управления типами УСПД
  const [typesDialogOpen, setTypesDialogOpen] = useState(false);

  const { isAdmin, isOperator } = useAuth();
  const canUpdateReadings = isAdmin() || isOperator();
  const canAdminAccess = isAdmin();

  // Загрузка данных
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [localRes, statsRes, pointsRes, uspdRes, uspdTypesRes] =
        await Promise.all([
          fetch(`${API_BASE}/api/localities`),
          fetch(`${API_BASE}/api/geocode/stats`),
          fetch(`${API_BASE}/api/points`),
          fetch(`${API_BASE}/api/uspd-points`),
          fetch(`${API_BASE}/api/uspd-types`),
        ]);
      if (!localRes.ok) throw new Error("Ошибка загрузки населённых пунктов");
      if (!pointsRes.ok) throw new Error("Ошибка загрузки точек");
      setLocalities(await localRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      setPoints(await pointsRes.json());
      if (uspdRes.ok) setUspdPoints(await uspdRes.json());
      setUspdTypes(await uspdTypesRes.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Загрузка справочников
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const loadUspdTypes = useCallback(async () => {
    setLoading(true); // ← включаем глобальную загрузку (она же используется в диалоге)
    setError(null); // ← сбрасываем старую ошибку перед новым запросом
    try {
      const res = await fetch(`${API_BASE}/api/uspd-types`);
      if (!res.ok) throw new Error("Ошибка загрузки типов");
      setUspdTypes(await res.json());
    } catch (e) {
      const err = e as Error;
      if (
        err.message === "Failed to fetch" ||
        err.message === "NetworkError" ||
        err.message.includes("fetch")
      ) {
        setError(
          "Не удалось подключиться к серверу. Проверьте, запущен ли сервер, и повторите попытку.",
        );
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Вычисляемые данные для фильтров ---

  // Список доступных моделей счётчиков с количеством точек каждой
  const availableMeterTypes = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of points) {
      const key = p.meter_model || "(не указана)";
      // Проход по всем точкам и подсчёт количества каждой модели счётчика. Если модель не указана, используем ключ "(не указана)".
      map.set(key, (map.get(key) || 0) + 1);
    }
    return (
      Array.from(map.entries())
        // Сотируем по второму элементу массива - цифра 1 (число счетчиков)
        .sort((a, b) => b[1] - a[1])
        // Преобразуем массивы в объекты
        .map(([name, count]) => ({ name, count }))
    );
  }, [points]);

  // Список доступных типов УСПД с количеством точек
  const availableUsdTypes = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of points) {
      const key = p.usd_type || "(не указан)";
      // Проход по всем точкам и подсчёт количества каждого типа УСПД. Если тип не указан, используем ключ "(не указан)".
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [points]);

  // Список наименований УСПД, отфильтрованный по выбранным типам УСПД
  const availableUsd = useMemo(() => {
    const filtered =
      selectedUsdTypes.size > 0
        ? points.filter((p) =>
            selectedUsdTypes.has(p.usd_type || "(не указан)"),
          )
        : points;
    const map = new Map<string, number>();
    for (const p of filtered) {
      const key = p.usd_name || "(не указано)";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [points, selectedUsdTypes]);

  // --- Итоговая фильтрация точек для отображения на карте ---

  // true, если хотя бы один фильтр активен
  const hasAnyFilter =
    selected.size > 0 ||
    selectedUsdTypes.size > 0 ||
    selectedUsd.size > 0 ||
    selectedMeterTypes.size > 0 ||
    selectedStatuses.size > 0;

  const displayedPoints = useMemo(() => {
    if (!showAll && !hasAnyFilter) return [];
    let result = points;
    if (selected.size > 0)
      result = result.filter((p) => selected.has(extractLocality(p.address)));
    if (selectedUsdTypes.size > 0)
      result = result.filter((p) =>
        selectedUsdTypes.has(p.usd_type || "(не указан)"),
      );
    if (selectedUsd.size > 0)
      result = result.filter((p) =>
        selectedUsd.has(p.usd_name || "(не указано)"),
      );
    if (selectedMeterTypes.size > 0)
      result = result.filter((p) =>
        selectedMeterTypes.has(p.meter_model || "(не указана)"),
      );
    if (selectedStatuses.size > 0)
      result = result.filter((p) => selectedStatuses.has(getReadingStatus(p)));
    return result;
  }, [
    points,
    selected,
    selectedUsdTypes,
    selectedUsd,
    selectedMeterTypes,
    selectedStatuses,
    showAll,
    hasAnyFilter,
  ]);

  // --- Обработчики событий ---

  // Показать все точки без фильтрации
  const handleShowAll = useCallback(() => {
    if (points.length === 0) loadInitialData();
    setShowAll(true);
    setSelected(new Set());
    setSelectedUsdTypes(new Set());
    setSelectedUsd(new Set());
    setSelectedMeterTypes(new Set());
    setActivePanel(null);
  }, [points.length, loadInitialData]);

  // Выбрать/снять отдельный населённый пункт
  const toggleLocality = useCallback(
    (locality: string) => {
      if (points.length === 0) loadInitialData();
      setShowAll(false);
      setSelected((prev) => {
        const next = new Set(prev);
        next.has(locality) ? next.delete(locality) : next.add(locality);
        return next;
      });
    },
    [points.length, loadInitialData],
  );

  // Выбрать все населённые пункты
  const selectAllLocalities = useCallback(() => {
    if (points.length === 0) loadInitialData();
    setShowAll(false);
    setSelected(new Set(localities.map((l) => l.locality)));
  }, [localities, points.length, loadInitialData]);

  // Выбрать/снять тип УСПД (при смене типа сбрасываются конкретные УСПД)
  const toggleUsdType = useCallback(
    (type: string) => {
      if (points.length === 0) loadInitialData();
      setSelectedUsdTypes((prev) => {
        const next = new Set(prev);
        next.has(type) ? next.delete(type) : next.add(type);
        return next;
      });
      setSelectedUsd(new Set());
    },
    [points.length, loadInitialData],
  );

  // Выбрать/снять конкретное наименование УСПД
  const toggleUsd = useCallback((usd: string) => {
    setSelectedUsd((prev) => {
      const next = new Set(prev);
      next.has(usd) ? next.delete(usd) : next.add(usd);
      return next;
    });
  }, []);

  // Выбрать/снять модель счётчика
  const onToggleMeterType = useCallback(
    (type: string) => {
      if (points.length === 0) loadInitialData();
      setSelectedMeterTypes((prev) => {
        const next = new Set(prev);
        next.has(type) ? next.delete(type) : next.add(type);
        return next;
      });
    },
    [points.length, loadInitialData],
  );

  // Сбросить сразу все фильтры
  const clearAllFilters = useCallback(() => {
    setSelected(new Set());
    setSelectedUsdTypes(new Set());
    setSelectedUsd(new Set());
    setSelectedMeterTypes(new Set());
    setSelectedStatuses(new Set());
    setShowAll(false);
    setActivePanel(null);
  }, []);

  // Запустить фоновое обновление показаний и подписаться на SSE-прогресс
  const startReadingsUpdate = useCallback(() => {
    setError(null);
    fetch(`${API_BASE}/api/readings/update`, { method: "POST" }).catch(
      (err) => {
        setError((err as Error).message);
      },
    );
    const eventSource = new EventSource(`${API_BASE}/api/readings/progress`);
    eventSource.onmessage = (event) => {
      const data: ReadingsProgress = JSON.parse(event.data);
      setReadingsProgress(data);
      if (data.status === "done" || data.status === "error") {
        eventSource.close();
        setTimeout(() => setReadingsProgress(null), 3000);
      }
    };
    eventSource.onerror = () => {
      eventSource.close();
      setError("Ошибка подключения к серверу обновления показаний");
    };
  }, []);

  // Запустить фоновое геокодирование и подписаться на SSE-прогресс
  const startGeocode = useCallback(() => {
    setError(null);
    fetch(`${API_BASE}/api/geocode/update`, { method: "POST" }).catch((err) => {
      setError((err as Error).message);
    });
    const eventSource = new EventSource(`${API_BASE}/api/geocode/progress`);
    eventSource.onmessage = (event) => {
      const data: GeocodingProgress = JSON.parse(event.data);
      setGeocodingProgress(data);
      if (data.status === "done" || data.status === "error") {
        eventSource.close();
        setTimeout(() => setGeocodingProgress(null), 3000);
      }
    };
    eventSource.onerror = () => {
      eventSource.close();
      setError("Ошибка подключения к серверу геокодирования");
    };
  }, []);

  // --- Обработчики УСПД ---

  // Клик на карту в режиме размещения — открываем диалог создания
  const handleMapClick = useCallback((lat: number, lng: number) => {
    setAddingUspdMode(false);
    setUspdDialogState({ lat, lng });
  }, []);

  // Клик на маркер УСПД — открываем диалог редактирования
  const handleUspdMarkerClick = useCallback((point: UspdPoint) => {
    setUspdDialogState(point);
  }, []);

  // Сохранить точку УСПД (создание или обновление)
  const handleUspdSave = useCallback(
    async (data: {
      name: string;
      uspd_type_id: number | null;
      description: string;
      latitude: number;
      longitude: number;
    }) => {
      const editingPoint =
        uspdDialogState && "id" in uspdDialogState ? uspdDialogState : null;
      try {
        if (editingPoint) {
          const res = await fetch(
            `${API_BASE}/api/uspd-points/${editingPoint.id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            },
          );
          if (res.ok) {
            const updated: UspdPoint = await res.json();
            // Подставляем type_name из локального справочника
            const typeName =
              uspdTypes.find((t) => t.id === updated.uspd_type_id)?.name ??
              null;
            setUspdPoints((prev) =>
              prev.map((p) =>
                p.id === updated.id ? { ...updated, type_name: typeName } : p,
              ),
            );
            setError(null);
          } else {
            const errData = await res.json();
            setError(errData.error || "Ошибка сохранения точки");
            return;
          }
        } else {
          const res = await fetch(`${API_BASE}/api/uspd-points`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          if (res.ok) {
            const created: UspdPoint = await res.json();
            const typeName =
              uspdTypes.find((t) => t.id === created.uspd_type_id)?.name ??
              null;
            setUspdPoints((prev) => [
              { ...created, type_name: typeName },
              ...prev,
            ]);
            setError(null);
          } else {
            const errData = await res.json();
            setError(errData.error || "Ошибка создания точки");
            return;
          }
        }
      } catch (err) {
        setError((err as Error).message);
        return;
      }
      setUspdDialogState(null);
    },
    [uspdDialogState, uspdTypes],
  );

  // Удалить точку УСПД
  const handleUspdDelete = useCallback(async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/uspd-points/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setUspdPoints((prev) => prev.filter((p) => p.id !== id));
        setError(null);
      } else {
        const errData = await res.json();
        setError(errData.error || "Ошибка удаления точки");
        return;
      }
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    setUspdDialogState(null);
  }, []);

  // Открыть/закрыть панель фильтра (при первом открытии загружает точки)
  const togglePanel = (panel: ActivePanel) => {
    if (panel && points.length === 0) {
      loadInitialData();
    }
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  return (
    <div className="map-wrapper">
      <Toolbar
        stats={stats}
        showAll={showAll}
        loadingPoints={loading}
        activePanel={activePanel}
        selectedCount={selected.size}
        selectedUsdTypesCount={selectedUsdTypes.size}
        selectedMeterTypesCount={selectedMeterTypes.size}
        selectedStatusTypesCount={selectedStatuses.size}
        displayedPointsCount={displayedPoints.length}
        totalPointsCount={points.length}
        hasAnyFilter={hasAnyFilter}
        readingsProgress={readingsProgress}
        geocodingProgress={geocodingProgress}
        addingUspdMode={addingUspdMode}
        onShowAll={handleShowAll}
        onTogglePanel={togglePanel}
        onClearAllFilters={clearAllFilters}
        onStartReadingsUpdate={startReadingsUpdate}
        onStartGeocode={startGeocode}
        onToggleAddUspdMode={() => setAddingUspdMode((v) => !v)}
        onToggleSidebar={onToggleSidebar}
        canUpdateReadings={canUpdateReadings}
        canAdminAccess={canAdminAccess}
      />

      <StatusIndicators
        loadingPoints={loading}
        error={error}
        readingsProgress={readingsProgress}
        onClearError={() => setError(null)}
        onRetry={loadInitialData}
      />

      <FilterDropdown
        activePanel={activePanel}
        onClose={() => setActivePanel(null)}
        localities={localities}
        selected={selected}
        search={search}
        loadingLocalities={loading}
        onToggleLocality={toggleLocality}
        onSelectAllLocalities={selectAllLocalities}
        onClearLocalities={() => setSelected(new Set())}
        onSearchChange={setSearch}
        availableUsdTypes={availableUsdTypes}
        availableUsd={availableUsd}
        selectedUsdTypes={selectedUsdTypes}
        selectedUsd={selectedUsd}
        usdTypeSearch={usdTypeSearch}
        usdSearch={usdSearch}
        onToggleUsdType={toggleUsdType}
        onToggleUsd={toggleUsd}
        onClearUsdFilters={() => {
          setSelectedUsdTypes(new Set());
          setSelectedUsd(new Set());
        }}
        onClearUsd={() => setSelectedUsd(new Set())}
        onUsdTypeSearchChange={setUsdTypeSearch}
        onUsdSearchChange={setUsdSearch}
        availableMeterTypes={availableMeterTypes}
        selectedMeterTypes={selectedMeterTypes}
        onToggleMeterType={onToggleMeterType}
        onClearMeterFilters={() => setSelectedMeterTypes(new Set())}
        selectedStatuses={selectedStatuses}
        onToggleStatus={(status) => {
          if (points.length === 0) loadInitialData();
          setSelectedStatuses((prev) => {
            const next = new Set(prev);
            next.has(status) ? next.delete(status) : next.add(status);
            return next;
          });
        }}
        onClearStatuses={() => setSelectedStatuses(new Set())}
      />

      <div className="map-container">
        <MapView
          points={displayedPoints}
          uspdPoints={uspdPoints}
          addingUspdMode={addingUspdMode}
          onMapClick={handleMapClick}
          onUspdMarkerClick={handleUspdMarkerClick}
        />
      </div>

      {canAdminAccess && <ReadingsPanel progress={readingsProgress} />}

      {canAdminAccess && <GeocodingPanel progress={geocodingProgress} />}

      <UspdDialog
        open={uspdDialogState !== null}
        lat={
          "lat" in (uspdDialogState ?? {})
            ? (uspdDialogState as { lat: number }).lat
            : null
        }
        lng={
          "lng" in (uspdDialogState ?? {})
            ? (uspdDialogState as { lng: number }).lng
            : null
        }
        uspdTypes={uspdTypes}
        editingPoint={
          "id" in (uspdDialogState ?? {})
            ? (uspdDialogState as UspdPoint)
            : null
        }
        onSave={handleUspdSave}
        onDelete={handleUspdDelete}
        onTypeCreated={(type) =>
          setUspdTypes((prev) =>
            [...prev, type].sort((a, b) => a.name.localeCompare(b.name)),
          )
        }
        onManageTypes={() => setTypesDialogOpen(true)}
        onClose={() => setUspdDialogState(null)}
      />

      <UspdTypesDialog
        open={typesDialogOpen}
        uspdTypes={uspdTypes}
        loading={loading}
        error={error}
        onLoad={loadUspdTypes}
        onTypeUpdated={(updated) =>
          setUspdTypes((prev) =>
            prev
              .map((t) => (t.id === updated.id ? updated : t))
              .sort((a, b) => a.name.localeCompare(b.name)),
          )
        }
        onTypeDeleted={(id) =>
          setUspdTypes((prev) => prev.filter((t) => t.id !== id))
        }
        onClose={() => setTypesDialogOpen(false)}
      />

    </div>
  );
};

export default MapComponent;
