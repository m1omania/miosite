# Локальный запуск проекта

## Быстрый старт

### 1. Установка зависимостей (уже выполнено)

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Настройка переменных окружения

Файлы `.env` уже созданы. **Важно**: Добавьте ваш OpenAI API ключ в `backend/.env`:

```env
OPENAI_API_KEY=sk-your-actual-key-here
```

> **Примечание**: Можно запустить без OpenAI ключа - будет работать базовый анализ (HTML/CSS парсинг), но без визуального анализа через Vision API.

### 3. Запуск

Откройте **два терминала**:

#### Терминал 1 - Backend:
```bash
cd backend
npm run dev
```

Backend запустится на `http://localhost:3001`

#### Терминал 2 - Frontend:
```bash
cd frontend
npm run dev
```

Frontend запустится на `http://localhost:3000`

### 4. Проверка

1. Откройте браузер: `http://localhost:3000`
2. Введите URL сайта (например: `example.com`)
3. Нажмите "Проверить сайт"
4. Дождитесь результатов анализа

## Тестирование без OpenAI API

Если у вас нет OpenAI API ключа, проект всё равно будет работать:
- ✅ HTML/CSS парсинг
- ✅ Анализ метрик (шрифты, контраст, CTA)
- ✅ Best practices проверки
- ❌ Визуальный анализ через Vision API (будет пропущен)

## Возможные проблемы

### Puppeteer не устанавливается
Если на macOS, может потребоваться:
```bash
brew install chromium
```

### Порт уже занят
Измените порт в `.env` файлах:
- Backend: `PORT=3002`
- Frontend: в `next.config.js` или через переменную окружения

### Ошибки CORS
Убедитесь, что в `backend/.env` указан правильный `CORS_ORIGIN`:
```
CORS_ORIGIN=http://localhost:3000
```

## Проверка работы API

### Тест health endpoint:
```bash
curl http://localhost:3001/health
```

### Тест аудита (вручную):
```bash
curl -X POST http://localhost:3001/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url": "example.com"}'
```

## Структура базы данных

SQLite база создаётся автоматически при первом запуске в `backend/database.sqlite`.

Для просмотра данных:
```bash
sqlite3 backend/database.sqlite
.tables
SELECT * FROM reports;
```




