import OpenAI from 'openai';
import dotenv from 'dotenv';
import axios from 'axios';
import { analyzeScreenshotWithHuggingFace } from './huggingFaceVisionService.js';
import { freeFormAnalysisPrompt } from './prompts/visionAnalysisPrompt.js';

/**
 * Проверяет, является ли описание страницей с капчей/защитой от роботов
 * Использует строгие фразы, чтобы избежать ложных срабатываний
 */
function isCaptchaPage(description: string): boolean {
  // Только конкретные фразы, связанные именно с капчей
  const captchaPhrases = [
    'i\'m not a robot',
    'i am not a robot',
    'please confirm that you are not a robot',
    'подтвердите, что вы не робот',
    'обнаружена страница с защитой от роботов',
    'не удалось получить доступ к содержимому сайта',
    'recaptcha',
    'hcaptcha',
    're-captcha',
    'h-captcha',
    'google captcha',
    'cloudflare challenge',
    'cloudflare проверка',
    'verify you are human',
    'подтвердите что вы человек',
  ];
  
  const descriptionLower = description.toLowerCase();
  
  // Проверяем только полные фразы, а не отдельные слова
  // Это исключает ложные срабатывания на словах "robot", "verify", "проверить" в обычных описаниях
  return captchaPhrases.some(phrase => descriptionLower.includes(phrase));
}

/**
 * Возвращает стандартный ответ для страницы с капчей
 */
function getCaptchaResponse(): VisionAnalysisResult {
  return {
    issues: [],
    suggestions: [{
      title: 'Не удалось выполнить проверку',
      description: 'На скриншоте обнаружена страница с защитой от роботов (капча, reCAPTCHA, hCaptcha или форма подтверждения). Система не может автоматически обойти защиту для анализа содержимого сайта.',
      impact: 'Невозможно провести полноценный UX/UI анализ сайта',
      priority: 'high',
      steps: [
        'Попробуйте использовать другой URL страницы (например, главную страницу вместо внутренней)',
        'Временно отключите защиту от роботов для тестирования',
        'Используйте прямую ссылку на страницу без редиректов',
        'Проверьте, не блокирует ли сайт автоматизированные запросы через User-Agent',
        'Попробуйте проанализировать сайт позже, когда защита может быть временно отключена',
      ],
    }],
    overallScore: 0,
    visualDescription: 'Обнаружена страница с защитой от роботов (капча/подтверждение). Не удалось получить доступ к содержимому сайта для анализа.',
  };
}

/**
 * Преобразует объект visualDescription в связный текстовый анализ
 */
function formatVisualDescriptionObject(obj: any): string {
  const sentences: string[] = [];
  
  // Определяем тип сайта и бренд
  const logo = obj.logo || obj.text?.logo || '';
  const siteName = logo || 'сайт';
  
  // Определяем тип сайта на основе содержимого
  let siteType = '';
  const hasNews = obj.text?.article_title || obj.text?.trending_now || 
                  obj.structure?.main_content?.includes('Article') ||
                  obj.text?.menu_items?.some((item: string) => 
                    ['News', 'Новости', 'News', 'Finance', 'Финансы'].includes(item));
  const hasSearch = obj.text?.search_bar || obj.interactive_elements?.search_button;
  const hasTrending = obj.text?.trending_now && obj.text.trending_now.length > 0;
  const hasHotelFeatures = obj.text?.menu_items?.some((item: string) => 
    ['Rooms', 'Номера', 'Booking', 'Бронирование', 'Reservations'].includes(item)) ||
    obj.text?.article_title?.toLowerCase().includes('hotel') ||
    obj.text?.article_title?.toLowerCase().includes('отель');
  const hasEcommerce = obj.text?.menu_items?.some((item: string) => 
    ['Shop', 'Магазин', 'Cart', 'Корзина', 'Products', 'Товары'].includes(item));
  
  if (hasNews || hasTrending) {
    siteType = 'новостной портал';
    if (logo) {
      sentences.push(`Это ${siteType} ${logo}.`);
    } else {
      sentences.push(`Это ${siteType}.`);
    }
  } else if (hasHotelFeatures) {
    siteType = 'сайт отеля или гостиницы';
    sentences.push(`Это ${siteType}${logo ? ` ${logo}` : ''}.`);
  } else if (hasEcommerce) {
    siteType = 'интернет-магазин';
    sentences.push(`Это ${siteType}${logo ? ` ${logo}` : ''}.`);
  } else if (hasSearch && logo) {
    siteType = 'поисковая система';
    sentences.push(`Это ${siteType} ${logo}.`);
  } else {
    sentences.push(`Это веб-сайт${logo ? ` ${logo}` : ''}.`);
  }
  
  // Описание структуры
  if (obj.structure) {
    if (obj.structure.header && obj.structure.header.length > 0) {
      const headerElements = obj.structure.header.filter((item: string) => 
        item !== 'No footer elements visible' && item !== 'No header elements visible'
      );
      if (headerElements.length > 0) {
        sentences.push(`В верхней части страницы расположены: ${headerElements.join(', ').toLowerCase()}.`);
      }
    }
    
    if (obj.structure.main_content && obj.structure.main_content.length > 0) {
      const mainElements = obj.structure.main_content.filter((item: string) => 
        item !== 'No footer elements visible' && item !== 'No header elements visible'
      );
      if (mainElements.length > 0) {
        sentences.push(`Основной контент включает: ${mainElements.join(', ').toLowerCase()}.`);
      }
    }
  }
  
  // Описание контента
  if (obj.text) {
    if (obj.text.article_title) {
      sentences.push(`На странице отображается статья с заголовком: "${obj.text.article_title}".`);
      if (obj.text.article_subtitle) {
        sentences.push(`Подзаголовок статьи: "${obj.text.article_subtitle}".`);
      }
    }
    
    if (obj.text.trending_now && Array.isArray(obj.text.trending_now) && obj.text.trending_now.length > 0) {
      const trends = obj.text.trending_now.slice(0, 5).join(', ');
      sentences.push(`В разделе трендов отображаются темы: ${trends}.`);
    }
    
    if (obj.text.menu_items && Array.isArray(obj.text.menu_items) && obj.text.menu_items.length > 0) {
      const menuItems = obj.text.menu_items.join(', ');
      sentences.push(`В навигационном меню доступны разделы: ${menuItems}.`);
    }
  }
  
  // Описание интерактивных элементов
  if (obj.interactive_elements) {
    const interactive: string[] = [];
    if (obj.interactive_elements.search_button) {
      interactive.push('кнопка поиска');
    }
    if (obj.interactive_elements.menu_items && Array.isArray(obj.interactive_elements.menu_items)) {
      interactive.push('навигационное меню');
    }
    if (obj.interactive_elements.read_more) {
      interactive.push('ссылки для чтения');
    }
    if (interactive.length > 0) {
      sentences.push(`На странице присутствуют интерактивные элементы: ${interactive.join(', ')}.`);
    }
  }
  
  // Описание цветовой схемы
  if (obj.colors) {
    const colorDesc: string[] = [];
    if (obj.colors.background) {
      colorDesc.push(`фон ${obj.colors.background}`);
    }
    if (obj.colors.header_background && obj.colors.header_background !== obj.colors.background) {
      colorDesc.push(`шапка ${obj.colors.header_background}`);
    }
    if (obj.colors.search_button) {
      colorDesc.push(`акцентные элементы ${obj.colors.search_button}`);
    }
    if (colorDesc.length > 0) {
      sentences.push(`Цветовая схема: ${colorDesc.join(', ')}.`);
    }
  }
  
  // Если ничего не найдено, возвращаем базовое описание
  if (sentences.length === 0) {
    return `Это веб-сайт${logo ? ` ${logo}` : ''}. На странице отображаются различные элементы интерфейса.`;
  }
  
  return sentences.join(' ');
}

