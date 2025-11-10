# Инструкция по встраиванию UX Audit Widget

## Быстрый старт

1. Создайте контейнер для виджета на вашей странице:
```html
<div id="ux-audit-widget"></div>
```

2. Подключите скрипт виджета:
```html
<script src="https://your-domain.com/widget/widget.js"
        data-api-url="https://your-api-domain.com"></script>
```

## Кастомизация

Все настройки виджета задаются через data-атрибуты в теге `<script>`:

### Доступные параметры

| Атрибут | Описание | По умолчанию |
|---------|----------|--------------|
| `data-api-url` | URL вашего API сервера | `http://localhost:3001` |
| `data-button-color` | Цвет кнопки (HEX) | `#3b82f6` |
| `data-button-text` | Текст кнопки | `Проверить UX сайта` |
| `data-text-color` | Цвет текста кнопки (HEX) | `#ffffff` |
| `data-container-id` | ID контейнера для виджета | `ux-audit-widget` |

### Примеры

#### Базовое использование

```html
<div id="ux-audit-widget"></div>
<script src="https://your-domain.com/widget/widget.js"
        data-api-url="https://api.yourdomain.com"></script>
```

#### С кастомными цветами

```html
<div id="ux-audit-widget"></div>
<script src="https://your-domain.com/widget/widget.js"
        data-api-url="https://api.yourdomain.com"
        data-button-color="#ff6b6b"
        data-button-text="Проверить мой сайт"
        data-text-color="#ffffff"></script>
```

#### С кастомным контейнером

```html
<div id="my-custom-widget"></div>
<script src="https://your-domain.com/widget/widget.js"
        data-api-url="https://api.yourdomain.com"
        data-container-id="my-custom-widget"></script>
```

## Что показывает виджет

1. **Форма ввода URL** - пользователь вводит адрес сайта для анализа
2. **Результаты анализа** - метрики, проблемы, рекомендации
3. **Форма заявки** - сбор контактов для дальнейшей работы

## API требования

Виджет ожидает следующие эндпоинты на вашем API:

- `POST /api/audit` - запуск анализа
- `POST /api/leads` - сохранение заявки

См. документацию API в `README.md`.

## Стилизация

Виджет использует встроенные стили и не требует дополнительных CSS файлов. Все стили применяются автоматически через JavaScript.

При необходимости вы можете переопределить стили через CSS:

```css
.ux-audit-widget-form {
  /* Ваши стили */
}

.ux-audit-results {
  /* Ваши стили */
}
```

## Пример полной страницы

См. файл `frontend/widget/example.html` для полного примера встраивания.

## Поддержка

При возникновении проблем проверьте:

1. Правильность URL API (`data-api-url`)
2. Наличие контейнера с указанным ID
3. CORS настройки на API сервере
4. Консоль браузера на наличие ошибок



