'use client';

import { useRef } from 'react';

export default function TestUploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('Файл выбран:', file.name, file.size, file.type);
      alert(`Файл выбран: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">Тест загрузки файла</h1>
        
        {/* Контейнер с кнопкой и input поверх неё */}
        <div className="relative inline-block w-full">
          {/* Кнопка */}
          <button
            type="button"
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium cursor-pointer relative z-10 pointer-events-none"
          >
            Выбрать файл
          </button>
          
          {/* Input поверх кнопки - прозрачный, но с размерами кнопки */}
          <input
            ref={fileInputRef}
            id="file-input"
            type="file"
            accept="image/*"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer',
              zIndex: 20
            }}
            onChange={handleFileChange}
          />
        </div>

        <p className="mt-4 text-sm text-gray-500 text-center">
          Откройте консоль браузера для просмотра логов
        </p>
      </div>
    </div>
  );
}

