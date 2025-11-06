import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../database.sqlite');
let dbInstance = null;
function getDatabase() {
    if (!dbInstance) {
        dbInstance = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err);
                throw err;
            }
            console.log('Connected to SQLite database');
        });
    }
    return {
        run: promisify(dbInstance.run.bind(dbInstance)),
        get: promisify(dbInstance.get.bind(dbInstance)),
        all: promisify(dbInstance.all.bind(dbInstance)),
        close: promisify(dbInstance.close.bind(dbInstance)),
    };
}
export async function initDatabase() {
    const db = getDatabase();
    // Create reports table
    await db.run(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      report_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Create leads table
    await db.run(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES reports(id)
    )
  `);
    // Create best_practices table (for future expansion)
    await db.run(`
    CREATE TABLE IF NOT EXISTS best_practices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      rule TEXT NOT NULL,
      severity TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Insert default best practices if table is empty
    const existing = await db.get('SELECT COUNT(*) as count FROM best_practices');
    if (existing && existing.count === 0) {
        const defaultPractices = [
            { category: 'typography', rule: 'Минимальный размер шрифта должен быть не менее 12px', severity: 'error' },
            { category: 'typography', rule: 'Рекомендуемый размер основного текста: 16px', severity: 'warning' },
            { category: 'contrast', rule: 'Контрастность текста должна соответствовать WCAG AA (4.5:1)', severity: 'error' },
            { category: 'cta', rule: 'На странице должна быть хотя бы одна CTA кнопка', severity: 'warning' },
            { category: 'performance', rule: 'Время загрузки страницы должно быть менее 3 секунд', severity: 'warning' },
            { category: 'responsive', rule: 'Сайт должен иметь viewport meta тег для адаптивности', severity: 'error' },
            { category: 'seo', rule: 'Страница должна иметь title тег', severity: 'warning' },
        ];
        for (const practice of defaultPractices) {
            await db.run('INSERT INTO best_practices (category, rule, severity) VALUES (?, ?, ?)', [practice.category, practice.rule, practice.severity]);
        }
    }
    console.log('Database initialized');
    return db;
}
export function getDb() {
    return getDatabase();
}
//# sourceMappingURL=db.js.map