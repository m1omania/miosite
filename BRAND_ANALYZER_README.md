# Анализатор брендинга и визуального стиля

Автоматический инструмент для анализа и извлечения ключевых данных брендинга и визуального стиля веб-сайтов.

## Функционал

Приложение автоматически собирает и сохраняет следующие данные:

1. **Логотип**
   - Favicon сайта
   - Meta логотипы (OG Image, Twitter Image)
   - Изображения логотипов на странице

2. **Цветовая палитра**
   - Доминирующие цвета из изображений (анализ через Vibrant.js)
   - Цвета из CSS и inline-стилей
   - Основные цвета фона, текста и границ

3. **Шрифты**
   - Google Fonts (из ссылок на fonts.googleapis.com)
   - Пользовательские шрифты (@font-face)
   - Системные шрифты

4. **Изображения**
   - Основные изображения с главной страницы
   - Иконки и логотипы
   - Alt-тексты для изображений

5. **Метаданные**
   - Title, Description, Keywords
   - Favicon URL

## Технологии

- **Next.js 14** - React фреймворк
- **TypeScript** - типизация
- **Cheerio** - парсинг HTML/DOM
- **Axios** - HTTP запросы
- **Node-Vibrant** - извлечение цветов из изображений

## Установка

Зависимости уже установлены в проекте. Если нужно переустановить:

```bash
cd frontend
npm install cheerio axios node-vibrant
```

## Использование

### Через веб-интерфейс

1. Откройте страницу `/brand-analyzer`
2. Введите URL сайта (например: `example.com` или `https://example.com`)
3. Нажмите "Анализировать"
4. Просмотрите результаты
5. При необходимости скачайте данные в формате JSON

### Через API

```bash
GET /api/brand-analyzer?url=https://example.com
```

**Пример ответа:**

```json
{
  "url": "https://example.com",
  "metadata": {
    "title": "Example Domain",
    "description": "Example description",
    "keywords": "example, keywords",
    "favicon": "https://example.com/favicon.ico"
  },
  "logo": {
    "favicon": "https://example.com/favicon.ico",
    "metaLogo": "https://example.com/og-image.jpg",
    "imageLogos": ["https://example.com/logo.png"]
  },
  "colors": {
    "dominant": ["#FF5733", "#33FF57"],
    "palette": []
  },
  "fonts": {
    "googleFonts": ["Roboto", "Open Sans"],
    "systemFonts": ["Arial", "Helvetica"],
    "customFonts": ["CustomFont"]
  },
  "images": [
    {
      "url": "https://example.com/image.jpg",
      "alt": "Description",
      "type": "main"
    }
  ],
  "cssStyles": {
    "backgroundColor": ["#ffffff", "#f0f0f0"],
    "color": ["#000000", "#333333"],
    "borderColor": ["#cccccc"]
  }
}
```

## Обработка ошибок

API обрабатывает следующие ошибки:

- **400** - Неверный формат URL или отсутствует параметр `url`
- **404** - Сайт не найден
- **503** - Сайт недоступен (ECONNREFUSED, ENOTFOUND)
- **500** - Ошибка парсинга или обработки

## Структура проекта

```
frontend/
├── app/
│   ├── api/
│   │   └── brand-analyzer/
│   │       └── route.ts          # API endpoint
│   └── brand-analyzer/
│       └── page.tsx              # Страница анализатора
└── components/
    └── BrandAnalyzer.tsx         # Компонент интерфейса
```

## Модульная структура

Код организован в отдельные функции:

- **Валидация URL** - `isValidUrl()`, `normalizeUrl()`
- **Парсинг HTML** - использование Cheerio для извлечения данных
- **Извлечение цветов** - `extractColorsFromCSS()`, `extractColorsFromImage()`
- **Анализ шрифтов** - парсинг Google Fonts, @font-face, системных шрифтов
- **Обработка ошибок** - централизованная обработка всех типов ошибок

## Ограничения

- Анализ ограничен главной страницей сайта
- CSS из внешних файлов анализируется частично (требуется дополнительный запрос)
- Изображения анализируются только если они доступны без CORS ограничений
- Максимум 20 изображений и 20 цветов в результатах

## Разработка

Для запуска в режиме разработки:

```bash
cd frontend
npm run dev
```

Откройте `http://localhost:4000/brand-analyzer`

## Лицензия

Часть проекта miosite.

