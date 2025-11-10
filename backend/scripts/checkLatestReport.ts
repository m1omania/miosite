import { getDb, initDatabase } from '../database/db.js';
import fs from 'fs';

async function checkLatestReport() {
  try {
    await initDatabase();
    const db = getDb();
    
    const report = await db.get<{ id: string; url: string; report_data: string; created_at: string }>(
      'SELECT id, url, report_data, created_at FROM reports ORDER BY created_at DESC LIMIT 1'
    );
    
    if (!report) {
      console.log('❌ Отчетов не найдено');
      return;
    }
    
    console.log('📊 Последний отчет:');
    console.log('   ID:', report.id);
    console.log('   URL:', report.url);
    console.log('   Создан:', report.created_at);
    console.log('   Размер данных:', report.report_data.length, 'символов');
    console.log('');
    
    const reportData = JSON.parse(report.report_data);
    
    console.log('📋 Структура отчета:');
    console.log('   ID:', reportData.id);
    console.log('   URL:', reportData.url);
    console.log('   Дата:', reportData.date);
    console.log('');
    
    console.log('📊 Summary:');
    if (reportData.summary) {
      console.log('   Overall Score:', reportData.summary.overallScore);
      console.log('   Summary length:', reportData.summary.summary?.length || 0, 'символов');
      console.log('   Summary preview:', reportData.summary.summary?.substring(0, 200) || 'отсутствует');
      console.log('   Strengths:', reportData.summary.strengths?.length || 0);
      console.log('   Weaknesses:', reportData.summary.weaknesses?.length || 0);
    } else {
      console.log('   ❌ Summary отсутствует');
    }
    console.log('');
    
    console.log('📸 Screenshots:');
    if (reportData.screenshots) {
      console.log('   Desktop:', reportData.screenshots.desktop ? 'есть' : 'отсутствует');
      console.log('   Mobile:', reportData.screenshots.mobile ? 'есть' : 'отсутствует');
      if (reportData.screenshots.desktop) {
        console.log('   Desktop size:', reportData.screenshots.desktop.length, 'символов');
      }
    } else {
      console.log('   ❌ Screenshots отсутствуют');
    }
    console.log('');
    
    console.log('📁 Categories:');
    if (reportData.categories) {
      console.log('   Количество категорий:', reportData.categories.length);
      reportData.categories.forEach((cat: any, idx: number) => {
        console.log(`   ${idx + 1}. ${cat.name}: score=${cat.score}, issues=${cat.issues?.length || 0}`);
      });
    } else {
      console.log('   ❌ Categories отсутствуют');
    }
    console.log('');
    
    console.log('🔍 Vision Analysis:');
    if (reportData.detailedReport?.visualDesign) {
      const vd = reportData.detailedReport.visualDesign;
      console.log('   Visual Description:', vd.visualDescription?.substring(0, 200) || 'отсутствует');
      console.log('   Issues:', vd.issues?.length || 0);
    } else {
      console.log('   ❌ Visual Design отсутствует');
    }
    console.log('');
    
    console.log('💾 Сохраняю полный отчет в файл...');
    fs.writeFileSync('latest-report.json', JSON.stringify(reportData, null, 2));
    console.log('   ✅ Сохранено в latest-report.json');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
  }
}

checkLatestReport();


