'use client';

import { useState, useRef, useEffect } from 'react';

interface AuditFormProps {
  onAuditStart: () => void;
  onAuditComplete: (reportId: string, report: any) => void;
  onError: (error: string) => void;
}

// Список популярных сайтов для примеров
const EXAMPLE_SITES = [
  'mail.ru',
  'yandex.ru',
  'google.com',
  'github.com',
  'stackoverflow.com',
  'reddit.com',
  'twitter.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'amazon.com',
  'ebay.com',
  'aliexpress.com',
  'wildberries.ru',
  'ozon.ru',
  'avito.ru',
  'cian.ru',
  'hh.ru',
  'habr.com',
  'medium.com',
  'wikipedia.org',
  'youtube.com',
  'netflix.com',
  'spotify.com',
  'apple.com',
  'microsoft.com',
  'adobe.com',
  'figma.com',
  'notion.so',
  'trello.com',
];

export default function AuditForm({ onAuditStart, onAuditComplete, onError }: AuditFormProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [randomSites, setRandomSites] = useState<string[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  
  // Генерируем 3 случайных сайта при каждом открытии списка
  const generateRandomSites = () => {
    const shuffled = [...EXAMPLE_SITES].sort(() => Math.random() - 0.5);
    setRandomSites(shuffled.slice(0, 3));
  };

  // Функция для сжатия изображения
  const compressImage = (file: File, maxWidth: number = 1920, maxHeight: number = 1080, quality: number = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Вычисляем новые размеры с сохранением пропорций
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
          }

          // Создаем canvas для сжатия
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Не удалось создать canvas контекст'));
            return;
          }

          // Рисуем изображение на canvas
          ctx.drawImage(img, 0, 0, width, height);

          // Конвертируем в base64 с сжатием
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error('Ошибка загрузки изображения'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Ошибка чтения файла'));
      reader.readAsDataURL(file);
    });
  };

  // Обработка загрузки файла
  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      onError('Пожалуйста, выберите изображение');
      return;
    }

    // Проверяем размер файла (максимум 10MB до сжатия)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      onError('Изображение слишком большое. Максимальный размер: 10MB');
      return;
    }

    try {
      setLoading(true); // Показываем индикатор загрузки при сжатии
      // Сжимаем изображение
      const compressedImage = await compressImage(file);
      setImagePreview(compressedImage);
      setImageFile(file);
      setUrl(''); // Очищаем URL при загрузке картинки
      setLoading(false);
    } catch (error) {
      setLoading(false);
      onError(error instanceof Error ? error.message : 'Ошибка при обработке изображения');
    }
  };

  // Обработка drag & drop
  useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (!dropZone) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('border-blue-500', 'bg-blue-50');
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('border-blue-500', 'bg-blue-50');
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('border-blue-500', 'bg-blue-50');

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
      }
    };

    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    return () => {
      dropZone.removeEventListener('dragover', handleDragOver);
      dropZone.removeEventListener('dragleave', handleDragLeave);
      dropZone.removeEventListener('drop', handleDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Обработка вставки через Ctrl+V
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            handleFileSelect(file);
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Очистка картинки
  const clearImage = () => {
    setImagePreview(null);
    setImageFile(null);
  };

  const validateUrl = (urlString: string): boolean => {
    try {
      let testUrl = urlString.trim();
      if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
        testUrl = 'https://' + testUrl;
      }
      new URL(testUrl);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Проверяем, есть ли картинка или URL
    if (!imageFile && !url.trim()) {
      onError('Введите адрес сайта или загрузите картинку');
      return;
    }

    // Если есть URL, проверяем его формат
    if (url.trim() && !validateUrl(url)) {
      onError('Неверный формат URL');
      return;
    }

    setLoading(true);
    onAuditStart();

    try {
      // Используем относительный путь для проксирования через Vercel
      // Если NEXT_PUBLIC_API_URL указан, используем его, иначе используем относительный путь
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const apiEndpoint = apiUrl ? `${apiUrl}/api/audit` : '/api/audit';
      
      let body: any;
      let headers: Record<string, string> = {};

      if (imageFile && imagePreview) {
        // Отправляем картинку
        body = JSON.stringify({ 
          image: imagePreview // base64 строка с data:image/...;base64,...
        });
        headers['Content-Type'] = 'application/json';
      } else {
        // Отправляем URL
        body = JSON.stringify({ url: url.trim() });
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при анализе');
      }

      const data = await response.json();
      onAuditComplete(data.reportId, data.report);
      
      // Очищаем форму после успешного анализа
      clearImage();
      setUrl('');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div 
        ref={dropZoneRef}
        className="relative"
      >
        <div className="flex gap-4 mb-2">
          <div className="flex-1 relative">
            {imagePreview ? (
              <div className="relative">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="w-full h-32 object-contain rounded border border-gray-200"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                  title="Удалить картинку"
                >
                  ×
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    clearImage(); // Очищаем картинку при вводе URL
                  }}
                  onFocus={() => {
                    generateRandomSites();
                    setShowExamples(true);
                  }}
                  onBlur={(e) => {
                    // Задержка для возможности клика по списку
                    setTimeout(() => setShowExamples(false), 200);
                  }}
                  placeholder="Введите адрес сайта или скиньте картинку"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                {showExamples && randomSites.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                    {randomSites.map((site, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setUrl(site);
                          setShowExamples(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors first:rounded-t-lg last:rounded-b-lg"
                      >
                        {site}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            
            {/* Скрытый input для выбора файла */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileSelect(file);
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {loading ? 'Анализ...' : 'Анализировать'}
          </button>
        </div>
        
        <div className="text-center text-sm text-gray-600">
          <span>Анализ по изображению </span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="text-blue-600 hover:text-blue-700 underline cursor-pointer disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            выбрать файл
          </button>
        </div>
      </div>
      
      {loading && (
        <div className="text-center text-gray-600 mt-4">
          <p>Анализ в процессе... Это может занять несколько секунд.</p>
        </div>
      )}
    </form>
  );
}

