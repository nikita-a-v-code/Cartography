import fs from 'fs/promises';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');

// Гарантируем существование папки logs
async function ensureLogDir() {
  try {
    await fs.access(LOG_DIR);
  } catch {
    await fs.mkdir(LOG_DIR, { recursive: true });
  }
}

// Общая функция записи в лог (асинхронная, не блокирует выполнение)
export async function writeLog(fileName: string, message: string): Promise<void> {
  try {
    await ensureLogDir();
    const filePath = path.join(LOG_DIR, fileName);
    const timestamp = new Date().toISOString();
    await fs.appendFile(filePath, `[${timestamp}] ${message}\n`);
  } catch (err) {
    console.error('Ошибка записи лога:', err);
  }
}

// Генератор имени файла для конкретного планировщика
export function getGeocodeLogFileName(): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `geocoder_${date}.log`;
}

export function getReadingsLogFileName(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `readings_${date}.log`;
}