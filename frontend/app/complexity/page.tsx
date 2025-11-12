'use client';

import ComplexityAnalyzer from '@/components/ComplexityAnalyzer';

export default function ComplexityPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Меню */}
        <div className="mb-8">
          <div className="flex justify-center gap-4 border-b border-gray-200">
            <a
              href="/"
              className="px-6 py-3 text-lg font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Дизайн Аудит
            </a>
            <button
              className="px-6 py-3 text-lg font-medium text-blue-600 border-b-2 border-blue-600 transition-colors"
            >
              Анализ сложности
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Анализ сложности
          </h1>
          <p className="text-xl text-gray-600">
            Оценка сложности интерфейса по методике IBM Complexity Analysis
          </p>
        </div>

        <ComplexityAnalyzer />
      </div>
    </main>
  );
}

