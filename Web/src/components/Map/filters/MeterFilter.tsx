// Фильтр по моделям счётчиков.
// Отображает список доступных моделей с чекбоксами и счётчиком выбранных,
// отсортированным по алфавиту.
import React from "react";
import {
  Box,
  Typography,
  Chip,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
} from "@mui/material";
import RouterIcon from "@mui/icons-material/Router";

interface FilterItem {
  name: string;
  count: number;
}

interface Props {
  availableMeterTypes: FilterItem[];
  selectedMeterTypes: Set<string>;
  onToggleType: (type: string) => void;
  onClearMeterFilters: () => void;
}

const MeterFilter: React.FC<Props> = ({
  availableMeterTypes,
  selectedMeterTypes,
  onToggleType,
  onClearMeterFilters,
}) => (
  <>
    {/* ===== Модель счетчика ===== */}
    <Divider sx={{ mx: 1.5, my: 0.5 }} />
    <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 1, gap: 0.5 }}>
        <RouterIcon fontSize="small" sx={{ color: "secondary.main" }} />
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
          Модель счетчика
        </Typography>
        {selectedMeterTypes.size > 0 && (
          <Chip
            label={selectedMeterTypes.size}
            size="small"
            color="secondary"
            onDelete={onClearMeterFilters}
          />
        )}
      </Box>
    </Box>
    <List dense sx={{ maxHeight: 800, overflowY: "auto", py: 0 }}>
        {[...availableMeterTypes]
          .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
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
              checked={selectedMeterTypes.has(t.name)}
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
  </>
);

export default MeterFilter;
