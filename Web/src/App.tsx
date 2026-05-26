// Корневой компонент приложения.
// Настраивает тему MUI (Material UI) и рендерит компонент карты.
import React from "react";
import { ThemeProvider, createTheme, CssBaseline, CircularProgress, Box } from "@mui/material";
import { AppBar } from "@mui/material";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MapComponent from "./components/Map/Map";
import Login from "./page/Login/Login"
import { AuthProvider, useAuth } from "./context/AuthContext";
import "./App.css"

// Единая тема MUI для всего приложения
const theme = createTheme({
  palette: {
    primary: {
      main: "#2c3e50",
    },
    secondary: {
      main: "#3498db",
    },
  },
});

// Компонент для защиты роутов только для админа
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin } = useAuth();

  if (!isAdmin()) {
    return <Navigate to="/" replace />;
  }

   return <>{children}</>;
};

// Компонент для защиты роутов
const AppContent: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  // Показываем загрузку пока проверяем авторизацию
  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #263238 0%, #0d90d1 50%, #263238 100%)",
        }}
      >
        <CircularProgress size={60} sx={{ color: "#ffc107" }} />
      </Box>
    );
  }

  // Если не авторизован - показываем страницу входа
  if (!isAuthenticated) {
    return <Login />;
  }

  
  return (
    <Box className="app">
      <Box component="main" className="app-main">
        <MapComponent />
      </Box>
    </Box>
  );
};

// Если авторизован - показываем приложение
const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
        <AuthProvider>
            <BrowserRouter>
     <AppContent />
      </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
