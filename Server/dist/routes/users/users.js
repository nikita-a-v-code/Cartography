"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../../config/database"); // отдельный пул для БД пользователей
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_EXPIRES_IN = "7d";
// ============================================================================
// АВТОРИЗАЦИЯ
// ============================================================================
// Логин пользователя
router.post("/login", async (req, res) => {
    try {
        const { login, password } = req.body;
        console.log("Login attempt:", { login, password: "***" });
        if (!login || !password) {
            return res
                .status(400)
                .json({ success: false, error: "Введите логин и пароль" });
        }
        const { rows } = await database_1.usersPool.query(`
      SELECT 
        u.id, 
        u.full_name, 
        u.login, 
        u.role_id,
        r.name as role_name,
        r.description as role_description,
        r.permissions,
        u.is_active
      FROM "Enforce".users u
      LEFT JOIN "Enforce".user_roles r ON u.role_id = r.id
      WHERE u.login = $1 AND u.password = $2
    `, [login, password]);
        console.log("Query result:", rows.length > 0 ? "User found" : "User not found");
        if (!rows[0]) {
            return res
                .status(401)
                .json({ success: false, error: "Неверный логин или пароль" });
        }
        if (!rows[0].is_active) {
            return res
                .status(403)
                .json({ success: false, error: "Учетная запись заблокирована" });
        }
        // Данные пользователя для токена и ответа
        const user = {
            id: rows[0].id,
            name: rows[0].full_name,
            login: rows[0].login,
            role_name: rows[0].role_name,
            permissions: rows[0].permissions,
        };
        // Генерируем JWT токен
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN,
        });
        res.json({
            success: true,
            token,
            user,
        });
    }
    catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ success: false, error: "Ошибка сервера" });
    }
});
// Получить текущего пользователя по токену
router.get("/me", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res
                .status(401)
                .json({ success: false, error: "Токен не предоставлен" });
        }
        const token = authHeader.slice(7);
        // Проверяем токен
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        }
        catch (err) {
            return res
                .status(401)
                .json({ success: false, error: "Недействительный токен" });
        }
        // Получаем данные пользователя из БД
        const { rows } = await database_1.usersPool.query(`
      SELECT 
        u.id, 
        u.full_name, 
        u.login, 
        u.role_id,
        r.name as role_name,
        r.permissions,
        u.is_active
      FROM "Enforce".users u
      LEFT JOIN "Enforce".user_roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [decoded.userId]);
        if (!rows[0]) {
            return res
                .status(401)
                .json({ success: false, error: "Пользователь не найден" });
        }
        if (!rows[0].is_active) {
            return res
                .status(403)
                .json({ success: false, error: "Учетная запись заблокирована" });
        }
        const user = {
            id: rows[0].id,
            name: rows[0].full_name,
            login: rows[0].login,
            role_name: rows[0].role_name,
            permissions: rows[0].permissions,
        };
        res.json({ success: true, user });
    }
    catch (error) {
        console.error("Ошибка получения пользователя:", error);
        res.status(500).json({ success: false, error: "Ошибка сервера" });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map