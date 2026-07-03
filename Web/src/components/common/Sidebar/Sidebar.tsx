// Боковая навигационная панель (шторка).
// Открывается по кнопке ☰ в тулбаре.
// Содержит 3 раздела: Карта, События, Администратор (только для admin).
import React from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import MapIcon from "@mui/icons-material/Map";
import EventNoteIcon from "@mui/icons-material/EventNote";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";

export type AppSection = "map" | "events" | "admin";

interface NavItem {
  id: AppSection;
  label: string;
  description: string;
  icon: React.ReactNode;
  adminOnly: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "map",
    label: "Работа с картой",
    description: "Карта счётчиков с фильтрами",
    icon: <MapIcon />,
    adminOnly: false,
  },
  {
    id: "events",
    label: "События",
    description: "Журнал событий системы",
    icon: <EventNoteIcon />,
    adminOnly: false,
  },
  {
    id: "admin",
    label: "Администратор",
    description: "Настройки приложения",
    icon: <AdminPanelSettingsIcon />,
    adminOnly: true,
  },
];

const DRAWER_WIDTH = 260;

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  activeSection: AppSection;
  onSectionChange: (section: AppSection) => void;
  canAdminAccess: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  open,
  onClose,
  activeSection,
  onSectionChange,
  canAdminAccess,
}) => {
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || canAdminAccess);

  const handleClick = (sectionId: AppSection) => {
    onSectionChange(sectionId);
    onClose();
  };

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      sx={{
        [`& .MuiDrawer-paper`]: {
          width: DRAWER_WIDTH,
          boxSizing: "border-box",
        },
      }}
    >
      {/* Шапка */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          bgcolor: "primary.main",
          color: "white",
        }}
      >
        <Typography variant="subtitle1" fontWeight={700}>
          Картография
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.75 }}>
          Выберите раздел
        </Typography>
      </Box>

      <Divider />

      {/* Навигационные пункты */}
      <List sx={{ pt: 1, px: 0.5 }}>
        {items.map((item) => (
          <ListItemButton
            key={item.id}
            selected={activeSection === item.id}
            onClick={() => handleClick(item.id)}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              "&.Mui-selected": {
                bgcolor: "primary.main",
                color: "white",
                "& .MuiListItemIcon-root": { color: "white" },
                "& .MuiListItemText-secondary": {
                  color: "rgba(255,255,255,0.7)",
                },
                "&:hover": { bgcolor: "primary.dark" },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 42 }}>{item.icon}</ListItemIcon>
            <ListItemText
              primary={item.label}
              secondary={item.description}
              primaryTypographyProps={{
                fontWeight: activeSection === item.id ? 600 : 400,
                fontSize: "0.9rem",
              }}
              secondaryTypographyProps={{ fontSize: "0.75rem" }}
            />
          </ListItemButton>
        ))}
      </List>
    </Drawer>
  );
};

export default Sidebar;
