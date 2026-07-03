// Главный компонент-оркестратор.
// Управляет навигацией между разделами приложения: карта, события, администратор.
// Содержит Sidebar и рендерит нужный раздел поверх карты (overlay).
// Map всегда остаётся в DOM чтобы Leaflet не пересоздавался.
import React, { useState } from "react";
import { Box, Typography } from "@mui/material";
import { useAuth } from "../context/AuthContext";
import Sidebar, { AppSection } from "./common/Sidebar/Sidebar";
import MapComponent from "./Map/Map";
import AdminPanel from "./Map/ui/AdminPanel";

const MainLayout: React.FC = () => {
  const { isAdmin } = useAuth();
  const canAdminAccess = isAdmin();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<AppSection>("map");

  const handleSectionChange = (s: AppSection) => {
    setActiveSection(s);
    setSidebarOpen(false);
  };

  return (
    <Box sx={{ height: "100%", position: "relative", overflow: "hidden" }}>
      {/* Боковая навигация (шторка) */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        canAdminAccess={canAdminAccess}
      />

      {/* Карта — всегда в DOM чтобы Leaflet не пересоздавался */}
      <MapComponent
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      {/* Раздел «События» — overlay поверх карты */}
      {activeSection === "events" && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            bgcolor: "#fafafa",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <Box sx={{ fontSize: 64, lineHeight: 1 }}>📅</Box>
          <Typography variant="h5" fontWeight={600} color="text.secondary">
            Раздел «События»
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Этот раздел находится в разработке
          </Typography>
        </Box>
      )}

      {/* Панель администратора — overlay поверх всего */}
      <AdminPanel
        open={activeSection === "admin"}
        onClose={() => setActiveSection("map")}
      />
    </Box>
  );
};

export default MainLayout;
