import { NextRequest, NextResponse } from 'next/server';

// Шаблоны заголовков для генерации
const HEADLINE_TEMPLATES = [
  'Улучшите свой {activity}',
  'Лучшее решение для {activity}',
  'Профессиональный {activity}',
  'Эффективный {activity}',
  'Современный {activity}',
  'Надежный {activity}',
  'Быстрый {activity}',
  'Удобный {activity}',
  'Инновационный {activity}',
  'Проверенный {activity}',
  'Экспертный {activity}',
  'Качественный {activity}',
  'Оптимальный {activity}',
  'Продвинутый {activity}',
  'Уникальный {activity}',
  'Откройте для себя {activity}',
  'Премиум {activity}',
  'Эксклюзивный {activity}',
  'Проверенное {activity}',
  'Топовое {activity}',
];

// Ключевые слова для замены
const KEYWORDS = [
  'разработка',
  'платформа',
  'сервис',
  'решение',
  'инструмент',
  'система',
  'технология',
  'продукт',
];

// Обновленные требования к платформам
const PLATFORM_REQUIREMENTS = {
  yandex_rsya: { 
    maxLength: 125, 
    recommendedLength: 75,
    name: 'Яндекс РСЯ',
    description: 'Максимум 125 символов (рекомендуется до 75)'
  },
  google_ads: { 
    maxLength: 30, 
    name: 'Google Ads',
    description: 'До 30 символов (3 заголовка)'
  },
  facebook_ads: { 
    maxLength: 40, 
    name: 'Facebook Ads',
    description: 'До 40 символов'
  },
  vk_ads: { 
    maxLength: 60, 
    name: 'VK Реклама',
    description: 'До 60 символов'
  },
  yandex_direct: { 
    maxLength: 33, 
    maxLength2: 75,
    name: 'Яндекс.Директ',
    description: 'Заголовок 1: до 33 символов, Заголовок 2: до 75 символов'
  },
  instagram_ads: { 
    maxLength: 40, 
    name: 'Instagram Ads',
    description: 'До 40 символов'
  },
};

// Функция для генерации заголовков на основе шаблонов с учетом максимальной длины
function generateHeadlines(
  companyActivity: string, 
  keyBenefits: string | undefined,
  maxLength: number
): string[] {
  const headlines: string[] = [];
  
  // Извлекаем ключевые слова из описания деятельности
  const activityWords = companyActivity
    .toLowerCase()
    .split(/[\s,\.]+/)
    .filter(word => word.length > 2)
    .slice(0, 8);
  
  // Генерируем заголовки на основе шаблонов
  const templates = [...HEADLINE_TEMPLATES];
  
  // Если есть ключевые слова, используем их
  if (keyBenefits) {
    const benefits = keyBenefits.split(/[\s,\.]+/).filter(w => w.length > 2).slice(0, 5);
    benefits.forEach(benefit => {
      templates.push(`{activity} с ${benefit}`);
      templates.push(`${benefit} для {activity}`);
      templates.push(`{activity}: ${benefit}`);
    });
  }
  
  // Генерируем заголовки
  templates.forEach(template => {
    // Заменяем {activity} на ключевые слова
    activityWords.forEach(word => {
      const headline = template.replace('{activity}', word);
      if (headline.length <= maxLength && !headlines.includes(headline)) {
        headlines.push(headline);
      }
    });
    
    // Также используем полное описание, если оно подходит
    if (companyActivity.length <= maxLength - 20) {
      const shortActivity = companyActivity.substring(0, maxLength - 20).toLowerCase();
      const headline = template.replace('{activity}', shortActivity);
      if (headline.length <= maxLength && !headlines.includes(headline)) {
        headlines.push(headline);
      }
    }
  });
  
  // Добавляем простые заголовки на основе ключевых слов
  KEYWORDS.forEach(keyword => {
    if (headlines.length < 20) {
      activityWords.forEach(word => {
        const headline = `${word} ${keyword}`;
        if (headline.length <= maxLength && !headlines.includes(headline)) {
          headlines.push(headline);
        }
      });
    }
  });
  
  // Убираем дубликаты, форматируем и ограничиваем
  return [...new Set(headlines)]
    .map(h => h.charAt(0).toUpperCase() + h.slice(1))
    .slice(0, 20);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyActivity, keyBenefits, platforms } = body;

    if (!companyActivity) {
      return NextResponse.json(
        { error: 'Описание деятельности компании обязательно' },
        { status: 400 }
      );
    }

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { error: 'Выберите хотя бы одну рекламную площадку' },
        { status: 400 }
      );
    }

    console.log('🔄 Генерация заголовков на основе шаблонов...');
    console.log('   Деятельность:', companyActivity.substring(0, 100));
    console.log('   Ключевые преимущества:', keyBenefits?.substring(0, 100) || 'не указаны');
    console.log('   Выбранные платформы:', platforms);

    // Генерируем заголовки для каждой выбранной платформы
    const result: Record<string, string[]> = {};
    const requirements: Record<string, any> = {};

    platforms.forEach((platform: string) => {
      const platformReq = PLATFORM_REQUIREMENTS[platform as keyof typeof PLATFORM_REQUIREMENTS];
      if (platformReq) {
        // Для Яндекс.Директ генерируем два типа заголовков
        if (platform === 'yandex_direct') {
          const yandexDirectReq = platformReq as typeof PLATFORM_REQUIREMENTS.yandex_direct;
          const headlines1 = generateHeadlines(companyActivity, keyBenefits, yandexDirectReq.maxLength);
          const headlines2 = generateHeadlines(companyActivity, keyBenefits, yandexDirectReq.maxLength2 || 75);
          result[`${platform}_1`] = headlines1;
          result[`${platform}_2`] = headlines2;
          requirements[`${platform}_1`] = { ...yandexDirectReq, maxLength: yandexDirectReq.maxLength, name: `${yandexDirectReq.name} (Заголовок 1)` };
          requirements[`${platform}_2`] = { ...yandexDirectReq, maxLength: yandexDirectReq.maxLength2 || 75, name: `${yandexDirectReq.name} (Заголовок 2)` };
        } else {
          const headlines = generateHeadlines(companyActivity, keyBenefits, platformReq.maxLength);
          result[platform] = headlines;
          requirements[platform] = platformReq;
        }
      }
    });

    // Собираем все заголовки для общего списка
    const allHeadlines: string[] = [];
    Object.values(result).forEach(headlines => {
      allHeadlines.push(...headlines);
    });
    result.all = [...new Set(allHeadlines)];

    if (result.all.length === 0) {
      return NextResponse.json(
        { error: 'Не удалось сгенерировать заголовки' },
        { status: 500 }
      );
    }

    console.log('✅ Сгенерировано заголовков:', result.all.length);

    return NextResponse.json({
      success: true,
      headlines: result,
      requirements: requirements
    });

  } catch (error: any) {
    console.error('Banner headlines generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Ошибка при генерации заголовков' },
      { status: 500 }
    );
  }
}
