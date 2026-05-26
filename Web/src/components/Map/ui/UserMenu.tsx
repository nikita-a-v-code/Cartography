import React, { useState } from "react";
import {
  Box,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import { useAuth } from "../../../context/AuthContext";

const UserMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleClose();
  };

  const getRoleLabel = (roleName?: string) => {
    switch (roleName) {
      case "admin":
        return "Администратор";
      case "operator":
        return "Оператор";
      case "viewer":
        return "Просмотр";
      default:
        return roleName || "Пользователь";
    }
  };

  const getRoleColor = (roleName?: string): "error" | "primary" | "default" => {
    switch (roleName) {
      case "admin":
        return "error";
      case "operator":
        return "primary";
      case "viewer":
        return "default";
      default:
        return "default";
    }
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Chip
          label={user.name}
          size="small"
          sx={{
            backgroundColor: "rgba(12, 26, 231, 0.08)",
            fontWeight: 500,
          }}
        />
        <IconButton
          onClick={handleOpen}
          size="small"
          aria-label="account"
          aria-controls="user-menu"
          aria-haspopup="true"
        >
          <PersonIcon />
        </IconButton>
      </Box>

      <Menu
        id="user-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box
          sx={{ px: 2, py: 1, borderBottom: "1px solid #eee", minWidth: 200 }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            Вы вошли как:
          </Typography>
          <Typography variant="body1" fontWeight="bold">
            {user.name}
          </Typography>
          <Chip
            label={getRoleLabel(user.role_name)}
            color={getRoleColor(user.role_name)}
            size="small"
            sx={{ mt: 0.5 }}
          />
        </Box>
        <MenuItem onClick={handleLogout}>
          <LogoutIcon sx={{ mr: 1 }} fontSize="small" />
          Выйти
        </MenuItem>
      </Menu>
    </>
  );
};

export default UserMenu;
