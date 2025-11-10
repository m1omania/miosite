# Настройка подключения Vercel к Backend на VPS

## Проблема
Vercel не может подключиться к backend на VPS (Jino.ru) через HTTP.

## Решение

### 1. Обновить Backend на сервере

Подключитесь к серверу и обновите backend:

```bash
ssh -p 49376 root@53893873b619.vps.myjino.ru
cd /opt/ux-audit/backend
git pull origin main
npm run build
systemctl restart ux-audit-backend
```

### 2. Проверить, что Backend слушает на всех интерфейсах

```bash
netstat -tulpn | grep 4001
# Должно быть: tcp 0 0 0.0.0.0:4001 (не только :::4001)
```

Если backend слушает только на `:::4001` (IPv6), нужно перезапустить сервис после обновления кода.

### 3. Проверить доступность Backend извне

```bash
# С сервера
curl http://localhost:4001/health

# С вашего компьютера
curl http://53893873b619.vps.myjino.ru:4001/health
```

Если порт недоступен извне, проверьте firewall:

```bash
# Проверить UFW
ufw status

# Если порт не открыт, открыть его
ufw allow 4001/tcp
```

### 4. Настроить переменные окружения на Vercel

В настройках проекта Vercel (Settings → Environment Variables) добавьте:

```
API_URL=http://53893873b619.vps.myjino.ru:4001
```

**Важно:** Используйте `API_URL` (без `NEXT_PUBLIC_`), так как это серверная переменная.

### 5. Проверить логи Vercel

После деплоя проверьте логи Vercel (Deployments → [ваш деплой] → Functions → [api/audit]):

- Если видите `ECONNREFUSED` - backend недоступен извне
- Если видите `fetch failed` - Vercel блокирует исходящие HTTP запросы
- Если видите таймауты - backend слишком медленный

### 6. Альтернативное решение: HTTPS через Nginx

Если Vercel блокирует исходящие HTTP запросы, нужно настроить HTTPS:

1. Установить Nginx на VPS
2. Настроить SSL сертификат (Let's Encrypt)
3. Настроить Nginx как reverse proxy для backend
4. Обновить `API_URL` на Vercel на HTTPS URL

## Текущий статус

✅ Код обновлен:
- Backend настроен слушать на `0.0.0.0` (все интерфейсы)
- API routes обновлены для работы с серверными переменными окружения
- Добавлено детальное логирование ошибок

⏳ Требуется:
- Обновить backend на сервере (команды выше)
- Проверить доступность порта 4001 извне
- Настроить переменную окружения `API_URL` на Vercel
- Передеплоить frontend на Vercel

## Проверка работы

После выполнения всех шагов:

1. Откройте frontend на Vercel
2. Попробуйте проанализировать сайт
3. Проверьте логи Vercel для диагностики ошибок

Если ошибка останется, проверьте:
- Логи backend на сервере: `journalctl -u ux-audit-backend -f`
- Логи Vercel в Dashboard
- Доступность backend извне: `curl http://53893873b619.vps.myjino.ru:4001/health`

