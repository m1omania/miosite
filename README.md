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

### Vercel (Frontend) ✅

1. Подключите репозиторий к Vercel: https://vercel.com
2. Выберите папку `frontend` как Root Directory
3. Установите переменные окружения:
   - `NEXT_PUBLIC_API_URL` - URL вашего backend на Render (например: `https://ux-audit-backend.onrender.com`)
4. Деплой автоматический при push в main

**Настройки Vercel:**
- Framework Preset: Next.js
- Root Directory: `frontend`
- Build Command: `npm run build` (автоматически)
- Output Directory: `.next` (автоматически)

### Render (Backend) ✅

1. Создайте новый Web Service на Render: https://render.com
2. Подключите репозиторий GitHub
3. Настройки:
   - **Name:** `ux-audit-backend`
   - **Environment:** Node
   - **Build Command:** `cd backend && npm install && PUPPETEER_SKIP_DOWNLOAD=false PUPPETEER_CACHE_DIR=/opt/render/project/src/backend/.local-chromium npx puppeteer browsers install chrome && npm run build`
   - **Start Command:** `cd backend && npm start`
   - **Plan:** Free (или выберите нужный)
4. Установите переменные окружения:
   - `NODE_ENV=production`
   - `PORT=10000` (Render автоматически устанавливает PORT, но можно указать явно)
   - `PUPPETEER_CACHE_DIR=/opt/render/project/src/backend/.local-chromium` (важно для работы Chrome)
   - `OPENAI_API_KEY` - ваш ключ OpenAI (опционально)
   - `HUGGINGFACE_API_KEY` - ваш токен Hugging Face (опционально, но рекомендуется)
   - `CORS_ORIGIN` - URL вашего frontend на Vercel (например: `https://your-app.vercel.app`)
   - `DATABASE_PATH=/opt/render/project/src/database.sqlite` (для Render)

**Важно:**
- После деплоя backend получит URL вида: `https://ux-audit-backend.onrender.com`
- Обновите `NEXT_PUBLIC_API_URL` в Vercel на этот URL
- Render может "засыпать" на free плане после 15 минут бездействия (первый запрос будет медленным)

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



