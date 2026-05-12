// Компонент индикаторов состояния.
// Отображает:
//   - полосу загрузки при загрузке точек
//   - сообщение об ошибке с кнопкой повтора и техническими деталями
//   - чип с прогрессом фонового обновления показаний
import React from "react";
import { Box, Chip, LinearProgress } from "@mui/material";
import ErrorAlert from "../../../ui/ErrorAlert";
import { ReadingsProgress } from "../types";

interface StatusIndicatorsProps {
  /** true — идёт загрузка точек, показывается полоса */
  loadingPoints: boolean;
  /** Ошибка (строка или Error объект) или null */
  error: string | Error | null;
  /** Данные прогресса обновления или null, если обновления нет */
  readingsProgress: ReadingsProgress | null;
  /** Колбэк закрытия сообщения об ошибке */
  onClearError: () => void;
  /** Колбэк повтора загрузки (опциональный) */
  onRetry?: () => void;
}

const StatusIndicators: React.FC<StatusIndicatorsProps> = ({
  loadingPoints,
  error,
  readingsProgress,
  onClearError,
  onRetry,
}) => (
  <>
    {loadingPoints && <LinearProgress className="loading-bar" />}

    {error && (
      <Box sx={{ px: 2, pt: 2 }}>
        <ErrorAlert
          error={error}
          title="Ошибка загрузки данных"
          onRetry={onRetry}
          showDetails={true}
        />
      </Box>
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
