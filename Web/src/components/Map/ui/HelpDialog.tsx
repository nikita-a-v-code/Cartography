import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Table,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  Alert,
} from "@mui/material";
import { API_BASE } from "../utils/mapUtils";

interface ConfigData {
  port: string;
  enableGeocoder: boolean;
  enableReadings: boolean;
  geocoder: {
    cron: string;
    batchSizeShedule: number;
    batchSizeHandle: number;
    retryDays: number;
  };
  readings: {
    cron: string;
    batchSize: number;
  };
}

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

const HelpDialog: React.FC<HelpDialogProps> = ({ open, onClose }) => {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch(`${API_BASE}/api/config`)
        .then((res) => {
          if (!res.ok) throw new Error("Ошибка загрузки настроек");
          return res.json();
        })
        .then((data) => setConfig(data))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>📖 Справка по работе с картой</DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Не удалось загрузить настройки сервера: {error}
          </Alert>
        )}
        {config && (
          <>
            <Typography variant="h6" gutterBottom>
              🗺️ Основные возможности
            </Typography>
            <Typography paragraph>
              • <strong>Фильтрация точек</strong> – по населённым пунктам, типу
              УСПД, модели счётчика и статусу показаний.
              <br />• <strong>Ручное добавление УСПД</strong> – нажмите
              «Добавить УСПД», затем кликните на карту.
              <br />• <strong>Обновление показаний</strong> – кнопка в панели
              инструментов запускает синхронизацию с БД.
              <br />• <strong>Кластеры</strong> – точки группируются при
              отдалении, у крупных кластеров отображается название населённого
              пункта.
              <br />• <strong>Маркеры</strong>: зелёные (актуальные показания),
              красные (устаревшие), серые (нет показаний).
            </Typography>

            <Typography variant="h6" gutterBottom>
              ⚙️ Настройки сервера (текущие)
            </Typography>
            <Table size="small" sx={{ mb: 2 }}>
              <TableBody>
                <TableRow>
                  <TableCell component="th" scope="row">
                    Порт сервера
                  </TableCell>
                  <TableCell>{config.port}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    Геокодер (включён)
                  </TableCell>
                  <TableCell>
                    {config.enableGeocoder ? "✅ Да" : "❌ Нет"}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    Расписание геокодера
                  </TableCell>
                  <TableCell>
                    <code>{config.geocoder.cron}</code> (каждые 3 дня в 03:00)
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    Батч геокодера по раписанию
                  </TableCell>
                  <TableCell>
                    {config.geocoder.batchSizeShedule} адресов за запуск
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    Повтор неудачных адресов
                  </TableCell>
                  <TableCell>каждые {config.geocoder.retryDays} дней</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    Батч ручного геокодирования
                  </TableCell>
                  <TableCell>
                    {config.geocoder.batchSizeHandle} адресов за запуск
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    Планировщик показаний (включён)
                  </TableCell>
                  <TableCell>
                    {config.enableReadings ? "✅ Да" : "❌ Нет"}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    Расписание чтения показаний
                  </TableCell>
                  <TableCell>
                    <code>{config.readings.cron}</code> (каждые 3 дня в 02:00)
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    Батч чтения показаний
                  </TableCell>
                  <TableCell>
                    {config.readings.batchSize} записей за SQL-запрос
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              💡 Примечание: настройки хранятся в файле <code>.env</code> на
              сервере. Для изменения параметров обратитесь к администратору.
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
};

export default HelpDialog;
