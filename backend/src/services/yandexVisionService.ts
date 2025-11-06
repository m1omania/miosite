import axios from 'axios';
import dotenv from 'dotenv';
import { universalVisionAnalysisPrompt } from './prompts/visionAnalysisPrompt.js';

dotenv.config();

export interface YandexAnalyzeResult {
  description: string;
  success: boolean;
}

export async function analyzeScreenshotWithYandex(base64Image: string): Promise<YandexAnalyzeResult> {
  const apiKey = process.env.YANDEX_API_KEY;
  const folderId = process.env.YANDEX_FOLDER_ID;
  const modelName = process.env.YANDEX_MODEL;

  if (!apiKey || !folderId || !modelName) {
    console.error('❌ Yandex AI Studio не настроен: отсутствуют переменные окружения');
    return {
      success: false,
      description: 'Визуальный анализ недоступен: отсутствуют параметры Yandex AI Studio (YANDEX_API_KEY, YANDEX_FOLDER_ID, YANDEX_MODEL).',
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

  // Модель может быть в формате "qwen2.5-vl-32b-instruct/amrfnqot0nnvod660m9q" или полный URI
  // Извлекаем только название модели
  let model = modelName;
  if (modelName.includes('gpt://')) {
    const modelMatch = modelName.match(/gpt:\/\/[^/]+\/(.+)/);
    model = modelMatch ? modelMatch[1] : modelName.replace(/^gpt:\/\/[^/]+\//, '');
  }

  try {
    console.log('🔄 Отправляем в Yandex AI Studio через OpenAI SDK...');
    console.log('   API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'не установлен');
    console.log('   Folder ID:', folderId);
    console.log('   Model:', model);
    console.log('   Full model URI:', `gpt://${folderId}/${model}`);
    console.log('   Размер изображения (base64):', Math.round(image.length / 1024), 'KB');

    // Используем прямой API endpoint для vision моделей
    // rest-assistant endpoint не поддерживает vision правильно
    const body = {
      modelUri: `gpt://${folderId}/${model}`,
      completionOptions: {
        stream: false,
        temperature: 0.3,
        maxTokens: 2000,
      },
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
    };

    const response = await axios.post(
      'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
      body,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Api-Key ${apiKey}`,
          'x-folder-id': folderId,
        },
        timeout: 30000,
      }
    );

    console.log('✅ Получен ответ от Yandex AI Studio (HTTP', response.status, ')');
    console.log('   Структура ответа:', Object.keys(response.data || {}).join(', '));

    const data = response.data as any;
    
    // Извлекаем текст из ответа
    let description = '';
    const alt0 = data?.result?.alternatives?.[0];
    
    if (alt0?.message?.text) {
      description = String(alt0.message.text).trim();
      console.log('   ✅ Найден text в message.text');
    } else if (alt0?.message?.content && Array.isArray(alt0.message.content)) {
      description = alt0.message.content
        .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
        .filter(Boolean)
        .join(' ')
        .trim();
      console.log('   ✅ Найден text в message.content (массив)');
    } else if (alt0?.text) {
      description = String(alt0.text).trim();
      console.log('   ✅ Найден text в alternatives[0].text');
    } else {
      console.warn('   ⚠️  Неизвестная структура ответа');
      console.warn('   Ключи в data:', Object.keys(data || {}));
      console.warn('   Полный ответ:', JSON.stringify(data).substring(0, 500));
      description = JSON.stringify(data);
    }

    if (!description || description.length < 10) {
      console.warn('⚠️  Пустой или короткий ответ от Yandex AI Studio');
      console.warn('   Длина description:', description.length);
      return {
        success: false,
        description: 'Визуальный анализ через Yandex AI Studio вернул пустой ответ. Модель может не поддерживать vision через этот endpoint.',
      };
    }

    console.log('   ✅ Успешно получен ответ, длина:', description.length, 'символов');
    return { success: true, description };
  } catch (error: any) {
    console.error('❌ Ошибка Yandex AI Studio:', error?.message || error);
    
    // Детальная диагностика ошибки 500
    if (error?.response?.status === 500) {
      const errorMsg = error?.response?.data?.error?.message || '';
      console.error('   💡 Ошибка 500: Модель qwen2.5-vl-32b-instruct может не поддерживать vision');
      console.error('   💡 Или модель не активирована для vision в вашем каталоге');
      console.error('   💡 Рекомендуется использовать Google Vision API или OpenAI Vision API');
      
      return {
        success: false,
        description: 'Модель qwen2.5-vl-32b-instruct не поддерживает vision через этот endpoint или не активирована. Используйте Google Vision API или OpenAI Vision API.',
      };
    }
    
    if (error?.response) {
      const status = error.response.status;
      const errorData = error.response.data || {};
      const errorMessage = errorData.error?.message || errorData.message || '';
      
      console.error('   HTTP статус:', status);
      console.error('   Данные ошибки:', JSON.stringify(errorData).substring(0, 1000));
      
      if (status === 401) {
        console.error('   💡 Проблема с аутентификацией - проверьте YANDEX_API_KEY');
        return {
          success: false,
          description: 'Ошибка аутентификации Yandex AI Studio. Проверьте YANDEX_API_KEY в настройках.',
        };
      } else if (status === 403) {
        console.error('   💡 Проблема с правами доступа - проверьте роли сервисного аккаунта');
        return {
          success: false,
          description: 'Недостаточно прав доступа к Yandex AI Studio. Проверьте настройки сервисного аккаунта.',
        };
      } else if (status === 400) {
        console.error('   💡 Неверный формат запроса - проверьте структуру body');
        return {
          success: false,
          description: 'Неверный формат запроса к Yandex AI Studio. Проверьте настройки модели.',
        };
      } else if (status === 500) {
        console.error('   💡 Внутренняя ошибка сервера Yandex');
        if (errorMessage.includes('Fatal internal error') || errorMessage.includes('Failed to get model')) {
          return {
            success: false,
            description: 'Модель qwen2.5-vl-32b-instruct недоступна или не активирована в вашем каталоге Yandex Cloud. Проверьте доступность vision моделей в Yandex Cloud Console или обратитесь в поддержку Yandex Cloud.',
          };
        }
        return {
          success: false,
          description: 'Внутренняя ошибка Yandex AI Studio. Модель может быть временно недоступна. Попробуйте позже или проверьте статус сервиса.',
        };
      }
    } else if (error?.request) {
      console.error('   ❌ Запрос отправлен, но ответ не получен');
      console.error('   Проверьте доступность API и интернет-соединение');
      return {
        success: false,
        description: 'Не удалось получить ответ от Yandex AI Studio. Проверьте интернет-соединение.',
      };
    } else {
      console.error('   ❌ Ошибка при формировании запроса:', error.message);
    }
    
    return {
      success: false,
      description: error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || 'Ошибка при обращении к Yandex AI Studio. Попробуйте снова позже.',
    };
  }
}

export default analyzeScreenshotWithYandex;


