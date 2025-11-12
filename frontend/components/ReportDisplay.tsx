'use client';

import { useState } from 'react';
import type { AuditReport } from '@/src/types';
import UXScoreChart from './UXScoreChart';
import PrincipleTooltip, { parseTextWithPrinciples } from './PrincipleTooltip';

interface ReportDisplayProps {
  report: AuditReport;
}

export default function ReportDisplay({ report }: ReportDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // Функция для копирования текста анализа
  const handleCopyAnalysis = async () => {
    if (!report.summary?.summary) return;
    
    try {
      // Копируем весь текст анализа, включая strengths и weaknesses
      let textToCopy = report.summary.summary;
      
      if (report.summary.strengths.length > 0) {
        textToCopy += '\n\n✅ Сильные стороны:\n';
        report.summary.strengths.forEach(strength => {
          textToCopy += `- ${strength}\n`;
        });
      }
      
      if (report.summary.weaknesses.length > 0) {
        textToCopy += '\n\n⚠️ Области для улучшения:\n';
        report.summary.weaknesses.forEach(weakness => {
          textToCopy += `- ${weakness}\n`;
        });
      }
      
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Ошибка при копировании:', error);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Скриншот сайта (первым) */}
      {report.screenshots && report.screenshots.desktop && (
        <div className="max-w-3xl mx-auto">
          <img
            src={report.screenshots.desktop}
            alt="Desktop скриншот"
            className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
            style={{ maxHeight: '400px', objectFit: 'contain' }}
            onClick={() => setIsImageModalOpen(true)}
          />
        </div>
      )}

      {/* Модальное окно для увеличенного скриншота */}
      {isImageModalOpen && report.screenshots?.desktop && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div className="relative max-w-7xl max-h-full">
            <img
              src={report.screenshots.desktop}
              alt="Desktop скриншот (увеличенный)"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setIsImageModalOpen(false)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full p-2 transition-all"
              aria-label="Закрыть"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* UX Score Breakdown (график) */}
      {report.summary && report.summary.overallScore > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4">UX Score Breakdown</h3>
          <UXScoreChart report={report} />
        </div>
      )}

      {/* Общее резюме по UX/UI */}
      {report.summary && report.summary.overallScore > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-800">Общее резюме по UX/UI</h3>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-blue-600">{report.summary.overallScore}</span>
              <span className="text-sm text-gray-600">/ 100</span>
            </div>
          </div>
          
          <div className="text-gray-700 leading-relaxed">
            {report.summary.summary.split('\n').map((line, index, array) => {
              const trimmedLine = line.trim();
              
              // Пустая строка
              if (trimmedLine === '') {
                return <div key={index} className="h-2" />;
              }
              
              // Заголовок уровня 1 (например: "Общий обзор", "Сильные стороны")
              const isMainHeading = trimmedLine.match(/^(Общий обзор|Сильные стороны|Проблемы и области для улучшения|Конкретные рекомендации|Итоговая оценка)$/i);
              
              // Подзаголовок (начинается с "1.", "2." и т.д. или "**1.")
              const isSubHeading = trimmedLine.match(/^(\d+\.|[*•]\s*\d+\.)\s+[А-ЯЁ]/);
              
              // Элемент списка (начинается с "-", "•" или содержит "**текст**:")
              const isListItem = trimmedLine.match(/^[-•*]\s/) || trimmedLine.match(/^\*\*[^*]+\*\*:/);
              
              // Жирный текст с двоеточием (например: "**Назначение**:")
              const isBoldLabel = trimmedLine.match(/^\*\*[^*]+\*\*:/);
              
              if (isMainHeading) {
                return (
                  <h2 key={index} className="text-2xl font-bold text-gray-900 mt-10 mb-6 first:mt-0 border-b-2 border-gray-300 pb-3">
                    {trimmedLine}
                  </h2>
                );
              } else if (isSubHeading) {
                return (
                  <h4 key={index} className="text-lg font-semibold text-gray-800 mt-6 mb-3">
                    {trimmedLine.replace(/^[*•]\s*/, '')}
                  </h4>
                );
              } else if (isBoldLabel) {
                const parts = trimmedLine.split(':');
                const label = parts[0].replace(/\*\*/g, '');
                const value = parts.slice(1).join(':').trim();
                const parsedValue = value ? parseTextWithPrinciples(value) : [];
                return (
                  <div key={index} className="mb-3">
                    <span className="font-semibold text-gray-800">{label}:</span>
                    {value && (
                      <span className="ml-2">
                        {parsedValue.map((part, partIndex) => {
                          if (typeof part === 'string') {
                            return <span key={partIndex}>{part}</span>;
                          } else {
                            return (
                              <PrincipleTooltip key={partIndex} principleName={part.name}>
                                {part.text}
                              </PrincipleTooltip>
                            );
                          }
                        })}
                      </span>
                    )}
                  </div>
                );
              } else if (isListItem) {
                const listContent = trimmedLine.replace(/^[-•*]\s*/, '').replace(/\*\*/g, '');
                const parsedContent = parseTextWithPrinciples(listContent);
                return (
                  <div key={index} className="ml-6 mb-2 flex items-start">
                    <span className="text-gray-500 mr-2 mt-1">•</span>
                    <span className="flex-1">
                      {parsedContent.map((part, partIndex) => {
                        if (typeof part === 'string') {
                          return <span key={partIndex}>{part}</span>;
                        } else {
                          return (
                            <PrincipleTooltip key={partIndex} principleName={part.name}>
                              {part.text}
                            </PrincipleTooltip>
                          );
                        }
                      })}
                    </span>
                  </div>
                );
              } else {
                const lineContent = trimmedLine.replace(/\*\*/g, '');
                const parsedContent = parseTextWithPrinciples(lineContent);
                return (
                  <div key={index} className="mb-3 text-gray-700">
                    {parsedContent.map((part, partIndex) => {
                      if (typeof part === 'string') {
                        return <span key={partIndex}>{part}</span>;
                      } else {
                        return (
                          <PrincipleTooltip key={partIndex} principleName={part.name}>
                            {part.text}
                          </PrincipleTooltip>
                        );
                      }
                    })}
                  </div>
                );
              }
            })}
          </div>
          
          {report.summary.strengths.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-green-700 mb-2">✅ Сильные стороны:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                {report.summary.strengths.map((strength, index) => {
                  const parsedStrength = parseTextWithPrinciples(strength);
                  return (
                    <li key={index}>
                      {parsedStrength.map((part, partIndex) => {
                        if (typeof part === 'string') {
                          return <span key={partIndex}>{part}</span>;
                        } else {
                          return (
                            <PrincipleTooltip key={partIndex} principleName={part.name}>
                              {part.text}
                            </PrincipleTooltip>
                          );
                        }
                      })}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          
          {report.summary.weaknesses.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-orange-700 mb-2">⚠️ Области для улучшения:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                {report.summary.weaknesses.map((weakness, index) => {
                  const parsedWeakness = parseTextWithPrinciples(weakness);
                  return (
                    <li key={index}>
                      {parsedWeakness.map((part, partIndex) => {
                        if (typeof part === 'string') {
                          return <span key={partIndex}>{part}</span>;
                        } else {
                          return (
                            <PrincipleTooltip key={partIndex} principleName={part.name}>
                              {part.text}
                            </PrincipleTooltip>
                          );
                        }
                      })}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          
          {/* Кнопка копирования */}
          <div className="mt-6 pt-4 border-t border-gray-300">
            <button
              onClick={handleCopyAnalysis}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Скопировано!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Копировать анализ
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Предупреждение об AI */}
      <div className="mt-6 text-center text-sm text-gray-600">
        <p>ИИ может допускать ошибки, поэтому проверьте информацию.</p>
      </div>
    </div>
  );
}

