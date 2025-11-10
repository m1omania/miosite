import axios from 'axios';
import dotenv from 'dotenv';
import { freeFormAnalysisPrompt, structureToJSONPrompt } from './prompts/visionAnalysisPrompt.js';

dotenv.config();

export interface HuggingFaceAnalyzeResult {
  description: string;
  success: boolean;
  freeFormAnalysis?: string; // Свободный анализ для summary
  isSizeError?: boolean; // Флаг для ошибки размера (413)
}

/**
 * Выполняет двухэтапный анализ:
 * 1. Свободный анализ (развернутый текст)
 * 2. Структурирование в JSON с bbox
 */
export async function analyzeScreenshotWithHuggingFace(base64Image: string): Promise<HuggingFaceAnalyzeResult> {
  const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_TOKEN;

  if (!hfToken) {
    console.error('❌ Hugging Face не настроен: отсутствует токен');
    return {
      success: false,
      description: 'Визуальный анализ недоступен: отсутствует токен Hugging Face (HF_TOKEN или HUGGINGFACE_API_KEY).',
    };
  }

  // Определяем формат изображения из исходной строки
  let mimeType = 'image/jpeg'; // По умолчанию JPEG
  if (base64Image.includes('data:image/png')) {
    mimeType = 'image/png';
  } else if (base64Image.includes('data:image/jpeg') || base64Image.includes('data:image/jpg')) {
    mimeType = 'image/jpeg';
  }

  // Извлекаем чистый base64 без префикса
  const image = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

  try {
    // ЭТАП 1: Свободный анализ (развернутый текст)
    console.log('🔄 Этап 1: Отправляем свободный анализ в Hugging Face Router API...');
    console.log('   Модель: Qwen/Qwen2.5-VL-7B-Instruct:hyperbolic');
    console.log('   Размер изображения (base64):', Math.round(image.length / 1024), 'KB');

    const freeFormResponse = await axios.post(
      'https://router.huggingface.co/v1/chat/completions',
      {
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
                  url: `data:${mimeType};base64,${image}`,
                },
              },
            ],
          },
        ],
        model: 'Qwen/Qwen2.5-VL-7B-Instruct:hyperbolic',
        stream: false,
        temperature: 0.8, // Больше креативности для свободного анализа
        top_p: 0.9,
        max_tokens: 6000, // Развернутый ответ (увеличено для детального анализа)
      },
      {
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000, // Увеличиваем таймаут для развернутого ответа
      }
    );

    console.log('✅ Получен свободный анализ');
    let freeAnalysis = freeFormResponse.data?.choices?.[0]?.message?.content || '';

    if (!freeAnalysis || freeAnalysis.length < 10) {
      console.warn('⚠️  Пустой или короткий ответ от Hugging Face на этапе 1');
      return {
        success: false,
        description: 'Визуальный анализ через Hugging Face вернул пустой ответ.',
      };
    }

    console.log('   ✅ Свободный анализ получен, длина:', freeAnalysis.length, 'символов');

    // Post-processing: проверка качества анализа
    const issuesCount = (freeAnalysis.match(/проблем|проблема|недостат|улучш|рекоменд/gi) || []).length;
    const scoreMatch = freeAnalysis.match(/score[:\s]+(\d+)|оценк[аи][:\s]+(\d+)|(\d+)\s*\/\s*100/gi);
    const score = scoreMatch ? parseInt(scoreMatch[0].match(/\d+/)?.[0] || '0') : 0;

    // Если проблем < 3 и score > 90 - запрашиваем уточнение
    if (issuesCount < 3 && score > 90) {
      console.log('⚠️  Обнаружено мало проблем при высоком score - запрашиваем уточнение...');
      const clarificationPrompt = `${freeFormAnalysisPrompt}\n\n⚠️ ВАЖНО: Проанализируй ещё раз более внимательно. Возможно ты пропустил неочевидные проблемы. Проверь:\n- Контрастность всех текстовых элементов\n- Размеры шрифтов\n- Визуальную иерархию\n- Доступность интерактивных элементов\n- Соответствие современным стандартам UX/UI`;
      
      const clarificationResponse = await axios.post(
        'https://router.huggingface.co/v1/chat/completions',
        {
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: clarificationPrompt,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${image}`,
                  },
                },
              ],
            },
          ],
          model: 'Qwen/Qwen2.5-VL-7B-Instruct:hyperbolic',
          stream: false,
          temperature: 0.8,
          top_p: 0.9,
          max_tokens: 6000,
        },
        {
          headers: {
            Authorization: `Bearer ${hfToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );
      
      const clarifiedAnalysis = clarificationResponse.data?.choices?.[0]?.message?.content || '';
      if (clarifiedAnalysis && clarifiedAnalysis.length > freeAnalysis.length) {
        console.log('   ✅ Получен уточненный анализ');
        freeAnalysis = clarifiedAnalysis;
      }
    }

    // ЭТАП 2: Структурирование в JSON
    console.log('🔄 Этап 2: Структурируем анализ в JSON...');
    
    const structurePrompt = structureToJSONPrompt.replace('{previousAnalysis}', freeAnalysis);
    
    const structureResponse = await axios.post(
      'https://router.huggingface.co/v1/chat/completions',
      {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: structurePrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${image}`,
                },
              },
            ],
          },
        ],
        model: 'Qwen/Qwen2.5-VL-7B-Instruct:hyperbolic',
        stream: false,
        temperature: 0.3, // Меньше креативности для структурирования
        top_p: 0.9,
        max_tokens: 4000, // Увеличено для детального JSON с множеством проблем
      },
      {
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    console.log('✅ Получен структурированный JSON');
    const structuredAnswer = structureResponse.data?.choices?.[0]?.message?.content || '';

    if (!structuredAnswer || structuredAnswer.length < 10) {
      console.warn('⚠️  Пустой или короткий ответ от Hugging Face на этапе 2');
      // Fallback: возвращаем свободный анализ
      return { 
        success: true, 
        description: freeAnalysis,
        freeFormAnalysis: freeAnalysis
      };
    }

    console.log('   ✅ Структурированный JSON получен, длина:', structuredAnswer.length, 'символов');
    return { 
      success: true, 
      description: structuredAnswer,
      freeFormAnalysis: freeAnalysis // Сохраняем свободный анализ для summary
    };
  } catch (error: any) {
    console.error('❌ Ошибка Hugging Face Router API:', error?.message || error);

    if (error?.response) {
      const status = error.response.status;
      const errorData = error.response.data || {};
      const errorMessage = errorData.error?.message || errorData.message || '';

      console.error('   HTTP статус:', status);
      console.error('   Данные ошибки:', JSON.stringify(errorData).substring(0, 1000));

      if (status === 401) {
        console.error('   💡 Проблема с аутентификацией - проверьте HF_TOKEN или HUGGINGFACE_API_KEY');
        return {
          success: false,
          description: 'Ошибка аутентификации Hugging Face. Проверьте токен в настройках.',
        };
      } else if (status === 403) {
        console.error('   💡 Проблема с правами доступа');
        return {
          success: false,
          description: 'Недостаточно прав доступа к Hugging Face Router API.',
        };
      } else if (status === 400) {
        console.error('   💡 Неверный формат запроса');
        return {
          success: false,
          description: 'Неверный формат запроса к Hugging Face Router API.',
        };
      } else if (status === 413) {
        console.error('   💡 Изображение слишком большое (Payload Too Large)');
        return {
          success: false,
          description: 'Request failed with status code 413',
          isSizeError: true, // Флаг для идентификации ошибки размера
        };
      } else if (status === 429) {
        console.error('   💡 Превышен лимит запросов');
        return {
          success: false,
          description: 'Превышен лимит запросов к Hugging Face Router API. Попробуйте позже.',
        };
      } else if (status >= 500) {
        console.error('   💡 Внутренняя ошибка сервера Hugging Face');
        return {
          success: false,
          description: 'Внутренняя ошибка Hugging Face Router API. Попробуйте позже.',
        };
      }
    } else if (error?.request) {
      console.error('   ❌ Запрос отправлен, но ответ не получен');
      return {
        success: false,
        description: 'Не удалось получить ответ от Hugging Face Router API. Проверьте интернет-соединение.',
      };
    }

    // Логируем детали ошибки для отладки
    console.error('   Тип ошибки:', error?.constructor?.name);
    console.error('   Код ошибки:', error?.code);
    console.error('   Полное сообщение об ошибке:', error?.message);
    if (error?.response?.data) {
      console.error('   Данные ответа:', JSON.stringify(error.response.data).substring(0, 500));
    }
    
    return {
      success: false,
      description: error?.response?.data?.error?.message || error?.message || 'Ошибка при обращении к Hugging Face Router API.',
    };
  }
}

