// Компонент индикаторов состояния.
// Отображает:
//   - полосу загрузки при загрузке точек
//   - сообщение об ошибке с кнопкой закрытия
//   - чип с прогрессом фонового обновления показаний
import React from "react";
import { Box, Chip, LinearProgress, Alert } from "@mui/material";
import { ReadingsProgress } from "../types";

interface StatusIndicatorsProps {
  /** true — идёт загрузка точек, показывается полоса */
  loadingPoints: boolean;
  /** Текст ошибки или null */
  error: string | null;
  /** Данные прогресса обновления или null, если обновления нет */
  readingsProgress: ReadingsProgress | null;
  /** Колбэк закрытия сообщения об ошибке */
  onClearError: () => void;
}

const StatusIndicators: React.FC<StatusIndicatorsProps> = ({
  loadingPoints,
  error,
  readingsProgress,
  onClearError,
}) => (
  <>
    {loadingPoints && <LinearProgress className="loading-bar" />}

    {error && (
      <Alert
        severity="error"
        variant="filled"
        className="error-alert"
        onClose={onClearError}
      >
        {error}
      </Alert>
    )}

    {readingsProgress && (
      <Box className="readings-progress">
        {readingsProgress.status === "running" && (
          <Chip
            label={`Обновление: ${readingsProgress.processed} / ${readingsProgress.total}`}
            color="info"
            size="small"
          />
        )}
        {readingsProgress.status === "done" && (
          <Chip
            label={`Готово! С показаниями: ${readingsProgress.withReadings}`}
            color="success"
            size="small"
          />
        )}
        {readingsProgress.status === "error" && (
          <Chip label={readingsProgress.message} color="error" size="small" />
        )}
      </Box>
    )}
  </>
);

export default StatusIndicators;