dotenv.config();

let openai: OpenAI | null = null;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export interface VisionAnalysisIssue {
  issue: string;
  bbox?: [number, number, number, number]; // [x1, y1, x2, y2]
  recommendation?: string;
  priority?: 'Critical' | 'High' | 'Medium' | 'Low';
  impact?: string;
}

export interface VisionAnalysisSuggestion {
  title?: string;
  description?: string;
  impact?: string;
  priority?: 'high' | 'medium' | 'low';
  steps?: string[];
}

export interface VisionAnalysisResult {
  issues: string[] | VisionAnalysisIssue[]; // Поддерживаем оба формата для обратной совместимости
  suggestions: string[] | VisionAnalysisSuggestion[]; // Может быть массивом строк или объектов
  overallScore: number;
  visualDescription?: string; // Описание того, что видит система на скриншоте
  freeFormAnalysis?: string; // Свободный анализ для summary
}

// Google Cloud Vision functions removed - service no longer used

// Функция analyzeWithOllama удалена - теперь используется Yandex Cloud AI Studio
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function analyzeWithOllama_DELETED(screenshotBase64: string, ollamaUrl: string, model: string): Promise<VisionAnalysisResult> {
  console.log('🔗 Анализирую через Ollama...');
  console.log(`   URL: ${ollamaUrl}`);
  console.log(`   Модель: ${model}`);
  
  try {
    // Remove data URL prefix if present
    const base64Image = screenshotBase64.includes(',') 
      ? screenshotBase64.split(',')[1] 
      : screenshotBase64;

    // Для быстрых моделей используем очень короткий промпт
    const prompt = (model === 'llava' || model === 'qwen3-vl')
      ? `Опиши этот сайт на русском: тема, название, основные блоки.`
      : `Ты эксперт по UX/UI дизайну. Проанализируй этот скриншот веб-сайта и найди проблемы с пользовательским опытом.

СНАЧАЛА детально опиши ЧТО ТЫ ВИДИШЬ на скриншоте. В описании ОБЯЗАТЕЛЬНО укажи:

1. ТЕМА САЙТА: Определи, о чем этот сайт (например: "продажа автозапчастей", "интернет-магазин одежды", "блог о путешествиях", "корпоративный сайт IT-компании" и т.д.)

2. НАЗВАНИЕ САЙТА: Если видно название/логотип сайта, укажи его

3. ОСНОВНАЯ ФУНКЦИЯ СТРАНИЦЫ: Для чего эта страница (например: "витрина запчастей", "каталог товаров", "главная страница с описанием услуг", "страница контактов" и т.д.)

4. СТРУКТУРА СТРАНИЦЫ: Подробно перечисли ВСЕ блоки и секции, которые ты видишь (например: "Верхнее меню навигации, баннер с предложением, карточки товаров в сетке, секция отзывов, форма обратной связи, футер с контактами" и т.д.)

5. ВИЗУАЛЬНЫЕ ЭЛЕМЕНТЫ: Цветовая схема, композиция, основные элементы интерфейса

Опиши так, чтобы пользователь понял, что речь именно о его сайте - укажи конкретные детали, которые видны на скриншоте.

ЗАТЕМ найди проблемы и дай рекомендации.

Обрати внимание на:
- Композицию и визуальную иерархию
- Читаемость текста
- Контрастность цветов
- Размещение элементов
- Наличие призывов к действию (кнопок, ссылок)
- Общую привлекательность дизайна

Верни ответ в формате JSON с полями:
- visualDescription: ДЕТАЛЬНОЕ описание сайта (тема, название если видно, функция страницы, структура блоков, визуальные элементы). Опиши так, чтобы было понятно, что речь именно об этом конкретном сайте.
- issues: массив строк с найденными проблемами
- suggestions: массив строк с конкретными рекомендациями
- overallScore: число от 0 до 100 (оценка общего качества UX)

Важно: верни ТОЛЬКО валидный JSON, без дополнительного текста.`;

    // Для vision моделей используем /api/chat с мультимодальными сообщениями
    console.log('📤 Отправляю запрос к Ollama...');
    console.log(`   Размер изображения (base64): ${(base64Image.length / 1024).toFixed(2)} KB`);
    console.log(`   Таймаут: 60 секунд`);
    
    let response;
    try {
      response = await axios.post(
      `${ollamaUrl}/api/chat`,
      {
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
            images: [base64Image],
          },
        ],
        stream: false,
        options: {
          temperature: 0.5,
          num_predict: 100, // Минимум для максимально быстрого ответа
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 60000, // 60 seconds - даем больше времени для обработки
      }
      );
      console.log('✅ Получен ответ от Ollama (HTTP статус:', response.status, ')');
    } catch (axiosError: any) {
      console.error('❌ Ошибка при запросе к Ollama:');
      if (axiosError.code === 'ECONNABORTED') {
        console.error('   ⏱️  Таймаут - Ollama не успел обработать запрос за 60 секунд');
        console.error('   💡 Попробуйте уменьшить размер скриншота или использовать более быструю модель');
      } else if (axiosError.response) {
        console.error('   HTTP статус:', axiosError.response.status);
        console.error('   Данные:', JSON.stringify(axiosError.response.data).substring(0, 300));
      } else {
        console.error('   Ошибка:', axiosError.message);
        console.error('   Код:', axiosError.code);
      }
      throw axiosError;
    }

    // Handle different response formats from Ollama
    console.log('📥 Обрабатываю ответ от Ollama...');
    console.log('   Тип response.data:', Array.isArray(response.data) ? 'массив' : typeof response.data);
    console.log('   Структура:', Array.isArray(response.data) ? `массив из ${response.data.length} элементов` : Object.keys(response.data || {}).join(', '));
    
    let content = '';
    
    // Если response.data - массив, берем последний элемент (обычно это финальный ответ)
    let responseData = response.data;
    if (Array.isArray(response.data)) {
      console.log('   📦 response.data - массив, беру последний элемент');
      responseData = response.data[response.data.length - 1] || response.data[0];
      console.log('   Тип элемента:', typeof responseData);
      console.log('   Ключи элемента:', Object.keys(responseData || {}).join(', '));
    }
    
    // Проверяем responseData.message.content (стандартный формат)
    if (responseData?.message?.content) {
      content = responseData.message.content;
      console.log('   ✅ Нашел content в message.content');
      console.log('   Длина:', content.length);
      console.log('   Первые 200 символов:', content.substring(0, 200));
    } 
    // Проверяем responseData.content
    else if (responseData?.content) {
      content = responseData.content;
      console.log('   ✅ Нашел content в responseData.content');
    }
    // Проверяем, если responseData - строка
    else if (typeof responseData === 'string') {
      content = responseData;
      console.log('   ✅ responseData - строка');
    } 
    // Пробуем извлечь из любого места
    else {
      console.warn('⚠️  Стандартные пути не сработали, ищу content вручную...');
      console.log('   Ключи в responseData:', Object.keys(responseData || {}));
      const fullResponse = JSON.stringify(responseData);
      const contentMatch = fullResponse.match(/"content"\s*:\s*"([^"]{10,})"/);
      if (contentMatch && contentMatch[1]) {
        content = contentMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
        console.log('   ✅ Извлек content из JSON строки');
      } else {
        console.error('   ❌ Не удалось найти content');
        console.error('   Полный ответ (первые 1500 символов):', fullResponse.substring(0, 1500));
        throw new Error('No response from Ollama');
      }
    }
    
    if (!content || content.length < 10) {
      console.error('❌ Пустой или слишком короткий ответ от Ollama');
      console.error('   content длина:', content?.length || 0);
      console.error('   content значение:', content);
      throw new Error('No response from Ollama');
    }
    
    // Log raw response for debugging
    console.log('📥 Сырой ответ от Ollama:');
    console.log('   Тип:', typeof content);
    console.log('   Длина:', content.length);
    console.log('   Первые 1000 символов:', content.substring(0, 1000));
    console.log('   Последние 500 символов:', content.substring(Math.max(0, content.length - 500)));

    // Try to parse JSON from response
    // Для llava может не быть JSON, только текстовое описание
    let parsed: VisionAnalysisResult;
    
    // Если модель llava или qwen3-vl, она может вернуть просто текст без JSON
    if ((model === 'llava' || model === 'qwen3-vl') && !content.includes('{') && !content.includes('visualDescription')) {
      console.log(`📝 ${model} вернула текстовое описание (не JSON), использую его как visualDescription`);
      // Используем весь ответ как visualDescription
      parsed = {
        visualDescription: content.trim(),
        issues: [],
        suggestions: ['Рекомендуется проверить визуальную иерархию и композицию'],
        overallScore: 75,
      };
    } else {
      try {
        // Extract JSON if wrapped in markdown code blocks
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
        let jsonString = jsonMatch ? jsonMatch[1] : content;
        
        // Remove any leading/trailing whitespace
        jsonString = jsonString.trim();
        
        // Try to find JSON object in text - use non-greedy and look for complete object
        let jsonObjectMatch = jsonString.match(/\{[\s\S]*?\}/);
        if (!jsonObjectMatch) {
          // Try greedy match for multiline JSON
          jsonObjectMatch = jsonString.match(/\{[\s\S]*\}/);
        }
        
        if (jsonObjectMatch) {
          try {
            parsed = JSON.parse(jsonObjectMatch[0]);
          } catch (parseErr) {
          // If JSON is incomplete, try to extract fields manually
          console.warn('JSON parse failed, extracting fields manually:', parseErr instanceof Error ? parseErr.message : parseErr);
          console.log('📋 Попытка парсинга JSON (первые 500 символов):', jsonObjectMatch[0].substring(0, 500));
          
          // Extract visualDescription - handle multiline strings and escaped quotes
          let visualDescription = '';
          
          // Try multiple patterns to extract visualDescription
          // Pattern 1: Standard JSON with escaped quotes - be more flexible
          let descMatch = jsonObjectMatch[0].match(/"visualDescription"\s*:\s*"((?:[^"\\]|\\.)*)"?/);
          if (descMatch && descMatch[1] && descMatch[1].length > 10) {
            visualDescription = descMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, ' ').trim();
          }
          
          // Pattern 2: Find visualDescription with unescaped quotes (might be incomplete JSON)
          if (!visualDescription || visualDescription.length < 10) {
            descMatch = jsonObjectMatch[0].match(/"visualDescription"\s*:\s*"([^"]{50,})/);
            if (descMatch && descMatch[1]) {
              visualDescription = descMatch[1].trim();
            }
          }
          
          // Pattern 3: Try to find any text after visualDescription (including multiline)
          if (!visualDescription || visualDescription.length < 10) {
            // Look for text between "visualDescription": " and next field or end
            descMatch = jsonObjectMatch[0].match(/"visualDescription"\s*:\s*"([\s\S]*?)"(?:\s*[,}])/);
            if (descMatch && descMatch[1] && descMatch[1].length > 10) {
              visualDescription = descMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').trim();
            }
          }
          
          // Pattern 4: If visualDescription is an object, extract all fields and combine them
          if (!visualDescription || visualDescription.length < 10) {
            // Try to find the visualDescription object - use a more robust approach
            // Find the start of visualDescription object
            const descStart = jsonObjectMatch[0].indexOf('"visualDescription"');
            if (descStart !== -1) {
              // Find the opening brace after visualDescription
              const braceStart = jsonObjectMatch[0].indexOf('{', descStart);
              if (braceStart !== -1) {
                // Find the matching closing brace (handle nested objects)
                let braceCount = 0;
                let braceEnd = braceStart;
                for (let i = braceStart; i < jsonObjectMatch[0].length; i++) {
                  if (jsonObjectMatch[0][i] === '{') braceCount++;
                  if (jsonObjectMatch[0][i] === '}') braceCount--;
                  if (braceCount === 0) {
                    braceEnd = i;
                    break;
                  }
                }
                
                if (braceEnd > braceStart) {
                  const objContent = jsonObjectMatch[0].substring(braceStart + 1, braceEnd);
                  console.log('📦 Содержимое объекта visualDescription:', objContent.substring(0, 500));
                  
                  // Extract all key-value pairs from the object
                  // More flexible pattern that handles escaped quotes and multiline
                  const simplePattern = /"([^"]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
                  const fields: string[] = [];
                  let match;
                  
                  // Extract simple string values
                  while ((match = simplePattern.exec(objContent)) !== null) {
                    const key = match[1]?.trim();
                    let value = match[2]?.trim();
                    // Unescape quotes
                    value = value.replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\\r/g, '');
                    if (key && value && value.length > 5) {
                      // Format: "KEY: значение"
                      const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
                      fields.push(`${formattedKey}: ${value}`);
                    }
                  }
                  
                  // If we found some fields, combine them
                  if (fields.length > 0) {
                    visualDescription = fields.join('. ');
                    console.log('✅ Извлечено полей из объекта:', fields.length);
                  } else {
                    // Fallback: extract any meaningful text from the object
                    // Try simpler pattern without strict quote matching
                    const simplePattern2 = /"([^"]+)"\s*:\s*"([^"]{10,})/g;
                    const fields2: string[] = [];
                    let match2;
                    while ((match2 = simplePattern2.exec(objContent)) !== null) {
                      const key = match2[1]?.trim();
                      const value = match2[2]?.trim();
                      if (key && value && value.length > 10) {
                        const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
                        fields2.push(`${formattedKey}: ${value}`);
                      }
                    }
                    if (fields2.length > 0) {
                      visualDescription = fields2.join('. ');
                      console.log('✅ Извлечено полей (fallback):', fields2.length);
                    } else {
                      // Last resort: extract any quoted text
                      const allQuotedText = objContent.match(/"([А-Яа-яA-Za-z0-9\s\.,!?]{15,})"/g);
                      if (allQuotedText && allQuotedText.length > 0) {
                        const texts = allQuotedText
                          .map(m => m.replace(/^"|"$/g, ''))
                          .filter(t => t.length > 10 && !t.includes('{') && !t.includes('}'));
                        if (texts.length > 0) {
                          const uniqueTexts = [...new Set(texts)];
                          visualDescription = uniqueTexts.slice(0, 5).join('. ');
                          console.log('✅ Извлечено текстов (last resort):', uniqueTexts.length);
                        }
                      }
                    }
                  }
                  
                  console.log('📝 Извлечено из объекта:', visualDescription.substring(0, 200));
                  console.log('   Длина visualDescription:', visualDescription.length);
                }
              }
            }
          }
          
          // Pattern 5: Extract from full content if JSON parsing failed
          if (!visualDescription || visualDescription.length < 10) {
            // Look for any meaningful text after "visualDescription"
            const fullMatch = content.match(/"visualDescription"\s*:\s*"([^"]{50,1000})/);
            if (fullMatch && fullMatch[1]) {
              visualDescription = fullMatch[1].trim();
            }
          }
          
          // Extract other fields
          const issuesMatch = jsonObjectMatch[0].match(/"issues"\s*:\s*\[([^\]]*)\]/);
          const suggestionsMatch = jsonObjectMatch[0].match(/"suggestions"\s*:\s*\[([^\]]*)\]/);
          const scoreMatch = jsonObjectMatch[0].match(/"overallScore"\s*:\s*(\d+)/);
          
          parsed = {
            visualDescription: visualDescription || 'Визуальный анализ выполнен через Ollama',
            issues: issuesMatch ? [] : ['Анализ выполнен через Ollama'],
            suggestions: suggestionsMatch ? [] : ['Рекомендуется проверить визуальную иерархию'],
            overallScore: scoreMatch ? parseInt(scoreMatch[1]) : 75,
          };
          
          console.log('📝 Извлечено из обрезанного JSON:');
          console.log('   visualDescription длина:', visualDescription.length);
          console.log('   visualDescription первые 200 символов:', visualDescription.substring(0, 200));
        }
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      // Fallback: analyze text response
      console.warn('Failed to parse JSON from Ollama, analyzing text response');
      const issues: string[] = [];
      const suggestions: string[] = [];
      let score = 75;

      const contentLower = content.toLowerCase();
      
      // Extract issues and suggestions from text
      if (contentLower.includes('проблем') || contentLower.includes('ошибк')) {
        issues.push('Найдены визуальные проблемы (детали в анализе)');
        score -= 10;
      }
      if (contentLower.includes('кнопк') || contentLower.includes('cta') || contentLower.includes('призыв')) {
        suggestions.push('Проверьте наличие и видимость призывов к действию');
      }
      if (contentLower.includes('контраст') || contentLower.includes('читаемост')) {
        issues.push('Возможны проблемы с контрастностью или читаемостью');
        suggestions.push('Проверьте контрастность текста и фона (минимум 4.5:1)');
        score -= 5;
      }
      if (contentLower.includes('хорош') || contentLower.includes('отличн')) {
        score += 10;
      }

      // Try to extract visual description from text - more aggressive extraction
      let visualDescription = '';
      
      // Pattern 1: Try to extract from JSON-like structure even in text
      const jsonDescMatch = content.match(/"visualDescription"\s*:\s*"([^"]{50,})/);
      if (jsonDescMatch && jsonDescMatch[1]) {
        visualDescription = jsonDescMatch[1].trim();
      } else {
        // Pattern 2: Look for "ТЕМА САЙТА" or "ТЕМА:" pattern (from our new prompt)
        const themeMatch = content.match(/(?:ТЕМА САЙТА|ТЕМА[:])\s*:?\s*([^.\n]{20,200})/i);
        if (themeMatch && themeMatch[1]) {
          visualDescription = themeMatch[1].trim();
        }
        
        // Pattern 3: Look for structured description starting with numbers
        const structuredMatch = content.match(/(?:1\.|ТЕМА|НАЗВАНИЕ|ФУНКЦИЯ|СТРУКТУРА)[\s\S]{50,500}(?:\n|$)/i);
        if (structuredMatch && structuredMatch[0]) {
          visualDescription = structuredMatch[0].trim();
        }
        
        // Pattern 4: Try Russian/English patterns
        if (!visualDescription) {
          const descMatch = content.match(/(?:вижу|видно|на скриншоте|на изображении|страница|сайт|image|screenshot|web page|page)[\s\S]{50,400}(?:\n|\.|$)/i);
          if (descMatch && descMatch[0]) {
            visualDescription = descMatch[0].trim();
          }
        }
        
        // Pattern 5: If still empty, take first meaningful paragraph
        if (!visualDescription && content.length > 100) {
          // Find first sentence or paragraph that's not JSON structure
          const firstPara = content.match(/[А-Яа-яA-Za-z][^}\]]{50,300}(?:\.|\n|$)/);
          if (firstPara && firstPara[0]) {
            visualDescription = firstPara[0].trim();
          } else {
            visualDescription = content.substring(0, 300).trim();
          }
        }
      }

      // Если это llava или qwen3-vl и нет visualDescription, используем весь content
      if ((model === 'llava' || model === 'qwen3-vl') && !visualDescription && content.length > 50) {
        console.log(`📝 ${model} вернула текст без JSON, использую весь content как visualDescription`);
        visualDescription = content.trim();
      }
      
      parsed = {
        visualDescription: visualDescription || ((model === 'llava' || model === 'qwen3-vl') && content.length > 50 ? content.substring(0, 500).trim() : 'Визуальный анализ выполнен через Ollama'),
        issues: issues.length > 0 ? issues : ['Анализ выполнен через Ollama'],
        suggestions: suggestions.length > 0 ? suggestions : ['Рекомендуется проверить визуальную иерархию'],
        overallScore: Math.max(0, Math.min(100, score)),
      };
    }
    }

    // Validate and normalize
    console.log('🔍 Проверяю извлеченный visualDescription...');
    console.log('   parsed.visualDescription тип:', typeof parsed.visualDescription);
    console.log('   parsed.visualDescription длина:', parsed.visualDescription?.length || 0);
    console.log('   parsed.visualDescription первые 200 символов:', parsed.visualDescription?.substring(0, 200) || 'нет');
    
    const result = {
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      overallScore: typeof parsed.overallScore === 'number' 
        ? Math.max(0, Math.min(100, parsed.overallScore)) 
        : 75,
      visualDescription: typeof parsed.visualDescription === 'string' 
        ? parsed.visualDescription 
        : undefined,
    };
    
    console.log('✅ Результат после нормализации:');
    console.log('   result.visualDescription:', result.visualDescription ? `✅ есть (${result.visualDescription.length} символов)` : '❌ нет');
    
    // Clean and truncate visualDescription to avoid issues
    if (result.visualDescription) {
      // Clean and format the description
      let cleaned = result.visualDescription
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      // Fix common typos and formatting issues
      cleaned = cleaned
        // Fix common misspellings first
        .replace(/САйт/gi, 'Сайт')
        .replace(/сайт/gi, 'сайт')
        .replace(/страницu/gi, 'странице')
        .replace(/страницy/gi, 'странице')
        .replace(/секcióнями/gi, 'секциями')
        .replace(/Vерхнее/gi, 'Верхнее')
        .replace(/cleмакет/gi, 'чистый макет')
        // Common English words to Russian
        .replace(/\bmusic\b/gi, 'музыка')
        .replace(/\bentertainment\b/gi, 'развлечения')
        .replace(/\bbanner\b/gi, 'баннер')
        .replace(/\bpost\b/gi, 'пост')
        .replace(/\bvideo\b/gi, 'видео')
        .replace(/\bimage\b/gi, 'изображение')
        .replace(/\bbutton\b/gi, 'кнопка')
        .replace(/\blink\b/gi, 'ссылка')
        .replace(/\blinks\b/gi, 'ссылки')
        .replace(/\btext\b/gi, 'текст')
        .replace(/\bblock\b/gi, 'блок')
        .replace(/\bblocks\b/gi, 'блоки')
        .replace(/\bsection\b/gi, 'секция')
        .replace(/\bsections\b/gi, 'секции')
        .replace(/\bmenu\b/gi, 'меню')
        .replace(/\bnavigation\b/gi, 'навигация')
        .replace(/\bpage\b/gi, 'страница')
        .replace(/\bpages\b/gi, 'страницы')
        .replace(/\bsite\b/gi, 'сайт')
        .replace(/\bsites\b/gi, 'сайты')
        .replace(/\belement\b/gi, 'элемент')
        .replace(/\belements\b/gi, 'элементы')
        .replace(/\binterface\b/gi, 'интерфейс')
        .replace(/\bdesign\b/gi, 'дизайн')
        .replace(/\blayout\b/gi, 'макет')
        .replace(/\bsearch\s+bar\b/gi, 'поисковая строка')
        .replace(/\bsearch\b/gi, 'поиск')
        .replace(/\bbar\b/gi, 'строка')
        .replace(/\bcontent\b/gi, 'контент')
        .replace(/\bmain\b/gi, 'главный')
        .replace(/\bside\b/gi, 'сторона')
        .replace(/\bmiddle\b/gi, 'середина')
        .replace(/\bright\b/gi, 'правая')
        .replace(/\bleft\b/gi, 'левая')
        .replace(/\bcolor\s+scheme\b/gi, 'цветовая схема')
        .replace(/\bcolor\b/gi, 'цвет')
        .replace(/\bbackground\b/gi, 'фон')
        .replace(/\bblack\b/gi, 'черный')
        .replace(/\bblue\b/gi, 'синий')
        .replace(/\bwhite\b/gi, 'белый')
        .replace(/\bclear\b/gi, 'чистый')
        .replace(/\buse\s+of\b/gi, 'использование')
        .replace(/\buse\b/gi, 'использование')
        .replace(/\bicons\b/gi, 'иконки')
        .replace(/\bicon\b/gi, 'иконка')
        .replace(/\blogos\b/gi, 'логотипы')
        .replace(/\blogo\b/gi, 'логотип')
        .replace(/\bconsistent\b/gi, 'единообразный')
        .replace(/\bfont\s+style\b/gi, 'стиль шрифта')
        .replace(/\bfont\b/gi, 'шрифт')
        .replace(/\bsize\b/gi, 'размер')
        .replace(/\bpresence\b/gi, 'наличие')
        .replace(/\bresponsive\b/gi, 'адаптивный')
        .replace(/\bincludes\b/gi, 'включает')
        .replace(/\binclude\b/gi, 'включать')
        // Common phrases
        .replace(/\band\b/gi, 'и')
        .replace(/\bwith\b/gi, 'с')
        .replace(/\babout\b/gi, 'о')
        .replace(/\bfor\b/gi, 'для')
        .replace(/\bon\b/gi, 'на')
        .replace(/\bin\b/gi, 'в')
        .replace(/\bof\b/gi, '')
        .replace(/\bthe\b/gi, '')
        .replace(/\ba\s+/gi, '')
        .replace(/\ban\s+/gi, '')
        // Fix Russian grammar
        .replace(/об\s+([а-яё])/gi, 'о $1')
        .replace(/Определить\s+о\s+том/gi, 'Определить')
        .replace(/о\s+том,\s+что/gi, 'что')
        // Fix punctuation
        .replace(/\s+\./g, '.')
        .replace(/\s+,/g, ',')
        .replace(/\s+:/g, ':')
        .replace(/\.\.+/g, '.')
        // Fix spacing around punctuation
        .replace(/\s*([.,:;!?])\s*/g, '$1 ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Capitalize first letter
      if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }
      
      // Structure the text better - split by common patterns
      // Try to format as structured description
      const structuredParts: string[] = [];
      
      // Extract theme
      const themeMatch = cleaned.match(/Тема:\s*([^\.]+)/i);
      if (themeMatch && themeMatch[1]) {
        structuredParts.push(`Тема: ${themeMatch[1].trim()}`);
      }
      
      // Extract name
      const nameMatch = cleaned.match(/Название:\s*([^\.]+)/i);
      if (nameMatch && nameMatch[1]) {
        structuredParts.push(`Название: ${nameMatch[1].trim()}`);
      }
      
      // Extract function
      const functionMatch = cleaned.match(/Функция\s+страницы:\s*([^\.]+)/i);
      if (functionMatch && functionMatch[1]) {
        structuredParts.push(`Функция страницы: ${functionMatch[1].trim()}`);
      }
      
      // Extract structure
      const structureMatch = cleaned.match(/Структура\s+блоков:\s*([^\.]+)/i);
      if (structureMatch && structureMatch[1]) {
        structuredParts.push(`Структура блоков: ${structureMatch[1].trim()}`);
      }
      
      // Extract visual elements
      const visualMatch = cleaned.match(/Визуальные\s+элементы:\s*([^\.]+)/i);
      if (visualMatch && visualMatch[1]) {
        structuredParts.push(`Визуальные элементы: ${visualMatch[1].trim()}`);
      }
      
      // If we found structured parts, use them; otherwise use cleaned text
      if (structuredParts.length > 0) {
        cleaned = structuredParts.join('. ');
      }
      
      // Final cleanup - remove double spaces and fix punctuation
      cleaned = cleaned
        .replace(/\s+/g, ' ')
        .replace(/\s*\.\s*\./g, '.')
        .replace(/\s*:\s*/g, ': ')
        .replace(/\s*,\s*/g, ', ')
        .trim();
      
      // Limit length
      result.visualDescription = cleaned.substring(0, 1500).trim();
      
      console.log('👁️  Что видит Ollama на скриншоте:');
      console.log('   ', result.visualDescription.substring(0, 200));
      console.log('   Полная длина:', result.visualDescription.length);
      console.log('✅ Ollama успешно проанализировал изображение');
      console.log('✅ visualDescription будет включен в отчет');
    } else {
      console.log('⚠️  Ollama не вернул описание изображения');
      console.log('⚠️  visualDescription отсутствует в результате');
    }
    
    // Final check before returning
    console.log('📤 Возвращаю результат анализа:');
    console.log('   visualDescription:', result.visualDescription ? `✅ есть (${result.visualDescription.length} символов)` : '❌ нет');
    console.log('   issues:', result.issues.length);
    console.log('   suggestions:', result.suggestions.length);
    console.log('   overallScore:', result.overallScore);
    
    return result;
  } catch (error) {
    console.error('❌ Ollama error:', error);
    if (error instanceof Error) {
      console.error('   Сообщение:', error.message);
      if ('response' in error && (error as any).response) {
        const resp = (error as any).response;
        console.error('   Статус:', resp.status);
        console.error('   Данные:', JSON.stringify(resp.data).substring(0, 200));
      }
    }
    throw error; // Re-throw to try next API
  }
}

