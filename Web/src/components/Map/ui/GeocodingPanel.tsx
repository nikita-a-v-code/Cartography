// Панель с прогресс-баром геокодирования.
// Отображается только во время выполнения операции.
// Показывает прогресс геокодирования и результаты (всего/успешных/неудачных).
import React from "react";
import { Box, Typography, LinearProgress, Alert } from "@mui/material";
import { GeocodingProgress } from "../types";

interface Props {
  progress: GeocodingProgress | null;
}

const GeocodingPanel: React.FC<Props> = ({ progress }) => {
  // Показываем панель только если идёт обновление
  if (!progress) return null;

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
          <LinearProgress
            variant="determinate"
            value={
              progress.total > 0
                ? (progress.processed / progress.total) * 100
                : 0
            }
            color="secondary"
          />
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
