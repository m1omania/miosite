'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ReportDisplay from '@/components/ReportDisplay';
import LeadForm from '@/components/LeadForm';
import type { AuditReport } from '@/src/types';

export default function ReportPage() {
  const params = useParams();
  const reportId = params.id as string;
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        // Всегда используем относительный путь через Next.js API routes
        const apiEndpoint = `/api/report/${reportId}`;
        const response = await fetch(apiEndpoint);

        if (!response.ok) {
          throw new Error('Отчёт не найден');
        }

        const data = await response.json();
        setReport(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки отчёта');
      } finally {
        setLoading(false);
      }
    };

    if (reportId) {
      fetchReport();
    }
  }, [reportId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Загрузка отчёта...</p>
        </div>
      </main>
    );
  }

  if (error || !report) {
    return (
      <main className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Ошибка</h1>
          <p className="text-gray-700">{error || 'Отчёт не найден'}</p>
          <a
            href="/"
            className="mt-6 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Вернуться на главную
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <ReportDisplay report={report} />
        <div className="max-w-2xl mx-auto">
          <LeadForm
            reportId={reportId}
            onSuccess={() => {}}
            onError={(err) => setError(err)}
          />
        </div>
      </div>
    </main>
  );
}

