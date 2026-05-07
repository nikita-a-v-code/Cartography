// Фильтр по статусу показаний.
// Позволяет отфильтровать точки учёта по одному или нескольким статусам:
//   - actual — актуальные показания (< 3 дней)
//   - stale  — устаревшие показания (от 3 дней)
//   - none   — показаний никогда не было
import React from "react";
import {
  Box,
  Typography,
  Chip,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { ReadingStatus } from "../types";

export const ALL_STATUSES: ReadingStatus[] = ["actual", "stale", "none"];

export const STATUS_LABELS: Record<ReadingStatus, string> = {
  actual: "Актуальны (< 3 дней)",
  stale: "Устарели (> 3 дней)",
  none: "Показаний никогда не было",
};

const STATUS_COLORS: Record<ReadingStatus, string> = {
  actual: "#27ae60",
  stale: "#e53935",
  none: "#95a5a6",
};

const StatusIcon: React.FC<{ status: ReadingStatus }> = ({ status }) => {
  const color = STATUS_COLORS[status];
  if (status === "actual")
    return <CheckCircleIcon fontSize="small" sx={{ color }} />;
  if (status === "stale")
    return <WarningAmberIcon fontSize="small" sx={{ color }} />;
  return <RadioButtonUncheckedIcon fontSize="small" sx={{ color }} />;
};

interface Props {
  selectedStatuses: Set<ReadingStatus>;
  onToggle: (status: ReadingStatus) => void;
  onClear: () => void;
}

const StatusFilter: React.FC<Props> = ({
  selectedStatuses,
  onToggle,
  onClear,
}) => (
  <>
    <Box
      sx={{
        px: 2,
        pt: 2,
        pb: 1,
        display: "flex",
        alignItems: "center",
        gap: 1,
      }}
    >
      <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
        Статус показаний
      </Typography>
      {selectedStatuses.size > 0 && (
        <Chip
          label={`${selectedStatuses.size} выбр.`}
          size="small"
          color="primary"
          onDelete={onClear}
        />
      )}
    </Box>
    <List dense sx={{ py: 0 }}>
      {ALL_STATUSES.map((status) => (
        <ListItemButton
          key={status}
          dense
          onClick={() => onToggle(status)}
          sx={{ py: 0.5 }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <Checkbox
              edge="start"
              checked={selectedStatuses.has(status)}
              size="small"
              color="default"
              disableRipple
              sx={{
                color: `${STATUS_COLORS[status]} !important`,
                "&.Mui-checked": { color: `${STATUS_COLORS[status]} !important` },
              }}
            />
          </ListItemIcon>
          <ListItemIcon sx={{ minWidth: 28 }}>
            <StatusIcon status={status} />
          </ListItemIcon>
          <ListItemText
            primary={STATUS_LABELS[status]}
            primaryTypographyProps={{ fontSize: "0.85rem" }}
          />
        </ListItemButton>
      ))}
    </List>
  </>
);

export default StatusFilter;
