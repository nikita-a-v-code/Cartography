import * as React from "react";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import UnsavedChangesDialog from "../../../../ui/UnsavedChangesDialog";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import DescriptionIcon from "@mui/icons-material/Description";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import { useAuth } from "../../../../context/AuthContext";

export default function NavigationSections({ showAsSidebar = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetRoute, setTargetRoute] = useState("");

  const allSections = [
    {
      title: "Заполнение по разделам",
      subtitle: "Множественное заполнение по шагам",
      description: "Пошаговое заполнение всех разделов для нескольких точек учета",
      icon: <AccountTreeIcon sx={{ fontSize: 40 }} />,
      route: "/SectionFilling",
      color: "#2196f3",
      adminOnly: false,
    },
    {
      title: "Заполнение единой карточки",
      subtitle: "Одна форма для всех данных",
      description: "Заполнение всех данных о точке учета на одной странице",
      icon: <DescriptionIcon sx={{ fontSize: 40 }} />,
      route: "/SingleFilling",
      color: "#ff9800",
      adminOnly: false,
    },
    {
      title: "Импорт Excel файла",
      subtitle: "Проверка и валидация",
      description: "Загрузка и проверка данных из Excel файла",
      icon: <UploadFileIcon sx={{ fontSize: 40 }} />,
      route: "/ImportExcel",
      color: "#4caf50",
      adminOnly: false,
    },
    {
      title: "Панель Администратора",
      subtitle: "Управление справочниками",
      description: "Добавление, изменение и удаление справочных данных",
      icon: <AdminPanelSettingsIcon sx={{ fontSize: 40 }} />,
      route: "/AdminPanel",
      color: "#9c27b0",
      adminOnly: true, // Только для админа
    },
  ];

  // Фильтруем разделы по ролям
  const sections = allSections.filter((section) => !section.adminOnly || isAdmin());

  const handleCardClick = (route) => {
    // Проверяем, есть ли несохраненные данные
    const hasUnsavedChanges = checkForUnsavedChanges();

    if (hasUnsavedChanges && location.pathname !== route) {
      setTargetRoute(route);
      setDialogOpen(true);
    } else {
      navigate(route);
    }
  };

  const checkForUnsavedChanges = () => {
    // Проверяем localStorage на наличие несохраненных данных
    const formData = localStorage.getItem("unsavedFormData");
    const hasFormInputs = document.querySelectorAll("input, textarea, select").length > 0;

    // Возвращаем true если есть данные в localStorage или заполненные поля
    return formData || hasFormInputs;
  };

  const handleConfirmNavigation = () => {
    setDialogOpen(false);
    // Очищаем несохраненные данные
    localStorage.removeItem("unsavedFormData");
    navigate(targetRoute);
  };

  const handleCancelNavigation = () => {
    setDialogOpen(false);
    setTargetRoute("");
  };

  if (showAsSidebar) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 3, textAlign: "center", fontWeight: "bold", fontSize: "14px" }}>
          Способ заполнения
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {sections.map((section, index) => {
            const isActive = location.pathname === section.route;
            return (
              <Button
                key={index}
                variant={isActive ? "contained" : "outlined"}
                onClick={() => handleCardClick(section.route)}
                sx={{
                  height: 80,
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 1,
                  borderColor: section.color,
                  backgroundColor: isActive ? section.color : "transparent",
                  color: isActive ? "white" : section.color,
                  "&:hover": {
                    borderColor: section.color,
                    backgroundColor: isActive ? section.color : `${section.color}15`,
                    transform: "scale(1.02)",
                  },
                  transition: "all 0.2s ease",
                }}
              >
                <Box sx={{ color: isActive ? "white" : section.color }}>
                  {React.cloneElement(section.icon, { sx: { fontSize: 24 } })}
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: "medium",
                    textAlign: "center",
                    lineHeight: 1.2,
                    fontSize: "11px",
                  }}
                >
                  {section.title}
                </Typography>
              </Button>
            );
          })}
        </Box>

        <UnsavedChangesDialog
          open={dialogOpen}
          onConfirm={handleConfirmNavigation}
          onCancel={handleCancelNavigation}
          targetRoute={targetRoute}
        />
      </Box>
    );
  }
}
