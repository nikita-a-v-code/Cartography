// Диалог управления справочником типов УСПД:
// просмотр, переименование, удаление.
import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  Typography,
  CircularProgress,
  Box,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { UspdType } from "../types";
import { API_BASE } from "../utils/mapUtils";

interface Props {
  open: boolean;
  uspdTypes: UspdType[];
  onClose: () => void;
  onTypeUpdated: (type: UspdType) => void;
  onTypeDeleted: (id: number) => void;
}

const UspdTypesDialog: React.FC<Props> = ({
  open,
  uspdTypes,
  onClose,
  onTypeUpdated,
  onTypeDeleted,
}) => {
  // id типа, который сейчас редактируется (null = нет)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const startEdit = (type: UspdType) => {
    setEditingId(type.id);
    setEditName(type.name);
    setEditDesc(type.description ?? "");
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError("");
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || editingId == null) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/uspd-types/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Ошибка сохранения");
        return;
      }
      const updated: UspdType = await res.json();
      onTypeUpdated(updated);
      setEditingId(null);
    } catch {
      setError("Ошибка сети");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    // Сохраняем id удаляемого типа, чтобы показать индикатор загрузки на кнопке и отключить её.
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/api/uspd-types/${id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Ошибка удаления");
        return;
      }
      onTypeDeleted(id);
      if (editingId === id) setEditingId(null);
    } catch {
      setError("Ошибка сети");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Управление типами УСПД</DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        {uspdTypes.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            Нет ни одного типа
          </Typography>
        ) : (
          <List dense disablePadding>
            {uspdTypes.map((type) =>
              editingId === type.id ? (
                // ── Режим редактирования строки ──────────────────────
                <ListItem
                  key={type.id}
                  divider
                  sx={{ gap: 1, flexWrap: "wrap", py: 1 }}
                >
                  <Box
                    sx={{ display: "flex", gap: 1, flex: 1, flexWrap: "wrap" }}
                  >
                    <TextField
                      label="Название"
                      value={editName}
                      onChange={(e) => {
                        setEditName(e.target.value);
                        setError("");
                      }}
                      size="small"
                      autoFocus
                      sx={{ flex: "1 1 140px" }}
                      error={!!error}
                      helperText={error || undefined}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                    <TextField
                      label="Описание"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      size="small"
                      sx={{ flex: "2 1 200px" }}
                    />
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      gap: 0.5,
                      alignSelf: "flex-start",
                      pt: 0.5,
                    }}
                  >
                    <Tooltip title="Сохранить">
                      <span>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={handleSaveEdit}
                          disabled={!editName.trim() || saving}
                        >
                          {saving ? (
                            <CircularProgress size={16} />
                          ) : (
                            <CheckIcon fontSize="small" />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Отмена">
                      <IconButton size="small" onClick={cancelEdit}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItem>
              ) : (
                // ── Обычная строка ─────────────────────────────────
                <ListItem key={type.id} divider>
                  <ListItemText
                    primary={type.name}
                    secondary={type.description || undefined}
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Переименовать">
                      <IconButton
                        size="small"
                        onClick={() => startEdit(type)}
                        disabled={deletingId != null}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Удалить">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(type.id)}
                          disabled={deletingId === type.id}
                        >
                          {deletingId === type.id ? (
                            <CircularProgress size={16} color="error" />
                          ) : (
                            <DeleteOutlineIcon fontSize="small" />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              ),
            )}
          </List>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
};

export default UspdTypesDialog;
