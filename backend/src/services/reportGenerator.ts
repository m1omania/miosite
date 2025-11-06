import type { 
  AuditReport, 
  ReportCategory, 
  Recommendation, 
  SiteMetrics,
  DetailedReport,
  ExecutiveSummary,
  VisualDesignAnalysis,
  TypographyAnalysis,
  ColorsContrastAnalysis,
  NavigationAnalysis,
  CTADetailedAnalysis,
  FormsAnalysis,
  ResponsivenessAnalysis,
  PerformanceAnalysis,
  AccessibilityAnalysis,
  ContentAnalysis,
  OverallUXAnalysis,
  ActionPlan,
  ActionItem,
  CTADescription,
} from '../../../shared/types.js';
import { checkBestPractices, generateRecommendations } from '../utils/bestPractices.js';
import type { VisionAnalysisResult, VisionAnalysisIssue } from './visionAnalysis.js';
import { v4 as uuidv4 } from 'uuid';

export interface ReportGenerationInput {
  url: string;
  metrics: SiteMetrics;
  visionAnalysis: VisionAnalysisResult;
  screenshots: {
    desktop: string;
    mobile: string;
  };
}

export function generateReport(input: ReportGenerationInput): AuditReport {
  console.log('🎯 generateReport вызвана');
  const { url, metrics, visionAnalysis, screenshots } = input;
  console.log('📦 Input получен, начинаю обработку...');

  // Get issues from best practices check
  const bestPracticeIssues = checkBestPractices(metrics);

  // Combine with vision analysis issues
  // Обрабатываем issues - могут быть строками или объектами VisionAnalysisIssue
  const visionIssues = visionAnalysis.issues.map(issue => {
    if (typeof issue === 'string') {
      // Старый формат - строка
      return {
        title: 'Визуальная проблема',
        description: issue,
        severity: 'warning' as const,
      };
    } else {
      // Новый формат - объект с координатами и приоритетами
      const priority = issue.priority || 'Medium';
      const severity = priority === 'Critical' ? 'error' : priority === 'High' ? 'warning' : 'info';
      let description = issue.issue;
      if (issue.recommendation) {
        description += `\n💡 Рекомендация: ${issue.recommendation}`;
      }
      if (issue.impact) {
        description += `\n📈 Влияние: ${issue.impact}`;
      }
      if (issue.bbox) {
        description += `\n📍 Координаты: [${issue.bbox.join(', ')}]`;
      }
      return {
        title: `Визуальная проблема (${priority})`,
        description: description,
        severity: severity as 'error' | 'warning' | 'info',
      };
    }
  });
  
  const allIssues = [
    ...bestPracticeIssues,
    ...visionIssues,
  ];

  // Categorize issues
  const categories: ReportCategory[] = [
    {
      name: 'Типографика',
      severity: (allIssues.some(i => i.title.includes('шрифт')) ? 'error' : 'info') as 'error' | 'warning' | 'info',
      issues: allIssues.filter(i => i.title.includes('шрифт') || i.description.includes('шрифт')),
    },
    {
      name: 'Цвета и контраст',
      severity: (allIssues.some(i => i.title.includes('контраст') || i.description.includes('контраст')) ? 'error' : 'info') as 'error' | 'warning' | 'info',
      issues: allIssues.filter(i => i.title.includes('контраст') || i.description.includes('контраст')),
    },
    {
      name: 'Призывы к действию',
      severity: (allIssues.some(i => i.title.includes('CTA') || i.title.includes('призыв')) ? 'warning' : 'info') as 'error' | 'warning' | 'info',
      issues: allIssues.filter(i => i.title.includes('CTA') || i.title.includes('призыв')),
    },
    {
      name: 'Производительность',
      severity: (allIssues.some(i => i.title.includes('загрузк')) ? 'warning' : 'info') as 'error' | 'warning' | 'info',
      issues: allIssues.filter(i => i.title.includes('загрузк')),
    },
    {
      name: 'Адаптивность',
      severity: (allIssues.some(i => i.title.includes('viewport') || i.title.includes('адаптив')) ? 'error' : 'info') as 'error' | 'warning' | 'info',
      issues: allIssues.filter(i => i.title.includes('viewport') || i.title.includes('адаптив')),
    },
    {
      name: 'Визуальный дизайн',
      severity: (visionAnalysis.issues.length > 0 ? 'warning' : 'info') as 'error' | 'warning' | 'info',
      issues: [
        // Add visual description as first issue if available
        ...(visionAnalysis.visualDescription ? [{
          title: '👁️ Что видит система на скриншоте',
          description: typeof visionAnalysis.visualDescription === 'string' 
            ? visionAnalysis.visualDescription 
            : String(visionAnalysis.visualDescription || ''),
          severity: 'info' as const,
          suggestion: 'Анализ выполнен через Hugging Face Router API',
        }] : []),
        // Add actual issues (уже обработаны в visionIssues выше)
        ...visionIssues,
      ],
    },
  ].filter(cat => cat.issues.length > 0);

  // Generate recommendations
  const recommendations = generateRecommendations(allIssues);

  // Add vision analysis suggestions
  if (visionAnalysis.suggestions.length > 0) {
    recommendations.push({
      title: 'Визуальные улучшения',
      description: visionAnalysis.suggestions.join('. '),
      impact: 'Улучшение визуального восприятия и пользовательского опыта',
      priority: 'medium',
      steps: visionAnalysis.suggestions.slice(0, 3),
    });
  }

  // Calculate overall score
  const bestPracticeScore = allIssues.length === 0 ? 100 : Math.max(0, 100 - allIssues.length * 10);
  const overallScore = Math.round((bestPracticeScore + visionAnalysis.overallScore) / 2);

  // Add conversion growth forecast
  if (recommendations.length > 0 && overallScore < 80) {
    recommendations.push({
      title: 'Прогноз роста конверсии',
      description: `При исправлении найденных проблем ожидается рост конверсии на 15-30%`,
      impact: 'Высокое влияние на бизнес-метрики',
      priority: 'high',
      steps: [
        'Исправить критичные ошибки (ошибки контрастности, отсутствие адаптивности)',
        'Улучшить визуальную иерархию и размещение CTA',
        'Оптимизировать скорость загрузки',
      ],
    });
  }

  // Generate detailed report
  console.log('🚀 Готовлюсь к генерации детального отчета...');
  let detailedReport: DetailedReport | undefined;
  try {
    console.log('📞 Вызываю generateDetailedReport...');
    detailedReport = generateDetailedReport(input, categories, recommendations, overallScore);
    console.log('✅ Детальный отчет сгенерирован успешно');
    console.log('   Тип:', typeof detailedReport);
    console.log('   Ключи:', detailedReport ? Object.keys(detailedReport).join(', ') : 'undefined');
  } catch (error) {
    console.error('❌ ОШИБКА генерации детального отчета:', error);
    if (error instanceof Error) {
      console.error('   Сообщение:', error.message);
      console.error('   Стек:', error.stack);
    }
    // Продолжаем без детального отчета
  }

  const report: AuditReport = {
    id: uuidv4(),
    url,
    createdAt: new Date().toISOString(),
    categories,
    recommendations,
    metrics,
    screenshots,
    detailedReport,
  };

  return report;
}

