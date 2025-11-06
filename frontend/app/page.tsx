'use client';

import { useState } from 'react';
import AuditForm from '@/components/AuditForm';
import ReportDisplay from '@/components/ReportDisplay';
import LeadForm from '@/components/LeadForm';
import type { AuditReport } from '../../shared/types';

export default function Home() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAuditStart = () => {
    setLoading(true);
    setError(null);
    setReport(null);
    setReportId(null);
  };

  const handleAuditComplete = (id: string, reportData: AuditReport) => {
    setReport(reportData);
    setReportId(id);
    setLoading(false);
    setError(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setLoading(false);
    setReport(null);
    setReportId(null);
  };

  const handleLeadSuccess = () => {
    // Можно показать уведомление или обновить состояние
    console.log('Lead submitted successfully');
  };

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            UX Audit Service
          </h1>
          <p className="text-xl text-gray-600">
            Автоматический анализ UX/UI вашего сайта
          </p>
        </div>

        {/* Audit Form */}
        <div className="mb-8">
          <AuditForm
            onAuditStart={handleAuditStart}
            onAuditComplete={handleAuditComplete}
            onError={handleError}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Анализ сайта...</p>
          </div>
        )}

        {/* Report Display */}
        {report && reportId && (
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
        )}

        {/* Info Section */}
        {!report && !loading && (
          <div className="mt-12 bg-white rounded-lg shadow-md p-8 max-w-3xl mx-auto">
            <h2 className="text-2xl font-semibold mb-4">Что мы проверяем?</h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Типографика и читаемость текста</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Контрастность цветов (WCAG AA)</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Призывы к действию (CTA)</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Скорость загрузки страницы</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Адаптивность для мобильных устройств</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Визуальный дизайн и композиция</span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}

