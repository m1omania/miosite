import { initDatabase, getDb } from '../database/db.js';

async function checkLatestReportDetails() {
  await initDatabase();
  const db = getDb();
  
  const report = await db.get<{
    id: string;
    url: string;
    report_data: string;
    created_at: string;
  }>('SELECT id, url, report_data, created_at FROM reports ORDER BY created_at DESC LIMIT 1');
  
  if (!report) {
    console.log('❌ Отчеты не найдены в базе данных');
    return;
  }
  
  console.log('📊 Последний отчет:');
  console.log('ID:', report.id);
  console.log('URL:', report.url);
  console.log('Создан:', report.created_at);
  console.log('\n=== ДЕТАЛЬНЫЙ АНАЛИЗ ===\n');
  
  const reportData = JSON.parse(report.report_data);
  
  // Проверяем freeFormAnalysis
  const freeFormAnalysis = reportData.visionAnalysis?.freeFormAnalysis;
  if (freeFormAnalysis) {
    console.log('✅ Free Form Analysis найден');
    console.log('   Длина:', freeFormAnalysis.length, 'символов');
    console.log('\n--- Free Form Analysis (первые 2000 символов) ---');
    console.log(freeFormAnalysis.substring(0, 2000));
    if (freeFormAnalysis.length > 2000) {
      console.log('\n... (еще', freeFormAnalysis.length - 2000, 'символов)');
    }
  } else {
    console.log('❌ Free Form Analysis НЕ найден!');
  }
  
  console.log('\n--- Vision Analysis структура ---');
  console.log('Visual description длина:', reportData.visionAnalysis?.visualDescription?.length || 0);
  console.log('Issues count:', reportData.visionAnalysis?.issues?.length || 0);
  console.log('Suggestions count:', reportData.visionAnalysis?.suggestions?.length || 0);
  console.log('Overall score:', reportData.visionAnalysis?.overallScore || 'N/A');
  
  console.log('\n--- Summary структура ---');
  console.log('Summary текст длина:', reportData.summary?.summary?.length || 0);
  console.log('Summary текст:', reportData.summary?.summary || 'N/A');
  console.log('Strengths:', reportData.summary?.strengths?.length || 0);
  console.log('Weaknesses:', reportData.summary?.weaknesses?.length || 0);
  
  // Проверяем screenshots
  console.log('\n--- Screenshots ---');
  console.log('Desktop screenshot есть:', !!reportData.screenshots?.desktop);
  if (reportData.screenshots?.desktop) {
    const screenshotSize = reportData.screenshots.desktop.length;
    console.log('   Размер desktop screenshot (base64):', (screenshotSize / 1024).toFixed(2), 'KB');
  }
}

checkLatestReportDetails().catch(console.error);