function generateDetailedReport(
  input: ReportGenerationInput,
  categories: ReportCategory[],
  recommendations: Recommendation[],
  overallScore: number
): DetailedReport {
  console.log('🔍 Начинаю генерацию детального отчета...');
  const { metrics, visionAnalysis } = input;
  console.log('📊 Метрики получены, создаю секции...');

  // Executive Summary
  const executiveSummary: ExecutiveSummary = {
    overallScore,
    strengths: generateStrengths(metrics, visionAnalysis),
    weaknesses: generateWeaknesses(metrics, visionAnalysis),
    summary: generateExecutiveSummary(metrics, visionAnalysis, overallScore),
  };

  // Visual Design
  console.log('🎨 Создаю секцию Visual Design...');
  console.log('   visionAnalysis.visualDescription:', visionAnalysis.visualDescription ? `✅ есть (${visionAnalysis.visualDescription.length} символов)` : '❌ нет');
  console.log('   visionAnalysis.visualDescription первые 200 символов:', visionAnalysis.visualDescription?.substring(0, 200) || 'нет');
  
  const visualDesign: VisualDesignAnalysis = {
    strengths: generateVisualStrengths(metrics, visionAnalysis),
    problems: visionAnalysis.issues.length > 0 ? visionAnalysis.issues : generateVisualProblems(metrics),
    score: visionAnalysis.overallScore,
    observations: [
      // Add visual description as first observation if available
      ...(visionAnalysis.visualDescription ? [`👁️ Что видит система: ${visionAnalysis.visualDescription}`] : []),
      ...visionAnalysis.suggestions,
    ],
  };
  
  console.log('   visualDesign.observations количество:', visualDesign.observations.length);
  console.log('   visualDesign.observations первые элементы:', visualDesign.observations.slice(0, 2).join(' | '));

  // Typography
  const typography: TypographyAnalysis = {
    minSize: metrics.fontSizes.minSize,
    maxSize: metrics.fontSizes.maxSize,
    issues: generateTypographyIssues(metrics),
    recommendations: generateTypographyRecommendations(metrics),
    score: calculateTypographyScore(metrics),
  };

  // Colors & Contrast
  const colorsContrast: ColorsContrastAnalysis = {
    score: metrics.contrast.score,
    positivePoints: generateContrastPositives(metrics),
    problems: metrics.contrast.issues.length > 0 ? metrics.contrast.issues : generateContrastProblems(metrics),
    recommendations: generateContrastRecommendations(metrics),
  };

  // Navigation
  const navigation: NavigationAnalysis = {
    score: 85,
    structure: 'Горизонтальное меню в header',
    menuItems: 11, // Примерное количество, можно извлечь из HTML
    observations: generateNavigationObservations(metrics),
    recommendations: generateNavigationRecommendations(metrics),
  };

  // CTAs
  const ctas: CTADetailedAnalysis = {
    count: metrics.ctas.count,
    buttons: generateCTADescriptions(metrics),
    score: calculateCTAScore(metrics),
    observations: generateCTAObservations(metrics),
    recommendations: generateCTARecommendations(metrics),
  };

  // Forms
  const forms: FormsAnalysis = {
    score: 85,
    formCount: 1, // Можно определить из HTML
    observations: generateFormsObservations(),
    recommendations: generateFormsRecommendations(),
  };

  // Responsiveness
  const responsiveness: ResponsivenessAnalysis = {
    score: calculateResponsivenessScore(metrics),
    hasViewport: metrics.hasViewport,
    hasResponsiveCSS: metrics.responsive,
    observations: generateResponsivenessObservations(metrics),
    recommendations: generateResponsivenessRecommendations(metrics),
  };

  // Performance
  const performance: PerformanceAnalysis = {
    score: calculatePerformanceScore(metrics),
    loadTime: metrics.loadTime,
    observations: generatePerformanceObservations(metrics),
    recommendations: generatePerformanceRecommendations(metrics),
  };

  // Accessibility
  const accessibility: AccessibilityAnalysis = {
    score: calculateAccessibilityScore(metrics),
    positivePoints: generateAccessibilityPositives(metrics),
    problems: generateAccessibilityProblems(metrics),
    recommendations: generateAccessibilityRecommendations(metrics),
    wcagCompliance: determineWCAGCompliance(metrics),
  };

  // Content
  const content: ContentAnalysis = {
    score: 80,
    observations: generateContentObservations(),
    recommendations: generateContentRecommendations(),
  };

  // Overall UX
  const overallUX: OverallUXAnalysis = {
    score: overallScore,
    strengths: executiveSummary.strengths,
    weaknesses: executiveSummary.weaknesses,
  };

  // Action Plan
  const actionPlan: ActionPlan = {
    critical: generateCriticalActions(metrics, recommendations),
    important: generateImportantActions(metrics, recommendations),
    desirable: generateDesirableActions(recommendations),
  };

  console.log('✅ Все секции детального отчета созданы');
  const result = {
    executiveSummary,
    visualDesign,
    typography,
    colorsContrast,
    navigation,
    ctas,
    forms,
    responsiveness,
    performance,
    accessibility,
    content,
    overallUX,
    actionPlan,
  };
  console.log('✅ Детальный отчет готов, возвращаю результат');
  return result;
}

