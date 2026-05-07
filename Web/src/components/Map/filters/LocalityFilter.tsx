// Фильтр по населённым пунктам.
// Позволяет:
//   - искать н.п. по названию
//   - выбрать все / сбросить выбор
//   - отмечать отдельные н.п. чекбоксами
// Список отображается с названием и количеством счётчиков, сортирован по алфавиту.
import React from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  CircularProgress,
  InputAdornment,
  IconButton,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import { LocalityData } from "../types";

interface Props {
  localities: LocalityData[];
  selected: Set<string>;
  search: string;
  loading: boolean;
  onToggle: (locality: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onSearchChange: (value: string) => void;
}

// Получаем пропсы из контейнера FilterDropdown и отображаем UI для фильтра по населённым пунктам.
const LocalityFilter: React.FC<Props> = ({
  localities,
  selected,
  search,
  loading,
  onToggle,
  onSelectAll,
  onClear,
  onSearchChange,
}) => {
  const filtered = localities.filter((l) =>
    l.locality.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <Box sx={{ px: 2, pt: 2, pb: 1 }}>
        <Box sx={{ display: "flex", gap: 1, mb: 1.5 }}>
          <Button
            size="small"
            variant="contained"
            onClick={onSelectAll}
            disabled={loading}
            sx={{ flex: 1, fontSize: "0.75rem" }}
          >
            Все
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={onClear}
            disabled={selected.size === 0}
            sx={{ flex: 1, fontSize: "0.75rem" }}
          >
            Сброс
          </Button>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", mb: 1.5, gap: 0.5 }}>
          <LocationCityIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
            Населённые пункты
          </Typography>
          {selected.size > 0 && (
            <Chip
              label={`${selected.size} выбр.`}
              size="small"
              color="primary"
            />
          )}
        </Box>
        <TextField
          size="small"
          fullWidth
          placeholder="Поиск населённого пункта..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => onSearchChange("")}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
      </Box>

      <List dense sx={{ maxHeight: 800, overflowY: "auto", py: 0 }}>
        {loading ? (
          <Box sx={{ p: 2, textAlign: "center" }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          localities
            .filter((l) =>
              l.locality.toLowerCase().includes(search.toLowerCase()),
            )
            .sort((a, b) => a.locality.localeCompare(b.locality, "ru"))
            .map((l) => (
              <ListItemButton
                key={l.locality}
                dense
                onClick={() => onToggle(l.locality)}
                sx={{ py: 0.3 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Checkbox
                    edge="start"
                    checked={selected.has(l.locality)}
                    size="small"
                    disableRipple
                  />
                </ListItemIcon>
                <ListItemText
                  primary={l.locality}
                  primaryTypographyProps={{ fontSize: "0.82rem", noWrap: true }}
                />
                <Chip
                  label={l.count}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: "0.7rem" }}
                />
              </ListItemButton>
            ))
        )}
      </List>
    </>
  );
};

export default LocalityFilter;
