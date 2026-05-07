// Корневой компонент приложения.
// Настраивает тему MUI (Material UI) и рендерит компонент карты.
import React from "react";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { AppBar, Toolbar, Typography, Box } from "@mui/material";
import MapIcon from "@mui/icons-material/Map";
import MapComponent from "./components/Map/Map";
import "./App.css";

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

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box className="app">
        <AppBar position="static"></AppBar>
        <Box component="main" className="app-main">
          <MapComponent />
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;