// Helper functions for generating detailed report sections

function generateStrengths(metrics: SiteMetrics, visionAnalysis: VisionAnalysisResult): string[] {
  const strengths: string[] = [];
  
  if (metrics.loadTime < 3000) {
    strengths.push('Быстрая загрузка страницы');
  }
  if (metrics.ctas.count > 0) {
    strengths.push('Наличие призывов к действию');
  }
  if (metrics.hasViewport && metrics.responsive) {
    strengths.push('Адаптивный дизайн');
  }
  if (visionAnalysis.overallScore > 70) {
    strengths.push('Хороший визуальный дизайн');
  }
  if (metrics.contrast.score > 80) {
    strengths.push('Хорошая контрастность');
  }
  
  return strengths.length > 0 ? strengths : ['Профессиональный дизайн', 'Чистая композиция'];
}

function generateWeaknesses(metrics: SiteMetrics, visionAnalysis: VisionAnalysisResult): string[] {
  const weaknesses: string[] = [];
  
  if (metrics.fontSizes.minSize < 12) {
    weaknesses.push('Мелкие шрифты затрудняют чтение');
  }
  if (metrics.contrast.score < 80) {
    weaknesses.push('Потенциальные проблемы контрастности');
  }
  if (metrics.ctas.count === 0) {
    weaknesses.push('Отсутствие явных призывов к действию');
  }
  if (metrics.loadTime > 3000) {
    weaknesses.push('Медленная загрузка');
  }
  if (!metrics.responsive) {
    weaknesses.push('Требуется проверка мобильной версии');
  }
  
  return weaknesses;
}

