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
    const { url, image } = req.body;
    
    // Проверяем, что передан либо URL, либо картинка
    if (!url && !image) {
      return res.status(400).json({ error: 'URL or image is required' });
    }

    // Если передана картинка, обрабатываем её напрямую
    if (image) {
      if (typeof image !== 'string') {
        return res.status(400).json({ error: 'Invalid image format. Expected base64 data URL string' });
      }
      
      // Проверяем и нормализуем формат base64 data URL
      let imageDataUrl = image.trim();
      const imageDataUrlPattern = /^data:image\/(png|jpeg|jpg|gif|webp|bmp);base64,/i;
      
      // Проверяем формат
      if (!imageDataUrlPattern.test(imageDataUrl)) {
        console.log('⚠️ Изображение не соответствует стандартному формату');
        console.log('   Первые 100 символов:', imageDataUrl.substring(0, 100));
        
        // Если формат не соответствует, пытаемся исправить
        // Проверяем, может быть это raw base64 без префикса
        const base64Only = imageDataUrl.replace(/^data:image\/[^;]+;base64,/, '');
        
        if (base64Only.startsWith('/9j/') || /^[A-Za-z0-9+/=\s]+$/.test(base64Only.replace(/\s/g, ''))) {
          // Похоже на raw base64 (JPEG начинается с /9j/), добавляем префикс
          const cleanBase64 = base64Only.replace(/\s/g, '');
          imageDataUrl = `data:image/jpeg;base64,${cleanBase64}`;
          console.log('✅ Добавлен префикс JPEG к raw base64');
        } else {
          console.error('❌ Не удалось определить формат изображения');
          return res.status(400).json({ 
            error: 'Invalid image format. Expected base64 data URL (data:image/[type];base64,...)',
            hint: 'Make sure the image is a valid base64 encoded image',
            receivedPreview: imageDataUrl.substring(0, 100)
          });
        }
      }
      
      // Проверяем, что base64 данные присутствуют после префикса
      const base64Match = imageDataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (!base64Match || !base64Match[1] || base64Match[1].length < 100) {
        return res.status(400).json({ 
          error: 'Invalid image: base64 data is missing or too short',
          hint: 'The image data appears to be empty or corrupted'
        });
      }

      // Initialize database if needed
      if (!dbInitialized) {
        await initDatabase();
        dbInitialized = true;
      }

      const db = getDb();

      // Генерируем ID для отчета
      const reportId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const normalizedUrl = `image_upload_${reportId}`;

      // Анализируем картинку напрямую через Vision API
      console.log('📸 Начинаю визуальный анализ загруженной картинки...');
      console.log('   Формат изображения:', imageDataUrl.substring(0, 30) + '...');
      console.log('   Размер изображения (base64 длина):', imageDataUrl.length, 'символов');
      
      try {
        const visionAnalysis = await analyzeScreenshot(imageDataUrl);
        console.log('✅ Визуальный анализ завершен');
        console.log('   Найдено проблем:', visionAnalysis.issues.length);
        console.log('   Рекомендаций:', visionAnalysis.suggestions.length);
        console.log('   Оценка:', visionAnalysis.overallScore);

        // Создаем минимальные метрики для отчета (так как нет HTML)
        const metrics = {
          loadTime: 0,
          hasViewport: false,
          hasTitle: false,
          fontSizes: {
            minSize: 16,
            maxSize: 16,
            mainTextSize: 16,
            issues: [],
          },
          contrast: {
            issues: [],
            score: 100,
          },
          ctas: {
            count: 0,
            issues: [],
          },
          responsive: false,
        };

        const screenshots = {
          desktop: imageDataUrl, // Используем загруженную картинку как скриншот
          mobile: imageDataUrl, // Используем ту же картинку для мобильной версии
        };

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

        return res.json({ reportId: report.id, report });
      } catch (visionError) {
        console.error('❌ Ошибка при анализе изображения:', visionError);
        if (visionError instanceof Error) {
          console.error('   Message:', visionError.message);
          console.error('   Stack:', visionError.stack?.substring(0, 500));
        }
        throw visionError; // Пробрасываем ошибку дальше для общей обработки
      }
    }

    // Обработка URL (существующая логика)
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

    // Функция для создания адаптивного скриншота с постепенным снижением качества
    const createAdaptiveScreenshot = async (maxSizeMB: number = 8): Promise<string> => {
      // Адаптируем настройки в зависимости от требуемого размера
      const isSmallLimit = maxSizeMB <= 2; // Для малых лимитов (1-2MB) используем более агрессивные настройки
      const qualitySteps = isSmallLimit ? [60, 45, 35, 25] : [85, 75, 60, 45];
      const widthSteps = isSmallLimit ? [1280, 1024, 800] : [1600, 1280, 1024];
      const maxHeight = isSmallLimit ? 2000 : 3000; // Для малых лимитов обрезаем более агрессивно
      
      console.log('📸 Создаю адаптивный скриншот для AI анализа...');
      console.log('   Максимальный размер:', maxSizeMB, 'MB');
      console.log('   Режим:', isSmallLimit ? 'агрессивный (малый лимит)' : 'стандартный');
      
      // Сначала получаем размеры страницы для полного скриншота
      const pageHeight = await page.evaluate(() => {
        return Math.max(
          document.body.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.clientHeight,
          document.documentElement.scrollHeight,
          document.documentElement.offsetHeight
        );
      });
      
      console.log('   Высота страницы:', pageHeight, 'px');
      
      // Пробуем разные настройки качества
      for (const quality of qualitySteps) {
        console.log(`   Пробую качество ${quality}%...`);
        
        const screenshot = await page.screenshot({
          type: 'jpeg',
          quality: quality,
          fullPage: true, // Полный скриншот страницы
          encoding: 'base64',
        }) as string;

        // Проверяем размер base64 (примерно 4/3 от реального размера)
        const base64Size = screenshot.length;
        const estimatedSizeMB = (base64Size * 3) / 4 / 1024 / 1024;
        
        console.log(`   Размер base64: ${(base64Size / 1024).toFixed(2)} KB (примерно ${estimatedSizeMB.toFixed(2)} MB изображения)`);
        
        // Если размер приемлемый, возвращаем
        if (estimatedSizeMB <= maxSizeMB) {
          console.log(`✅ Скриншот создан с качеством ${quality}% (размер в пределах лимита)`);
          return screenshot;
        }
        
        console.log(`   ⚠️ Размер превышает лимит, пробую меньшее качество...`);
      }
      
      // Если даже с минимальным качеством размер большой, пробуем снизить разрешение (ширину)
      console.log('   ⚠️ Даже с минимальным качеством размер большой, пробую снизить разрешение...');
      const minQuality = qualitySteps[qualitySteps.length - 1];
      
      for (const width of widthSteps) {
        console.log(`   Пробую ширину ${width}px с качеством ${minQuality}% (полная страница)...`);
        
        // Временно меняем viewport для уменьшения разрешения
        await page.setViewport({ width: width, height: 1080 });
        await new Promise(resolve => setTimeout(resolve, 500)); // Даем время на перерисовку
        
        const screenshot = await page.screenshot({
          type: 'jpeg',
          quality: minQuality,
          fullPage: true, // ВСЕГДА полная страница, даже при уменьшенном разрешении
          encoding: 'base64',
        }) as string;
        
        // Восстанавливаем viewport
        await page.setViewport({ width: 1920, height: 1080 });
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const base64Size = screenshot.length;
        const estimatedSizeMB = (base64Size * 3) / 4 / 1024 / 1024;
        
        console.log(`   Размер base64: ${(base64Size / 1024).toFixed(2)} KB (примерно ${estimatedSizeMB.toFixed(2)} MB изображения)`);
        
        if (estimatedSizeMB <= maxSizeMB) {
          console.log(`✅ Скриншот создан с шириной ${width}px и качеством ${minQuality}% (полная страница)`);
          return screenshot;
        }
      }
      
      // Если даже с минимальной шириной размер большой, только тогда обрезаем высоту
      // Это крайний случай - лучше видеть верх страницы, чем ничего
      const finalWidth = widthSteps[widthSteps.length - 1];
      const finalQuality = Math.max(25, minQuality - 5); // Еще немного снижаем качество
      console.log(`   ⚠️ Даже с минимальной шириной размер большой, обрезаю верх страницы ${maxHeight}px...`);
      
      await page.setViewport({ width: finalWidth, height: 1080 });
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const finalScreenshot = await page.screenshot({
        type: 'jpeg',
        quality: finalQuality,
        clip: {
          x: 0,
          y: 0,
          width: finalWidth,
          height: Math.min(maxHeight, pageHeight), // Обрезаем, но стараемся захватить максимум
        },
        encoding: 'base64',
      }) as string;
      
      // Восстанавливаем viewport
      await page.setViewport({ width: 1920, height: 1080 });
      
      console.log(`✅ Скриншот создан с минимальными настройками (верх ${maxHeight}px, ширина ${finalWidth}px, качество ${finalQuality}%)`);
      return finalScreenshot;
    };

    // Устанавливаем viewport для полного скриншота
    await page.setViewport({ width: 1920, height: 1080 });
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Создаем адаптивный скриншот для AI анализа (полная страница с автоматической оптимизацией)
    const desktopScreenshotForAI = await createAdaptiveScreenshot(8); // Максимум 8MB

    // Для отображения пользователю делаем полный скриншот страницы (PNG для лучшего качества)
    const desktopScreenshotFull = await page.screenshot({
      type: 'png',
      fullPage: true, // Полный скриншот всей страницы для отображения
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
      mobile: `data:image/png;base64,${desktopScreenshotFull}`, // Используем desktop скриншот для mobile (мобильный скриншот отключен)
    };

    // Analyze with Vision API (используем полный скриншот с адаптивным качеством)
    console.log('📸 Начинаю визуальный анализ скриншота...');
    console.log('   Использую полный скриншот страницы (адаптивное качество)');
    console.log('   Размер скриншота:', desktopScreenshotForAI.length, 'символов (base64)');
    
    let visionAnalysis: any;
    try {
      visionAnalysis = await analyzeScreenshot(`data:image/jpeg;base64,${desktopScreenshotForAI}`);
      console.log('✅ Визуальный анализ завершен');
      console.log('   Найдено проблем:', visionAnalysis.issues.length);
      console.log('   Рекомендаций:', visionAnalysis.suggestions.length);
      console.log('   Оценка:', visionAnalysis.overallScore);
      console.log('   Visual Description:', visionAnalysis.visualDescription ? `есть (${visionAnalysis.visualDescription.length} символов)` : 'отсутствует');
      console.log('   Free Form Analysis:', visionAnalysis.freeFormAnalysis ? `есть (${visionAnalysis.freeFormAnalysis.length} символов)` : 'отсутствует');
      
      // Проверяем, что анализ действительно выполнился
      if (!visionAnalysis || (visionAnalysis.overallScore === 0 && !visionAnalysis.visualDescription && !visionAnalysis.freeFormAnalysis)) {
        console.warn('⚠️  Анализ вернул пустой результат, возможно была ошибка');
        console.warn('   Проверяю, нужно ли повторить анализ...');
        
        // Если анализ не выполнился, пробуем еще раз с меньшим размером
        if (visionAnalysis && visionAnalysis.visualDescription && visionAnalysis.visualDescription.includes('недоступен')) {
          console.log('   ⚠️ Анализ вернул ошибку, пробую повторить с меньшим размером скриншота...');
          try {
            const fallbackScreenshot = await createAdaptiveScreenshot(2); // Пробуем с 2MB
            visionAnalysis = await analyzeScreenshot(`data:image/jpeg;base64,${fallbackScreenshot}`);
            console.log('✅ Повторный анализ завершен');
            console.log('   Найдено проблем:', visionAnalysis.issues.length);
            console.log('   Оценка:', visionAnalysis.overallScore);
          } catch (retryError: any) {
            console.error('❌ Повторный анализ также не удался:', retryError.message);
            // Продолжаем с текущим результатом
          }
        }
      }
    } catch (error: any) {
      console.error('❌ Ошибка при анализе скриншота:', error.message);
      console.error('   Error type:', error.constructor.name);
      console.error('   isSizeError:', error.isSizeError);
      
      // Если ошибка связана с размером, пробуем еще раз с меньшим качеством
      if (error.isSizeError || error.message?.includes('size') || error.message?.includes('too large') || error.message?.includes('413')) {
        console.log('   ⚠️ Изображение слишком большое (413), пробую создать скриншот с меньшим размером...');
        
        try {
          // Пробуем с более агрессивными настройками - уменьшаем размер постепенно
          let fallbackScreenshot: string | null = null;
          const sizes = [4, 3, 2, 1]; // Пробуем размеры от 4MB до 1MB
          
          for (const sizeMB of sizes) {
            console.log(`   Пробую создать скриншот размером до ${sizeMB}MB...`);
            fallbackScreenshot = await createAdaptiveScreenshot(sizeMB);
            const estimatedSizeMB = (fallbackScreenshot.length * 3) / 4 / 1024 / 1024;
            console.log(`   Размер скриншота: ${estimatedSizeMB.toFixed(2)}MB`);
            
            try {
              visionAnalysis = await analyzeScreenshot(`data:image/jpeg;base64,${fallbackScreenshot}`);
              console.log('✅ Визуальный анализ завершен (с пониженным качеством)');
              break; // Успешно проанализировали
            } catch (retryError: any) {
              if (retryError.isSizeError || retryError.message?.includes('413')) {
                console.log(`   Размер ${sizeMB}MB все еще слишком большой, пробую меньше...`);
                continue; // Пробуем следующий размер
              } else {
                throw retryError; // Другая ошибка - пробрасываем дальше
              }
            }
          }
          
          if (!visionAnalysis) {
            throw new Error('Не удалось создать скриншот подходящего размера для анализа');
          }
        } catch (retryError: any) {
          console.error('❌ Не удалось проанализировать даже с минимальным размером:', retryError.message);
          throw retryError; // Пробрасываем ошибку дальше
        }
      } else {
        throw error; // Пробрасываем ошибку дальше, если это не проблема размера
      }
    }

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
      console.error('   Stack:', error.stack?.substring(0, 1000));
      console.error('   Error name:', error.name);
    }
    
    // Закрываем браузер и страницы в случае ошибки
    try {
      if (page) {
        await page.close();
      }
      if (browser) {
        await browser.close();
      }
    } catch (closeError) {
      console.error('❌ Error closing browser:', closeError);
    }
    
    res.status(500).json({ 
      error: 'Failed to analyze website',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack?.substring(0, 500) : undefined) : undefined
    });
  } finally {
    // Дополнительная проверка на случай если ошибка произошла до инициализации
    try {
      if (page && !page.isClosed()) {
      await page.close();
    }
    if (browser) {
      await browser.close();
      }
    } catch (closeError) {
      // Игнорируем ошибки при закрытии
    }
  }
});

export default router;