// Hugging Face функция удалена

function analyzeCaption(caption: string): VisionAnalysisResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 75;

  const captionLower = caption.toLowerCase();
  
  // Analyze based on keywords
  if (captionLower.includes('cluttered') || captionLower.includes('busy') || captionLower.includes('crowded') || captionLower.includes('many elements')) {
    issues.push('Перегруженный дизайн - слишком много элементов на странице');
    suggestions.push('Упростите композицию, увеличьте пробелы между элементами, используйте визуальную иерархию');
    score -= 10;
  }
  
  if (captionLower.includes('small') || captionLower.includes('tiny') || captionLower.includes('little text')) {
    issues.push('Мелкие элементы - возможны проблемы с читаемостью');
    suggestions.push('Увеличьте размер шрифтов и интерактивных элементов для лучшей читаемости');
    score -= 5;
  }
  
  if (captionLower.includes('dark') || captionLower.includes('black background')) {
    issues.push('Тёмная цветовая схема - проверьте контрастность');
    suggestions.push('Убедитесь в достаточном контрасте текста и фона (минимум 4.5:1 для нормального текста)');
  }

  if (captionLower.includes('bright') || captionLower.includes('white background') || captionLower.includes('light')) {
    // This is usually good, but check contrast
    suggestions.push('Светлая цветовая схема хороша, но проверьте контрастность текста');
  }

  if (captionLower.includes('header') || captionLower.includes('navigation') || captionLower.includes('menu')) {
    // Good structure indicators
    score += 5;
  }

  if (captionLower.includes('button') || captionLower.includes('link') || captionLower.includes('call to action')) {
    // Good CTA indicators
    score += 5;
  }

  if (captionLower.includes('image') || captionLower.includes('photo') || captionLower.includes('picture')) {
    suggestions.push('Использование изображений улучшает визуальную привлекательность');
    score += 3;
  }

  // If no specific issues found, provide generic feedback
  if (issues.length === 0) {
    issues.push('Визуальный анализ выполнен (детали требуют ручной проверки)');
    suggestions.push('Рекомендуется проверить визуальную иерархию, композицию и контрастность элементов');
  }

  return {
    issues,
    suggestions: suggestions.length > 0 ? suggestions : ['Проверьте визуальную композицию и читаемость'],
    overallScore: Math.max(0, Math.min(100, score)),
  };
}

