"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeLog = writeLog;
exports.getGeocodeLogFileName = getGeocodeLogFileName;
exports.getReadingsLogFileName = getReadingsLogFileName;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const LOG_DIR = path_1.default.join(process.cwd(), 'logs');
// Гарантируем существование папки logs
async function ensureLogDir() {
    try {
        await promises_1.default.access(LOG_DIR);
    }
    catch {
        await promises_1.default.mkdir(LOG_DIR, { recursive: true });
    }
}
// Общая функция записи в лог (асинхронная, не блокирует выполнение)
async function writeLog(fileName, message) {
    try {
        await ensureLogDir();
        const filePath = path_1.default.join(LOG_DIR, fileName);
        const timestamp = new Date().toISOString();
        await promises_1.default.appendFile(filePath, `[${timestamp}] ${message}\n`);
    }
    catch (err) {
        console.error('Ошибка записи лога:', err);
    }
}
// Генератор имени файла для конкретного планировщика
function getGeocodeLogFileName() {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return `geocoder_${date}.log`;
}
function getReadingsLogFileName() {
    const date = new Date().toISOString().slice(0, 10);
    return `readings_${date}.log`;
}
//# sourceMappingURL=logger.js.map