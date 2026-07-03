// Панель с прогресс-баром геокодирования.
// Отображается только во время выполнения операции.
// Показывает прогресс геокодирования и результаты (всего/успешных/неудачных).
import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  LinearProgress,
  Alert,
  Button,
  CircularProgress,
} from "@mui/material";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import { GeocodingProgress } from "../types";
import { API_BASE } from "../utils/mapUtils";

interface Props {
  progress: GeocodingProgress | null;
}

const GeocodingPanel: React.FC<Props> = ({ progress }) => {
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Сбросить состояние паузы при начале новой операции
  useEffect(() => {
    if (progress?.status === "running") {
      setIsPaused(false);
    }
  }, [progress?.status]);

  // Показываем панель только если идёт обновление
  if (!progress) return null;

  const handlePause = async () => {
    setIsLoadingAction(true);
    try {
      await fetch(`${API_BASE}/api/geocode/pause`, { method: "POST" });
      setIsPaused(true);
    } catch (err) {
      console.error("Ошибка при паузе:", err);
    }
    setIsLoadingAction(false);
  };

  const handleResume = async () => {
    setIsLoadingAction(true);
    try {
      await fetch(`${API_BASE}/api/geocode/resume`, { method: "POST" });
      setIsPaused(false);
    } catch (err) {
      console.error("Ошибка при возобновлении:", err);
    }
    setIsLoadingAction(false);
  };

  const handleCancel = async () => {
    setIsLoadingAction(true);
    try {
      await fetch(`${API_BASE}/api/geocode/cancel`, { method: "POST" });
    } catch (err) {
      console.error("Ошибка при отмене:", err);
    }
    setIsLoadingAction(false);
  };

  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderTop: "1px solid",
        borderColor: "divider",
        flexShrink: 0,
        backgroundColor: "#f5f5f5",
      }}
    >
      {progress.status === "running" && (
        <>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
            <LinearProgress
              variant="determinate"
              value={
                progress.total > 0
                  ? (progress.processed / progress.total) * 100
                  : 0
              }
              color="secondary"
              sx={{ flex: 1 }}
            />
            <Box sx={{ display: "flex", gap: 0.5 }}>
              {isLoadingAction ? (
                <CircularProgress size={24} />
              ) : (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={isPaused ? <PlayArrowIcon /> : <PauseIcon />}
                    onClick={isPaused ? handleResume : handlePause}
                  >
                    {isPaused ? "Возобновить" : "Пауза"}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<StopIcon />}
                    onClick={handleCancel}
                  >
                    Стоп
                  </Button>
                </>
              )}
            </Box>
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            textAlign="center"
            display="block"
            sx={{ mt: 0.5 }}
          >
            {progress.processed} / {progress.total}
          </Typography>
        </>
      )}
      {progress.status === "done" && (
        <Alert severity="success" variant="outlined" sx={{ py: 0.5 }}>
          ✅ Завершено: {progress.success} успешно, {progress.failed} неудачно
        </Alert>
      )}
      {progress.status === "error" && (
        <Alert severity="error" variant="outlined" sx={{ py: 0.5 }}>
          ❌ Ошибка: {progress.message}
        </Alert>
      )}
    </Box>
  );
};

export default GeocodingPanel;
