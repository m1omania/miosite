import { Router } from 'express';
import { takeScreenshot, getPageMetrics } from '../services/screenshot.js';
import { parseHTML } from '../services/htmlParser.js';
import { analyzeScreenshot } from '../services/visionAnalysis.js';
import { generateReport } from '../services/reportGenerator.js';
import { getDb, initDatabase } from '../../database/db.js';
import puppeteer from 'puppeteer';

const router = Router();

// Initialize database on first request
let dbInitialized = false;

router.post('/', async (req, res) => {
  let browser: puppeteer.Browser | null = null;
  let page: puppeteer.Page | null = null;

  try {
    const { url } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required and must be a string' });
    }

    // Initialize database if needed
    if (!dbInitialized) {
      await initDatabase();
      dbInitialized = true;
    }

    const db = getDb();

    // Normalize URL for consistency
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    // Delete existing reports for this URL to allow overwriting
    await db.run('DELETE FROM reports WHERE url = ?', [normalizedUrl]);
    console.log('🗑️  Удалены старые отчеты для URL:', normalizedUrl);

    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });

    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Get page metrics and HTML
    const startTime = Date.now();

    await page.goto(normalizedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000, // Увеличиваем таймаут до 30 секунд
    });
    const loadTime = Date.now() - startTime;
    // Wait for page to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Parse HTML and get metrics
    const metrics = await parseHTML(page, loadTime);

    // Для десктоп версии делаем скриншот только первого экрана (viewport)
    // Устанавливаем viewport для десктоп скриншота
    await page.setViewport({ width: 1280, height: 720 });
    await new Promise(resolve => setTimeout(resolve, 500)); // Даем время на рендеринг
    
    const desktopScreenshotFull = await page.screenshot({
      type: 'png',
      fullPage: false, // Только первый экран (viewport), не вся страница
      encoding: 'base64',
    }) as string;

    // Для анализа AI используем desktop скриншот (мобильный не отправляется на анализ)
    const desktopScreenshotViewport = await page.screenshot({
      type: 'jpeg', // JPEG меньше размер чем PNG
      quality: 85, // Увеличено качество для лучшего распознавания
      fullPage: false, // Только видимая область
      encoding: 'base64',
    }) as string;
    
    // Мобильный скриншот не создается и не отправляется на анализ
    // (закомментировано для экономии ресурсов)
    /*
    await page.setViewport({ width: 1920, height: 1080 });
    await new Promise(resolve => setTimeout(resolve, 300));

    await page.setViewport({ width: 375, height: 667 });
    await new Promise(resolve => setTimeout(resolve, 500));

    const mobileScreenshot = await page.screenshot({
      type: 'png',
      fullPage: true,
      encoding: 'base64',
    }) as string;
    */

    const screenshots = {
      desktop: `data:image/png;base64,${desktopScreenshotFull}`,
      // mobile: `data:image/png;base64,${mobileScreenshot}`, // Мобильный скриншот отключен
    };

    // Analyze with Vision API (используем viewport для быстроты)
    console.log('📸 Начинаю визуальный анализ скриншота...');
    console.log('   Использую viewport (видимая область) для быстрого анализа');
    console.log('   Размер viewport:', desktopScreenshotViewport.length, 'символов');
    const visionAnalysis = await analyzeScreenshot(`data:image/png;base64,${desktopScreenshotViewport}`);
    console.log('✅ Визуальный анализ завершен');
    console.log('   Найдено проблем:', visionAnalysis.issues.length);
    console.log('   Рекомендаций:', visionAnalysis.suggestions.length);
    console.log('   Оценка:', visionAnalysis.overallScore);

    // Generate report
    const report = generateReport({
      url: normalizedUrl,
      metrics,
      visionAnalysis,
      screenshots,
    });

    // Save report to database
    await db.run(
      'INSERT INTO reports (id, url, report_data) VALUES (?, ?, ?)',
      [report.id, normalizedUrl, JSON.stringify(report)]
    );

    res.json({ reportId: report.id, report });
  } catch (error) {
    console.error('❌ Audit error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack?.substring(0, 500));
    }
    res.status(500).json({ 
      error: 'Failed to analyze website',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    });
  } finally {
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
    }
  }
});

export default router;
