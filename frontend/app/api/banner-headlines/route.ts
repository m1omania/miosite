import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// Explicitly mark this route as dynamic
export const dynamic = 'force-dynamic';

// Промпт для генерации заголовков через AI
const HEADLINES_GENERATION_PROMPT = `Ты — эксперт по созданию рекламных заголовков для различных платформ (Яндекс РСЯ, Google Ads, Facebook Ads, VK Реклама, Яндекс.Директ, Instagram Ads).

Задача: Создай 20 качественных, осмысленных рекламных заголовков на русском языке на основе предоставленной информации о компании.

**КРИТИЧЕСКИ ВАЖНО:**
- Все заголовки должны быть на русском языке
- Заголовки должны быть осмысленными, конкретными, с выгодой для пользователя
- Избегай общих фраз типа "Улучши", "Лучшее решение" без контекста
- Используй конкретные цифры, факты, преимущества
- Учитывай целевую аудиторию и ключевые преимущества
- Заголовки должны вызывать интерес и мотивировать к действию

**Рекомендации для качественных заголовков:**
1. **Ясность и конкретность** — четко передавай суть предложения
2. **Выгода** — показывай, что получит пользователь (экономия времени, денег, решение проблемы)
3. **Целевая аудитория** — обращайся к конкретной группе людей
4. **Призыв к действию** — мотивируй к конкретному шагу
5. **Эмоциональность** — создавай позитивные эмоции
6. **Краткость** — будь лаконичен, но информативен
7. **Факты** — используй конкретные цифры и данные
8. **Уникальность** — избегай клише и шаблонных фраз
9. **Без кликбейта** — честные и релевантные заголовки

**Информация о компании:**
Деятельность: {companyActivity}
Ключевые преимущества: {keyBenefits}

**Требования:**
- Максимальная длина заголовка: {maxLength} символов
- Все заголовки должны быть уникальными
- Каждый заголовок должен быть на отдельной строке
- Не нумеруй заголовки
- Не добавляй дополнительные символы или форматирование

Верни ТОЛЬКО список заголовков, каждый на отдельной строке, без нумерации и дополнительных комментариев.`;

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

    // Используем Hugging Face Router API с моделью Qwen/Qwen2.5-VL-7B-Instruct:hyperbolic
    // (та же модель, что используется для анализа изображений)
    // При ошибке API автоматически переключаемся на шаблонную генерацию

    console.log('🔄 Генерация заголовков...');
    console.log('   Деятельность:', companyActivity.substring(0, 100));
    console.log('   Ключевые преимущества:', keyBenefits?.substring(0, 100) || 'не указаны');
    console.log('   Выбранные платформы:', platforms);

    // Определяем максимальную длину для генерации (берем самую большую из выбранных платформ)
    const maxLength = Math.max(...platforms.map((p: string) => {
      const req = PLATFORM_REQUIREMENTS[p as keyof typeof PLATFORM_REQUIREMENTS];
      if (req) {
        if (p === 'yandex_direct') {
          const yandexReq = req as typeof PLATFORM_REQUIREMENTS.yandex_direct;
          return Math.max(yandexReq.maxLength, yandexReq.maxLength2 || 0);
        }
        return req.maxLength;
      }
      return 30;
    }));

    console.log('   Максимальная длина:', maxLength);

    // Пытаемся использовать Hugging Face API (та же модель, что для анализа изображений)
    let headlines: string[] = [];
    try {
      headlines = await generateHeadlinesWithAI(companyActivity, keyBenefits, maxLength);
      console.log('✅ Заголовки сгенерированы через AI (Qwen/Qwen2.5-VL-7B-Instruct)');
    } catch (error: any) {
      console.warn('⚠️  Не удалось использовать AI, переключаемся на шаблонную генерацию:', error.message);
      // Fallback на шаблонную генерацию
      headlines = generateFallbackHeadlines(companyActivity, keyBenefits, maxLength);
      console.log('✅ Заголовки сгенерированы через шаблоны');
    }

    console.log('✅ Сгенерировано заголовков:', headlines.length);

    // Генерируем заголовки для каждой выбранной платформы
    const result: Record<string, string[]> = {};
    const requirements: Record<string, any> = {};

    platforms.forEach((platform: string) => {
      const platformReq = PLATFORM_REQUIREMENTS[platform as keyof typeof PLATFORM_REQUIREMENTS];
      if (platformReq) {
        // Для Яндекс.Директ генерируем два типа заголовков
        if (platform === 'yandex_direct') {
          const yandexDirectReq = platformReq as typeof PLATFORM_REQUIREMENTS.yandex_direct;
          const headlines1 = headlines.filter((h: string) => h.length <= yandexDirectReq.maxLength);
          const headlines2 = headlines.filter((h: string) => h.length <= (yandexDirectReq.maxLength2 || 75));
          result[`${platform}_1`] = headlines1;
          result[`${platform}_2`] = headlines2;
          requirements[`${platform}_1`] = { ...yandexDirectReq, maxLength: yandexDirectReq.maxLength, name: `${yandexDirectReq.name} (Заголовок 1)` };
          requirements[`${platform}_2`] = { ...yandexDirectReq, maxLength: yandexDirectReq.maxLength2 || 75, name: `${yandexDirectReq.name} (Заголовок 2)` };
        } else {
          const platformHeadlines = headlines.filter((h: string) => h.length <= platformReq.maxLength);
          result[platform] = platformHeadlines;
          requirements[platform] = platformReq;
        }
      }
    });

    // Собираем все заголовки для общего списка
    const allHeadlines: string[] = [];
    Object.values(result).forEach(platformHeadlines => {
      allHeadlines.push(...platformHeadlines);
    });
    result.all = [...new Set(allHeadlines)];

    if (result.all.length === 0) {
      return NextResponse.json(
        { error: 'Не удалось сгенерировать заголовки для выбранных платформ' },
        { status: 500 }
      );
    }

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

