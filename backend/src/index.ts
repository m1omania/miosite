import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import auditRoutes from './routes/audit.js';
import reportRoutes from './routes/report.js';
import leadsRoutes from './routes/leads.js';
import { initDatabase } from '../database/db.js';

dotenv.config();

console.log('🚀 Запуск сервера...');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'не установлен');
console.log('   PORT:', process.env.PORT || 'не установлен (будет использован 4001)');
console.log('   CORS_ORIGIN:', process.env.CORS_ORIGIN || 'не установлен (будут использованы значения по умолчанию)');
console.log('   HUGGINGFACE_API_KEY:', process.env.HUGGINGFACE_API_KEY ? 'установлен (' + process.env.HUGGINGFACE_API_KEY.substring(0, 10) + '...)' : 'не установлен');
console.log('   OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'установлен' : 'не установлен');

// Initialize database on startup
initDatabase().catch((error) => {
  console.error('❌ Ошибка при инициализации базы данных:', error);
  // Не останавливаем сервер, база данных инициализируется при первом запросе
});

const app = express();
const PORT = parseInt(process.env.PORT || '4001', 10);

// CORS configuration - поддерживает несколько origins
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:4000', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Разрешаем запросы без origin (например, Postman, curl)
    if (!origin) return callback(null, true);
    
    // Проверяем, есть ли origin в списке разрешенных
    if (allowedOrigins.includes(origin) || allowedOrigins.some(allowed => origin?.includes(allowed))) {
      callback(null, true);
    } else {
      // Для разработки разрешаем все vercel.app и localhost
      if (origin.includes('vercel.app') || origin.includes('localhost')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Увеличиваем лимит размера тела запроса для загрузки изображений (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/audit', auditRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/leads', leadsRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Обработка ошибок при запуске сервера
// Явно указываем 0.0.0.0, чтобы сервер был доступен извне (не только localhost)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   External access: http://0.0.0.0:${PORT}/health`);
}).on('error', (error: any) => {
  console.error('❌ Ошибка при запуске сервера:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`   Порт ${PORT} уже занят. Попробуйте использовать другой порт.`);
  }
  process.exit(1);
});

// Обработка необработанных ошибок
process.on('uncaughtException', (error) => {
  console.error('❌ Необработанное исключение:', error);
  // Не завершаем процесс, чтобы сервер продолжал работать
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Необработанный rejection:', reason);
  console.error('   Promise:', promise);
  // Не завершаем процесс, чтобы сервер продолжал работать
});

