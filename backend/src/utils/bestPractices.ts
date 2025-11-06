import type { SiteMetrics, Issue, Recommendation } from '../../../shared/types.js';

export interface BestPracticeRule {
  category: string;
  rule: string;
  severity: 'error' | 'warning' | 'info';
  check: (metrics: SiteMetrics) => boolean | Issue | null;
}

export const bestPractices: BestPracticeRule[] = [
  {
    category: 'typography',
    rule: 'Минимальный размер шрифта должен быть не менее 12px',
    severity: 'error',
    check: (metrics) => {
      if (metrics.fontSizes.minSize < 12) {
        return {
          title: 'Слишком маленький шрифт',
          description: `Минимальный размер шрифта ${metrics.fontSizes.minSize}px меньше рекомендуемого минимума 12px`,
          severity: 'error',
          suggestion: 'Увеличьте размер мелких шрифтов до минимум 12px для улучшения читаемости',
        };
      }
      return null;
    },
  },
  {
    category: 'typography',
    rule: 'Рекомендуемый размер основного текста: 16px',
    severity: 'warning',
    check: (metrics) => {
      const mainFontSize = metrics.fontSizes.maxSize;
      if (mainFontSize < 14 || mainFontSize > 24) {
        return {
          title: 'Неоптимальный размер основного текста',
          description: `Основной размер текста ${mainFontSize}px. Рекомендуется 16-18px`,
          severity: 'warning',
          suggestion: 'Используйте размер 16-18px для основного текста',
        };
      }
      return null;
    },
  },
  {
    category: 'contrast',
    rule: 'Контрастность текста должна соответствовать WCAG AA (4.5:1)',
    severity: 'error',
    check: (metrics) => {
      if (metrics.contrast.issues.length > 0) {
        return {
          title: 'Проблемы с контрастностью',
          description: metrics.contrast.issues.join('; '),
          severity: 'error',
          suggestion: 'Улучшите контрастность текста для лучшей читаемости',
        };
      }
      return null;
    },
  },
  {
    category: 'cta',
    rule: 'На странице должна быть хотя бы одна CTA кнопка',
    severity: 'warning',
    check: (metrics) => {
      if (metrics.ctas.count === 0) {
        return {
          title: 'Отсутствуют призывы к действию',
          description: 'На странице не найдено CTA кнопок',
          severity: 'warning',
          suggestion: 'Добавьте явные призывы к действию для улучшения конверсии',
        };
      }
      return null;
    },
  },
  {
    category: 'performance',
    rule: 'Время загрузки страницы должно быть менее 3 секунд',
    severity: 'warning',
    check: (metrics) => {
      if (metrics.loadTime > 3000) {
        return {
          title: 'Медленная загрузка',
          description: `Время загрузки ${(metrics.loadTime / 1000).toFixed(1)} сек превышает рекомендуемое`,
          severity: 'warning',
          suggestion: 'Оптимизируйте изображения, используйте кэширование, минифицируйте CSS/JS',
        };
      }
      return null;
    },
  },
  {
    category: 'responsive',
    rule: 'Сайт должен иметь viewport meta тег для адаптивности',
    severity: 'error',
    check: (metrics) => {
      if (!metrics.hasViewport) {
        return {
          title: 'Отсутствует viewport meta тег',
          description: 'Сайт не адаптирован для мобильных устройств',
          severity: 'error',
          suggestion: 'Добавьте <meta name="viewport" content="width=device-width, initial-scale=1">',
        };
      }
      return null;
    },
  },
  {
    category: 'seo',
    rule: 'Страница должна иметь title тег',
    severity: 'warning',
    check: (metrics) => {
      if (!metrics.hasTitle) {
        return {
          title: 'Отсутствует title тег',
          description: 'Страница не имеет title, что негативно влияет на SEO',
          severity: 'warning',
          suggestion: 'Добавьте уникальный title тег для страницы',
        };
      }
      return null;
    },
  },
];

export function checkBestPractices(metrics: SiteMetrics): Issue[] {
  const issues: Issue[] = [];

  for (const practice of bestPractices) {
    const result = practice.check(metrics);
    if (result && typeof result === 'object' && 'title' in result) {
      issues.push(result as Issue);
    }
  }

  return issues;
}

export function generateRecommendations(issues: Issue[]): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Группируем по категориям
  const categories = new Set(issues.map(i => {
    if (i.title.includes('шрифт')) return 'typography';
    if (i.title.includes('контраст')) return 'contrast';
    if (i.title.includes('CTA') || i.title.includes('призыв')) return 'cta';
    if (i.title.includes('загрузк')) return 'performance';
    if (i.title.includes('viewport') || i.title.includes('адаптив')) return 'responsive';
    return 'general';
  }));

  for (const category of categories) {
    const categoryIssues = issues.filter(i => {
      const cat = i.title.includes('шрифт') ? 'typography' :
                  i.title.includes('контраст') ? 'contrast' :
                  i.title.includes('CTA') || i.title.includes('призыв') ? 'cta' :
                  i.title.includes('загрузк') ? 'performance' :
                  i.title.includes('viewport') || i.title.includes('адаптив') ? 'responsive' :
                  'general';
      return cat === category;
    });

    if (categoryIssues.length > 0) {
      const highPriority = categoryIssues.some(i => i.severity === 'error');
      recommendations.push({
        title: getCategoryTitle(category),
        description: categoryIssues.map(i => i.description).join('. '),
        impact: highPriority ? 'Высокое влияние на конверсию и пользовательский опыт' : 'Среднее влияние на UX',
        priority: highPriority ? 'high' : 'medium',
        steps: categoryIssues
          .filter(i => i.suggestion)
          .map(i => i.suggestion!)
          .slice(0, 3), // Максимум 3 шага
      });
    }
  }

  return recommendations;
}

function getCategoryTitle(category: string): string {
  const titles: Record<string, string> = {
    typography: 'Улучшить типографику',
    contrast: 'Повысить контрастность',
    cta: 'Добавить призывы к действию',
    performance: 'Оптимизировать скорость загрузки',
    responsive: 'Сделать сайт адаптивным',
    general: 'Общие улучшения',
  };
  return titles[category] || 'Улучшения';
}

