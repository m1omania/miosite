'use client';

import type { AuditReport } from '../../shared/types';
import { useState } from 'react';
import DetailedReportDisplay from './DetailedReportDisplay';

interface ReportDisplayProps {
  report: AuditReport;
}

export default function ReportDisplay({ report }: ReportDisplayProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showDetailed, setShowDetailed] = useState(false);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-100 border-red-500 text-red-800';
      case 'warning':
        return 'bg-yellow-100 border-yellow-500 text-yellow-800';
      default:
        return 'bg-blue-100 border-blue-500 text-blue-800';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'Критично';
      case 'warning':
        return 'Предупреждение';
      default:
        return 'Информация';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">Отчёт по UX-аудиту</h2>
            <p className="text-gray-600 mb-4">
              <a href={report.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {report.url}
              </a>
            </p>
            <p className="text-sm text-gray-500">
              Дата анализа: {new Date(report.createdAt).toLocaleString('ru-RU')}
            </p>
          </div>
          {report.detailedReport && (
            <button
              onClick={() => setShowDetailed(!showDetailed)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              {showDetailed ? 'Скрыть детальный отчёт' : 'Показать детальный отчёт'}
            </button>
          )}
        </div>
        
        {/* Screenshots */}
        {report.screenshots && report.screenshots.desktop && (
          <div className="mt-6 space-y-4">
            <h3 className="text-lg font-semibold mb-3">Скриншот сайта</h3>
            <div className="max-w-4xl">
              <div className="border rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
                  🖥️ Desktop версия
                </div>
                <div className="bg-gray-50 p-2">
                  <img
                    src={report.screenshots.desktop}
                    alt="Desktop скриншот"
                    className="w-full h-auto rounded border border-gray-200"
                    style={{ maxHeight: '600px', objectFit: 'contain' }}
                  />
                </div>
              </div>
            </div>
            {/* Мобильный скриншот временно скрыт */}
            {/* {report.screenshots.mobile && (
              <div className="border rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
                  📱 Mobile версия
                </div>
                <div className="bg-gray-50 p-2">
                  <img
                    src={report.screenshots.mobile}
                    alt="Mobile скриншот"
                    className="w-full h-auto rounded border border-gray-200 mx-auto"
                    style={{ maxWidth: '375px', maxHeight: '600px', objectFit: 'contain' }}
                  />
                </div>
              </div>
            )} */}
          </div>
        )}
      </div>

      {/* Detailed Report */}
      {showDetailed && report.detailedReport && (
        <DetailedReportDisplay report={report.detailedReport} />
      )}

      {/* Metrics Summary */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold mb-4">Метрики</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Время загрузки</p>
            <p className="text-lg font-bold">
              {(report.metrics.loadTime / 1000).toFixed(2)} сек
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">CTA кнопки</p>
            <p className="text-lg font-bold">{report.metrics.ctas.count}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Контрастность</p>
            <p className="text-lg font-bold">{report.metrics.contrast.score}/100</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Адаптивность</p>
            <p className="text-lg font-bold">
              {report.metrics.responsive ? '✓' : '✗'}
            </p>
          </div>
        </div>
      </div>

      {/* Categories */}
      {report.categories.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4">Найденные проблемы</h3>
          <div className="space-y-4">
            {report.categories.map((category, index) => (
              <div
                key={index}
                className={`border-l-4 rounded p-4 ${getSeverityColor(category.severity)}`}
              >
                <div
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() =>
                    setExpandedCategory(expandedCategory === category.name ? null : category.name)
                  }
                >
                  <h4 className="font-semibold">{category.name}</h4>
                  <span className="text-sm px-2 py-1 rounded bg-white">
                    {getSeverityBadge(category.severity)}
                  </span>
                </div>
                {expandedCategory === category.name && (
                  <div className="mt-4 space-y-2">
                    {category.issues.map((issue, issueIndex) => {
                      // Специальное форматирование для описания сайта
                      const isVisualDescription = issue.title.includes('Что видит система');
                      return (
                        <div key={issueIndex} className={`bg-white p-3 rounded ${isVisualDescription ? 'border-2 border-blue-300' : ''}`}>
                          <p className="font-medium">{issue.title}</p>
                          <div className={`text-sm text-gray-700 mt-1 ${isVisualDescription ? 'whitespace-pre-line leading-relaxed' : ''}`}>
                            {typeof issue.description === 'string' 
                              ? issue.description.split('\n').map((line, lineIndex) => (
                                  <p key={lineIndex} className={lineIndex > 0 ? 'mt-2' : ''}>{line}</p>
                                ))
                              : <p>{String(issue.description || '')}</p>
                            }
                          </div>
                          {issue.suggestion && (
                            <p className="text-sm text-blue-600 mt-2">
                              💡 {issue.suggestion}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4">Эксперт рекомендует</h3>
          <div className="space-y-4">
            {report.recommendations.map((rec, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-lg">{rec.title}</h4>
                  <span
                    className={`px-3 py-1 rounded text-white text-sm ${getPriorityColor(rec.priority)}`}
                  >
                    {rec.priority === 'high' ? 'Высокий' : rec.priority === 'medium' ? 'Средний' : 'Низкий'}
                  </span>
                </div>
                <p className="text-gray-700 mb-2">{rec.description}</p>
                <p className="text-sm text-gray-600 mb-3">
                  <strong>Влияние:</strong> {rec.impact}
                </p>
                {rec.steps.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Шаги для исправления:</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                      {rec.steps.map((step, stepIndex) => (
                        <li key={stepIndex}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

