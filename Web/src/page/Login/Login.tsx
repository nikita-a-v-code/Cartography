// Компонент страницы входа в систему
import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
} from "@mui/material";
import { Visibility, VisibilityOff, Login as LoginIcon } from "@mui/icons-material";
import { useAuth } from "../../context/AuthContext"

// Тип для формы входа
interface LoginFormData {
  login: string;
  password: string;
}

const Login: React.FC = () => {
  // Получаем функцию входа из контекста аутентификации
  const { login } = useAuth();
  // Состояние для данных формы (логин и пароль)
  const [formData, setFormData] =  useState<LoginFormData>({ login: "", password: "" });
  // Состояние для показа/скрытия пароля
  const [showPassword, setShowPassword] = useState<boolean>(false);
  // Состояние для сообщения об ошибке
  const [error, setError] = useState<string>("");
  // Состояние загрузки (для индикатора)
  const [loading, setLoading] = useState<boolean>(false);

  // Обработчик изменения полей
  const handleChange = (field: keyof LoginFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  // Обработчик отправки формы
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.login.trim() || !formData.password.trim()) {
      setError("Введите логин и пароль");
      return;
    }

    // Устанавливаем загрузку и очищаем ошибки
    setLoading(true);
    setError("");

    // Вызываем функцию входа из контекста
    const result = await login(formData.login, formData.password);

    setLoading(false);

    // Если вход неудачен, показываем ошибку
    if (!result.success) {
      setError(result.error || "Ошибка авторизации");
    }
  };

  // Нажимаем на войти помимо мышки - клавиша Enter
  const handleKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #263238 0%, #19ad19 50%, #263238 100%)",
        padding: 2,
      }}
    >
      {/* Карточка формы входа */}
      <Card
        sx={{
          maxWidth: 400,
          width: "100%",
          borderRadius: 3,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          border: "2px solid #ffc107",
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Заголовок и подзаголовок */}
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: "bold",
                background: "linear-gradient(45deg, #263238, #0d90d1)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                mb: 1,
              }}
            >
              Модуль Картографии
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Войдите в систему для продолжения
            </Typography>
          </Box>

          {/* Сообщение об ошибке, если есть */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Форма входа */}
          <form onSubmit={handleSubmit}>
            {/* Поле логина */}
            <TextField
              fullWidth
              label="Логин"
              variant="outlined"
              value={formData.login}
              onChange={handleChange("login")}
              onKeyPress={handleKeyPress}
              disabled={loading}
              sx={{ mb: 2 }}
              autoFocus
            />

            {/* Поле пароля с кнопкой показа */}
            <TextField
              fullWidth
              label="Пароль"
              variant="outlined"
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={handleChange("password")}
              onKeyPress={handleKeyPress}
              disabled={loading}
              sx={{ mb: 3 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* Кнопка входа */}
            <Button
              fullWidth
              variant="contained"
              size="large"
              type="submit"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
              sx={{
                py: 1.5,
                background: "linear-gradient(45deg, #263238 0%, #0d90d1 100%)",
                "&:hover": {
                  background: "linear-gradient(45deg, #37474f 0%, #1e9ad6 100%)",
                },
              }}
            >
              {loading ? "Вход..." : "Войти"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Login;
