// Фильтр по УСПД (устройства сбора показаний данных).
// Содержит два уровня фильтрации:
//   1. Тип УСПД — список всех типов с чекбоксами, сортирован по алфавиту
//   2. Наименование УСПД — появляется только после выбора типа, с поиском
import React from "react";
import {
  Box,
  Typography,
  TextField,
  Chip,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RouterIcon from "@mui/icons-material/Router";
import ElectricMeterIcon from "@mui/icons-material/ElectricMeter";

interface FilterItem {
  name: string;
  count: number;
}

interface Props {
  availableUsdTypes: FilterItem[];
  availableUsd: FilterItem[];
  selectedUsdTypes: Set<string>;
  selectedUsd: Set<string>;
  usdTypeSearch: string;
  usdSearch: string;
  onToggleType: (type: string) => void;
  onToggleUsd: (usd: string) => void;
  onClearUsdFilters: () => void;
  onClearUsd: () => void;
  onUsdTypeSearchChange: (value: string) => void;
  onUsdSearchChange: (value: string) => void;
}

const UspdFilter: React.FC<Props> = ({
  availableUsdTypes,
  availableUsd,
  selectedUsdTypes,
  selectedUsd,
  usdTypeSearch,
  usdSearch,
  onToggleType,
  onToggleUsd,
  onClearUsdFilters,
  onClearUsd,
  onUsdTypeSearchChange,
  onUsdSearchChange,
}) => (
  <>
    {/* ===== Тип УСПД ===== */}
    <Divider sx={{ mx: 1.5, my: 0.5 }} />
    <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 1, gap: 0.5 }}>
        <RouterIcon fontSize="small" sx={{ color: "secondary.main" }} />
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
          Тип УСПД
        </Typography>
        {selectedUsdTypes.size > 0 && (
          <Chip
            label={selectedUsdTypes.size}
            size="small"
            color="secondary"
            onDelete={onClearUsdFilters}
          />
        )}
      </Box>
    </Box>
    <List dense sx={{ maxHeight: 800, overflowY: "auto", py: 0 }}>
      {[...availableUsdTypes]
        .sort((a, b) => a.name.localeCompare(b.name, "ru"))
        .map((t) => (
          <ListItemButton
            key={t.name}
            dense
            onClick={() => onToggleType(t.name)}
            sx={{ py: 0.2 }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Checkbox
                edge="start"
                checked={selectedUsdTypes.has(t.name)}
                size="small"
                disableRipple
              />
            </ListItemIcon>
            <ListItemText
              primary={t.name}
              primaryTypographyProps={{ fontSize: "0.8rem", noWrap: true }}
            />
            <Chip
              label={t.count}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: "0.7rem" }}
            />
          </ListItemButton>
        ))}
    </List>

    {/* ===== Наименование УСПД ===== */}
    {selectedUsdTypes.size > 0 && (
      <>
        <Divider sx={{ mx: 1.5, my: 0.5 }} />
        <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 1, gap: 0.5 }}>
            <ElectricMeterIcon
              fontSize="small"
              sx={{ color: "warning.main" }}
            />
            <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
              Наименование УСПД
            </Typography>
            {selectedUsd.size > 0 && (
              <Chip
                label={selectedUsd.size}
                size="small"
                color="warning"
                onDelete={onClearUsd}
              />
            )}
          </Box>
          <TextField
            size="small"
            fullWidth
            placeholder="Поиск наименования УСПД..."
            value={usdSearch}
            onChange={(e) => onUsdSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Box>
        <List dense sx={{ maxHeight: 800, overflowY: "auto", py: 0 }}>
          {[...availableUsd]
            .filter((u) =>
              u.name.toLowerCase().includes(usdSearch.toLowerCase()),
            )
            .sort((a, b) => a.name.localeCompare(b.name, "ru"))
            .map((u) => (
              <ListItemButton
                key={u.name}
                dense
                onClick={() => onToggleUsd(u.name)}
                sx={{ py: 0.2 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Checkbox
                    edge="start"
                    checked={selectedUsd.has(u.name)}
                    size="small"
                    disableRipple
                  />
                </ListItemIcon>
                <ListItemText
                  primary={u.name}
                  primaryTypographyProps={{ fontSize: "0.8rem", noWrap: true }}
                />
                <Chip
                  label={u.count}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: "0.7rem" }}
                />
              </ListItemButton>
            ))}
        </List>
      </>
    )}
  </>
);

export default UspdFilter;
