import axios from 'axios';
import fs from 'fs';

// Создаем простое тестовое изображение (1x1 пиксель PNG)
const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

console.log('');
console.log('=== 🧪 ПРЯМОЙ ТЕСТ OLLAMA ===');
console.log('');

const ollamaUrl = 'http://localhost:11434';
const model = 'llava';

const prompt = `Опиши это изображение одним предложением на русском языке. Что ты видишь?`;

try {
  console.log(`Отправляю запрос к ${ollamaUrl}/api/chat`);
  console.log(`Модель: ${model}`);
  console.log(`Размер изображения: ${testImageBase64.length} символов`);
  console.log('');
  
  const response = await axios.post(
    `${ollamaUrl}/api/chat`,
    {
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
          images: [testImageBase64],
        },
      ],
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 100,
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  console.log('✅ Получен ответ от Ollama');
  console.log('');
  console.log('Структура ответа:');
  console.log(JSON.stringify(response.data, null, 2));
  console.log('');
  
  if (response.data.message?.content) {
    console.log('✅ Content найден!');
    console.log('Content:', response.data.message.content);
  } else {
    console.log('❌ Content не найден в response.data.message.content');
    console.log('Проверяю другие места...');
    if (response.data.content) {
      console.log('✅ Content в response.data.content:', response.data.content);
    } else {
      console.log('❌ Content не найден нигде');
    }
  }
  
} catch (error) {
  console.error('');
  console.error('❌ Ошибка:');
  if (error.response) {
    console.error('HTTP статус:', error.response.status);
    console.error('Данные:', error.response.data);
  } else if (error.code === 'ECONNABORTED') {
    console.error('Таймаут - Ollama не успел ответить');
  } else {
    console.error('Ошибка:', error.message);
  }
}