// Генерация заголовков через Hugging Face Router API (та же модель, что для анализа изображений)
async function generateHeadlinesWithAI(
  companyActivity: string,
  keyBenefits: string | undefined,
  maxLength: number
): Promise<string[]> {
  // Проверяем наличие токена Hugging Face
  const hfToken = process.env.HUGGINGFACE_API_KEY || 
                 process.env.HF_TOKEN || 
                 process.env.HF || 
                 process.env.HUGGINGFACE_TOKEN;

  if (!hfToken) {
    throw new Error('Hugging Face API токен не найден');
  }

  // Формируем промпт
  const prompt = HEADLINES_GENERATION_PROMPT
    .replace('{companyActivity}', companyActivity)
    .replace('{keyBenefits}', keyBenefits || 'не указаны')
    .replace('{maxLength}', maxLength.toString());

  try {
    console.log('🔄 Отправляем запрос в Hugging Face Router API...');
    console.log('   Модель: Qwen/Qwen2.5-VL-7B-Instruct:hyperbolic');

    const response = await axios.post(
      'https://router.huggingface.co/v1/chat/completions',
      {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
        model: 'Qwen/Qwen2.5-VL-7B-Instruct:hyperbolic',
        stream: false,
        temperature: 0.8, // Креативность для генерации заголовков
        top_p: 0.9,
        max_tokens: 2000, // Достаточно для 20 заголовков
      },
      {
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000, // 60 секунд таймаут
      }
    );

    const content = response.data?.choices?.[0]?.message?.content || '';
    
    if (!content || content.length < 10) {
      throw new Error('Пустой ответ от Hugging Face API');
    }

    console.log('✅ Получен ответ от AI, длина:', content.length, 'символов');

    // Парсим заголовки из ответа
    const headlines: string[] = content
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => {
        // Убираем пустые строки, нумерацию, маркеры списка
        const cleaned = line.replace(/^[\d\.\-\*\)\s]+/, '').trim();
        return cleaned.length > 5 && cleaned.length <= maxLength;
      })
      .map((line: string): string => {
        // Убираем нумерацию и маркеры в начале строки
        let cleaned: string = line.replace(/^[\d\.\-\*\)\s]+/, '').trim();
        // Убираем кавычки, если есть
        cleaned = cleaned.replace(/^["']|["']$/g, '');
        // Делаем первую букву заглавной
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      })
      .filter((h: string) => h.length > 0 && h.length <= maxLength);

    // Убираем дубликаты
    const uniqueHeadlines: string[] = [...new Set(headlines)];

    if (uniqueHeadlines.length === 0) {
      throw new Error('Не удалось извлечь заголовки из ответа AI');
    }

    console.log('✅ Извлечено уникальных заголовков:', uniqueHeadlines.length);
    return uniqueHeadlines.slice(0, 20); // Ограничиваем до 20 заголовков

  } catch (error: any) {
    console.error('❌ Ошибка при генерации заголовков через Hugging Face:', error?.message || error);
    
    if (error?.response) {
      const status = error.response.status;
      const errorData = error.response.data || {};
      
      if (status === 401) {
        throw new Error('Ошибка аутентификации Hugging Face. Проверьте токен.');
      } else if (status === 403) {
        throw new Error('Ошибка доступа (403). Возможно, исчерпаны бесплатные кредиты.');
      } else if (status === 429) {
        throw new Error('Превышен лимит запросов (429). Попробуйте позже.');
      } else if (status >= 500) {
        throw new Error('Внутренняя ошибка сервера Hugging Face.');
      }
    }
    
    throw error;
  }
}

