'use client';

import type { DetailedReport } from '../../shared/types';
import { useState } from 'react';

interface DetailedReportDisplayProps {
  report: DetailedReport;
}

export default function DetailedReportDisplay({ report }: DetailedReportDisplayProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('executive');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Executive Summary */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-3xl font-bold mb-4">📊 Полный UX/UI отчёт</h2>
        
        <div className="mb-6">
          <div className="text-6xl font-bold text-blue-600 mb-2">
            {report.executiveSummary.overallScore}/100
          </div>
          <p className="text-gray-700 text-lg">{report.executiveSummary.summary}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <div>
            <h3 className="font-semibold text-green-700 mb-2">✅ Сильные стороны:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {report.executiveSummary.strengths.map((strength, i) => (
                <li key={i}>{strength}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-red-700 mb-2">❌ Слабые стороны:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {report.executiveSummary.weaknesses.map((weakness, i) => (
                <li key={i}>{weakness}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Visual Design */}
      <SectionCard
        title="🎨 Визуальный дизайн"
        score={report.visualDesign.score}
        expanded={expandedSection === 'visual'}
        onToggle={() => toggleSection('visual')}
      >
        <div>
          <h4 className="font-semibold mb-2">Сильные стороны:</h4>
          <ul className="list-disc list-inside space-y-1 mb-4">
            {report.visualDesign.strengths.map((s, i) => (
              <li key={i} className="text-sm">{s}</li>
            ))}
          </ul>
          {report.visualDesign.problems.length > 0 && (
            <>
              <h4 className="font-semibold mb-2">Проблемы:</h4>
              <ul className="list-disc list-inside space-y-1 mb-4">
                {report.visualDesign.problems.map((p, i) => (
                  <li key={i} className="text-sm">{p}</li>
                ))}
              </ul>
            </>
          )}
          {report.visualDesign.observations.length > 0 && (
            <>
              <h4 className="font-semibold mb-2">Наблюдения:</h4>
              <ul className="list-disc list-inside space-y-1">
                {report.visualDesign.observations.map((o, i) => (
                  <li key={i} className="text-sm">{o}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </SectionCard>

      {/* Typography */}
      <SectionCard
        title="📝 Типографика"
        score={report.typography.score}
        expanded={expandedSection === 'typography'}
        onToggle={() => toggleSection('typography')}
      >
        <div>
          <div className="mb-4">
            <p className="text-sm"><strong>Минимальный размер:</strong> {report.typography.minSize}px</p>
            <p className="text-sm"><strong>Максимальный размер:</strong> {report.typography.maxSize}px</p>
          </div>
          {report.typography.issues.length > 0 && (
            <>
              <h4 className="font-semibold mb-2">Проблемы:</h4>
              <ul className="list-disc list-inside space-y-1 mb-4">
                {report.typography.issues.map((issue, i) => (
                  <li key={i} className="text-sm">{issue.description}</li>
                ))}
              </ul>
            </>
          )}
          <h4 className="font-semibold mb-2">Рекомендации:</h4>
          <ul className="list-disc list-inside space-y-1">
            {report.typography.recommendations.map((rec, i) => (
              <li key={i} className="text-sm">{rec}</li>
            ))}
          </ul>
        </div>
      </SectionCard>

      {/* Colors & Contrast */}
      <SectionCard
        title="🎨 Цвета и контрастность"
        score={report.colorsContrast.score}
        expanded={expandedSection === 'contrast'}
        onToggle={() => toggleSection('contrast')}
      >
        <div>
          {report.colorsContrast.positivePoints.length > 0 && (
            <>
              <h4 className="font-semibold mb-2">Положительные моменты:</h4>
              <ul className="list-disc list-inside space-y-1 mb-4">
                {report.colorsContrast.positivePoints.map((p, i) => (
                  <li key={i} className="text-sm">{p}</li>
                ))}
              </ul>
            </>
          )}
          {report.colorsContrast.problems.length > 0 && (
            <>
              <h4 className="font-semibold mb-2">Проблемы:</h4>
              <ul className="list-disc list-inside space-y-1 mb-4">
                {report.colorsContrast.problems.map((p, i) => (
                  <li key={i} className="text-sm">{p}</li>
                ))}
              </ul>
            </>
          )}
          <h4 className="font-semibold mb-2">Рекомендации:</h4>
          <ul className="list-disc list-inside space-y-1">
            {report.colorsContrast.recommendations.map((rec, i) => (
              <li key={i} className="text-sm">{rec}</li>
            ))}
          </ul>
        </div>
      </SectionCard>

      {/* CTAs */}
      <SectionCard
        title="🎯 Призывы к действию (CTA)"
        score={report.ctas.score}
        expanded={expandedSection === 'ctas'}
        onToggle={() => toggleSection('ctas')}
      >
        <div>
          <p className="text-sm mb-4"><strong>Найдено CTA:</strong> {report.ctas.count}</p>
          {report.ctas.buttons.length > 0 && (
            <>
              <h4 className="font-semibold mb-2">Кнопки:</h4>
              <ul className="list-disc list-inside space-y-1 mb-4">
                {report.ctas.buttons.map((btn, i) => (
                  <li key={i} className="text-sm">
                    "{btn.text}" - {btn.location} ({btn.visibility})
                  </li>
                ))}
              </ul>
            </>
          )}
          {report.ctas.observations.length > 0 && (
            <>
              <h4 className="font-semibold mb-2">Наблюдения:</h4>
              <ul className="list-disc list-inside space-y-1 mb-4">
                {report.ctas.observations.map((obs, i) => (
                  <li key={i} className="text-sm">{obs}</li>
                ))}
              </ul>
            </>
          )}
          {report.ctas.recommendations.length > 0 && (
            <>
              <h4 className="font-semibold mb-2">Рекомендации:</h4>
              <ul className="list-disc list-inside space-y-1">
                {report.ctas.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm">{rec}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </SectionCard>

      {/* Performance */}
      <SectionCard
        title="⚡ Производительность"
        score={report.performance.score}
        expanded={expandedSection === 'performance'}
        onToggle={() => toggleSection('performance')}
      >
        <div>
          <p className="text-sm mb-4">
            <strong>Время загрузки:</strong> {(report.performance.loadTime / 1000).toFixed(2)} сек
          </p>
          <h4 className="font-semibold mb-2">Наблюдения:</h4>
          <ul className="list-disc list-inside space-y-1 mb-4">
            {report.performance.observations.map((obs, i) => (
              <li key={i} className="text-sm">{obs}</li>
            ))}
          </ul>
          <h4 className="font-semibold mb-2">Рекомендации:</h4>
          <ul className="list-disc list-inside space-y-1">
            {report.performance.recommendations.map((rec, i) => (
              <li key={i} className="text-sm">{rec}</li>
            ))}
          </ul>
        </div>
      </SectionCard>

      {/* Accessibility */}
      <SectionCard
        title="♿ Доступность (A11Y)"
        score={report.accessibility.score}
        expanded={expandedSection === 'accessibility'}
        onToggle={() => toggleSection('accessibility')}
      >
        <div>
          <p className="text-sm mb-4">
            <strong>Соответствие WCAG:</strong> {report.accessibility.wcagCompliance}
          </p>
          {report.accessibility.positivePoints.length > 0 && (
            <>
              <h4 className="font-semibold mb-2">Положительные моменты:</h4>
              <ul className="list-disc list-inside space-y-1 mb-4">
                {report.accessibility.positivePoints.map((p, i) => (
                  <li key={i} className="text-sm">{p}</li>
                ))}
              </ul>
            </>
          )}
          {report.accessibility.problems.length > 0 && (
            <>
              <h4 className="font-semibold mb-2">Проблемы:</h4>
              <ul className="list-disc list-inside space-y-1 mb-4">
                {report.accessibility.problems.map((p, i) => (
                  <li key={i} className="text-sm">{p}</li>
                ))}
              </ul>
            </>
          )}
          <h4 className="font-semibold mb-2">Рекомендации:</h4>
          <ul className="list-disc list-inside space-y-1">
            {report.accessibility.recommendations.map((rec, i) => (
              <li key={i} className="text-sm">{rec}</li>
            ))}
          </ul>
        </div>
      </SectionCard>

      {/* Action Plan */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-2xl font-semibold mb-4">📊 План действий</h3>
        
        {report.actionPlan.critical.length > 0 && (
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-red-700 mb-3">Критично (1 неделя):</h4>
            <div className="space-y-3">
              {report.actionPlan.critical.map((action, i) => (
                <ActionItemCard key={i} action={action} priority="critical" />
              ))}
            </div>
          </div>
        )}

        {report.actionPlan.important.length > 0 && (
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-yellow-700 mb-3">Важно (2-3 недели):</h4>
            <div className="space-y-3">
              {report.actionPlan.important.map((action, i) => (
                <ActionItemCard key={i} action={action} priority="important" />
              ))}
            </div>
          </div>
        )}

        {report.actionPlan.desirable.length > 0 && (
          <div>
            <h4 className="text-lg font-semibold text-blue-700 mb-3">Желательно (1 месяц):</h4>
            <div className="space-y-3">
              {report.actionPlan.desirable.map((action, i) => (
                <ActionItemCard key={i} action={action} priority="desirable" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SectionCardProps {
  title: string;
  score: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function SectionCard({ title, score, expanded, onToggle, children }: SectionCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={onToggle}
      >
        <h3 className="text-xl font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-blue-600">{score}/100</span>
          <span className="text-2xl">{expanded ? '▼' : '▶'}</span>
        </div>
      </div>
      {expanded && <div className="mt-4">{children}</div>}
    </div>
  );
}

interface ActionItemCardProps {
  action: {
    title: string;
    problem: string;
    solution: string;
    impact: string;
    timeframe: string;
  };
  priority: 'critical' | 'important' | 'desirable';
}

function ActionItemCard({ action, priority }: ActionItemCardProps) {
  const borderColor = {
    critical: 'border-red-500',
    important: 'border-yellow-500',
    desirable: 'border-blue-500',
  }[priority];

  return (
    <div className={`border-l-4 ${borderColor} p-4 bg-gray-50 rounded`}>
      <h5 className="font-semibold mb-2">{action.title}</h5>
      <p className="text-sm text-gray-700 mb-2"><strong>Проблема:</strong> {action.problem}</p>
      <p className="text-sm text-gray-700 mb-2"><strong>Решение:</strong> {action.solution}</p>
      <p className="text-sm text-gray-700 mb-2"><strong>Влияние:</strong> {action.impact}</p>
      <p className="text-sm text-gray-600"><strong>Срок:</strong> {action.timeframe}</p>
    </div>
  );
}