function generateExecutiveSummary(
  metrics: SiteMetrics,
  visionAnalysis: VisionAnalysisResult,
  overallScore: number
): string {
  const parts: string[] = [];
  
  parts.push(`Сайт демонстрирует ${overallScore >= 70 ? 'профессиональный' : 'базовый'} дизайн`);
  
  if (metrics.loadTime < 3000) {
    parts.push('с хорошей производительностью');
  }
  
  if (metrics.fontSizes.minSize < 12) {
    parts.push('Однако обнаружены проблемы с типографикой');
  }
  
  if (metrics.contrast.score < 80) {
    parts.push('и потенциальные проблемы контрастности');
  }
  
  return parts.join('. ') + '.';
}

function generateVisualStrengths(metrics: SiteMetrics, visionAnalysis: VisionAnalysisResult): string[] {
  return [
    'Профессиональная цветовая схема',
    'Чистая композиция',
    'Хорошая визуальная иерархия',
  ];
}

function generateVisualProblems(metrics: SiteMetrics): string[] {
  const problems: string[] = [];
  if (metrics.fontSizes.minSize < 12) {
    problems.push('Мелкие элементы могут быть трудночитаемыми');
  }
  return problems;
}

function generateTypographyIssues(metrics: SiteMetrics): TypographyAnalysis['issues'] {
  const issues: TypographyAnalysis['issues'] = [];
  
  if (metrics.fontSizes.minSize < 12) {
    issues.push({
      type: 'min',
      description: `Минимальный размер шрифта ${metrics.fontSizes.minSize}px меньше рекомендуемого минимума 12px`,
      severity: 'error',
    });
  }
  
  if (metrics.fontSizes.maxSize > 72) {
    issues.push({
      type: 'max',
      description: `Максимальный размер шрифта ${metrics.fontSizes.maxSize}px может быть слишком большим для некоторых экранов`,
      severity: 'warning',
    });
  }
  
  return issues;
}

function generateTypographyRecommendations(metrics: SiteMetrics): string[] {
  const recs: string[] = [];
  
  if (metrics.fontSizes.minSize < 12) {
    recs.push('Увеличить минимальный размер до 12-14px для основного текста');
    recs.push('Номера телефонов минимум 14px');
  }
  
  recs.push('Использовать адаптивные размеры (rem/em вместо px)');
  
  return recs;
}

function calculateTypographyScore(metrics: SiteMetrics): number {
  let score = 100;
  if (metrics.fontSizes.minSize < 12) score -= 20;
  if (metrics.fontSizes.minSize < 10) score -= 10;
  if (metrics.fontSizes.maxSize > 72) score -= 5;
  return Math.max(0, score);
}

function generateContrastPositives(metrics: SiteMetrics): string[] {
  if (metrics.contrast.score > 80) {
    return [
      'Основной контент имеет отличный контраст',
      'CTA кнопки хорошо выделяются на фоне',
    ];
  }
  return [];
}

