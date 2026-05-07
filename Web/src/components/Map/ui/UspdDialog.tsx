// Диалог создания / редактирования точки УСПД.
// Открывается при клике на карту в режиме размещения или при клике на маркер УСПД.
// Содержит встроенное создание нового типа УСПД без отдельного экрана.
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Box,
  Divider,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import RouterIcon from "@mui/icons-material/Router";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import SettingsIcon from "@mui/icons-material/Settings";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { UspdType, UspdPoint } from "../types";
import { API_BASE } from "../utils/mapUtils";

const NEW_TYPE_SENTINEL = "__new__";

interface Props {
  open: boolean;
  lat: number | null;
  lng: number | null;
  uspdTypes: UspdType[];
  editingPoint: UspdPoint | null;
  onSave: (data: {
    name: string;
    uspd_type_id: number | null;
    description: string;
    latitude: number;
    longitude: number;
  }) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
  onTypeCreated: (type: UspdType) => void; // сообщаем родителю о новом типе
  onManageTypes: () => void;             // открыть диалог управления типами
}

const UspdDialog: React.FC<Props> = ({
  open,
  lat,
  lng,
  uspdTypes,
  editingPoint,
  onSave,
  onDelete,
  onClose,
  onTypeCreated,
  onManageTypes,
}) => {
  const [name, setName] = useState("");
  const [uspdTypeId, setUspdTypeId] = useState<number | "">("");
  const [description, setDescription] = useState("");

  // Состояние инлайн-формы создания нового типа
  const [showNewType, setShowNewType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [creatingType, setCreatingType] = useState(false);
  const [typeError, setTypeError] = useState("");

  useEffect(() => {
    if (open) {
      if (editingPoint) {
        setName(editingPoint.name);
        setUspdTypeId(editingPoint.uspd_type_id ?? "");
        setDescription(editingPoint.description ?? "");
      } else {
        setName("");
        setUspdTypeId("");
        setDescription("");
      }
      setShowNewType(false);
      setNewTypeName("");
      setTypeError("");
    }
  }, [open, editingPoint]);

  const effectiveLat = editingPoint?.latitude ?? lat;
  const effectiveLng = editingPoint?.longitude ?? lng;

  const handleSelectChange = (value: number | "") => {
    if ((value as unknown as string) === NEW_TYPE_SENTINEL) {
      setShowNewType(true);
      setUspdTypeId("");
    } else {
      setUspdTypeId(value);
      setShowNewType(false);
    }
  };

  const handleCreateType = async () => {
    if (!newTypeName.trim()) return;
    setCreatingType(true);
    setTypeError("");
    try {
      const res = await fetch(`${API_BASE}/api/uspd-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTypeName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setTypeError(data.error ?? "Ошибка создания типа");
        return;
      }
      const created: UspdType = await res.json();
      onTypeCreated(created);
      setUspdTypeId(created.id);
      setShowNewType(false);
      setNewTypeName("");
    } catch {
      setTypeError("Ошибка сети");
    } finally {
      setCreatingType(false);
    }
  };

  const handleSave = () => {
    if (!name.trim() || effectiveLat == null || effectiveLng == null) return;
    onSave({
      name: name.trim(),
      uspd_type_id: uspdTypeId !== "" ? (uspdTypeId as number) : null,
      description: description.trim(),
      latitude: effectiveLat,
      longitude: effectiveLng,
    });
  };

  const isEdit = editingPoint != null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <RouterIcon color="secondary" />
        {isEdit ? "Редактировать точку УСПД" : "Новая точка УСПД"}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {effectiveLat != null && effectiveLng != null && (
            <Typography variant="caption" color="text.secondary">
              Координаты: {effectiveLat.toFixed(6)}, {effectiveLng.toFixed(6)}
            </Typography>
          )}

          <TextField
            label="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            size="small"
            required
            autoFocus
            fullWidth
          />

          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel>Тип УСПД</InputLabel>
            <Select
              value={showNewType ? NEW_TYPE_SENTINEL : uspdTypeId}
              label="Тип УСПД"
              onChange={(e) => handleSelectChange(e.target.value as number | "")}
            >
              <MenuItem value="">
                <em>Не указан</em>
              </MenuItem>
              {uspdTypes.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
              <Divider />
              <MenuItem value={NEW_TYPE_SENTINEL} sx={{ color: "primary.main", fontWeight: 600 }}>
                <AddIcon fontSize="small" sx={{ mr: 0.5 }} />
                Создать новый тип...
              </MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Управление типами">
            <IconButton size="small" onClick={onManageTypes} sx={{ mt: 0.5 }}>
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          </Box>

          {/* Инлайн-форма создания нового типа */}
          {showNewType && (
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
              <TextField
                label="Название нового типа"
                value={newTypeName}
                onChange={(e) => { setNewTypeName(e.target.value); setTypeError(""); }}
                size="small"
                fullWidth
                autoFocus
                error={!!typeError}
                helperText={typeError || undefined}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateType();
                  if (e.key === "Escape") { setShowNewType(false); setNewTypeName(""); }
                }}
                InputProps={{
                  endAdornment: creatingType ? (
                    <InputAdornment position="end">
                      <CircularProgress size={16} />
                    </InputAdornment>
                  ) : undefined,
                }}
              />
              <Button
                variant="contained"
                size="small"
                onClick={handleCreateType}
                disabled={!newTypeName.trim() || creatingType}
                sx={{ minWidth: 36, px: 1, height: 40 }}
              >
                <CheckIcon fontSize="small" />
              </Button>
              <Button
                size="small"
                onClick={() => { setShowNewType(false); setNewTypeName(""); setTypeError(""); }}
                sx={{ minWidth: 36, px: 1, height: 40 }}
              >
                <CloseIcon fontSize="small" />
              </Button>
            </Box>
          )}

          <TextField
            label="Описание (необязательно)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            size="small"
            multiline
            rows={2}
            fullWidth
          />
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ justifyContent: "space-between", px: 2, py: 1 }}>
        {isEdit ? (
          <Button
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => onDelete(editingPoint!.id)}
            size="small"
          >
            Удалить
          </Button>
        ) : (
          <span />
        )}
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button onClick={onClose} size="small">
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!name.trim()}
            size="small"
          >
            Сохранить
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default UspdDialog;

