'use client';

import { useState } from 'react';
import JSZip from 'jszip';
import BannerHeadlinesGenerator from './BannerHeadlinesGenerator';

interface BrandAnalysisResult {
  url: string;
  metadata: {
    title: string | null;
    description: string | null;
    keywords: string | null;
    favicon: string | null;
  };
  logo: {
    favicon: string | null;
    metaLogo: string | null;
    imageLogos: string[];
  };
  colors: {
    dominant: string[];
    palette: Array<{ color: string; population: number }>;
  };
  fonts: {
    googleFonts: string[];
    systemFonts: string[];
    customFonts: string[];
  };
  images: Array<{
    url: string;
    alt: string | null;
    type: 'main' | 'icon' | 'other';
  }>;
  cssStyles: {
    backgroundColor: string[];
    color: string[];
    borderColor: string[];
  };
}

export default function BrandAnalyzer() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BrandAnalysisResult | null>(null);

  // Функция для нормализации URL
  const normalizeUrl = (inputUrl: string): string => {
    let normalized = inputUrl.trim();
    
    // Убираем пробелы
    normalized = normalized.replace(/\s+/g, '');
    
    // Если URL пустой, возвращаем как есть
    if (!normalized) {
      return normalized;
    }
    
    // Если URL уже содержит протокол, возвращаем как есть
    if (/^https?:\/\//i.test(normalized)) {
      return normalized;
    }
    
    // Если URL начинается с //, добавляем https:
    if (normalized.startsWith('//')) {
      return `https:${normalized}`;
    }
    
    // Если URL не содержит протокол, добавляем https://
    return `https://${normalized}`;
  };

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError('Введите URL сайта');
      return;
    }

    // Нормализуем URL перед отправкой
    const normalizedUrl = normalizeUrl(url);

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/brand-analyzer?url=${encodeURIComponent(normalizedUrl)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка при анализе сайта');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Не удалось проанализировать сайт');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAnalyze();
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Анализ брендинга и визуального стиля
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Автоматический сбор данных о брендинге, цветах, шрифтах и визуальных элементах сайта
        </p>
      </div>

      {/* Input Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex gap-4">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Введите URL сайта (например: example.com)"
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Анализ...' : 'Анализировать'}
          </button>
        </div>
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Metadata */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Метаданные</h2>
            <div className="space-y-2">
              <div>
                <span className="font-medium">URL: </span>
                <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {result.url}
                </a>
              </div>
              {result.metadata.title && (
                <div>
                  <span className="font-medium">Заголовок: </span>
                  <span>{result.metadata.title}</span>
                </div>
              )}
              {result.metadata.description && (
                <div>
                  <span className="font-medium">Описание: </span>
                  <span>{result.metadata.description}</span>
                </div>
              )}
              {result.metadata.keywords && (
                <div>
                  <span className="font-medium">Ключевые слова: </span>
                  <span>{result.metadata.keywords}</span>
                </div>
              )}
            </div>
          </div>

          {/* Logo */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Логотип</h2>
            <div className="space-y-4">
              {result.logo.favicon && (
                <div>
                  <div className="font-medium mb-2">Favicon:</div>
                  <img src={result.logo.favicon} alt="Favicon" className="w-16 h-16 border border-gray-200 rounded" />
                </div>
              )}
              {result.logo.metaLogo && (
                <div>
                  <div className="font-medium mb-2">Meta Logo (OG Image):</div>
                  <img src={result.logo.metaLogo} alt="Meta Logo" className="max-w-xs h-auto border border-gray-200 rounded" />
                </div>
              )}
              {result.logo.imageLogos.length > 0 && (
                <div>
                  <div className="font-medium mb-2">Логотипы на странице:</div>
                  <div className="flex flex-wrap gap-4">
                    {result.logo.imageLogos.map((logoUrl, idx) => (
                      <img key={idx} src={logoUrl} alt={`Logo ${idx + 1}`} className="max-w-xs h-auto border border-gray-200 rounded" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Colors */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Цветовая палитра</h2>
            {result.colors.dominant.length > 0 && (
              <div className="mb-6">
                <div className="font-medium mb-3">Доминирующие цвета:</div>
                <div className="flex flex-wrap gap-3">
                  {result.colors.dominant.map((color, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div
                        className="w-16 h-16 rounded border border-gray-300"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-sm font-mono">{color}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.cssStyles.backgroundColor.length > 0 && (
              <div>
                <div className="font-medium mb-3">Цвета из CSS:</div>
                <div className="flex flex-wrap gap-3">
                  {result.cssStyles.backgroundColor.slice(0, 15).map((color, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div
                        className="w-12 h-12 rounded border border-gray-300"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs font-mono">{color}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Fonts */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Шрифты</h2>
            {result.fonts.googleFonts.length > 0 && (
              <div className="mb-4">
                <div className="font-medium mb-2">Google Fonts:</div>
                <div className="flex flex-wrap gap-2">
                  {result.fonts.googleFonts.map((font, idx) => (
                    <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {font}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {result.fonts.customFonts.length > 0 && (
              <div className="mb-4">
                <div className="font-medium mb-2">Пользовательские шрифты (@font-face):</div>
                <div className="flex flex-wrap gap-2">
                  {result.fonts.customFonts.map((font, idx) => (
                    <span key={idx} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                      {font}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {result.fonts.systemFonts.length > 0 && (
              <div>
                <div className="font-medium mb-2">Системные шрифты:</div>
                <div className="flex flex-wrap gap-2">
                  {result.fonts.systemFonts.map((font, idx) => (
                    <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                      {font}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Images */}
          {result.images.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold mb-4">Изображения</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {result.images.map((img, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                    <img
                      src={img.url}
                      alt={img.alt || `Image ${idx + 1}`}
                      className="w-full h-32 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    {img.alt && (
                      <div className="p-2 text-xs text-gray-600 truncate">{img.alt}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Archive Export */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Экспорт данных</h2>
            <button
                onClick={async () => {
                  if (!result) return;
                  
                  setLoading(true);
                  try {
                    const zip = new JSZip();
                    const timestamp = new Date().getTime();
                    const siteName = result.url.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '_');
                    
                    // Download and add images
                    const imagePromises: Promise<void>[] = [];
                    
                    // Add favicon
                    if (result.logo.favicon) {
                      imagePromises.push(
                        fetch(result.logo.favicon)
                          .then(res => res.blob())
                          .then(blob => {
                            const ext = result.logo.favicon!.split('.').pop()?.split('?')[0] || 'ico';
                            zip.file(`logos/favicon.${ext}`, blob);
                          })
                          .catch(err => console.log('Failed to download favicon:', err))
                      );
                    }
                    
                    // Add meta logo
                    if (result.logo.metaLogo) {
                      imagePromises.push(
                        fetch(result.logo.metaLogo)
                          .then(res => res.blob())
                          .then(blob => {
                            const ext = result.logo.metaLogo!.split('.').pop()?.split('?')[0] || 'png';
                            zip.file(`logos/meta-logo.${ext}`, blob);
                          })
                          .catch(err => console.log('Failed to download meta logo:', err))
                      );
                    }
                    
                    // Add logo images
                    result.logo.imageLogos.forEach((logoUrl, idx) => {
                      imagePromises.push(
                        fetch(logoUrl)
                          .then(res => res.blob())
                          .then(blob => {
                            const ext = logoUrl.split('.').pop()?.split('?')[0] || 'png';
                            zip.file(`logos/logo-${idx + 1}.${ext}`, blob);
                          })
                          .catch(err => console.log(`Failed to download logo ${idx + 1}:`, err))
                      );
                    });
                    
                    // Add other images
                    result.images.forEach((img, idx) => {
                      if (img.type !== 'icon') {
                        imagePromises.push(
                          fetch(img.url)
                            .then(res => res.blob())
                            .then(blob => {
                              const ext = img.url.split('.').pop()?.split('?')[0] || 'jpg';
                              const alt = img.alt ? img.alt.replace(/[^a-z0-9]/gi, '_').substring(0, 30) : `image-${idx + 1}`;
                              zip.file(`images/${alt}.${ext}`, blob);
                            })
                            .catch(err => console.log(`Failed to download image ${idx + 1}:`, err))
                        );
                      }
                    });
                    
                    // Wait for all images to download
                    await Promise.allSettled(imagePromises);
                    
                    // Generate and download ZIP
                    const zipBlob = await zip.generateAsync({ type: 'blob' });
                    const url = URL.createObjectURL(zipBlob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `brand-analysis-${siteName}-${timestamp}.zip`;
                    link.click();
                    URL.revokeObjectURL(url);
                  } catch (error) {
                    console.error('Error creating archive:', error);
                    setError('Ошибка при создании архива');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Создание архива...' : 'Скачать архив (ZIP)'}
              </button>
          </div>
        </div>
      )}

      {/* Banner Headlines Generator - показываем только после анализа */}
      {result && (
        <div className="mt-8">
          <BannerHeadlinesGenerator 
            analysisData={{
              title: result.metadata.title,
              description: result.metadata.description,
              keywords: result.metadata.keywords
            }}
          />
        </div>
      )}
    </div>
  );
}