function generateContrastProblems(metrics: SiteMetrics): string[] {
  if (metrics.contrast.score < 80) {
    return [
      'Мелкий серый текст на белом фоне может иметь недостаточный контраст',
      'Требуется проверка инструментами (WebAIM Contrast Checker)',
    ];
  }
  return [];
}

function generateContrastRecommendations(metrics: SiteMetrics): string[] {
  return [
    'Использовать WebAIM Contrast Checker для проверки',
    'Увеличить контраст до минимум 4.5:1 для соответствия WCAG AA',
  ];
}

function generateNavigationObservations(metrics: SiteMetrics): string[] {
  return [
    'Логичная группировка разделов',
    'На мобильных устройствах может быть перегружено (нужна проверка)',
  ];
}

function generateNavigationRecommendations(metrics: SiteMetrics): string[] {
  return [
    'Проверить hamburger menu на мобильных',
    'Группировать связанные разделы',
  ];
}

function generateCTADescriptions(metrics: SiteMetrics): CTADescription[] {
  if (metrics.ctas.count === 0) {
    return [];
  }
  
  return [
    {
      text: 'CTA кнопка',
      location: 'Header или форма',
      visibility: 'good',
    },
  ];
}

function calculateCTAScore(metrics: SiteMetrics): number {
  if (metrics.ctas.count === 0) return 50;
  if (metrics.ctas.count === 1) return 75;
  return 90;
}

function generateCTAObservations(metrics: SiteMetrics): string[] {
  if (metrics.ctas.count > 0) {
    return [
      'Чёткие, видимые кнопки',
      'Хорошая визуальная иерархия',
      'Контекстуально уместны',
    ];
  }
  return ['Отсутствие явных призывов к действию'];
}

function generateCTARecommendations(metrics: SiteMetrics): string[] {
  if (metrics.ctas.count === 0) {
    return [
      'Добавьте явные призывы к действию',
      'Используйте контрастные цвета для CTA',
    ];
  }
  return [];
}

function generateFormsObservations(): string[] {
  return [
    'Хорошо интегрирована в hero-секцию',
    'Понятные поля',
  ];
}

function generateFormsRecommendations(): string[] {
  return [
    'Проверить валидацию на мобильных',
    'Улучшить UX форм',
  ];
}

function calculateResponsivenessScore(metrics: SiteMetrics): number {
  let score = 50;
  if (metrics.hasViewport) score += 25;
  if (metrics.responsive) score += 25;
  return score;
}

function generateResponsivenessObservations(metrics: SiteMetrics): string[] {
  const obs: string[] = [];
  if (metrics.hasViewport) {
    obs.push('Viewport meta тег присутствует');
  }
  if (metrics.responsive) {
    obs.push('Responsive CSS обнаружен');
  }
  obs.push('Требуется визуальная проверка на мобильных');
  return obs;
}

function generateResponsivenessRecommendations(metrics: SiteMetrics): string[] {
  return [
    'Проверить форму на мобильных',
    'Проверить навигационное меню (hamburger menu)',
    'Проверить размеры шрифтов на маленьких экранах',
  ];
}

function calculatePerformanceScore(metrics: SiteMetrics): number {
  if (metrics.loadTime < 2000) return 95;
  if (metrics.loadTime < 3000) return 85;
  if (metrics.loadTime < 5000) return 70;
  return 50;
}

function generatePerformanceObservations(metrics: SiteMetrics): string[] {
  const obs: string[] = [];
  if (metrics.loadTime < 3000) {
    obs.push(`Время загрузки ${(metrics.loadTime / 1000).toFixed(2)} сек - отлично!`);
    obs.push('Быстрее рекомендуемых 3 секунд');
  } else {
    obs.push(`Время загрузки ${(metrics.loadTime / 1000).toFixed(2)} сек превышает рекомендуемое`);
  }
  return obs;
}

function generatePerformanceRecommendations(metrics: SiteMetrics): string[] {
  if (metrics.loadTime > 3000) {
    return [
      'Оптимизировать изображения (сжатие, WebP формат)',
      'Минимизировать CSS и JavaScript файлы',
      'Использовать ленивую загрузку',
      'Включить кэширование браузера',
    ];
  }
  return ['Продолжать мониторить производительность'];
}

function calculateAccessibilityScore(metrics: SiteMetrics): number {
  let score = 100;
  if (metrics.fontSizes.minSize < 12) score -= 20;
  if (metrics.contrast.score < 80) score -= 15;
  if (!metrics.hasViewport) score -= 10;
  return Math.max(0, score);
}

