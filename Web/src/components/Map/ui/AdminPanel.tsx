// Панель администратора — полноэкранный компонент.
// Открывается по кнопке в Toolbar (только для администраторов).
// Левая навигация: разделы настроек.
// Правая область: содержимое раздела с редактируемыми полями.
// Настройки хранятся в таблице "Main".settings, применяются немедленно
// (кроме cron-расписания — требует перезапуска сервера).
import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  TextField,
  Switch,
  FormControlLabel,
  Divider,
  CircularProgress,
  Alert,
  InputAdornment,
  Tooltip,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import MapIcon from "@mui/icons-material/Map";
import BoltIcon from "@mui/icons-material/Bolt";
import { API_BASE } from "../utils/mapUtils";

interface AppSettings {
  enableGeocoder: boolean;
  geocoderCron: string;
  geocoderBatchSize: number;
  geocodingBatchSize: number;
  geocoderRetryDays: number;
  enableReadings: boolean;
  readingsCron: string;
  readingsBatchSize: number;
}

interface AdminPanelProps {
  open: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { id: "geocoder", label: "Геокодирование", icon: <MapIcon /> },
  { id: "readings", label: "Показания", icon: <BoltIcon /> },
];

const FieldRow: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: "300px 1fr",
      alignItems: "center",
      gap: 3,
      mb: 2.5,
    }}
  >
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Typography variant="body1">{label}</Typography>
      {hint && (
        <Tooltip title={hint} placement="top">
          <InfoOutlinedIcon
            sx={{ fontSize: 16, color: "text.disabled", cursor: "help" }}
          />
        </Tooltip>
      )}
    </Box>
    <Box>{children}</Box>
  </Box>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    variant="overline"
    color="text.secondary"
    sx={{ display: "block", mb: 1.5, mt: 0.5, letterSpacing: 1 }}
  >
    {children}
  </Typography>
);

