# Настройка Google Cloud Vision API

## 🚀 Быстрый старт (через API ключ)

### 1. Получите API ключ

1. Перейдите на https://console.cloud.google.com/
2. Создайте проект или выберите существующий
3. Включите **Cloud Vision API**:
   - Перейдите в "APIs & Services" > "Library"
   - Найдите "Cloud Vision API"
   - Нажмите "Enable"
4. Создайте API ключ:
   - "APIs & Services" > "Credentials"
   - "Create Credentials" > "API Key"
   - Скопируйте ключ

### 2. Добавьте в .env

```bash
# backend/.env
GOOGLE_CLOUD_VISION_API_KEY=your-api-key-here
```

### 3. Перезапустите backend

```bash
cd backend
npm run dev
```

---

## 🔐 Альтернативный способ (Service Account)

### 1. Создайте Service Account

1. В Google Cloud Console: "IAM & Admin" > "Service Accounts"
2. "Create Service Account"
3. Назначьте роль: "Cloud Vision API User"
4. Создайте JSON ключ и скачайте файл

### 2. Добавьте в .env

```bash
# backend/.env
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your-service-account-key.json
```

### 3. Перезапустите backend

---

## 💰 Стоимость

**Бесплатно:**
- 1000 запросов в месяц

**Платно:**
- После 1000 запросов: $1.50 за 1000 запросов
- Label Detection: $1.50 за 1000
- Text Detection: $1.50 за 1000

---

## ✅ Проверка

После настройки создайте аудит - в логах должно появиться:
```
✅ Google Cloud Vision анализ успешен
```

