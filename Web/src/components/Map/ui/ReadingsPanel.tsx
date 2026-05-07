// Панель управления обновлением показаний.
// Содержит кнопку запуска фонового обновления и отображает
// прогресс-бар с результатами (обработано/всего/ошибка).
import React from "react";
import { Box, Button, Typography, LinearProgress, Alert } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { ReadingsProgress } from "../types";

interface Props {
  progress: ReadingsProgress | null;
  onStart: () => void;
}

const ReadingsPanel: React.FC<Props> = ({ progress, onStart }) => (
  <Box
    sx={{
      px: 2,
      py: 1.5,
      borderTop: "1px solid",
      borderColor: "divider",
      flexShrink: 0,
    }}
  >
    <Button
      size="small"
      fullWidth
      variant="contained"
      color="secondary"
      startIcon={<RefreshIcon />}
      onClick={onStart}
      disabled={progress?.status === "running"}
    >
      Обновить показания
    </Button>
    {progress && (
      <Box sx={{ mt: 1 }}>
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
            >
              {progress.processed} / {progress.total}
            </Typography>
          </>
        )}
        {progress.status === "done" && (
          <Alert severity="success" variant="outlined" sx={{ py: 0, mt: 0.5 }}>
            С показаниями: {progress.withReadings}
          </Alert>
        )}
        {progress.status === "error" && (
          <Alert severity="error" variant="outlined" sx={{ py: 0, mt: 0.5 }}>
            {progress.message}
          </Alert>
        )}
      </Box>
    )}
  </Box>
);

export default ReadingsPanel;
