import axios from 'axios';

// Можно изменить на любой другой сайт для тестирования
const TEST_URL = process.env.TEST_URL || 'https://www.google.com';

console.log('');
console.log('=== 🧪 ТЕСТОВЫЙ АУДИТ ===');
console.log('');
console.log(`Тестирую сайт: ${TEST_URL}`);
console.log('');

try {
  const response = await axios.post('http://localhost:4001/api/audit', {
    url: TEST_URL
  }, {
    timeout: 180000 // 3 минуты на весь процесс
  });

  console.log('');
  console.log('=== ✅ АУДИТ ЗАВЕРШЕН ===');
  console.log('');
  console.log('Полный ответ API:');
  console.log(JSON.stringify(response.data, null, 2).substring(0, 1000));
  console.log('');
  console.log('ID отчета:', response.data.reportId || response.data.id);
  console.log('');
  
  // Проверяем наличие visualDescription
  const report = response.data.report;
  
  if (report && report.detailed) {
    const visualDesign = report.detailed.visualDesign;
    if (visualDesign && visualDesign.observations) {
      console.log('📊 Наблюдения Visual Design:');
      visualDesign.observations.forEach((obs, i) => {
        console.log(`   ${i + 1}. ${obs.substring(0, 100)}...`);
      });
    }
  }
  
  // Проверяем категории
  if (report && report.categories) {
    const visualCategory = report.categories.find(c => c.name === 'Визуальный дизайн');
    if (visualCategory) {
      console.log('');
      console.log('📋 Категория "Визуальный дизайн":');
      visualCategory.issues.forEach((issue, i) => {
        if (issue.title.includes('Что видит система')) {
          console.log('');
          console.log('   👁️ ОПИСАНИЕ НАЙДЕНО:');
          console.log('   ', issue.description.substring(0, 200) + '...');
        }
      });
    }
  }
  
  console.log('');
  console.log('=== 🔍 ПРОВЕРКА РЕЗУЛЬТАТА ===');
  console.log('');
  
  const hasVisualDescription = report?.categories?.some(cat => 
    cat.issues?.some(issue => 
      issue.title?.includes('Что видит система') && 
      issue.description && 
      issue.description.length > 10
    )
  ) || report?.detailed?.visualDesign?.observations?.some(obs => 
    obs.includes('Что видит система') && obs.length > 50
  );
  
  if (hasVisualDescription) {
    console.log('✅ visualDescription присутствует в отчете!');
  } else {
    console.log('❌ visualDescription НЕ найден в отчете');
    console.log('');
    console.log('Проверяю логи backend...');
  }
  
  console.log('');
  console.log('Полный отчет доступен по URL:');
  console.log(`http://localhost:4000/report/${response.data.id}`);
  
} catch (error) {
  console.error('');
  console.error('=== ❌ ОШИБКА ===');
  console.error('');
  if (error.response) {
    console.error('HTTP статус:', error.response.status);
    console.error('Ответ:', error.response.data);
  } else if (error.request) {
    console.error('Не удалось получить ответ от сервера');
    console.error('Убедитесь, что backend запущен на порту 4001');
  } else {
    console.error('Ошибка:', error.message);
  }
  process.exit(1);
}

