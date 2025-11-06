import axios from 'axios';
import dotenv from 'dotenv';
import { universalVisionAnalysisPrompt } from './prompts/visionAnalysisPrompt.js';

dotenv.config();

export interface HuggingFaceAnalyzeResult {
  description: string;
  success: boolean;
}

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
    console.log('🔄 Отправляем в Hugging Face Router API...');
    console.log('   Модель: Qwen/Qwen2.5-VL-7B-Instruct:hyperbolic');
    console.log('   Размер изображения (base64):', Math.round(image.length / 1024), 'KB');

    const response = await axios.post(
      'https://router.huggingface.co/v1/chat/completions',
      {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: universalVisionAnalysisPrompt,
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
        temperature: 0.3,
        max_tokens: 2000,
      },
      {
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    console.log('✅ Получен ответ от Hugging Face Router API');
    console.log('   HTTP статус:', response.status);

    const answer = response.data?.choices?.[0]?.message?.content || '';

    if (!answer || answer.length < 10) {
      console.warn('⚠️  Пустой или короткий ответ от Hugging Face');
      return {
        success: false,
        description: 'Визуальный анализ через Hugging Face вернул пустой ответ.',
      };
    }

    console.log('   ✅ Успешно получен ответ, длина:', answer.length, 'символов');
    return { success: true, description: answer };
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

    return {
      success: false,
      description: error?.response?.data?.error?.message || error?.message || 'Ошибка при обращении к Hugging Face Router API.',
    };
  }
}

