'use client';

import { useState, useRef, useEffect } from 'react';
import type { Issue } from '@/src/types';

interface ScreenshotWithAnnotationsProps {
  screenshot: string;
  issues: Issue[];
}

export default function ScreenshotWithAnnotations({ screenshot, issues }: ScreenshotWithAnnotationsProps) {
  const [hoveredIssue, setHoveredIssue] = useState<Issue | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Фильтруем issues с координатами
  const issuesWithBbox = issues.filter(issue => issue.bbox && Array.isArray(issue.bbox) && issue.bbox.length === 4);

  // Получаем размеры изображения
  useEffect(() => {
    const img = imageRef.current;
    if (img) {
      const updateSize = () => {
        setImageSize({
          width: img.offsetWidth,
          height: img.offsetHeight,
        });
      };

      if (img.complete) {
        updateSize();
      } else {
        img.onload = updateSize;
      }

      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
  }, [screenshot]);

  // Получаем реальные размеры исходного изображения
  const getOriginalImageSize = () => {
    const img = new Image();
    img.src = screenshot;
    return new Promise<{ width: number; height: number }>((resolve) => {
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
    });
  };

  const [originalSize, setOriginalSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    getOriginalImageSize().then(setOriginalSize);
  }, [screenshot]);

  // Вычисляем масштаб для преобразования координат
  const getScale = () => {
    if (!originalSize || imageSize.width === 0 || imageSize.height === 0) {
      return { scaleX: 1, scaleY: 1 };
    }
    return {
      scaleX: imageSize.width / originalSize.width,
      scaleY: imageSize.height / originalSize.height,
    };
  };

  const { scaleX, scaleY } = getScale();

  // Преобразуем координаты bbox в координаты относительно отображаемого изображения
  const getScaledBbox = (bbox: [number, number, number, number]) => {
    if (!originalSize) return bbox;
    return [
      bbox[0] * scaleX, // x1
      bbox[1] * scaleY, // y1
      bbox[2] * scaleX, // x2
      bbox[3] * scaleY, // y2
    ] as [number, number, number, number];
  };

  // Получаем цвет для приоритета
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-red-500';
      case 'High':
        return 'bg-orange-500';
      case 'Medium':
        return 'bg-yellow-500';
      case 'Low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Получаем цвет для severity
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'border-red-500 bg-red-50';
      case 'warning':
        return 'border-yellow-500 bg-yellow-50';
      default:
        return 'border-blue-500 bg-blue-50';
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block w-full" style={{ zIndex: 1 }}>
      <div className="relative" style={{ zIndex: 1 }}>
        <img
          ref={imageRef}
          src={screenshot}
          alt="Desktop скриншот"
          className="w-full h-auto rounded border border-gray-200"
          style={{ maxHeight: '600px', objectFit: 'contain' }}
        />

        {/* Аннотации на скриншоте */}
        {originalSize && imageSize.width > 0 && issuesWithBbox.map((issue, index) => {
          const bbox = issue.bbox!;
          const scaledBbox = getScaledBbox(bbox);
          const [x1, y1, x2, y2] = scaledBbox;
          const width = x2 - x1;
          const height = y2 - y1;

          return (
            <div
              key={index}
              className="absolute border-2 border-dashed cursor-pointer group"
              style={{
                left: `${x1}px`,
                top: `${y1}px`,
                width: `${width}px`,
                height: `${height}px`,
                borderColor: issue.severity === 'error' ? '#ef4444' : issue.severity === 'warning' ? '#f59e0b' : '#3b82f6',
                zIndex: hoveredIssue === issue ? 20 : 10,
              }}
              onMouseEnter={() => {
                setHoveredIssue(issue);
                // Вычисляем позицию tooltip
                const container = containerRef.current;
                if (container && typeof window !== 'undefined') {
                  const containerRect = container.getBoundingClientRect();
                  const tooltipWidth = 400;
                  const tooltipSpacing = 10;
                  
                  const issueLeft = containerRect.left + x1;
                  const issueRight = containerRect.left + x2;
                  const issueCenterY = containerRect.top + (y1 + y2) / 2;
                  
                  const spaceRight = window.innerWidth - issueRight;
                  const showOnRight = spaceRight >= tooltipWidth + tooltipSpacing;
                  
                  const tooltipLeft = showOnRight 
                    ? issueRight + tooltipSpacing
                    : issueLeft - tooltipWidth - tooltipSpacing;
                  
                  const finalLeft = Math.max(10, Math.min(tooltipLeft, window.innerWidth - tooltipWidth - 10));
                  const finalTop = Math.max(10, Math.min(issueCenterY, window.innerHeight - 200));
                  
                  setTooltipPosition({ left: finalLeft, top: finalTop });
                }
              }}
              onMouseLeave={() => {
                setHoveredIssue(null);
                setTooltipPosition(null);
              }}
            >
              {/* Индикатор приоритета */}
              {issue.priority && (
                <div
                  className={`absolute -top-2 -left-2 w-4 h-4 rounded-full ${getPriorityColor(issue.priority)} border-2 border-white shadow-md`}
                  title={issue.priority}
                />
              )}

              {/* Tooltip с информацией о проблеме */}
              {hoveredIssue === issue && tooltipPosition && (
                <div
                  className={`fixed z-[9999] p-3 rounded-lg shadow-2xl border-2 min-w-[300px] max-w-[400px] ${getSeverityColor(issue.severity)}`}
                  style={{
                    left: `${tooltipPosition.left}px`,
                    top: `${tooltipPosition.top}px`,
                    transform: 'translateY(-50%)',
                  }}
                  onMouseEnter={() => setHoveredIssue(issue)}
                  onMouseLeave={() => {
                    setHoveredIssue(null);
                    setTooltipPosition(null);
                  }}
                >
                  <div className="font-semibold text-sm mb-2">{issue.title}</div>
                  <div className="text-xs text-gray-700 mb-2 whitespace-pre-line">{issue.description.split('\n')[0]}</div>
                  
                  {issue.recommendation && (
                    <div className="text-xs text-gray-600 mt-2">
                      <span className="font-medium">💡 Рекомендация:</span> {issue.recommendation}
                    </div>
                  )}
                  
                  {issue.impact && (
                    <div className="text-xs text-gray-600 mt-1">
                      <span className="font-medium">📈 Влияние:</span> {issue.impact}
                    </div>
                  )}

                  {issue.priority && (
                    <div className="text-xs mt-2 pt-2 border-t border-gray-300">
                      <span className="font-medium">Приоритет:</span>{' '}
                      <span className={`px-2 py-0.5 rounded ${getPriorityColor(issue.priority)} text-white text-xs`}>
                        {issue.priority}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Легенда */}
      {issuesWithBbox.length > 0 && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs">
          <div className="font-semibold mb-2">Легенда:</div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 border border-white"></div>
              <span>Critical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500 border border-white"></div>
              <span>High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500 border border-white"></div>
              <span>Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 border border-white"></div>
              <span>Low</span>
            </div>
          </div>
          <div className="mt-2 text-gray-600">
            Наведите курсор на выделенные области, чтобы увидеть детали проблемы
          </div>
        </div>
      )}
    </div>
  );
}

