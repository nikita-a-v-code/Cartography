import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:6002"

export type UserRole = "admin" | "operator" | "viewer";

// Интерфейс пользователя (поля, которые приходят с сервера)
export interface User {
  id: number | string;
  name: string;
  role?: UserRole;
  role_name?: UserRole; // возможно, поле role_name как в коде
  permissions?: {
    all?: boolean;
    [key: string]: boolean | undefined;
  };
  // другие возможные поля (email, created_at и т.д.)
}

// Тип ответа при проверке авторизации
interface CurrentUserResponse {
  success: boolean;
  user?: User;
  error?: string;
}

// Тип ответа при логине
interface LoginResponse {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
}

// Тип значения контекста
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (loginValue: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  isAdmin: () => boolean;
  isOperator: () => boolean;
  isViewer: () => boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Кастомный хук
export const useAuth = (): AuthContextType => {
  // Реакт хук
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

// --- Провайдер ---
interface AuthProviderProps {
  children: ReactNode;
}

// Хранит состояние авторизации
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);;

  // При загрузке проверяем токен и получаем данные пользователя с сервера
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("auth_token");

      if (!token) {
        setLoading(false);
        return;
      }

       try {
        const response = await fetch(`${API_BASE}/api/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const data: CurrentUserResponse = await response.json();

        if (response.ok && data.success && data.user) {
          setUser(data.user);
        } else {
          // Токен недействителен – удаляем
          localStorage.removeItem("auth_token");
        }
      } catch (error) {
        console.error("Auth check error:", error);
        localStorage.removeItem("auth_token");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);
  
  // Функция входа
   const login = async (loginValue: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: loginValue, password }),
      });

      const data: LoginResponse = await response.json();

      if (response.ok && data.success && data.token && data.user) {
        localStorage.setItem("auth_token", data.token);
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: data.error || "Ошибка авторизации" };
      }
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "Ошибка подключения к серверу" };
    }
  };

  // Функция выхода
  const logout = (): void => {
    setUser(null);
    localStorage.removeItem("auth_token");
  };

  // Проверка прав доступа из базы данных
 const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.permissions?.all) return true;
    return user.permissions?.[permission] === true;
  };

  // Проверка роли
  const isAdmin = (): boolean => user?.role_name === "admin";
  const isOperator = (): boolean => user?.role_name === "operator";
  const isViewer = (): boolean => user?.role_name === "viewer";
  const isAuthenticated = !!user;

   const value: AuthContextType = {
    user, // { id, name, role, permissions... } или null
    loading, // true/false - идет проверка авторизации
    login, // функция для входа
    logout, // функция для выхода
    hasPermission, // проверка прав доступа
    isAdmin, // проверка роли
    isOperator, // проверка роли
    isViewer, // проверка роли
    isAuthenticated
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
