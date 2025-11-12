'use client';

import { useState } from 'react';

interface HeadlinesResult {
  success: boolean;
  headlines: Record<string, string[]>;
  requirements: Record<string, { maxLength: number; name: string; description?: string }>;
}

interface AnalysisData {
  title: string | null;
  description: string | null;
  keywords: string | null;
}

interface BannerHeadlinesGeneratorProps {
  analysisData?: AnalysisData;
}

// Доступные платформы
const PLATFORMS = [
  { id: 'yandex_rsya', name: 'Яндекс РСЯ', description: 'До 125 символов (рекомендуется до 75)' },
  { id: 'google_ads', name: 'Google Ads', description: 'До 30 символов' },
  { id: 'facebook_ads', name: 'Facebook Ads', description: 'До 40 символов' },
  { id: 'vk_ads', name: 'VK Реклама', description: 'До 60 символов' },
  { id: 'yandex_direct', name: 'Яндекс.Директ', description: 'Заголовок 1: до 33 символов, Заголовок 2: до 75' },
  { id: 'instagram_ads', name: 'Instagram Ads', description: 'До 40 символов' },
];

export default function BannerHeadlinesGenerator({ analysisData }: BannerHeadlinesGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HeadlinesResult | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedViewPlatform, setSelectedViewPlatform] = useState<string>('all');

  const handlePlatformToggle = (platformId: string) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(platformId)) {
        return prev.filter(id => id !== platformId);
      } else {
        return [...prev, platformId];
      }
    });
  };

  const handleGenerate = async () => {
    if (!analysisData) {
      setError('Данные анализа недоступны');
      return;
    }

    if (selectedPlatforms.length === 0) {
      setError('Выберите хотя бы одну рекламную площадку');
      return;
    }

    // Автоматически формируем данные из анализа
    const companyActivity = [
      analysisData.title,
      analysisData.description
    ].filter(Boolean).join('. ');

    if (!companyActivity.trim()) {
      setError('Недостаточно данных для генерации заголовков');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/banner-headlines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyActivity: companyActivity.trim(),
          keyBenefits: analysisData.keywords || undefined,
          platforms: selectedPlatforms,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка при генерации заголовков');
      }

      setResult(data);
      // Устанавливаем первую платформу для просмотра
      if (selectedPlatforms.length > 0) {
        setSelectedViewPlatform(selectedPlatforms[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Не удалось сгенерировать заголовки');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Можно добавить уведомление об успешном копировании
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Генератор заголовков для рекламных баннеров
      </h2>
      <p className="text-gray-600 mb-6">
        Выберите рекламные площадки и сгенерируйте заголовки на основе данных вашего сайта
      </p>

      {/* Platform Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Выберите рекламные площадки (можно выбрать несколько):
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PLATFORMS.map((platform) => (
            <label
              key={platform.id}
              className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                selectedPlatforms.includes(platform.id)
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedPlatforms.includes(platform.id)}
                onChange={() => handlePlatformToggle(platform.id)}
                className="mt-1 mr-3 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">{platform.name}</div>
                <div className="text-sm text-gray-600 mt-1">{platform.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
      
      <button
        onClick={handleGenerate}
        disabled={loading || !analysisData || selectedPlatforms.length === 0}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {loading ? 'Генерация заголовков...' : 'Сгенерировать заголовки'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-6 space-y-6">
          {/* Platform Selector for Viewing */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Выберите платформу для просмотра</h2>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setSelectedViewPlatform('all')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedViewPlatform === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Все заголовки
              </button>
              {Object.entries(result.requirements).map(([key, req]) => (
                <button
                  key={key}
                  onClick={() => setSelectedViewPlatform(key)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    selectedViewPlatform === key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {req.name} (до {req.maxLength} символов)
                </button>
              ))}
            </div>
          </div>

          {/* Headlines List */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">
              {selectedViewPlatform === 'all'
                ? 'Все заголовки'
                : result.requirements[selectedViewPlatform]?.name || 'Заголовки'}
            </h2>
            {result.headlines[selectedViewPlatform]?.length > 0 ? (
              <div className="space-y-3">
                {result.headlines[selectedViewPlatform].map(
                  (headline, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-lg mb-1">{headline}</div>
                        <div className="text-sm text-gray-500">
                          {headline.length} символов
                        </div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(headline)}
                        className="ml-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                      >
                        Копировать
                      </button>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-gray-600">
                Нет заголовков для выбранной платформы
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