export async function analyzeScreenshot(screenshotBase64: string): Promise<VisionAnalysisResult> {
  console.log('🔍 analyzeScreenshot вызвана');
  console.log('   Длина screenshot:', screenshotBase64?.length || 0);
  
  // Пробуем сначала Hugging Face Router API (работает отлично с Qwen2.5-VL-32B)
  const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_TOKEN;
  if (hfToken) {
    console.log('🔄 Пробуем Hugging Face Router API (основной метод)...');
    try {
      const hf = await analyzeScreenshotWithHuggingFace(screenshotBase64);
      if (hf.success) {
        console.log('✅ Получен ответ от Hugging Face Router API');
        
        // Пытаемся распарсить JSON из ответа
        let parsed: Partial<VisionAnalysisResult> = {};
        const description = hf.description;
        
        try {
          const jsonMatch = description.match(/```json\n([\s\S]*?)\n```/) || description.match(/```\n([\s\S]*?)\n```/);
          const jsonString = jsonMatch ? jsonMatch[1] : description;
          
          const jsonObjectMatch = jsonString.match(/\{[\s\S]*\}/);
          if (jsonObjectMatch) {
            try {
              parsed = JSON.parse(jsonObjectMatch[0]);
              console.log('✅ Успешно распарсен JSON из ответа Hugging Face');
            } catch (parseErr) {
              console.warn('⚠️  Не удалось распарсить JSON, используем текстовый ответ');
            }
          }
        } catch (error) {
          console.warn('⚠️  Ошибка при парсинге JSON, используем текстовый ответ');
        }
        
        // Проверяем, не является ли это страницей с капчей
        if (isCaptchaPage(description)) {
          console.warn('⚠️  Обнаружена страница с капчей/защитой от роботов');
          return getCaptchaResponse();
        }
        
        // Убеждаемся, что visualDescription - строка
        let visualDescription = description;
        if (parsed.visualDescription) {
          if (typeof parsed.visualDescription === 'string') {
            visualDescription = parsed.visualDescription;
          } else if (typeof parsed.visualDescription === 'object') {
            // Если это объект, преобразуем в читаемую строку
            visualDescription = formatVisualDescriptionObject(parsed.visualDescription);
            console.warn('⚠️  visualDescription был объектом, преобразован в читаемый текст');
          } else {
            visualDescription = String(parsed.visualDescription);
          }
        }
        
        // Обрабатываем issues - могут быть строками или объектами с bbox
        let issues: string[] | VisionAnalysisIssue[] = [];
        if (Array.isArray(parsed.issues)) {
          // Проверяем формат issues
          if (parsed.issues.length > 0 && typeof parsed.issues[0] === 'object' && parsed.issues[0] !== null) {
            // Новый формат с объектами
            issues = parsed.issues.map((item: any) => ({
              issue: item.issue || String(item),
              bbox: item.bbox,
              recommendation: item.recommendation,
              priority: item.priority,
              impact: item.impact,
            }));
            console.log('   ✅ Найдены issues с координатами и приоритетами:', issues.length);
          } else {
            // Старый формат - массив строк
            issues = parsed.issues.filter((item: any) => typeof item === 'string');
          }
        }
        
        const result: VisionAnalysisResult = {
          issues: issues,
          suggestions: Array.isArray(parsed.suggestions)
            ? parsed.suggestions
            : ['Проверьте рекомендации, сформированные на основе визуального анализа'],
          overallScore: typeof parsed.overallScore === 'number'
            ? Math.max(0, Math.min(100, parsed.overallScore))
            : 75,
          visualDescription: visualDescription,
          freeFormAnalysis: hf.freeFormAnalysis || undefined, // Сохраняем свободный анализ, если есть
        };
        
        console.log('✅ Hugging Face Router API анализ успешен');
        console.log('   Найдено проблем:', result.issues.length);
        console.log('   Рекомендаций:', result.suggestions.length);
        console.log('   Оценка:', result.overallScore);
        console.log('   Свободный анализ:', result.freeFormAnalysis ? `есть (${result.freeFormAnalysis.length} символов)` : 'отсутствует');
        
        return result;
      } else if (hf.isSizeError) {
        // Если это ошибка размера, выбрасываем специальную ошибку
        const sizeError = new Error('Request failed with status code 413: Image too large');
        (sizeError as any).isSizeError = true;
        throw sizeError;
      }
    } catch (error: any) {
      // Если это ошибка размера, пробрасываем её дальше
      if (error && typeof error === 'object' && 'isSizeError' in error && (error as any).isSizeError) {
        throw error;
      }
      
      // Проверяем тип ошибки
      if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout') || error?.message?.includes('TIMEOUT')) {
        console.error('❌ Hugging Face Router API: таймаут запроса (превышено время ожидания)');
        console.error('   Это может быть из-за большого размера изображения или медленного ответа API');
      } else if (error?.response?.status === 401 || error?.response?.status === 403) {
        console.error('❌ Hugging Face Router API: ошибка аутентификации');
        console.error('   Проверьте правильность HUGGINGFACE_API_KEY');
      } else if (error?.response?.status === 429) {
        console.error('❌ Hugging Face Router API: превышен лимит запросов');
        console.error('   Попробуйте позже или используйте другой API ключ');
      } else if (error?.response?.status >= 500) {
        console.error('❌ Hugging Face Router API: внутренняя ошибка сервера');
        console.error('   Сервис временно недоступен, попробуйте позже');
      } else {
        console.warn('⚠️  Hugging Face Router API недоступен:', error?.message || error);
      }
    }
  } else {
    console.warn('⚠️  Hugging Face API ключ не установлен (HUGGINGFACE_API_KEY)');
  }
  
  // Fallback: OpenAI Vision API
  if (openai && process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
    console.log('🔄 Пробуем OpenAI Vision API...');
    try {
      const openaiResult = await analyzeWithOpenAI(screenshotBase64);
      console.log('✅ OpenAI Vision API успешно выполнил анализ');
      return openaiResult;
    } catch (error: any) {
      if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
        console.error('❌ OpenAI Vision API: таймаут запроса');
      } else {
        console.warn('⚠️  OpenAI Vision API недоступен:', error?.message || error);
      }
    }
  } else {
    console.warn('⚠️  OpenAI API ключ не установлен (OPENAI_API_KEY)');
  }
  
  // Если все fallback не сработали, выбрасываем ошибку вместо мокового отчета
  const hasHfKey = !!(process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_TOKEN);
  const hasOpenAIKey = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here');
  
  console.log('❌ Все сервисы vision анализа недоступны');
  console.log('   HUGGINGFACE_API_KEY установлен:', hasHfKey);
  console.log('   OPENAI_API_KEY установлен:', hasOpenAIKey);
  
  let errorMessage = 'Визуальный анализ недоступен. ';
  if (!hasHfKey && !hasOpenAIKey) {
    errorMessage += 'Не установлены API ключи. Установите HUGGINGFACE_API_KEY или OPENAI_API_KEY в переменных окружения.';
  } else if (hasHfKey && !hasOpenAIKey) {
    errorMessage += 'Hugging Face API недоступен или вернул ошибку. Проверьте правильность HUGGINGFACE_API_KEY и доступность сервиса.';
  } else if (!hasHfKey && hasOpenAIKey) {
    errorMessage += 'OpenAI API недоступен или вернул ошибку. Проверьте правильность OPENAI_API_KEY и доступность сервиса.';
  } else {
    errorMessage += 'Все сервисы vision анализа (Hugging Face, OpenAI) недоступны или вернули ошибку. Проверьте настройки API ключей и доступность сервисов.';
  }
  
  throw new Error(errorMessage);
}

