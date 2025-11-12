'use client';

import { useState, useEffect, useRef } from 'react';
import AuditForm from '@/components/AuditForm';
import ReportDisplay from '@/components/ReportDisplay';
import LeadForm from '@/components/LeadForm';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { AuditReport } from '@/src/types';

type Step = 1 | 2 | 3;

export default function Home() {
  const [step, setStep] = useState<Step>(1);
  const [analysisType, setAnalysisType] = useState<'url' | 'image'>('url');
  const [report, setReport] = useState<AuditReport | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ stage: string; message: string; progress: number } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingStartTimeRef = useRef<number | null>(null);

  // Polling статуса анализа
  useEffect(() => {
    if (!reportId || !loading) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
      pollingStartTimeRef.current = null;
      return;
    }

    // Запоминаем время начала polling
    pollingStartTimeRef.current = Date.now();
    const MAX_POLLING_TIME = 5 * 60 * 1000; // 5 минут максимум

    const pollStatus = async () => {
      try {
        // Проверяем таймаут
        if (pollingStartTimeRef.current && Date.now() - pollingStartTimeRef.current > MAX_POLLING_TIME) {
          console.warn('⏱️ Превышено максимальное время polling (5 минут), останавливаем...');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current);
            pollingTimeoutRef.current = null;
          }
          setError('Анализ занял слишком много времени. Попробуйте позже или используйте другой URL/изображение.');
          setLoading(false);
          setStep(1);
          return;
        }

        console.log('🔄 Polling status для reportId:', reportId);
        const response = await fetch(`/api/report/${reportId}/status`);
        if (response.ok) {
          const data = await response.json();
          console.log('📊 Получен статус:', data.status);
          if (data.status) {
            setStatus(data.status);
            
            // Если анализ завершен, загружаем полный отчет и переходим на шаг 3
            if (data.status.stage === 'completed' && data.status.progress === 100) {
              console.log('✅ Анализ завершен, загружаю полный отчет...');
              const reportResponse = await fetch(`/api/report/${reportId}`);
              if (reportResponse.ok) {
                const reportData = await reportResponse.json();
                console.log('✅ Полный отчет загружен, переходим на шаг 3');
                setReport(reportData);
                setLoading(false);
                setStep(3); // Переходим на шаг 3 (готовый отчет)
                if (pollingIntervalRef.current) {
                  clearInterval(pollingIntervalRef.current);
                  pollingIntervalRef.current = null;
                }
                if (pollingTimeoutRef.current) {
                  clearTimeout(pollingTimeoutRef.current);
                  pollingTimeoutRef.current = null;
                }
                pollingStartTimeRef.current = null;
              } else {
                console.error('❌ Ошибка при загрузке полного отчета:', reportResponse.status);
              }
            }
          } else {
            console.warn('⚠️ Статус не найден в ответе');
          }
        } else {
          console.warn('⚠️ Ошибка при polling статуса:', response.status);
        }
      } catch (error) {
        console.error('❌ Error polling status:', error);
      }
    };

    // Начинаем polling сразу и затем каждые 2 секунды
    pollStatus();
    pollingIntervalRef.current = setInterval(pollStatus, 2000);

    // Устанавливаем таймаут для остановки polling через 5 минут
    pollingTimeoutRef.current = setTimeout(() => {
      console.warn('⏱️ Таймаут polling (5 минут), останавливаем...');
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setError('Анализ занял слишком много времени. Попробуйте позже или используйте другой URL/изображение.');
      setLoading(false);
      setStep(1);
    }, MAX_POLLING_TIME);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
      pollingStartTimeRef.current = null;
    };
  }, [reportId, loading]);

  const handleAuditStart = (type: 'url' | 'image') => {
    setAnalysisType(type);
    setStep(2); // Переходим на шаг 2 (анализ)
    setLoading(true);
    setError(null);
    setReport(null);
    setReportId(null);
    setStatus(null);
  };

  const handleAuditComplete = (id: string, reportData: AuditReport) => {
    console.log('✅ handleAuditComplete вызван:', { id, hasReport: !!reportData, hasScreenshots: !!reportData.screenshots });
    setReport(reportData);
    setReportId(id);
    // Не останавливаем loading - продолжаем polling для обновления статуса
    setError(null);
    // Устанавливаем начальный статус если есть
    if (reportData.status) {
      setStatus(reportData.status);
      console.log('📊 Установлен начальный статус:', reportData.status);
    } else {
      console.warn('⚠️ Статус не найден в reportData');
    }
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setLoading(false);
    setStep(1); // Возвращаемся на шаг 1 при ошибке
    setReport(null);
    setReportId(null);
    setStatus(null);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    pollingStartTimeRef.current = null;
  };

  const handleBackClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmBack = () => {
    setShowConfirmDialog(false);
    setStep(1);
    setLoading(false);
    setReport(null);
    setReportId(null);
    setStatus(null);
    setError(null);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    pollingStartTimeRef.current = null;
  };

  const handleCancelBack = () => {
    setShowConfirmDialog(false);
  };

  const handleLeadSuccess = () => {
    // Можно показать уведомление или обновить состояние
    console.log('Lead submitted successfully');
  };

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header (показываем только на шаге 1) */}
        {step === 1 && (
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Дизайн аудит
            </h1>
            <p className="text-xl text-gray-600">
              UX/UI аудит вашего сайта или изображения
            </p>
          </div>
        )}

        {/* Шаг 1: Ввод адреса/картинки */}
        {step === 1 && (
          <div className="mb-8">
            <AuditForm
              onAuditStart={handleAuditStart}
              onAuditComplete={handleAuditComplete}
              onError={handleError}
            />
          </div>
        )}

        {/* Шаг 2: Анализ сайта/картинки + статус */}
        {step === 2 && (
          <div className="mb-8">
            {/* Кнопка "Назад" */}
            <div className="mb-4">
              <button
                onClick={handleBackClick}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Назад
              </button>
            </div>

            {/* Заголовок и текст */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Проводим дизайн-аудит вашего {analysisType === 'url' ? 'сайта' : 'изображения'}
              </h2>
              <p className="text-lg text-gray-600">
                Это займет несколько минут. Можете вернуться позже.
              </p>
            </div>

            {/* Статус анализа - над скриншотом (показываем всегда на шаге 2, если идет загрузка) */}
            {loading && (
              <div className="text-center mb-6">
                <div className="text-sm text-gray-600 mb-2">
                  {status?.message || 'Анализ в процессе...'}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 max-w-md mx-auto">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${status?.progress || 0}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-2">{status?.progress || 0}%</div>
              </div>
            )}

            {/* Скриншот или скелетон */}
            {report && report.screenshots && report.screenshots.desktop ? (
              <div className="mb-4 max-w-3xl mx-auto">
                <img
                  src={report.screenshots.desktop}
                  alt="Desktop скриншот"
                  className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ maxHeight: '400px', objectFit: 'contain' }}
                  onClick={() => setIsImageModalOpen(true)}
                />
                {/* Адрес сайта (только для анализа по URL) */}
                {analysisType === 'url' && report.url && (
                  <div className="flex justify-center mt-4">
                    <div className="bg-gray-800 rounded-lg px-4 py-2.5 flex items-center gap-2.5">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <span className="text-white text-sm font-medium">{report.url}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-4 max-w-3xl mx-auto">
                <div className="w-full bg-gray-200 animate-pulse" style={{ height: '300px' }}>
                  <div className="h-full flex items-center justify-center">
                    <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {/* Error Display на шаге 2 */}
            {error && (
              <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-red-800 mb-2">Произошла ошибка</h3>
                    <div className="text-sm text-red-700 mb-3 whitespace-pre-line">{error}</div>
                    <button
                      onClick={() => {
                        setError(null);
                        setStep(1);
                        setLoading(false);
                        setReport(null);
                        setReportId(null);
                        setStatus(null);
                      }}
                      className="text-sm text-red-800 underline hover:text-red-900"
                    >
                      Попробовать снова
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Модальное окно для увеличенного скриншота (шаг 2) */}
        {isImageModalOpen && report?.screenshots?.desktop && (
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

        {/* Шаг 3: Готовый отчет */}
        {step === 3 && report && reportId && (
          <div className="mb-8">
            {/* Кнопка "Назад" */}
            <div className="mb-4">
              <button
                onClick={handleBackClick}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Назад
              </button>
            </div>

            {/* Заголовок - Аудит проведен */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Аудит проведен
              </h2>
              <p className="text-lg text-gray-600">
                Результаты анализа {analysisType === 'url' ? 'вашего сайта' : 'вашего изображения'}
              </p>
            </div>

            {/* Полный отчет */}
            <div className="space-y-8">
              <ReportDisplay report={report} />
              <div className="max-w-2xl mx-auto">
                <LeadForm
                  reportId={reportId}
                  onSuccess={handleLeadSuccess}
                  onError={handleError}
                />
              </div>
            </div>
          </div>
        )}

        {/* Модальное окно подтверждения */}
        <ConfirmDialog
          isOpen={showConfirmDialog}
          title="Вернуться назад?"
          message="Весь результат анализа будет потерян. Вы уверены, что хотите вернуться к началу?"
          confirmText="Да, вернуться"
          cancelText="Отмена"
          onConfirm={handleConfirmBack}
          onCancel={handleCancelBack}
        />

        {/* Info Section (показываем только на шаге 1) */}
        {step === 1 && (
          <div className="mt-12 bg-white rounded-lg shadow-md p-8 max-w-3xl mx-auto">
            <h2 className="text-2xl font-semibold mb-4">Что анализирует ИИ?</h2>
            <ul className="space-y-2 text-gray-700">
              <li>• Визуальная иерархия и композиция</li>
              <li>• Цветовая схема и контрастность</li>
              <li>• Типографика и читаемость</li>
              <li>• Навигация и информационная архитектура</li>
              <li>• Интерактивность и призывы к действию</li>
              <li>• Эмоциональное воздействие и мотивация</li>
              <li>• Когнитивная нагрузка и простота использования</li>
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}

