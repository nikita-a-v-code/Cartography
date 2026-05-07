// Контейнер выпадающих панелей фильтров.
// В зависимости от activePanel отображает нужный фильтр:
//   - locality → LocalityFilter
//   - uspd     → UspdFilter
//   - meter    → MeterFilter
//   - status   → StatusFilter
// Передаёт все необходимые props в соответствующий компонент.
import React from "react";
import {
  Box,
  Typography,
  IconButton,
  Collapse,
  Paper,
  Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import { LocalityData } from "../types";
import LocalityFilter from "../filters/LocalityFilter";
import UspdFilter from "../filters/UspdFilter";
import MeterFilter from "../filters/MeterFilter";
import StatusFilter from "../filters/StatusFilter";
import { ActivePanel } from "../ui/Toolbar";
import { ReadingStatus } from "../types";

interface FilterItem {
  name: string;
  count: number;
}

interface FilterDropdownProps {
  activePanel: ActivePanel;
  onClose: () => void;
  // Locality
  localities: LocalityData[];
  selected: Set<string>;
  search: string;
  loadingLocalities: boolean;
  onToggleLocality: (locality: string) => void;
  onSelectAllLocalities: () => void;
  onClearLocalities: () => void;
  onSearchChange: (value: string) => void;
  // USPD
  availableUsdTypes: FilterItem[];
  availableUsd: FilterItem[];
  selectedUsdTypes: Set<string>;
  selectedUsd: Set<string>;
  usdTypeSearch: string;
  usdSearch: string;
  onToggleUsdType: (type: string) => void;
  onToggleUsd: (usd: string) => void;
  onClearUsdFilters: () => void;
  onClearUsd: () => void;
  onUsdTypeSearchChange: (value: string) => void;
  onUsdSearchChange: (value: string) => void;
  // Meter
  availableMeterTypes: FilterItem[];
  selectedMeterTypes: Set<string>;
  onToggleMeterType: (type: string) => void;
  onClearMeterFilters: () => void;
  // Status
  selectedStatuses: Set<ReadingStatus>;
  onToggleStatus: (status: ReadingStatus) => void;
  onClearStatuses: () => void;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  activePanel,
  onClose,
  localities,
  selected,
  search,
  loadingLocalities,
  onToggleLocality,
  onSelectAllLocalities,
  onClearLocalities,
  onSearchChange,
  availableUsdTypes,
  availableUsd,
  selectedUsdTypes,
  selectedUsd,
  usdTypeSearch,
  usdSearch,
  onToggleUsdType,
  onToggleUsd,
  onClearUsdFilters,
  onClearUsd,
  onUsdTypeSearchChange,
  onUsdSearchChange,
  availableMeterTypes,
  selectedMeterTypes,
  onToggleMeterType,
  onClearMeterFilters,
  selectedStatuses,
  onToggleStatus,
  onClearStatuses,
}) => (
  <Collapse in={activePanel !== null} className="filter-dropdown-container">
    <Paper className="filter-dropdown" elevation={4}>
      <Box className="filter-dropdown-header">
        <Typography variant="subtitle1" fontWeight={600}>
          {activePanel === "locality" && "Населённые пункты"}
          {activePanel === "uspd" && "УСПД"}
          {activePanel === "meter" && "Модели счётчиков"}
          {activePanel === "status" && "Статус показаний"}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Divider />
      <Box className="filter-dropdown-body">
        {activePanel === "locality" && (
          <LocalityFilter
            localities={localities}
            selected={selected}
            search={search}
            loading={loadingLocalities}
            onToggle={onToggleLocality}
            onSelectAll={onSelectAllLocalities}
            onClear={onClearLocalities}
            onSearchChange={onSearchChange}
          />
        )}
        {activePanel === "uspd" && (
          <UspdFilter
            availableUsdTypes={availableUsdTypes}
            availableUsd={availableUsd}
            selectedUsdTypes={selectedUsdTypes}
            selectedUsd={selectedUsd}
            usdTypeSearch={usdTypeSearch}
            usdSearch={usdSearch}
            onToggleType={onToggleUsdType}
            onToggleUsd={onToggleUsd}
            onClearUsdFilters={onClearUsdFilters}
            onClearUsd={onClearUsd}
            onUsdTypeSearchChange={onUsdTypeSearchChange}
            onUsdSearchChange={onUsdSearchChange}
          />
        )}
        {activePanel === "meter" && (
          <MeterFilter
            availableMeterTypes={availableMeterTypes}
            selectedMeterTypes={selectedMeterTypes}
            onToggleType={onToggleMeterType}
            onClearMeterFilters={onClearMeterFilters}
          />
        )}
        {activePanel === "status" && (
          <StatusFilter
            selectedStatuses={selectedStatuses}
            onToggle={onToggleStatus}
            onClear={onClearStatuses}
          />
        )}
      </Box>
    </Paper>
  </Collapse>
);

export default FilterDropdown;
