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
} from '../types.js';
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
  reportId?: string; // Опциональный ID отчета (если не передан, генерируется новый)
}

export function generateReport(input: ReportGenerationInput): AuditReport {
  console.log('🎯 generateReport вызвана');
  const { url, metrics, visionAnalysis, screenshots, reportId } = input;
  console.log('📦 Input получен, начинаю обработку...');

  // Используем ТОЛЬКО AI рекомендации из visionAnalysis
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
      // НЕ добавляем координаты в description - они должны быть только в bbox
      // if (issue.bbox) {
      //   description += `\n📍 Координаты: [${issue.bbox.join(', ')}]`;
      // }
      
      const result = {
        title: `Визуальная проблема (${priority})`,
        description: description,
        severity: severity as 'error' | 'warning' | 'info',
        bbox: issue.bbox, // Сохраняем координаты для отображения на скриншоте
        recommendation: issue.recommendation,
        priority: issue.priority,
        impact: issue.impact,
      };
      
      // Логируем для отладки
      if (issue.bbox) {
        console.log('   ✅ Сохранены координаты bbox:', issue.bbox);
      } else {
        console.log('   ⚠️  Координаты bbox отсутствуют для проблемы:', issue.issue?.substring(0, 50));
      }
      
      return result;
    }
  });
  
  // Логируем общее количество issues с координатами
  const issuesWithBbox = visionIssues.filter((i): i is typeof i & { bbox: [number, number, number, number] } => {
    return typeof i !== 'string' && 'bbox' in i && i.bbox !== undefined && Array.isArray(i.bbox) && i.bbox.length === 4;
  });
  console.log('📊 Всего issues с координатами bbox:', issuesWithBbox.length, 'из', visionIssues.length);
  
  // Используем только issues от AI
  const allIssues = visionIssues;

  // Categorize issues and calculate scores
  // ВАЖНО: При фильтрации сохраняем все свойства issues, включая bbox
  const categories: ReportCategory[] = [
    {
      name: 'Типографика',
      severity: (allIssues.some(i => i.title.includes('шрифт')) ? 'error' : 'info') as 'error' | 'warning' | 'info',
      issues: allIssues.filter(i => i.title.includes('шрифт') || i.description.includes('шрифт')).map(issue => ({
        ...issue, // Сохраняем все свойства, включая bbox
      })),
      score: calculateCategoryScore('Типографика', allIssues, metrics, visionAnalysis),
    },
    {
      name: 'Цвета и контраст',
      severity: (allIssues.some(i => i.title.includes('контраст') || i.description.includes('контраст')) ? 'error' : 'info') as 'error' | 'warning' | 'info',
      issues: allIssues.filter(i => i.title.includes('контраст') || i.description.includes('контраст')).map(issue => ({
        ...issue, // Сохраняем все свойства, включая bbox
      })),
      score: calculateCategoryScore('Цвета и контраст', allIssues, metrics, visionAnalysis),
    },
    {
      name: 'Призывы к действию',
      severity: (allIssues.some(i => i.title.includes('CTA') || i.title.includes('призыв')) ? 'warning' : 'info') as 'error' | 'warning' | 'info',
      issues: allIssues.filter(i => i.title.includes('CTA') || i.title.includes('призыв')).map(issue => ({
        ...issue, // Сохраняем все свойства, включая bbox
      })),
      score: calculateCategoryScore('Призывы к действию', allIssues, metrics, visionAnalysis),
    },
    {
      name: 'Производительность',
      severity: (allIssues.some(i => i.title.includes('загрузк')) ? 'warning' : 'info') as 'error' | 'warning' | 'info',
      issues: allIssues.filter(i => i.title.includes('загрузк')).map(issue => ({
        ...issue, // Сохраняем все свойства, включая bbox
      })),
      score: calculateCategoryScore('Производительность', allIssues, metrics, visionAnalysis),
    },
    {
      name: 'Адаптивность',
      severity: (allIssues.some(i => i.title.includes('viewport') || i.title.includes('адаптив')) ? 'error' : 'info') as 'error' | 'warning' | 'info',
      issues: allIssues.filter(i => i.title.includes('viewport') || i.title.includes('адаптив')).map(issue => ({
        ...issue, // Сохраняем все свойства, включая bbox
      })),
      score: calculateCategoryScore('Адаптивность', allIssues, metrics, visionAnalysis),
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
      score: calculateCategoryScore('Визуальный дизайн', allIssues, metrics, visionAnalysis),
    },
  ].filter(cat => cat.issues.length > 0);

  // Генерируем рекомендации ТОЛЬКО если есть проблемы
  const recommendations: Recommendation[] = [];
  
  // Рекомендации показываем только если есть реальные проблемы (issues)
  if (allIssues.length > 0 && visionAnalysis.suggestions.length > 0) {
    visionAnalysis.suggestions.forEach((suggestion) => {
      if (typeof suggestion === 'string') {
        // Старый формат - строка
    recommendations.push({
          title: 'Рекомендация по улучшению',
          description: suggestion,
      impact: 'Улучшение визуального восприятия и пользовательского опыта',
      priority: 'medium',
          steps: [suggestion],
        });
      } else if (typeof suggestion === 'object' && suggestion !== null) {
        // Новый формат - объект с полями
    recommendations.push({
          title: suggestion.title || 'Рекомендация по улучшению',
          description: suggestion.description || '',
          impact: suggestion.impact || 'Улучшение визуального восприятия и пользовательского опыта',
          priority: (suggestion.priority || 'medium') as 'high' | 'medium' | 'low',
          steps: Array.isArray(suggestion.steps) ? suggestion.steps : [],
        });
      }
    });
  }

  // Используем только overallScore от AI
  const overallScore = visionAnalysis.overallScore;

  // Генерируем общее резюме по UX/UI
  // Используем свободный анализ для summary, если он есть и не пустой
  const summary = visionAnalysis.freeFormAnalysis && visionAnalysis.freeFormAnalysis.trim().length > 0
    ? generateUXSummaryFromFreeForm(visionAnalysis.freeFormAnalysis, visionAnalysis.overallScore)
    : generateUXSummary(metrics, visionAnalysis, overallScore, allIssues.length);

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
    id: reportId || uuidv4(),
    url,
    createdAt: new Date().toISOString(),
    categories,
    recommendations,
    metrics,
    screenshots,
    detailedReport,
    summary,
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
  const allIssues = categories.flatMap(cat => cat.issues);
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
    problems: visionAnalysis.issues.length > 0 ? visionAnalysis.issues.map(i => typeof i === 'string' ? i : i.issue) : [],
    score: visionAnalysis.overallScore,
    observations: [
      // Add visual description as first observation if available
      ...(visionAnalysis.visualDescription ? [`👁️ Что видит система: ${visionAnalysis.visualDescription}`] : []),
      ...visionAnalysis.suggestions.map(s => typeof s === 'string' ? s : s.title || s.description || ''),
    ],
  };
  
  console.log('   visualDesign.observations количество:', visualDesign.observations.length);
  console.log('   visualDesign.observations первые элементы:', visualDesign.observations.slice(0, 2).join(' | '));

  // Typography - используем только AI данные
  const typography: TypographyAnalysis = {
    minSize: metrics.fontSizes.minSize,
    maxSize: metrics.fontSizes.maxSize,
    issues: allIssues.filter(i => i.title.includes('шрифт') || i.description.includes('шрифт')).map(i => ({
      type: 'readability' as const,
      description: i.description,
      severity: i.severity,
    })),
    recommendations: recommendations.filter(r => r.title.includes('типографик') || r.description.includes('шрифт')).map(r => r.description),
    score: calculateTypographyScore(metrics),
  };

  // Colors & Contrast - используем только AI данные, синхронизированы с проблемами
  const contrastIssues = allIssues.filter(i => 
    i.title.toLowerCase().includes('контраст') || 
    i.description.toLowerCase().includes('контраст') ||
    i.title.toLowerCase().includes('contrast') ||
    i.description.toLowerCase().includes('contrast')
  );
  const contrastRecommendations = recommendations.filter(r => 
    r.title.toLowerCase().includes('контраст') || 
    r.description.toLowerCase().includes('контраст') ||
    r.title.toLowerCase().includes('contrast') ||
    r.description.toLowerCase().includes('contrast')
  );
  
  // Если AI нашел проблемы с контрастом, используем их; иначе используем метрики
  // Синхронизируем score: если есть проблемы от AI, score должен быть ниже
  let contrastScore = metrics.contrast.score;
  if (contrastIssues.length > 0) {
    // Если AI нашел проблемы, снижаем score на основе количества проблем
    contrastScore = Math.max(0, 100 - (contrastIssues.length * 15));
  } else if (contrastRecommendations.length > 0) {
    // Если есть рекомендации, но нет явных проблем, немного снижаем score
    contrastScore = Math.max(70, metrics.contrast.score - 10);
  }
  
  const colorsContrast: ColorsContrastAnalysis = {
    score: contrastScore,
    // Показываем positivePoints только если нет проблем от AI
    positivePoints: contrastIssues.length === 0 && contrastScore >= 80 ? generateContrastPositives(metrics) : [],
    problems: contrastIssues.map(i => i.description),
    // Показываем рекомендации только если есть проблемы
    recommendations: contrastIssues.length > 0 ? contrastRecommendations.map(r => r.description) : [],
  };

  // Navigation
  const navigation: NavigationAnalysis = {
    score: calculateNavigationScore(metrics),
    structure: detectNavigationStructure(metrics),
    menuItems: 0, // Парсинг навигации из HTML не реализован, используем 0
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
    score: calculateFormsScore(metrics),
    formCount: 0, // Парсинг форм из HTML не реализован, используем 0
    observations: generateFormsObservations(metrics),
    recommendations: generateFormsRecommendations(metrics),
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
    score: calculateContentScore(metrics, visionAnalysis),
    observations: generateContentObservations(metrics),
    recommendations: generateContentRecommendations(metrics),
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

function generateUXSummary(
  metrics: SiteMetrics,
  visionAnalysis: VisionAnalysisResult,
  overallScore: number,
  issuesCount: number
): { overallScore: number; summary: string; strengths: string[]; weaknesses: string[] } {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const parts: string[] = [];
  
  // Определяем общую оценку
  if (overallScore >= 85) {
    parts.push('Сайт демонстрирует отличный UX/UI дизайн');
  } else if (overallScore >= 70) {
    parts.push('Сайт демонстрирует хороший UX/UI дизайн');
  } else if (overallScore >= 50) {
    parts.push('Сайт имеет базовый UX/UI дизайн');
  } else {
    parts.push('Сайт требует значительных улучшений UX/UI');
  }
  
  // Сильные стороны
  if (overallScore >= 70) {
    strengths.push('Профессиональный визуальный дизайн');
  }
  
  if (metrics.loadTime < 3000) {
    strengths.push('Быстрая загрузка страницы');
    parts.push('с хорошей производительностью');
  }
  
  if (metrics.hasViewport && metrics.responsive) {
    strengths.push('Адаптивный дизайн для мобильных устройств');
  }
  
  if (metrics.contrast.score >= 80) {
    strengths.push('Хорошая контрастность текста');
  }
  
  if (metrics.ctas.count > 0) {
    strengths.push('Наличие призывов к действию');
  }
  
  if (visionAnalysis.visualDescription && visionAnalysis.visualDescription.length > 100) {
    strengths.push('Понятная структура и информационная архитектура');
  }
  
  // Слабые стороны
  if (issuesCount > 0) {
    weaknesses.push(`Обнаружено ${issuesCount} ${issuesCount === 1 ? 'проблема' : issuesCount < 5 ? 'проблемы' : 'проблем'}, требующих внимания`);
  }
  
  if (metrics.fontSizes.minSize < 12) {
    weaknesses.push('Мелкие шрифты могут затруднять чтение');
  }
  
  if (metrics.contrast.score < 80) {
    weaknesses.push('Проблемы с контрастностью текста');
  }
  
  if (metrics.ctas.count === 0) {
    weaknesses.push('Отсутствие явных призывов к действию');
  }
  
  if (metrics.loadTime > 3000) {
    weaknesses.push('Медленная загрузка страницы');
  }
  
  if (!metrics.hasViewport) {
    weaknesses.push('Отсутствие адаптивности для мобильных устройств');
  }
  
  // Формируем итоговое резюме
  if (issuesCount === 0) {
    parts.push('критических проблем не обнаружено');
  } else {
    parts.push(`обнаружено ${issuesCount} ${issuesCount === 1 ? 'проблема' : issuesCount < 5 ? 'проблемы' : 'проблем'}, требующих внимания`);
  }
  
  const summaryText = parts.join(', ') + '.';
  
  return {
    overallScore,
    summary: summaryText,
    strengths: strengths.length > 0 ? strengths : ['Дизайн соответствует базовым стандартам'],
    weaknesses: weaknesses.length > 0 ? weaknesses : [],
  };
}

/**
 * Генерирует summary из свободного анализа AI
 */
function generateUXSummaryFromFreeForm(
  freeFormAnalysis: string,
  overallScore: number
): { overallScore: number; summary: string; strengths: string[]; weaknesses: string[] } {
  if (!freeFormAnalysis || freeFormAnalysis.trim().length === 0) {
    // Если свободный анализ пустой, возвращаем базовое резюме
    return {
      overallScore,
      summary: 'Анализ выполнен успешно.',
      strengths: ['Дизайн соответствует базовым стандартам'],
      weaknesses: [],
    };
  }

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  
  // Извлекаем сильные стороны из свободного анализа
  const strengthsMatch = freeFormAnalysis.match(/сильн[ыая] сторон[ыа]?[:\n]([\s\S]*?)(?=проблем|област|рекомендац|итогов|$)/i);
  if (strengthsMatch && strengthsMatch[1]) {
    const strengthsText = strengthsMatch[1];
    const strengthLines = strengthsText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.match(/^[-*•]/))
      .filter(line => line.length > 10);
    strengths.push(...strengthLines.slice(0, 5)); // Максимум 5 сильных сторон
  }
  
  // Извлекаем проблемы/области для улучшения
  const weaknessesMatch = freeFormAnalysis.match(/проблем[ыа]?|област[и]? для улучшени[яя]?[:\n]([\s\S]*?)(?=рекомендац|итогов|$)/i);
  if (weaknessesMatch && weaknessesMatch[1]) {
    const weaknessesText = weaknessesMatch[1];
    const weaknessLines = weaknessesText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.match(/^[-*•]/))
      .filter(line => line.length > 10);
    weaknesses.push(...weaknessLines.slice(0, 5)); // Максимум 5 проблем
  }
  
  // Используем весь свободный анализ как summary
  // Улучшаем форматирование: убираем markdown, но сохраняем структуру
  let summaryText = freeFormAnalysis.trim();
  
  // Убираем markdown разметку, но сохраняем структуру
  summaryText = summaryText
    // Убираем ### перед заголовками, оставляем пустую строку перед ними
    .replace(/###\s*\*\*([^*]+)\*\*/g, '\n\n$1\n') // ### **Заголовок** -> Заголовок
    .replace(/###\s*([^\n]+)/g, '\n\n$1\n') // ### Заголовок -> Заголовок
    // Убираем жирный текст **текст** -> текст
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Убираем разделители ---
    .replace(/^---+$/gm, '')
    // Исправляем неправильную нумерацию подпунктов: "**1. Текст**" -> "- Текст"
    .replace(/\*\*\d+\.\s+([^*]+)\*\*/g, '- $1')
    .replace(/^\d+\.\s+([А-ЯЁ])/gm, '- $1')
    // Убираем упоминания "быстрая победа" и "Быстрая победа"
    .replace(/[Бб]ыстрая победа[:\s]*/gi, '')
    .replace(/\([Бб]ыстрая победа\)/gi, '')
    .replace(/[Бб]ыстрая победа[,\s]*/gi, '')
    // Убираем лишние пробелы и переносы
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  
  return {
    overallScore,
    summary: summaryText,
    strengths: strengths.length > 0 ? strengths : ['Дизайн соответствует базовым стандартам'],
    weaknesses: weaknesses.length > 0 ? weaknesses : [],
  };
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

// Удалены функции generateVisualProblems, generateTypographyIssues, generateTypographyRecommendations
// Теперь используются только AI данные из visionAnalysis

/**
 * Рассчитывает оценку для категории на основе проблем, метрик и AI анализа
 */
function calculateCategoryScore(
  categoryName: string,
  allIssues: any[],
  metrics: SiteMetrics,
  visionAnalysis: VisionAnalysisResult
): number {
  // Фильтруем проблемы для этой категории
  const categoryIssues = allIssues.filter(issue => {
    const title = issue.title?.toLowerCase() || '';
    const description = issue.description?.toLowerCase() || '';
    
    switch (categoryName) {
      case 'Типографика':
        return title.includes('шрифт') || description.includes('шрифт');
      case 'Цвета и контраст':
        return title.includes('контраст') || description.includes('контраст');
      case 'Призывы к действию':
        return title.includes('cta') || title.includes('призыв') || description.includes('cta') || description.includes('призыв');
      case 'Производительность':
        return title.includes('загрузк') || description.includes('загрузк');
      case 'Адаптивность':
        return title.includes('viewport') || title.includes('адаптив') || description.includes('viewport') || description.includes('адаптив');
      case 'Визуальный дизайн':
        return true; // Все проблемы попадают в визуальный дизайн
      default:
        return false;
    }
  });
  
  // Базовый расчет на основе метрик
  let score = 100;
  
  switch (categoryName) {
    case 'Типографика':
      // На основе размера шрифтов
      if (metrics.fontSizes.minSize < 12) score -= 20;
      if (metrics.fontSizes.minSize < 10) score -= 10;
      if (metrics.fontSizes.maxSize > 72) score -= 5;
      // Штраф за проблемы от AI
      categoryIssues.forEach(issue => {
        if (issue.severity === 'error') score -= 15;
        else if (issue.severity === 'warning') score -= 10;
        else score -= 5;
      });
      break;
      
    case 'Цвета и контраст':
      // На основе контраста
      score = metrics.contrast.score;
      // Штраф за проблемы от AI
      categoryIssues.forEach(issue => {
        if (issue.severity === 'error') score -= 10;
        else if (issue.severity === 'warning') score -= 5;
      });
      break;
      
    case 'Призывы к действию':
      // На основе количества CTA
      if (metrics.ctas.count === 0) score = 50;
      else if (metrics.ctas.count === 1) score = 75;
      else score = 90;
      // Штраф за проблемы от AI
      categoryIssues.forEach(issue => {
        if (issue.severity === 'error') score -= 15;
        else if (issue.severity === 'warning') score -= 10;
      });
      break;
      
    case 'Производительность':
      // На основе времени загрузки
      if (metrics.loadTime < 2000) score = 95;
      else if (metrics.loadTime < 3000) score = 85;
      else if (metrics.loadTime < 5000) score = 70;
      else score = 50;
      // Штраф за проблемы от AI
      categoryIssues.forEach(issue => {
        if (issue.severity === 'error') score -= 10;
        else if (issue.severity === 'warning') score -= 5;
      });
      break;
      
    case 'Адаптивность':
      // На основе viewport и responsive
      score = 50;
      if (metrics.hasViewport) score += 25;
      if (metrics.responsive) score += 25;
      // Штраф за проблемы от AI
      categoryIssues.forEach(issue => {
        if (issue.severity === 'error') score -= 15;
        else if (issue.severity === 'warning') score -= 10;
      });
      break;
      
    case 'Визуальный дизайн':
      // На основе overallScore от AI
      score = visionAnalysis.overallScore || 75;
      // Дополнительный штраф за количество проблем
      if (categoryIssues.length > 3) score -= 10;
      else if (categoryIssues.length > 1) score -= 5;
      break;
      
    default:
      // Если проблем нет - высокая оценка, если есть - снижаем
      if (categoryIssues.length === 0) score = 90;
      else {
        score = 100;
        categoryIssues.forEach(issue => {
          if (issue.severity === 'error') score -= 20;
          else if (issue.severity === 'warning') score -= 10;
          else score -= 5;
        });
      }
  }
  
  return Math.max(0, Math.min(100, score));
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

// Удалена функция generateContrastProblems - используем только AI данные

function generateContrastRecommendations(metrics: SiteMetrics): string[] {
  return [
    'Использовать WebAIM Contrast Checker для проверки',
    'Увеличить контраст до минимум 4.5:1 для соответствия WCAG AA',
  ];
}

function calculateNavigationScore(metrics: SiteMetrics): number {
  let score = 70;
  if (metrics.hasViewport) score += 10;
  if (metrics.responsive) score += 10;
  if (metrics.hasTitle) score += 10;
  return Math.min(100, score);
}

function detectNavigationStructure(metrics: SiteMetrics): string {
  // На основе доступных метрик определяем структуру навигации
  if (metrics.responsive) {
    return 'Адаптивная навигация';
  }
  return 'Навигация присутствует';
}

function generateNavigationObservations(metrics: SiteMetrics): string[] {
  const obs: string[] = [];
  if (metrics.responsive) {
    obs.push('Адаптивная навигация обнаружена');
  }
  if (metrics.hasViewport) {
    obs.push('Viewport настроен для мобильных устройств');
  }
  obs.push('Требуется визуальная проверка структуры навигации');
  return obs;
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
  
  // Генерируем описания на основе количества найденных CTA
  const descriptions: CTADescription[] = [];
  for (let i = 0; i < Math.min(metrics.ctas.count, 5); i++) {
    descriptions.push({
      text: `Призыв к действию ${i + 1}`,
      location: 'Требуется визуальная проверка расположения',
      visibility: 'good',
    });
  }
  return descriptions;
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

function calculateFormsScore(metrics: SiteMetrics): number {
  // Оценка форм на основе доступных метрик
  let score = 75;
  if (metrics.hasViewport) score += 10;
  if (metrics.responsive) score += 10;
  if (metrics.ctas.count > 0) score += 5; // Если есть CTA, возможно есть формы
  return Math.min(100, score);
}

function generateFormsObservations(metrics: SiteMetrics): string[] {
  const obs: string[] = [];
  if (metrics.responsive) {
    obs.push('Адаптивный дизайн поддерживает формы на мобильных');
  }
  if (metrics.hasViewport) {
    obs.push('Viewport настроен для корректного отображения форм');
  }
  obs.push('Требуется визуальная проверка наличия и качества форм');
  return obs;
}

function generateFormsRecommendations(metrics: SiteMetrics): string[] {
  const recs: string[] = [];
  if (!metrics.responsive) {
    recs.push('Проверить адаптивность форм на мобильных устройствах');
  }
  recs.push('Убедиться в наличии валидации полей');
  recs.push('Проверить доступность форм для пользователей с ограниченными возможностями');
  return recs;
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

function calculateContentScore(metrics: SiteMetrics, visionAnalysis: VisionAnalysisResult): number {
  // Оценка контента на основе метрик и визуального анализа
  let score = 75;
  if (metrics.hasTitle) score += 10;
  if (metrics.fontSizes.minSize >= 12) score += 5;
  if (visionAnalysis.visualDescription && visionAnalysis.visualDescription.length > 100) score += 10;
  return Math.min(100, score);
}

function generateContentObservations(metrics: SiteMetrics): string[] {
  const obs: string[] = [];
  if (metrics.hasTitle) {
    obs.push('Title тег присутствует');
  } else {
    obs.push('Отсутствует title тег - требуется для SEO');
  }
  if (metrics.fontSizes.minSize >= 12) {
    obs.push('Размер шрифта соответствует рекомендациям');
  } else {
    obs.push(`Минимальный размер шрифта ${metrics.fontSizes.minSize.toFixed(1)}px может быть слишком мал`);
  }
  obs.push('Требуется визуальная проверка качества и структуры контента');
  return obs;
}

function generateContentRecommendations(metrics: SiteMetrics): string[] {
  const recs: string[] = [];
  if (!metrics.hasTitle) {
    recs.push('Добавить title тег для улучшения SEO');
  }
  if (metrics.fontSizes.minSize < 12) {
    recs.push('Увеличить минимальный размер шрифта до 12px для лучшей читаемости');
  }
  recs.push('Проверить SEO метаданные (description, keywords)');
  recs.push('Улучшить структуру контента с использованием заголовков H1-H6');
  return recs;
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