async function analyzeWithOpenAI(screenshotBase64: string): Promise<VisionAnalysisResult> {
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  try {
    // Remove data URL prefix if present
    const base64Image = screenshotBase64.includes(',') 
      ? screenshotBase64.split(',')[1] 
      : screenshotBase64;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: freeFormAnalysisPrompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 6000, // Увеличено для развернутого анализа
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Проверяем, не является ли это страницей с капчей
    if (isCaptchaPage(content)) {
      console.warn('⚠️  Обнаружена страница с капчей/защитой от роботов (OpenAI)');
      return getCaptchaResponse();
    }

    // Try to parse JSON from response
    let parsed: VisionAnalysisResult;
    try {
      // Extract JSON if wrapped in markdown code blocks
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      parsed = JSON.parse(jsonString);
    } catch (parseError) {
      // Fallback: try to extract structured data from text
      console.warn('Failed to parse JSON, trying to extract from text');
      const issues: string[] = [];
      const suggestions: string[] = [];
      
      // Simple extraction
      if (content.includes('проблем')) {
        issues.push('Найдены визуальные проблемы (детали в полном анализе)');
      }
      if (content.includes('рекоменд')) {
        suggestions.push('Рекомендуется улучшить дизайн (детали в полном анализе)');
      }

      parsed = {
        issues,
        suggestions,
        overallScore: 70,
      };
    }

    // Validate and normalize
    return {
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      overallScore: typeof parsed.overallScore === 'number' 
        ? Math.max(0, Math.min(100, parsed.overallScore)) 
        : 75,
    };
  } catch (error) {
    console.error('Vision analysis error:', error);
    // Return fallback result instead of throwing
    return {
      issues: ['Не удалось выполнить визуальный анализ'],
      suggestions: ['Проверьте вручную визуальные элементы сайта'],
      overallScore: 70,
    };
  }
}

