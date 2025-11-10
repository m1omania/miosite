# Диагностика ошибки 500

## Проблема
Backend возвращает ошибку 500 вместо 503. Это означает, что подключение работает, но backend не может обработать запрос.

## Что проверить

### 1. Проверить логи Vercel
В Vercel Dashboard:
- Deployments → ваш деплой → Functions → api/audit → Logs

Ищите:
- Детали ошибки от backend
- Сообщения об ошибках подключения
- Таймауты

### 2. Проверить логи backend на сервере
```bash
ssh -p 49376 root@53893873b619.vps.myjino.ru
journalctl -u ux-audit-backend -f
```

Или последние логи:
```bash
journalctl -u ux-audit-backend -n 50 --no-pager
```

### 3. Проверить доступность backend напрямую
```bash
# Health check
curl http://53893873b619.vps.myjino.ru/health

# Тестовый запрос
curl -X POST http://53893873b619.vps.myjino.ru/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

## Возможные причины ошибки 500

### 1. Puppeteer не может запуститься
- Chrome не найден
- Недостаточно памяти
- Проблемы с зависимостями

**Решение:** Проверить логи backend, обновить зависимости

### 2. Chrome не найден
- Chrome не установлен через Puppeteer
- Неправильный путь к Chrome

**Решение:** 
```bash
cd /opt/ux-audit/backend
PUPPETEER_SKIP_DOWNLOAD=false npx puppeteer browsers install chrome
```

### 3. Проблема с AI API
- API ключ не установлен
- API недоступен
- Таймаут API

**Решение:** Проверить переменные окружения на сервере

### 4. Таймаут на backend
- Сайт слишком медленный
- Таймаут слишком короткий

**Решение:** Увеличить таймауты в коде

### 5. Проблема с базой данных
- База данных недоступна
- Ошибка записи

**Решение:** Проверить права доступа к базе данных

## Быстрая проверка

### Проверить статус backend
```bash
ssh -p 49376 root@53893873b619.vps.myjino.ru
systemctl status ux-audit-backend
```

### Проверить последние ошибки
```bash
journalctl -u ux-audit-backend -n 100 --no-pager | grep -i error
```

### Проверить переменные окружения
```bash
ssh -p 49376 root@53893873b619.vps.myjino.ru
cat /opt/ux-audit/backend/.env
```

## Следующие шаги

1. Проверить логи Vercel для деталей ошибки
2. Проверить логи backend на сервере
3. Проверить доступность backend напрямую
4. Исправить проблему в зависимости от ошибки

