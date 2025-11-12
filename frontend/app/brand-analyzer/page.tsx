'use client';

import { useState } from 'react';
import BrandAnalyzer from '@/components/BrandAnalyzer';

export default function BrandAnalyzerPage() {
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
            <a
              href="/complexity"
              className="px-6 py-3 text-lg font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Анализ сложности
            </a>
            <button
              className="px-6 py-3 text-lg font-medium text-blue-600 border-b-2 border-blue-600 transition-colors"
            >
              Анализ брендинга
            </button>
          </div>
        </div>

        <BrandAnalyzer />
      </div>
    </main>
  );
}

