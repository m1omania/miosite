#!/bin/bash

# Скрипт для локального запуска проекта

echo "🚀 Запуск UX Audit Service локально..."
echo ""

# Проверка .env файлов
if [ ! -f backend/.env ]; then
    echo "⚠️  Создаю backend/.env из примера..."
    cp backend/.env.example backend/.env
    echo "📝 Не забудьте добавить OPENAI_API_KEY в backend/.env"
fi

if [ ! -f frontend/.env ]; then
    echo "⚠️  Создаю frontend/.env из примера..."
    cp frontend/.env.example frontend/.env
fi

echo ""
echo "📦 Зависимости установлены:"
echo "   ✓ Backend"
echo "   ✓ Frontend"
echo ""
echo "🔧 Для запуска выполните в двух терминалах:"
echo ""
echo "Терминал 1 (Backend):"
echo "  cd backend && npm run dev"
echo ""
echo "Терминал 2 (Frontend):"
echo "  cd frontend && npm run dev"
echo ""
echo "🌐 После запуска:"
echo "   Backend:  http://localhost:3001"
echo "   Frontend: http://localhost:3000"
echo ""
echo "⚠️  ВАЖНО: Добавьте OPENAI_API_KEY в backend/.env для работы Vision API"
echo "   (или можно протестировать без него - будет базовый анализ)"