const AdminPanel: React.FC<AdminPanelProps> = ({ open, onClose }) => {
  const [section, setSection] = useState("geocoder");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    fetch(`${API_BASE}/api/admin/settings`)
      .then((res) => {
        if (!res.ok) throw new Error(`Ошибка ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then((data: AppSettings) => {
        setSettings(data);
        setDraft(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open]);

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error(`Ошибка ${res.status}: ${res.statusText}`);
      const updated: AppSettings = await res.json();
      setSettings(updated);
      setDraft(updated);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    draft && settings && JSON.stringify(draft) !== JSON.stringify(settings);

  if (!open) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
      }}
    >
      {/* ── AppBar ──────────────────────────────────────────────────────── */}
      <AppBar position="static" color="primary" elevation={2}>
        <Toolbar>
          <Typography variant="h6" sx={{ flex: 1, fontWeight: 700 }}>
            ⚙️ Панель администратора
          </Typography>
          {hasChanges && (
            <Button
              variant="contained"
              color="inherit"
              startIcon={
                saving ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <SaveIcon />
                )
              }
              onClick={handleSave}
              disabled={saving}
              sx={{ mr: 1, color: "primary.main", bgcolor: "white" }}
            >
              Сохранить изменения
            </Button>
          )}
          <IconButton color="inherit" onClick={onClose} edge="end">
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* ── Тело панели ─────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Боковая навигация */}
        <Paper
          elevation={0}
          sx={{
            width: 220,
            borderRight: "1px solid",
            borderColor: "divider",
            flexShrink: 0,
            pt: 2,
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ px: 2, display: "block", mb: 1 }}
          >
            НАСТРОЙКИ
          </Typography>
          <List dense disablePadding>
            {NAV_ITEMS.map((item) => (
              <ListItemButton
                key={item.id}
                selected={section === item.id}
                onClick={() => setSection(item.id)}
                sx={{ borderRadius: "0 20px 20px 0", mr: 1 }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </Paper>

        {/* Область контента */}
        <Box sx={{ flex: 1, overflow: "auto", p: 4 }}>
          {loading && (
            <Box display="flex" justifyContent="center" py={8}>
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3, maxWidth: 700 }}>
              {error}
            </Alert>
          )}

          {saved && (
            <Alert severity="success" sx={{ mb: 3, maxWidth: 700 }}>
              Настройки сохранены. Изменения батча и дней повтора вступят в силу
              немедленно. Изменение cron-расписания требует перезапуска сервера.
            </Alert>
          )}

          {draft && !loading && (
            <>
              {/* ── Раздел: Геокодирование ── */}
              {section === "geocoder" && (
                <Box sx={{ maxWidth: 700 }}>
                  <Typography variant="h5" fontWeight={700} gutterBottom>
                    Геокодирование
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    Настройки автоматического и ручного геокодирования адресов
                    счётчиков.
                  </Typography>

                  <SectionTitle>Планировщик</SectionTitle>

                  <FieldRow label="Включить планировщик">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={draft.enableGeocoder}
                          onChange={(e) =>
                            set("enableGeocoder", e.target.checked)
                          }
                        />
                      }
                      label={
                        <Typography variant="body2" color="text.secondary">
                          {draft.enableGeocoder
                            ? "Автоматический запуск включён"
                            : "Автоматический запуск выключен"}
                        </Typography>
                      }
                    />
                  </FieldRow>

                  <FieldRow
                    label="Расписание (cron)"
                    hint="Изменение вступает в силу после перезапуска сервера"
                  >
                    <TextField
                      size="small"
                      value={draft.geocoderCron}
                      onChange={(e) => set("geocoderCron", e.target.value)}
                      placeholder="0 3 */3 * *"
                      helperText="По умолчанию: каждые 3 дня в 03:00"
                      sx={{ width: 260 }}
                    />
                  </FieldRow>

                  <FieldRow
                    label="Батч планировщика"
                    hint="Количество адресов за одну автоматическую итерацию"
                  >
                    <TextField
                      size="small"
                      type="number"
                      value={draft.geocoderBatchSize}
                      onChange={(e) =>
                        set(
                          "geocoderBatchSize",
                          parseInt(e.target.value, 10) || 1,
                        )
                      }
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            адресов
                          </InputAdornment>
                        ),
                      }}
                      inputProps={{ min: 1, max: 10000 }}
                      sx={{ width: 220 }}
                    />
                  </FieldRow>

                  <FieldRow
                    label="Повтор неудачных адресов"
                    hint="Через сколько дней повторять адреса, для которых не нашлись координаты"
                  >
                    <TextField
                      size="small"
                      type="number"
                      value={draft.geocoderRetryDays}
                      onChange={(e) =>
                        set(
                          "geocoderRetryDays",
                          parseInt(e.target.value, 10) || 1,
                        )
                      }
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">дней</InputAdornment>
                        ),
                      }}
                      inputProps={{ min: 1, max: 365 }}
                      sx={{ width: 180 }}
                    />
                  </FieldRow>

                  <Divider sx={{ my: 3 }} />
                  <SectionTitle>Ручной запуск</SectionTitle>

                  <FieldRow
                    label="Батч ручного запуска"
                    hint="Количество адресов при нажатии кнопки «Запустить геокодирование» в тулбаре"
                  >
                    <TextField
                      size="small"
                      type="number"
                      value={draft.geocodingBatchSize}
                      onChange={(e) =>
                        set(
                          "geocodingBatchSize",
                          parseInt(e.target.value, 10) || 1,
                        )
                      }
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            адресов
                          </InputAdornment>
                        ),
                      }}
                      inputProps={{ min: 1, max: 50000 }}
                      sx={{ width: 220 }}
                    />
                  </FieldRow>
                </Box>
              )}

              {/* ── Раздел: Показания ── */}
              {section === "readings" && (
                <Box sx={{ maxWidth: 700 }}>
                  <Typography variant="h5" fontWeight={700} gutterBottom>
                    Показания счётчиков
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    Настройки синхронизации дат последних показаний с исходной
                    базой данных.
                  </Typography>

                  <SectionTitle>Планировщик</SectionTitle>

                  <FieldRow label="Включить планировщик">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={draft.enableReadings}
                          onChange={(e) =>
                            set("enableReadings", e.target.checked)
                          }
                        />
                      }
                      label={
                        <Typography variant="body2" color="text.secondary">
                          {draft.enableReadings
                            ? "Автоматический запуск включён"
                            : "Автоматический запуск выключен"}
                        </Typography>
                      }
                    />
                  </FieldRow>

                  <FieldRow
                    label="Расписание (cron)"
                    hint="Изменение вступает в силу после перезапуска сервера"
                  >
                    <TextField
                      size="small"
                      value={draft.readingsCron}
                      onChange={(e) => set("readingsCron", e.target.value)}
                      placeholder="0 2 */3 * *"
                      helperText="По умолчанию: каждые 3 дня в 02:00"
                      sx={{ width: 260 }}
                    />
                  </FieldRow>

                  <FieldRow
                    label="Батч запроса"
                    hint="Количество счётчиков, обрабатываемых за один SQL-запрос к исходной БД"
                  >
                    <TextField
                      size="small"
                      type="number"
                      value={draft.readingsBatchSize}
                      onChange={(e) =>
                        set(
                          "readingsBatchSize",
                          parseInt(e.target.value, 10) || 1,
                        )
                      }
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            записей
                          </InputAdornment>
                        ),
                      }}
                      inputProps={{ min: 1, max: 10000 }}
                      sx={{ width: 220 }}
                    />
                  </FieldRow>
                </Box>
              )}
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default AdminPanel;