// Резервная функция для генерации заголовков на основе шаблонов с учетом рекомендаций
function generateFallbackHeadlines(
  companyActivity: string, 
  keyBenefits: string | undefined,
  maxLength: number
): string[] {
  const headlines: string[] = [];
  
  // Извлекаем ключевые слова из описания деятельности
  const activityWords = companyActivity
    .toLowerCase()
    .split(/[\s,\.]+/)
    .filter(word => word.length > 3)
    .slice(0, 5);

  const mainActivity = activityWords[0] || 'сервис';
  const secondActivity = activityWords[1] || 'решение';
  const thirdActivity = activityWords[2] || 'инструмент';

  // Извлекаем ключевые слова из преимуществ
  const benefits: string[] = [];
  if (keyBenefits) {
    const benefitWords = keyBenefits
      .toLowerCase()
      .split(/[\s,\.]+/)
      .filter(word => word.length > 3)
      .slice(0, 5);
    benefits.push(...benefitWords);
  }

  // Определяем целевую аудиторию на основе описания
  const audience = extractAudience(companyActivity);
  
  // Шаблоны с конкретикой, выгодой и эмоциональностью
  const templates: string[] = [];

  // Шаблоны с выгодой (экономия времени, денег, решение проблемы)
  templates.push(`Как ${mainActivity} поможет сэкономить время`);
  templates.push(`Экономьте до 30% с ${mainActivity}`);
  templates.push(`${mainActivity}: решение вашей проблемы`);
  templates.push(`Экономьте до 5000₽ в месяц с ${mainActivity}`);
  templates.push(`${mainActivity} — быстрый результат за 1 день`);

  // Шаблоны с целевой аудиторией
  if (audience) {
    templates.push(`${mainActivity} для ${audience}`);
    templates.push(`${audience}: откройте для себя ${mainActivity}`);
    templates.push(`Для ${audience}: ${mainActivity} с гарантией`);
  }

  // Шаблоны с интригой и призывом к действию
  templates.push(`5 причин выбрать ${mainActivity} уже сегодня`);
  templates.push(`Почему ${mainActivity} выбирают профессионалы`);
  templates.push(`${mainActivity}: новый подход к решению задач`);
  templates.push(`Откройте для себя ${mainActivity} — бесплатно`);
  templates.push(`Успейте получить ${mainActivity} со скидкой`);

  // Шаблоны с конкретными преимуществами
  if (benefits.length > 0) {
    benefits.slice(0, 3).forEach(benefit => {
      templates.push(`${mainActivity} с ${benefit} — уже сегодня`);
      templates.push(`Получите ${benefit} с ${mainActivity}`);
      templates.push(`${benefit} для вашего бизнеса — ${mainActivity}`);
      templates.push(`Как ${mainActivity} даст вам ${benefit}`);
    });
  }

  // Шаблоны с уникальным торговым предложением
  templates.push(`${mainActivity}: то, что отличает вас от конкурентов`);
  templates.push(`Единственный ${mainActivity} с такой гарантией`);
  templates.push(`${mainActivity} — эксклюзивное предложение`);

  // Шаблоны с актуальностью и свежестью
  templates.push(`Новый ${mainActivity} — только в этом сезоне`);
  templates.push(`${mainActivity}: современный подход к бизнесу`);
  templates.push(`Тренд 2024: ${mainActivity} для профессионалов`);

  // Шаблоны в формате "Как достичь результата без боли"
  templates.push(`Как получить ${mainActivity} без лишних затрат`);
  templates.push(`Как ${mainActivity} поможет вам за 1 день`);
  templates.push(`Как ${mainActivity} решает вашу проблему`);

  // Шаблоны с конкретными цифрами и фактами
  templates.push(`${mainActivity}: результат за 24 часа`);
  templates.push(`Быстрее на 50% с ${mainActivity}`);
  templates.push(`${mainActivity}: экономия до 5000₽ в месяц`);

  // Фильтруем заголовки по длине и уникальности
  templates.forEach(template => {
    const headline = template.charAt(0).toUpperCase() + template.slice(1);
    if (headline.length <= maxLength && !headlines.includes(headline)) {
      headlines.push(headline);
    }
  });

  // Убираем дубликаты и ограничиваем количество
  return [...new Set(headlines)].slice(0, 20);
}

// Функция для определения целевой аудитории на основе описания деятельности
function extractAudience(activity: string): string | null {
  const activityLower = activity.toLowerCase();
  
  // Определяем целевую аудиторию по ключевым словам
  if (activityLower.includes('мама') || activityLower.includes('матери') || activityLower.includes('детей')) {
    return 'занятых мам';
  }
  if (activityLower.includes('фриланс') || activityLower.includes('удаленн')) {
    return 'фрилансеров';
  }
  if (activityLower.includes('бизнес') || activityLower.includes('предпринимател')) {
    return 'предпринимателей';
  }
  if (activityLower.includes('студент') || activityLower.includes('обучен')) {
    return 'студентов';
  }
  if (activityLower.includes('профессионал') || activityLower.includes('специалист')) {
    return 'профессионалов';
  }
  if (activityLower.includes('стартап') || activityLower.includes('старт')) {
    return 'стартапов';
  }
  if (activityLower.includes('малый бизнес') || activityLower.includes('малый')) {
    return 'малого бизнеса';
  }
  
  return null;
}
