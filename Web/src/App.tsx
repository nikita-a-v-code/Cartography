import React from "react";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { AppBar, Toolbar, Typography, Box } from "@mui/material";
import MapIcon from "@mui/icons-material/Map";
import MapComponent from "./components/Map";
import "./App.css";

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
        <AppBar position="static">
          <Toolbar>
            <MapIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="h1">
              Cartography
            </Typography>
          </Toolbar>
        </AppBar>
        <Box component="main" className="app-main">
          <MapComponent />
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;
