# UX Audit MVP Service

Веб-сервис для автоматического UX-аудита сайтов с анализом через Puppeteer и OpenAI Vision API.

## Возможности

- ✅ Автоматический анализ UX/UI проблем на главной странице сайта
- ✅ Проверка типографики, контрастности, CTA, скорости загрузки
- ✅ Генерация персонализированных отчётов с рекомендациями
- ✅ Форма сбора заявок на дизайн-доработки
- ✅ JS-виджет для встраивания на сайты партнёров

## Структура проекта

```
miosite/
├── frontend/          # Next.js приложение
├── backend/           # Express API
├── shared/            # Общие типы
└── widget/            # JS виджет для партнёров
```

## Установка

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Заполните OPENAI_API_KEY в .env
npm run dev
```

Backend запустится на `http://localhost:3001`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Установите NEXT_PUBLIC_API_URL=http://localhost:3001
npm run dev
```

Frontend запустится на `http://localhost:3000`

## Конфигурация

### Backend (.env)

```env
PORT=3001
NODE_ENV=development
OPENAI_API_KEY=your_openai_api_key_here
DATABASE_PATH=./database.sqlite
CORS_ORIGIN=http://localhost:3000
```

### Frontend (.env)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## API Endpoints

### POST /api/audit

Запуск анализа сайта.

**Request:**
```json
{
  "url": "example.com"
}
```

**Response:**
```json
{
  "reportId": "uuid",
  "report": { ... }
}
```

### GET /api/report/:id

Получение сохранённого отчёта.

### POST /api/leads

Сохранение заявки на доработку.

**Request:**
```json
{
  "reportId": "uuid",
  "name": "Иван Иванов",
  "phone": "+79991234567",
  "email": "ivan@example.com",
  "comment": "Нужна помощь с дизайном"
}
```

## Деплой

### Vercel (Frontend)

1. Подключите репозиторий к Vercel
2. Установите переменную окружения `NEXT_PUBLIC_API_URL`
3. Деплой автоматический при push в main

### Render (Backend)

1. Создайте новый Web Service
2. Подключите репозиторий
3. Build Command: `cd backend && npm install && npm run build`
4. Start Command: `cd backend && npm start`
5. Установите переменные окружения:
   - `OPENAI_API_KEY`
   - `CORS_ORIGIN` (URL вашего frontend)
   - `DATABASE_PATH` (по умолчанию `./database.sqlite`)

## Разработка

### Запуск в режиме разработки

Backend:
```bash
cd backend
npm run dev
```

Frontend:
```bash
cd frontend
npm run dev
```

### Сборка для продакшена

Backend:
```bash
cd backend
npm run build
npm start
```

Frontend:
```bash
cd frontend
npm run build
npm start
```

## Зависимости

### Backend
- Express - веб-сервер
- Puppeteer - скриншоты и парсинг
- OpenAI - Vision API
- SQLite - база данных
- TypeScript

### Frontend
- Next.js 14
- React 18
- Tailwind CSS

## Лицензия

MIT



