'use client';

import type { AuditReport } from '@/src/types';

interface UXScoreChartProps {
  report: AuditReport;
}

/**
 * Компонент для отображения графика оценок по категориям UX
 */
export default function UXScoreChart({ report }: UXScoreChartProps) {
  // Маппинг категорий на английские названия для графика
  const categoryMapping: Record<string, string> = {
    'Типографика': 'Typography',
    'Цвета и контраст': 'Accessibility',
    'Призывы к действию': 'CTA Visibility',
    'Производительность': 'Performance',
    'Адаптивность': 'Mobile Responsive',
    'Визуальный дизайн': 'Visual Design',
  };
  
  // Собираем данные для графика
  const chartData: Array<{ name: string; score: number; originalName: string }> = [];
  
  // Accessibility = Цвета и контраст
  const accessibilityCategory = report.categories.find(c => c.name === 'Цвета и контраст');
  if (accessibilityCategory) {
    chartData.push({
      name: 'Accessibility',
      score: accessibilityCategory.score || 0,
      originalName: accessibilityCategory.name,
    });
  }
  
  // CTA Visibility = Призывы к действию
  const ctaCategory = report.categories.find(c => c.name === 'Призывы к действию');
  if (ctaCategory) {
    chartData.push({
      name: 'CTA Visibility',
      score: ctaCategory.score || 0,
      originalName: ctaCategory.name,
    });
  }
  
  // Form Usability - используем оценку из detailedReport или дефолтную
  const formsScore = report.detailedReport?.forms?.score || 75;
  chartData.push({
    name: 'Form Usability',
    score: formsScore,
    originalName: 'Формы',
  });
  
  // Mobile Responsive = Адаптивность
  const responsiveCategory = report.categories.find(c => c.name === 'Адаптивность');
  if (responsiveCategory) {
    chartData.push({
      name: 'Mobile Responsive',
      score: responsiveCategory.score || 0,
      originalName: responsiveCategory.name,
    });
  }
  
  // Performance = Производительность
  const performanceCategory = report.categories.find(c => c.name === 'Производительность');
  if (performanceCategory) {
    chartData.push({
      name: 'Performance',
      score: performanceCategory.score || 0,
      originalName: performanceCategory.name,
    });
  } else {
    // Если категории нет, используем оценку из detailedReport или рассчитываем на основе метрик
    const performanceScore = report.detailedReport?.performance?.score || 
      (report.metrics.loadTime < 2000 ? 95 : 
       report.metrics.loadTime < 3000 ? 85 : 
       report.metrics.loadTime < 5000 ? 70 : 50);
    chartData.push({
      name: 'Performance',
      score: performanceScore,
      originalName: 'Производительность',
    });
  }
  
  // Typography = Типографика
  const typographyCategory = report.categories.find(c => c.name === 'Типографика');
  if (typographyCategory) {
    chartData.push({
      name: 'Typography',
      score: typographyCategory.score || 0,
      originalName: typographyCategory.name,
    });
  }
  
  // Рассчитываем общую оценку (среднее всех категорий)
  const overallScore = chartData.length > 0
    ? Math.round(chartData.reduce((sum, item) => sum + item.score, 0) / chartData.length)
    : report.summary?.overallScore || 0;
  
  // Функция для генерации прогресс-бара
  const renderProgressBar = (score: number) => {
    const filledBlocks = Math.round(score / 10);
    const emptyBlocks = 10 - filledBlocks;
    return '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6 font-mono">
      <h3 className="text-xl font-semibold mb-4 text-gray-800">UX Score Breakdown</h3>
      
      <div className="space-y-2 text-sm">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <span className="w-40 text-left text-gray-700">{item.name}:</span>
            <span className="flex-1 mx-2 text-gray-600">
              {renderProgressBar(item.score)}
            </span>
            <span className="w-20 text-right font-semibold text-gray-800">
              {item.score}/100
            </span>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-300">
        <div className="flex items-center justify-between">
          <span className="w-40 text-left font-semibold text-gray-800">Overall UX Score:</span>
          <span className="flex-1 mx-2 text-gray-600">
            {renderProgressBar(overallScore)}
          </span>
          <span className="w-20 text-right font-bold text-blue-600">
            {overallScore}/100
          </span>
        </div>
      </div>
    </div>
  );
}

