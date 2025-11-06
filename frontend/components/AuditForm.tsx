'use client';

import { useState } from 'react';

interface AuditFormProps {
  onAuditStart: () => void;
  onAuditComplete: (reportId: string, report: any) => void;
  onError: (error: string) => void;
}

export default function AuditForm({ onAuditStart, onAuditComplete, onError }: AuditFormProps) {
  // Дефолтный URL для быстрого тестирования
  const DEFAULT_TEST_URL = 'example.com';
  const [url, setUrl] = useState(DEFAULT_TEST_URL);
  const [loading, setLoading] = useState(false);

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
    
    if (!url.trim()) {
      onError('Введите URL сайта');
      return;
    }

    if (!validateUrl(url)) {
      onError('Неверный формат URL');
      return;
    }

    setLoading(true);
    onAuditStart();

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
      const response = await fetch(`${apiUrl}/api/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при анализе сайта');
      }

      const data = await response.json();
      onAuditComplete(data.reportId, data.report);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex gap-4 mb-4">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Введите URL сайта (например: example.com)"
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Анализ...' : 'Проверить сайт'}
        </button>
      </div>
      {loading && (
        <div className="text-center text-gray-600">
          <p>Анализ сайта в процессе... Это может занять несколько секунд.</p>
        </div>
      )}
    </form>
  );
}

