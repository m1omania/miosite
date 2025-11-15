import axios from 'axios';

async function testAudit() {
  try {
    console.log('🧪 Тестирую анализ сайта...');
    console.log('');
    
    const testUrl = 'https://example.com';
    console.log('📡 Отправляю запрос на анализ:', testUrl);
    
    const response = await axios.post('http://localhost:4001/api/audit', {
      url: testUrl
    }, {
      timeout: 120000, // 2 минуты на анализ
    });
    
    console.log('✅ Ответ получен');
    console.log('   Report ID:', response.data.reportId);
    console.log('   Overall Score:', response.data.report?.summary?.overallScore);
    console.log('   Summary:', response.data.report?.summary?.summary?.substring(0, 200));
    console.log('   Free Form Analysis:', response.data.report?.summary?.summary ? 'есть' : 'отсутствует');
    console.log('   Visual Description:', response.data.report?.detailedReport?.visualDesign?.visualDescription ? 'есть' : 'отсутствует');
    console.log('   Issues:', response.data.report?.categories?.flatMap((c: any) => c.issues)?.length || 0);
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data).substring(0, 500));
    }
  }
}

testAudit();



