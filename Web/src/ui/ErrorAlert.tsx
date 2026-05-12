// Адаптированный компонент отображения ошибок для веб-интерфейса картографии.
// Включает диагностику типов ошибок, советы по решению и технические детали.
import React, { useState } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Collapse,
  Typography,
  Stack,
} from "@mui/material";
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from "@mui/icons-material";

interface ErrorAlertProps {
  /** Ошибка: строка, Error объект или null */
  error: string | Error | null;
  /** Функция повтора запроса (если null, кнопка не показывается) */
  onRetry?: () => void;
  /** Заголовок алерта */
  title?: string;
  /** Показывать ли кнопку для расширения технических деталей */
  showDetails?: boolean;
  /** Дополнительные CSS классы */
  className?: string;
}

interface ErrorInfo {
  type: "network" | "notFound" | "server" | "unknown";
  userMessage: string;
  suggestion: string;
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({
  error,
  onRetry,
  title = "Ошибка загрузки данных",
  showDetails = true,
  className = "",
}) => {
  const [showFullError, setShowFullError] = useState(false);

  if (!error) return null;

  const getErrorMessage = (err: string | Error): string => {
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message;
    return "Неизвестная ошибка";
  };

  const getErrorType = (err: string | Error): ErrorInfo => {
    const message = getErrorMessage(err);

    if (
      message.includes("Failed to fetch") ||
      message.includes("NetworkError") ||
      message.includes("fetch failed")
    ) {
      return {
        type: "network",
        userMessage:
          "Не удается подключиться к серверу. Проверьте подключение к интернету.",
        suggestion: "Убедитесь, что сервер запущен на localhost:6002.",
      };
    }

    if (message.includes("404")) {
      return {
        type: "notFound",
        userMessage: "Запрашиваемый ресурс не найден.",
        suggestion: "Проверьте настройки API.",
      };
    }

    if (message.includes("500")) {
      return {
        type: "server",
        userMessage: "Внутренняя ошибка сервера.",
        suggestion: "Обратитесь к администратору или повторите позже.",
      };
    }

    return {
      type: "unknown",
      userMessage: message,
      suggestion: "Попробуйте обновить страницу или повторить операцию.",
    };
  };

  const errorInfo = getErrorType(error);

  return (
    <Alert
      severity="error"
      className={`error-alert ${className}`}
      sx={{
        mb: 2,
      }}
      action={
        onRetry && (
          <Button
            color="inherit"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={onRetry}
            sx={{ whiteSpace: "nowrap" }}
          >
            Повторить
          </Button>
        )
      }
    >
      <AlertTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <ErrorIcon />
        {title}
      </AlertTitle>

      <Stack spacing={1}>
        <Typography variant="body2">{errorInfo.userMessage}</Typography>

        <Typography
          variant="caption"
          sx={{
            opacity: 0.9,
            display: "block",
          }}
        >
          💡 {errorInfo.suggestion}
        </Typography>

        {showDetails && (
          <Box>
            <Button
              size="small"
              onClick={() => setShowFullError(!showFullError)}
              startIcon={
                showFullError ? <ExpandLessIcon /> : <ExpandMoreIcon />
              }
              sx={{
                p: 0,
                minWidth: "auto",
                mt: 1,
                color: "inherit",
                textDecoration: "underline",
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                },
              }}
            >
              Технические детали
            </Button>

            <Collapse in={showFullError}>
              <Box
                sx={{
                  mt: 1,
                  p: 1,
                  backgroundColor: "rgba(0, 0, 0, 0.2)",
                  borderRadius: 1,
                  fontFamily: "monospace",
                  fontSize: "0.7rem",
                  wordBreak: "break-word",
                  color: "inherit",
                  maxHeight: "200px",
                  overflowY: "auto",
                }}
              >
                {getErrorMessage(error)}
              </Box>
            </Collapse>
          </Box>
        )}
      </Stack>
    </Alert>
  );
};

export default ErrorAlert;
