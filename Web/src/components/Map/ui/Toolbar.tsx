// Панель инструментов (верхняя строка интерфейса).
// Отображает:
//   - логотип с количеством геокодированных адресов
//   - кнопки активации панелей фильтров (н.п., УСПД, счётчики, статус)
//   - счётчик отображаемых точек и кнопку обновления показаний
import React from "react";
import {
  Box,
  Typography,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Divider,
} from "@mui/material";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import RouterIcon from "@mui/icons-material/Router";
import ElectricMeterIcon from "@mui/icons-material/ElectricMeter";
import AssessmentIcon from "@mui/icons-material/Assessment";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import MapIcon from "@mui/icons-material/Map";
import RefreshIcon from "@mui/icons-material/Refresh";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import AddLocationAltIcon from "@mui/icons-material/AddLocationAlt";

import { StatsData, ReadingsProgress } from "../types";

export type ActivePanel = "locality" | "uspd" | "meter" | "status" | null;

interface ToolbarProps {
  stats: StatsData | null;
  showAll: boolean;
  loadingPoints: boolean;
  activePanel: ActivePanel;
  selectedCount: number;
  selectedUsdTypesCount: number;
  selectedMeterTypesCount: number;
  selectedStatusTypesCount: number;
  displayedPointsCount: number;
  totalPointsCount: number;
  hasAnyFilter: boolean;
  readingsProgress: ReadingsProgress | null;
  addingUspdMode: boolean;
  onShowAll: () => void;
  onTogglePanel: (panel: ActivePanel) => void;
  onClearAllFilters: () => void;
  onStartReadingsUpdate: () => void;
  onToggleAddUspdMode: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  stats,
  showAll,
  loadingPoints,
  activePanel,
  selectedCount,
  selectedUsdTypesCount,
  selectedMeterTypesCount,
  selectedStatusTypesCount,
  displayedPointsCount,
  totalPointsCount,
  hasAnyFilter,
  readingsProgress,
  addingUspdMode,
  onShowAll,
  onTogglePanel,
  onClearAllFilters,
  onStartReadingsUpdate,
  onToggleAddUspdMode,
}) => (
  <Box className="top-toolbar">
    <Box className="toolbar-left">
      <Box className="toolbar-brand">
        <MapIcon sx={{ fontSize: 24, color: "#1976d2" }} />
        <Typography variant="h6" fontWeight={700} color="primary">
          Геокодировано
        </Typography>
        {stats && (
          <Chip
            label={`${stats.geocoded} из ${stats.total}`}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ ml: 1, fontWeight: 500 }}
          />
        )}
      </Box>

      <Divider orientation="vertical" flexItem sx={{ mx: 1.5 }} />

      <Box className="filter-buttons">
        <Button
          variant={showAll ? "contained" : "outlined"}
          size="small"
          onClick={onShowAll}
          disabled={loadingPoints}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Все точки
        </Button>

        <Button
          variant={activePanel === "locality" ? "contained" : "outlined"}
          color={selectedCount > 0 ? "primary" : "inherit"}
          size="small"
          startIcon={<LocationCityIcon />}
          endIcon={<KeyboardArrowDownIcon />}
          onClick={() => onTogglePanel("locality")}
          sx={{ textTransform: "none" }}
        >
          Нас. пункты
          {selectedCount > 0 && (
            <Chip
              label={selectedCount}
              size="small"
              color="primary"
              sx={{ ml: 1, height: 20, fontSize: "0.7rem" }}
            />
          )}
        </Button>

        <Button
          variant={activePanel === "uspd" ? "contained" : "outlined"}
          color={selectedUsdTypesCount > 0 ? "secondary" : "inherit"}
          size="small"
          startIcon={<RouterIcon />}
          endIcon={<KeyboardArrowDownIcon />}
          onClick={() => onTogglePanel("uspd")}
          sx={{ textTransform: "none" }}
        >
          УСПД
          {selectedUsdTypesCount > 0 && (
            <Chip
              label={selectedUsdTypesCount}
              size="small"
              color="secondary"
              sx={{ ml: 1, height: 20, fontSize: "0.7rem" }}
            />
          )}
        </Button>

        <Button
          variant={activePanel === "meter" ? "contained" : "outlined"}
          color={selectedMeterTypesCount > 0 ? "warning" : "inherit"}
          size="small"
          startIcon={<ElectricMeterIcon />}
          endIcon={<KeyboardArrowDownIcon />}
          onClick={() => onTogglePanel("meter")}
          sx={{ textTransform: "none" }}
        >
          Счётчики
          {selectedMeterTypesCount > 0 && (
            <Chip
              label={selectedMeterTypesCount}
              size="small"
              color="warning"
              sx={{ ml: 1, height: 20, fontSize: "0.7rem" }}
            />
          )}
        </Button>

        <Button
          variant={activePanel === "status" ? "contained" : "outlined"}
          color={selectedStatusTypesCount > 0 ? "warning" : "inherit"}
          size="small"
          startIcon={<AssessmentIcon />}
          endIcon={<KeyboardArrowDownIcon />}
          onClick={() => onTogglePanel("status")}
          sx={{ textTransform: "none" }}
        >
          Статус показаний
          {selectedStatusTypesCount > 0 && (
            <Chip
              label={selectedStatusTypesCount}
              size="small"
              color="warning"
              sx={{ ml: 1, height: 20, fontSize: "0.7rem" }}
            />
          )}
        </Button>

        {(hasAnyFilter || showAll) && (
          <Tooltip title="Сбросить все фильтры">
            <IconButton
              size="small"
              color="error"
              onClick={onClearAllFilters}
              sx={{ ml: 0.5 }}
            >
              <FilterAltOffIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>

    <Box className="toolbar-right">
      <Tooltip title={addingUspdMode ? "Отменить размещение" : "Разместить точку УСПД на карте"}>
        <Button
          variant={addingUspdMode ? "contained" : "outlined"}
          color="secondary"
          size="small"
          startIcon={<AddLocationAltIcon />}
          onClick={onToggleAddUspdMode}
          sx={{ textTransform: "none" }}
        >
          {addingUspdMode ? "Нажмите на карту..." : "Добавить УСПД"}
        </Button>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>
        На карте:{" "}
        <Box component="span" fontWeight={700} color="primary.main">
          {displayedPointsCount}
        </Box>
        {totalPointsCount > 0 && displayedPointsCount !== totalPointsCount && (
          <Box component="span" color="text.disabled">
            {" "}
            / {totalPointsCount}
          </Box>
        )}
      </Typography>

      <Tooltip title="Обновить показания">
        <span>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={onStartReadingsUpdate}
            disabled={readingsProgress?.status === "running"}
            sx={{ textTransform: "none" }}
          >
            Обновить статус показаний
          </Button>
        </span>
      </Tooltip>
    </Box>
  </Box>
);

export default Toolbar;