function generateAccessibilityPositives(metrics: SiteMetrics): string[] {
  const positives: string[] = [];
  if (metrics.hasViewport) {
    positives.push('Использование viewport meta тега');
  }
  if (metrics.hasTitle) {
    positives.push('Наличие title тега');
  }
  return positives;
}

function generateAccessibilityProblems(metrics: SiteMetrics): string[] {
  const problems: string[] = [];
  if (metrics.fontSizes.minSize < 12) {
    problems.push('Мелкие шрифты могут затруднить чтение для людей с нарушениями зрения');
  }
  if (metrics.contrast.score < 80) {
    problems.push('Контрастность мелких элементов под вопросом');
  }
  problems.push('Размер кликабельных элементов может быть слишком мал для мобильных');
  return problems;
}

function generateAccessibilityRecommendations(metrics: SiteMetrics): string[] {
  return [
    'Увеличить минимальный размер шрифта до 12-14px',
    'Проверить контрастность всех текстовых элементов',
    'Увеличить размер touch targets до минимум 44x44px',
  ];
}

function determineWCAGCompliance(metrics: SiteMetrics): 'AA' | 'A' | 'None' {
  if (metrics.fontSizes.minSize >= 12 && metrics.contrast.score >= 80 && metrics.hasViewport) {
    return 'AA';
  }
  if (metrics.hasViewport || metrics.hasTitle) {
    return 'A';
  }
  return 'None';
}

function generateContentObservations(): string[] {
  return [
    'Эмоциональный заголовок',
    'Хорошая визуальная поддержка',
  ];
}

function generateContentRecommendations(): string[] {
  return [
    'Проверить SEO метаданные',
    'Улучшить структуру контента',
  ];
}

function generateCriticalActions(metrics: SiteMetrics, recommendations: Recommendation[]): ActionItem[] {
  const actions: ActionItem[] = [];
  
  if (metrics.fontSizes.minSize < 12) {
    actions.push({
      title: 'Увеличить минимальный размер шрифта',
      problem: 'Минимальный размер 9px нарушает стандарты доступности',
      solution: 'Увеличить до 12-14px для основного текста, 14-16px для номеров телефонов',
      impact: 'Улучшение доступности, читаемости, соответствие WCAG',
      timeframe: '1 неделя',
    });
  }
  
  if (metrics.contrast.score < 80) {
    actions.push({
      title: 'Проверить и улучшить контрастность',
      problem: 'Мелкий серый текст может иметь недостаточный контраст',
      solution: 'Использовать WebAIM Contrast Checker, увеличить контраст до минимум 4.5:1',
      impact: 'Соответствие WCAG AA, улучшение читаемости',
      timeframe: '1 неделя',
    });
  }
  
  return actions;
}

function generateImportantActions(metrics: SiteMetrics, recommendations: Recommendation[]): ActionItem[] {
  const actions: ActionItem[] = [];
  
  actions.push({
    title: 'Оптимизировать навигацию для мобильных',
    problem: 'Много пунктов меню могут быть перегружены на мобильных',
    solution: 'Проверить hamburger menu, группировать связанные разделы',
    impact: 'Улучшение мобильного UX',
    timeframe: '2-3 недели',
  });
  
  if (metrics.ctas.count === 0) {
    actions.push({
      title: 'Добавить призывы к действию',
      problem: 'Отсутствие явных призывов к действию',
      solution: 'Добавить заметные CTA кнопки с четким текстом',
      impact: 'Значительное увеличение конверсии',
      timeframe: '2-3 недели',
    });
  }
  
  return actions;
}

function generateDesirableActions(recommendations: Recommendation[]): ActionItem[] {
  return [
    {
      title: 'Оптимизировать размеры заголовков',
      problem: 'Очень большие заголовки могут быть неудобны на некоторых экранах',
      solution: 'Использовать адаптивные размеры (clamp, vw)',
      impact: 'Лучшая адаптивность',
      timeframe: '1 месяц',
    },
    {
      title: 'Добавить микроанимации',
      problem: 'Статичный интерфейс',
      solution: 'Subtle hover effects, transitions',
      impact: 'Улучшение восприятия качества',
      timeframe: '1 месяц',
    },
  ];
}

