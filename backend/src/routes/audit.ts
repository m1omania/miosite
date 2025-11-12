import { Router } from 'express';
import { takeScreenshot, getPageMetrics } from '../services/screenshot.js';
import { parseHTML } from '../services/htmlParser.js';
import { analyzeScreenshot } from '../services/visionAnalysis.js';
import { generateReport } from '../services/reportGenerator.js';
import { getDb, initDatabase } from '../../database/db.js';
import { chromium, type Browser, type Page } from 'playwright';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Initialize database on first request
let dbInitialized = false;

/**
 * Находит путь к Chrome (на Render или VPS)
 */
function findChromePath(): string | null {
  console.log('🔍 Ищу Chrome...');
  console.log('   PUPPETEER_EXECUTABLE_PATH:', process.env.PUPPETEER_EXECUTABLE_PATH || 'не установлен');
  console.log('   PUPPETEER_CACHE_DIR:', process.env.PUPPETEER_CACHE_DIR || 'не установлен');
  
  // Если указан явный путь, используем его
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    console.log('✅ Использую явный путь:', process.env.PUPPETEER_EXECUTABLE_PATH);
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // Определяем, где запущен сервер (Render или VPS)
  const isRender = process.env.RENDER === 'true' || existsSync('/opt/render');
  
  // Для VPS проверяем стандартный путь Puppeteer (~/.cache/puppeteer/chrome)
  if (!isRender) {
    const homeDir = process.env.HOME || '/root';
    const defaultPuppeteerCache = join(homeDir, '.cache', 'puppeteer', 'chrome');
    console.log('   Проверяю стандартный путь Puppeteer для VPS:', defaultPuppeteerCache);
    console.log('   Путь существует:', existsSync(defaultPuppeteerCache));
    
    if (existsSync(defaultPuppeteerCache)) {
      try {
        const versions = readdirSync(defaultPuppeteerCache);
        console.log('   Найдено версий Chrome в стандартном кеше:', versions.length, versions);
        
        for (const version of versions) {
          if (version.startsWith('linux-')) {
            console.log('   Проверяю версию:', version);
            const possiblePaths = [
              join(defaultPuppeteerCache, version, 'chrome-linux64', 'chrome'),
              join(defaultPuppeteerCache, version, 'chrome-linux', 'chrome'),
              join(defaultPuppeteerCache, version, 'chrome', 'chrome'),
            ];
            
            for (const path of possiblePaths) {
              console.log('     Проверяю путь:', path);
              console.log('     Существует:', existsSync(path));
              if (existsSync(path)) {
                console.log('✅ Найден Chrome по стандартному пути Puppeteer:', path);
                return path;
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Ошибка при поиске Chrome в стандартном кеше:', error);
      }
    }
  }
  
  // Пробуем найти Chrome в кеше Puppeteer на Render или VPS
  // Сначала проверяем директорию проекта (сохраняется между build и runtime)
  const projectCacheDir = isRender 
    ? '/opt/render/project/src/backend/.local-chromium'
    : process.env.PUPPETEER_CACHE_DIR || join(process.cwd(), '.local-chromium');
  const projectChromePath = join(projectCacheDir, 'chrome');
  
  console.log('   Проверяю путь к Chrome в проекте:', projectChromePath);
  console.log('   Путь существует:', existsSync(projectChromePath));
  
  if (existsSync(projectChromePath)) {
    try {
      const versions = readdirSync(projectChromePath);
      console.log('   Найдено версий Chrome в проекте:', versions.length, versions);
      
      for (const version of versions) {
        if (version.startsWith('linux-')) {
          console.log('   Проверяю версию:', version);
          const possiblePaths = [
            join(projectChromePath, version, 'chrome-linux64', 'chrome'),
            join(projectChromePath, version, 'chrome-linux', 'chrome'),
            join(projectChromePath, version, 'chrome', 'chrome'),
          ];
          
          for (const path of possiblePaths) {
            console.log('     Проверяю путь:', path);
            console.log('     Существует:', existsSync(path));
            if (existsSync(path)) {
              console.log('✅ Найден Chrome по пути:', path);
              return path;
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Ошибка при поиске Chrome в проекте:', error);
    }
  }
  
  // Затем проверяем переменную окружения PUPPETEER_CACHE_DIR
  const cacheDir = process.env.PUPPETEER_CACHE_DIR || '/opt/render/.cache/puppeteer';
  const chromeCachePath = join(cacheDir, 'chrome');
  
  console.log('   Проверяю путь к кешу:', chromeCachePath);
  console.log('   Путь существует:', existsSync(chromeCachePath));
  
  if (existsSync(chromeCachePath)) {
    try {
      // Ищем папку с версией Chrome (например, linux-127.0.6533.88)
      const versions = readdirSync(chromeCachePath);
      console.log('   Найдено версий Chrome:', versions.length, versions);
      
      for (const version of versions) {
        if (version.startsWith('linux-')) {
          console.log('   Проверяю версию:', version);
          // Пробуем разные варианты структуры папок
          const possiblePaths = [
            join(chromeCachePath, version, 'chrome-linux64', 'chrome'),
            join(chromeCachePath, version, 'chrome-linux', 'chrome'),
            join(chromeCachePath, version, 'chrome', 'chrome'),
          ];
          
          for (const path of possiblePaths) {
            console.log('     Проверяю путь:', path);
            console.log('     Существует:', existsSync(path));
            if (existsSync(path)) {
              console.log('✅ Найден Chrome по пути:', path);
              return path;
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Ошибка при поиске Chrome в кеше:', error);
      if (error instanceof Error) {
        console.error('   Message:', error.message);
        console.error('   Stack:', error.stack?.substring(0, 200));
      }
    }
  } else {
    console.warn('⚠️  Путь к кешу Chrome не существует:', chromeCachePath);
  }

  // Пробуем стандартные пути
  const standardPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];

  console.log('   Проверяю стандартные пути...');
  for (const path of standardPaths) {
    if (existsSync(path)) {
      console.log('✅ Найден Chrome по стандартному пути:', path);
      return path;
    }
  }

  console.warn('⚠️  Chrome не найден ни в одном из проверенных мест');
  return null;
}

router.post('/', async (req, res) => {
  let browser: Browser | null = null;
  let page: Page | null = null;

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
      
      // Проверяем размер изображения (лимит ~0.8MB для Hugging Face API)
      const base64Data = imageDataUrl.split(',')[1] || imageDataUrl;
      let estimatedSizeMB = (base64Data.length * 3) / 4 / 1024 / 1024;
      console.log('   Примерный размер изображения:', estimatedSizeMB.toFixed(2), 'MB');
      
      // Если изображение слишком большое, уменьшаем его
      // Hugging Face Router API обычно принимает изображения до 4-5 MB в base64
      // Но для надежности используем 2 MB как безопасный лимит
      const MAX_SIZE_MB = 2.0; // Увеличенный лимит для дизайнерских макетов
      if (estimatedSizeMB > MAX_SIZE_MB) {
        console.warn(`⚠️  Изображение слишком большое (${estimatedSizeMB.toFixed(2)}MB) для Hugging Face API (лимит ~${MAX_SIZE_MB}MB)`);
        console.warn('   Уменьшаю изображение через Puppeteer...');
        
        try {
          // Используем Puppeteer для уменьшения изображения
          const resizeLaunchOptions: any = {
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--disable-gpu',
              '--disable-software-rasterizer',
              '--disable-extensions',
            ],
          };

          // Определяем, где запущен сервер (Render или VPS)
          const isRender = process.env.RENDER === 'true' || existsSync('/opt/render');
          
          if (isRender) {
            // На Render добавляем --single-process (нужен из-за ограниченных ресурсов)
            resizeLaunchOptions.args.push('--single-process');
            const chromePath = findChromePath();
            if (chromePath) {
              resizeLaunchOptions.executablePath = chromePath;
              console.log('🔧 Использую Chrome по пути (для уменьшения изображения):', chromePath);
            }
          } else {
            // На VPS не нужен --single-process, больше ресурсов
            const chromePath = findChromePath();
            if (chromePath) {
              resizeLaunchOptions.executablePath = chromePath;
              console.log('🔧 Использую Chrome по пути (для уменьшения изображения):', chromePath);
            }
          }

          browser = await chromium.launch(resizeLaunchOptions);
          page = await browser.newPage();
          
          // Пробуем разные настройки качества, пока не достигнем нужного размера
          const qualityLevels = [0.7, 0.6, 0.5, 0.4, 0.3];
          const maxDimensions = [
            { width: 1920, height: 1080 },
            { width: 1600, height: 900 },
            { width: 1280, height: 720 },
            { width: 1024, height: 576 },
            { width: 800, height: 450 },
          ];
          
          let resizedImageDataUrl = imageDataUrl;
          let success = false;
          
          for (let i = 0; i < qualityLevels.length && !success; i++) {
            const quality = qualityLevels[i];
            const dims = maxDimensions[i];
            
            console.log(`   Пробую качество ${(quality * 100).toFixed(0)}%, размер ${dims.width}x${dims.height}...`);
            
            // Загружаем изображение в data URL и создаем временную страницу
            await page.setContent(`
              <html>
                <body style="margin:0;padding:0;">
                  <img id="img" src="${imageDataUrl}" style="max-width:${dims.width}px;max-height:${dims.height}px;width:auto;height:auto;" />
                </body>
              </html>
            `);
            
            // Ждем загрузки изображения
            await page.waitForSelector('#img');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Делаем скриншот с уменьшенным размером
            // Playwright возвращает Buffer, конвертируем в base64
            const resizedScreenshotBuffer = await page.screenshot({
              type: 'jpeg',
              quality: quality * 100,
            });
            const resizedScreenshot = resizedScreenshotBuffer.toString('base64');
            
            const resizedBase64Data = resizedScreenshot;
            const resizedSizeMB = (resizedBase64Data.length * 3) / 4 / 1024 / 1024;
            
            console.log(`   Размер после сжатия: ${resizedSizeMB.toFixed(2)}MB`);
            
            if (resizedSizeMB <= MAX_SIZE_MB) {
              resizedImageDataUrl = `data:image/jpeg;base64,${resizedScreenshot}`;
              estimatedSizeMB = resizedSizeMB;
              success = true;
              console.log(`✅ Изображение успешно уменьшено до ${resizedSizeMB.toFixed(2)}MB`);
            }
          }
          
          if (!success) {
            // Если все попытки не помогли, используем последнее (самое маленькое) изображение
            const lastScreenshotBuffer = await page.screenshot({
              type: 'jpeg',
              quality: 30,
            });
            const lastScreenshot = lastScreenshotBuffer.toString('base64');
            resizedImageDataUrl = `data:image/jpeg;base64,${lastScreenshot}`;
            estimatedSizeMB = (lastScreenshot.length * 3) / 4 / 1024 / 1024;
            console.warn(`⚠️  Не удалось уменьшить до ${MAX_SIZE_MB}MB, использую минимальный размер: ${estimatedSizeMB.toFixed(2)}MB`);
          }
          
          // Используем уменьшенное изображение
          imageDataUrl = resizedImageDataUrl;
          
          // Закрываем браузер
          await page.close();
          await browser.close();
          browser = null;
          page = null;
        } catch (resizeError) {
          console.error('❌ Не удалось уменьшить изображение:', resizeError);
          // Если не удалось уменьшить, возвращаем ошибку
          return res.status(413).json({
            error: 'Image too large',
            message: `Изображение слишком большое (${estimatedSizeMB.toFixed(2)}MB). Не удалось автоматически уменьшить. Пожалуйста, уменьшите размер изображения до ${MAX_SIZE_MB}MB или меньше перед загрузкой.`,
            hint: 'Попробуйте сжать изображение или уменьшить его разрешение до 1280x720 или меньше.',
          });
        }
      }
      
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

      console.log('✅ Изображение готово, возвращаю его клиенту');
      console.log('   Размер:', Math.round(imageDataUrl.length / 1024), 'KB');

      // Сначала создаем отчет со скриншотами и пустым анализом
      let initialVisionAnalysis: any = {
        overallScore: 0,
        issues: [],
        suggestions: [],
        visualDescription: 'AI анализ выполняется...',
        freeFormAnalysis: '',
      };

      // Генерируем начальный отчет со скриншотами
      let report = generateReport({
        url: normalizedUrl,
        metrics,
        visionAnalysis: initialVisionAnalysis,
        screenshots,
      });

      // Добавляем начальный статус - скриншоты готовы, начинаем AI анализ
      report.status = {
        stage: 'ai_analysis',
        message: 'Анализируем дизайн с помощью AI...',
        progress: 80,
      };

      // Сохраняем начальный отчет в БД
      await db.run(
        'INSERT OR REPLACE INTO reports (id, url, report_data) VALUES (?, ?, ?)',
        [report.id, normalizedUrl, JSON.stringify(report)]
      );

      // Отправляем ответ клиенту со скриншотами сразу
      res.json({ reportId: report.id, report });

      // Теперь запускаем AI анализ асинхронно (не блокируя ответ)
      setImmediate(async () => {
        // Получаем db заново в асинхронном блоке
        const asyncDb = getDb();
        
        const updateStatusAsync = async (stage: string, message: string, progress: number) => {
          try {
            console.log(`🔄 Обновляю статус: [${progress}%] ${stage} - ${message} (reportId: ${report.id})`);
            const existingReport = await asyncDb.get<{ report_data: string }>(
              'SELECT report_data FROM reports WHERE id = ?',
              [report.id]
            );
            
            if (existingReport) {
              const reportData = JSON.parse(existingReport.report_data);
              reportData.status = { stage, message, progress };
              await asyncDb.run(
                'UPDATE reports SET report_data = ? WHERE id = ?',
                [JSON.stringify(reportData), report.id]
              );
              console.log(`✅ Статус обновлен: [${progress}%] ${stage} - ${message}`);
            }
          } catch (statusError) {
            console.error('❌ Ошибка при обновлении статуса:', statusError);
          }
        };
        
        try {
          // Обновляем статус: общий обзор
          await updateStatusAsync('ai_analysis', 'Проводим общий обзор дизайна...', 82);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Небольшая задержка для визуализации
          
          console.log('📸 Начинаю визуальный анализ изображения (асинхронно)...');
          const visionAnalysis = await analyzeScreenshot(imageDataUrl);
          console.log('✅ Визуальный анализ завершен (асинхронно)');
          console.log('   Найдено проблем:', visionAnalysis.issues.length);
          console.log('   Рекомендаций:', visionAnalysis.suggestions.length);
          console.log('   Оценка:', visionAnalysis.overallScore);

          // Обновляем статус: выявляем сильные стороны
          await updateStatusAsync('ai_analysis', 'Выявляем сильные стороны...', 88);
          await new Promise(resolve => setTimeout(resolve, 500)); // Небольшая задержка для визуализации

          // Проверяем, не является ли это моковым результатом
          const isMockResult = visionAnalysis.visualDescription?.includes('Визуальный анализ недоступен') ||
                              visionAnalysis.visualDescription?.includes('недоступны или не настроены') ||
                              (visionAnalysis.issues.length === 1 && 
                               typeof visionAnalysis.issues[0] === 'string' &&
                               visionAnalysis.issues[0].includes('недоступен'));
          
          let finalVisionAnalysis = visionAnalysis;
          if (isMockResult) {
            console.warn('⚠️  Получен моковый результат - ИИ не сработал, создаю пустой анализ');
            finalVisionAnalysis = {
              overallScore: 0,
              issues: [],
              suggestions: [],
              visualDescription: 'AI анализ недоступен. Изображение доступно для просмотра.',
              freeFormAnalysis: '',
            };
          }

          // Обновляем статус: определяем проблемы
          await updateStatusAsync('ai_analysis', 'Определяем проблемы и области для улучшения...', 92);
          await new Promise(resolve => setTimeout(resolve, 500)); // Небольшая задержка для визуализации

          // Обновляем статус: финализация отчета
          await updateStatusAsync('finalizing', 'Формируем финальный отчет...', 95);
          await new Promise(resolve => setTimeout(resolve, 500)); // Небольшая задержка для визуализации

          // Обновляем отчет с результатами AI анализа
          const updatedReport = generateReport({
            url: normalizedUrl,
            metrics,
            visionAnalysis: finalVisionAnalysis,
            screenshots,
            reportId: report.id, // Используем тот же ID
          });

          // Обновляем статус: завершено
          updatedReport.status = {
            stage: 'completed',
            message: 'Анализ завершен',
            progress: 100,
          };

          // Небольшая задержка перед финальным статусом, чтобы пользователь увидел процесс
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Обновляем статус в БД отдельно (чтобы polling сразу увидел обновление)
          await updateStatusAsync('completed', 'Анализ завершен', 100);

          // Обновляем отчет в БД (уже содержит статус completed)
          await asyncDb.run(
            'UPDATE reports SET report_data = ? WHERE id = ?',
            [JSON.stringify(updatedReport), report.id]
          );

          console.log(`✅ Финальный отчет обновлен (reportId: ${report.id})`);
        } catch (visionError: any) {
          console.error('❌ Ошибка при асинхронном анализе изображения:', visionError.message);
          console.error('   Stack:', visionError.stack);
          
          // Показываем промежуточный статус перед завершением
          await updateStatusAsync('ai_analysis', 'Обрабатываем результаты...', 90);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Задержка, чтобы пользователь увидел процесс
          
          // Даже при ошибке обновляем статус до completed, чтобы пользователь видел результат
          try {
            await updateStatusAsync('completed', 'Анализ завершен (частичный результат)', 100);
            
            const existingReport = await asyncDb.get<{ report_data: string }>(
              'SELECT report_data FROM reports WHERE id = ?',
              [report.id]
            );
            
            if (existingReport) {
              const reportData = JSON.parse(existingReport.report_data);
              reportData.status = {
                stage: 'completed',
                message: 'Анализ завершен (частичный результат)',
                progress: 100,
              };
              await asyncDb.run(
                'UPDATE reports SET report_data = ? WHERE id = ?',
                [JSON.stringify(reportData), report.id]
              );
              console.log(`✅ Статус обновлен до completed (частичный результат) для reportId: ${report.id}`);
            }
          } catch (statusError) {
            console.error('❌ Ошибка при обновлении статуса после ошибки анализа:', statusError);
          }
        }
      });
      
      return; // Завершаем обработку запроса
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

    // Launch browser с правильной конфигурацией для production
    const launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
      ],
    };

    // Определяем, где запущен сервер (Render или VPS)
    const isRender = process.env.RENDER === 'true' || existsSync('/opt/render');
    const isVPS = !isRender && process.env.NODE_ENV === 'production';
    
    if (isRender) {
      // На Render всегда используем --single-process (ограниченные ресурсы)
      launchOptions.args.push('--single-process');
      
      const chromePath = findChromePath();
      if (chromePath) {
        launchOptions.executablePath = chromePath;
        console.log('🔧 Использую Chrome по пути:', chromePath);
      } else {
        console.warn('⚠️  Chrome не найден, Puppeteer попытается найти его автоматически');
      }
    } else if (isVPS) {
      // На VPS добавляем оптимизации для снижения нагрузки
      launchOptions.args.push(
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-features=TranslateUI',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-renderer-backgrounding',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
        '--enable-automation',
        '--password-store=basic',
        '--use-mock-keychain',
        '--memory-pressure-off',
        '--max_old_space_size=512',
      );
      
      // На VPS используем --single-process только если явно указано в USE_SINGLE_PROCESS
      const useSingleProcess = process.env.USE_SINGLE_PROCESS === 'true';
      if (useSingleProcess) {
        launchOptions.args.push('--single-process');
        console.log('🔧 Использую --single-process для снижения нагрузки на VPS');
      }
      
      const chromePath = findChromePath();
      if (chromePath) {
        launchOptions.executablePath = chromePath;
        console.log('🔧 Использую Chrome по пути:', chromePath);
      }
    }

    // Увеличиваем таймаут CDP-протокола, чтобы избежать Target closed/Network.enable timed out
    launchOptions.protocolTimeout = 60000;
    launchOptions.ignoreHTTPSErrors = true;
    browser = await chromium.launch(launchOptions);

    // В Playwright создаем context с userAgent и headers
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
        'Upgrade-Insecure-Requests': '1',
      },
      viewport: { width: 1920, height: 1080 },
    });
    page = await context.newPage();
    // Глобальные таймауты страницы
    page.setDefaultTimeout(45000);
    page.setDefaultNavigationTimeout(45000);
    // Playwright использует addInitScript вместо evaluateOnNewDocument
    await page.addInitScript(() => {
      // @ts-ignore
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    // Viewport уже установлен в context
    // Ускоряем загрузку: блокируем тяжёлые ресурсы (разрешаем CSS для стабильности layout)
    // Playwright использует page.route() вместо setRequestInterception
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      // Блокируем только media и fonts. Разрешаем images для скриншота, document, script, xhr/fetch, stylesheet
      if (resourceType === 'media' || resourceType === 'font') {
        return route.abort();
      }
      return route.continue();
    });

    // Генерируем reportId заранее для обновления статуса
    const reportId = uuidv4();
    
    // Функция для обновления статуса анализа
    const updateStatus = async (stage: string, message: string, progress: number) => {
      try {
        // Получаем текущий отчет из БД
        const existingReport = await db.get<{ report_data: string }>(
          'SELECT report_data FROM reports WHERE id = ?',
          [reportId]
        );
        
        if (existingReport) {
          const reportData = JSON.parse(existingReport.report_data);
          reportData.status = { stage, message, progress };
          await db.run(
            'UPDATE reports SET report_data = ? WHERE id = ?',
            [JSON.stringify(reportData), reportId]
          );
        } else {
          // Если отчета еще нет, создаем временный
          const tempReport = {
            id: reportId,
            url: normalizedUrl,
            createdAt: new Date().toISOString(),
            categories: [],
            recommendations: [],
            metrics: {} as any,
            status: { stage, message, progress },
          };
          await db.run(
            'INSERT OR REPLACE INTO reports (id, url, report_data) VALUES (?, ?, ?)',
            [reportId, normalizedUrl, JSON.stringify(tempReport)]
          );
        }
        console.log(`📊 Статус: [${progress}%] ${stage} - ${message}`);
      } catch (error) {
        console.error('❌ Ошибка при обновлении статуса:', error);
      }
    };

    // Get page metrics and HTML
    const startTime = Date.now();
    
    // Обновляем статус: загрузка страницы
    await updateStatus('loading', 'Загружаем страницу...', 10);

    // Увеличиваем таймаут для медленных сайтов и используем более мягкую стратегию ожидания
    // Для очень медленных сайтов используем более мягкую стратегию сразу
    let pageLoaded = false;
    let loadError: any = null;
    
    // Обёртка: одна попытка загрузки страницы с domcontentloaded
    const attemptLoad = async (p: Page) => {
      console.log('📡 Пробую загрузить страницу с domcontentloaded (таймаут 45 сек)...');
      await p.goto(normalizedUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
    };
    // Попытка 1 + ретрай при Target closed / Frame detached
    let attempts = 0;
    while (!pageLoaded && attempts < 2) {
      attempts++;
      try {
        await attemptLoad(page as any);
        pageLoaded = true;
        console.log(`✅ Страница загружена с domcontentloaded (попытка ${attempts})`);
      } catch (error: any) {
        loadError = error;
        const msg = String(error?.message || '');
        const isDetached = msg.includes('detached') || msg.includes('Target closed');
        if (error.name === 'TimeoutError') {
          console.warn(`⚠️  Таймаут при загрузке (попытка ${attempts}), пробую следующие стратегии...`);
          break; // перейдём к стратегии 2/3 ниже
        }
        console.warn(`⚠️  Ошибка при загрузке (попытка ${attempts}):`, msg);
        if (isDetached && attempts < 2) {
          // Пересоздаём страницу и повторяем
          try {
            await page.close().catch(() => {});
          } catch {}
          page = await browser!.newPage();
          page.setDefaultTimeout(45000);
          await page.setViewportSize({ width: 1920, height: 1080 });
          await page.route('**/*', (route) => {
            const resourceType = route.request().resourceType();
            // Разрешаем изображения для скриншота
            if (resourceType === 'media' || resourceType === 'font') {
              return route.abort();
            }
            return route.continue();
          });
          continue;
        }
        // Если не детач/таргет клоузд — выходим на следующую стратегию
        break;
      }
    }
    
    // Стратегия 2: Если domcontentloaded не сработал, пробуем load
    if (!pageLoaded) {
      try {
        console.log('📡 Пробую загрузить страницу с load (таймаут 60 сек)...');
        await page.goto(normalizedUrl, {
          waitUntil: 'load',
          timeout: 60000,
        });
        pageLoaded = true;
        console.log('✅ Страница загружена с load');
      } catch (error: any) {
        loadError = error;
        if (error.name === 'TimeoutError') {
          console.warn('⚠️  Таймаут при загрузке с load, пробую commit...');
        } else {
          console.warn('⚠️  Ошибка при загрузке с load:', error.message);
        }
      }
    }
    
    // Стратегия 3: Если load не сработал, пробуем networkidle2 (более мягкий вариант)
    if (!pageLoaded) {
      try {
        console.log('📡 Пробую загрузить страницу с networkidle2 (таймаут 90 сек)...');
        await page.goto(normalizedUrl, {
          waitUntil: 'networkidle', // networkidle - ждет когда не более 0 сетевых соединений в течение 500мс
          timeout: 90000,
        });
        pageLoaded = true;
        console.log('✅ Страница загружена с networkidle2');
      } catch (error: any) {
        loadError = error;
        console.warn('⚠️  Не удалось загрузить страницу даже с networkidle2, пробую без waitUntil...');
        // Стратегия 4: Последняя попытка - без waitUntil, просто ждем таймаут
        try {
          console.log('📡 Пробую загрузить страницу без waitUntil (таймаут 30 сек)...');
          await page.goto(normalizedUrl, {
            timeout: 30000, // Минимальный таймаут, просто ждем начала загрузки
          });
          pageLoaded = true;
          console.log('✅ Страница начала загружаться (без waitUntil)');
        } catch (finalError: any) {
          loadError = finalError;
          console.warn('⚠️  Не удалось загрузить страницу, продолжаю с тем что есть...');
          // Продолжаем работу - возможно страница частично загружена
        }
      }
    }
    
    // Если ничего не помогло, выбрасываем ошибку
    if (!pageLoaded && loadError) {
      throw loadError;
    }
    const loadTime = Date.now() - startTime;
    
    // Ждем стабилизации страницы (оптимизировано для снижения нагрузки)
    console.log('⏳ Жду стабилизации страницы...');
    // Уменьшено время ожидания для снижения нагрузки на CPU
    // Используем простой setTimeout вместо waitForFunction для экономии ресурсов
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('✅ Страница готова к скриншоту');

    // Обновляем статус: анализ метрик
    await updateStatus('metrics', 'Анализируем скорость загрузки...', 30);
    
    // Parse HTML and get metrics
    const metrics = await parseHTML(page, loadTime);
    
    // Обновляем статус: анализ типографики
    await updateStatus('typography', 'Анализируем типографику...', 40);
    
    // Обновляем статус: анализ контраста
    await updateStatus('contrast', 'Анализируем контраст и цвета...', 50);
    
    // Обновляем статус: анализ CTA
    await updateStatus('cta', 'Анализируем призывы к действию...', 60);

    // Функция для создания скриншота viewport (только видимая область - быстрее)
    const createViewportScreenshot = async (maxSizeMB: number = 8): Promise<string> => {
      // Адаптируем настройки в зависимости от требуемого размера
      const isVerySmallLimit = maxSizeMB < 1; // Для очень малых лимитов (<1MB) используем очень агрессивные настройки
      const isSmallLimit = maxSizeMB <= 2; // Для малых лимитов (1-2MB) используем более агрессивные настройки
      
      let qualitySteps: number[];
      let widthSteps: number[];
      
      if (isVerySmallLimit) {
        // Очень агрессивные настройки для размеров <1MB
        qualitySteps = [30, 20, 15, 10];
        widthSteps = [800, 640, 480];
      } else if (isSmallLimit) {
        // Агрессивные настройки для размеров 1-2MB
        qualitySteps = [60, 45, 35, 25];
        widthSteps = [1280, 1024, 800];
      } else {
        // Стандартные настройки для больших размеров
        qualitySteps = [85, 75, 60, 45];
        widthSteps = [1600, 1280, 1024];
      }
      
      console.log('📸 Создаю скриншот viewport для AI анализа (только видимая область)...');
      console.log('   Максимальный размер:', maxSizeMB, 'MB');
      const mode = isVerySmallLimit ? 'очень агрессивный (<1MB)' : isSmallLimit ? 'агрессивный (1-2MB)' : 'стандартный';
      console.log('   Режим:', mode);
      
      // Пробуем разные настройки качества (viewport скриншот - быстрее)
      for (const quality of qualitySteps) {
        console.log(`   Пробую качество ${quality}%...`);
        
        const screenshotBuffer = await page.screenshot({
          type: 'jpeg',
          quality: quality,
          // Без fullPage - только viewport (видимая область)
        });
        const screenshot = screenshotBuffer.toString('base64');

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
        console.log(`   Пробую ширину ${width}px с качеством ${minQuality}% (viewport)...`);
        
        // Временно меняем viewport для уменьшения разрешения
        await page.setViewportSize({ width: width, height: 1080 });
        await new Promise(resolve => setTimeout(resolve, 500)); // Даем время на перерисовку
        
        const screenshotBuffer = await page.screenshot({
          type: 'jpeg',
          quality: minQuality,
          // Без fullPage - только viewport
        });
        const screenshot = screenshotBuffer.toString('base64');
        
        // Восстанавливаем viewport
        await page.setViewportSize({ width: 1920, height: 1080 });
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const base64Size = screenshot.length;
        const estimatedSizeMB = (base64Size * 3) / 4 / 1024 / 1024;
        
        console.log(`   Размер base64: ${(base64Size / 1024).toFixed(2)} KB (примерно ${estimatedSizeMB.toFixed(2)} MB изображения)`);
        
        if (estimatedSizeMB <= maxSizeMB) {
          console.log(`✅ Скриншот viewport создан с шириной ${width}px и качеством ${minQuality}%`);
          return screenshot;
        }
      }
      
      // Если даже с минимальной шириной размер большой, используем минимальное качество
      const finalWidth = widthSteps[widthSteps.length - 1];
      const finalQuality = Math.max(20, minQuality - 5);
      console.log(`   ⚠️ Использую минимальные настройки: ширина ${finalWidth}px, качество ${finalQuality}%...`);
      
        await page.setViewportSize({ width: finalWidth, height: 1080 });
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const finalScreenshotBuffer = await page.screenshot({
        type: 'jpeg',
        quality: finalQuality,
        // Без fullPage - только viewport
      });
      const finalScreenshot = finalScreenshotBuffer.toString('base64');
      
      // Восстанавливаем viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      console.log(`✅ Скриншот viewport создан с минимальными настройками (ширина ${finalWidth}px, качество ${finalQuality}%)`);
      return finalScreenshot;
    };

    // Устанавливаем viewport для полного скриншота
    await page.setViewportSize({ width: 1920, height: 1080 });
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Функция для создания скриншота секции страницы
    const createSectionScreenshot = async (sectionName: string, scrollY: number, height: number): Promise<string> => {
      console.log(`📸 Создаю скриншот секции: ${sectionName} (scrollY: ${scrollY}, height: ${height})`);
      
      // Прокручиваем страницу к нужной секции
      await page.evaluate((y) => {
        window.scrollTo(0, y);
      }, scrollY);
      
      // Ждем прокрутки
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Получаем размеры страницы
      const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      const viewportHeight = 1080; // Высота viewport
      
      // Вычисляем, сколько нужно прокрутить для захвата нужной секции
      const actualScrollY = Math.min(scrollY, pageHeight - viewportHeight);
      
      // Прокручиваем к нужной позиции
      await page.evaluate((y) => {
        window.scrollTo(0, y);
      }, actualScrollY);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Создаем скриншот viewport (видимая область)
      const screenshotBuffer = await page.screenshot({
        type: 'jpeg',
        quality: 70, // Среднее качество для экономии размера
      });
      
      const screenshot = screenshotBuffer.toString('base64');
      console.log(`✅ Скриншот секции ${sectionName} создан: ${Math.round(screenshot.length / 1024)} KB`);
      
      return screenshot;
    };
    
    // Сначала прокручиваем страницу в начало, чтобы правильно определить позиции секций
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Определяем секции страницы (теперь scrollY = 0, координаты будут правильными)
    const pageDimensions = await page.evaluate(() => {
      const header = document.querySelector('header, [role="banner"], .header, #header');
      const footer = document.querySelector('footer, [role="contentinfo"], .footer, #footer');
      const main = document.querySelector('main, [role="main"], .main, #main, .content');
      
      // getBoundingClientRect() возвращает координаты относительно viewport
      // Если страница прокручена в начало (scrollY = 0), то top = абсолютная позиция
      const headerRect = header?.getBoundingClientRect();
      const footerRect = footer?.getBoundingClientRect();
      const mainRect = main?.getBoundingClientRect();
      
      const scrollY = window.scrollY || window.pageYOffset; // Должно быть 0
      const pageHeight = document.documentElement.scrollHeight;
      
      return {
        header: headerRect ? {
          y: headerRect.top + scrollY, // Если scrollY = 0, то top уже абсолютная позиция
          height: headerRect.height
        } : null,
        footer: footerRect ? {
          y: footerRect.top + scrollY,
          height: footerRect.height
        } : null,
        main: mainRect ? {
          y: mainRect.top + scrollY,
          height: mainRect.height
        } : null,
        pageHeight,
        viewportHeight: window.innerHeight
      };
    });
    
    console.log('📐 Размеры страницы:', JSON.stringify(pageDimensions, null, 2));
    
    // Создаем скриншоты секций
    const sectionScreenshots: { [key: string]: string } = {};
    
    // Header (верхняя часть страницы - начинаем с 0)
    // Всегда начинаем с начала страницы для header
    sectionScreenshots.header = await createSectionScreenshot('header', 0, pageDimensions.header ? Math.min(800, pageDimensions.header.height) : 800);
    
    // Main (средняя часть страницы)
    const mainStartY = pageDimensions.header ? pageDimensions.header.y + pageDimensions.header.height : 800;
    const mainHeight = pageDimensions.main ? pageDimensions.main.height : Math.min(1200, pageDimensions.pageHeight - mainStartY);
    sectionScreenshots.main = await createSectionScreenshot('main', mainStartY, mainHeight);
    
    // Footer (нижняя часть страницы - последние 600px)
    const footerStartY = Math.max(0, pageDimensions.pageHeight - 600);
    if (pageDimensions.footer) {
      sectionScreenshots.footer = await createSectionScreenshot('footer', pageDimensions.footer.y, pageDimensions.footer.height);
    } else {
      sectionScreenshots.footer = await createSectionScreenshot('footer', footerStartY, 600);
    }
    
    // ВАЖНО: После создания всех скриншотов секций возвращаемся в начало страницы
    // чтобы основной скриншот для отображения был с начала страницы (header)
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Для отображения пользователю используем первый скриншот (header) как основной
    const desktopScreenshotForAI = sectionScreenshots.header; // Используем header для отображения

    // Для отображения пользователю делаем полный скриншот страницы (PNG для лучшего качества)
    // Скриншот viewport для отображения (быстрее, чем fullPage)
    // Страница уже прокручена в начало (scrollY = 0), поэтому скриншот будет с header
    const desktopScreenshotFullBuffer = await page.screenshot({
      type: 'png',
      // Без fullPage - только viewport (видимая область)
    });
    const desktopScreenshotFull = desktopScreenshotFullBuffer.toString('base64');

    // Мобильный скриншот - viewport (быстрее)
    await page.setViewportSize({ width: 375, height: 667 });
    await new Promise(resolve => setTimeout(resolve, 500));

    const mobileScreenshotBuffer = await page.screenshot({
      type: 'png',
      // Без fullPage - только viewport (видимая область)
    });
    const mobileScreenshot = mobileScreenshotBuffer.toString('base64');

    const screenshots = {
      desktop: `data:image/png;base64,${desktopScreenshotFull}`,
      mobile: `data:image/png;base64,${mobileScreenshot}`, // Используем мобильный viewport скриншот
    };

    console.log('✅ Скриншоты созданы, возвращаю их клиенту');
    console.log('   Desktop:', Math.round(desktopScreenshotFull.length / 1024), 'KB');
    console.log('   Mobile:', Math.round(mobileScreenshot.length / 1024), 'KB');

    // Сначала создаем отчет со скриншотами и пустым анализом
    let visionAnalysis: any = {
      overallScore: 0,
      issues: [],
      suggestions: [],
      visualDescription: 'AI анализ выполняется...',
      freeFormAnalysis: '',
    };

    // Генерируем начальный отчет со скриншотами
    let report = generateReport({
      url: normalizedUrl,
      metrics,
      visionAnalysis,
      screenshots,
      reportId, // Используем тот же ID
    });
    
    // Добавляем начальный статус - скриншоты готовы, начинаем AI анализ
    report.status = {
      stage: 'ai_analysis',
      message: 'Анализируем дизайн с помощью AI...',
      progress: 80,
    };
    
    // Обновляем статус в БД
    await updateStatus('ai_analysis', 'Анализируем дизайн с помощью AI...', 80);

    // Сохраняем начальный отчет в БД
    await db.run(
      'INSERT OR REPLACE INTO reports (id, url, report_data) VALUES (?, ?, ?)',
      [report.id, normalizedUrl, JSON.stringify(report)]
    );

    // Отправляем ответ клиенту со скриншотами сразу
    res.json({ reportId: report.id, report });

    // Закрываем браузер перед запуском AI анализа (освобождаем ресурсы)
    try {
      if (page) {
        await page.close().catch(() => {});
      }
      if (browser) {
        const contexts = browser.contexts();
        await Promise.all(contexts.map(ctx => ctx.close().catch(() => {})));
        await browser.close().catch(() => {});
      }
    } catch (closeError) {
      console.warn('⚠️  Ошибка при закрытии браузера:', closeError);
    }
    browser = null;
    page = null;

    // Теперь запускаем AI анализ асинхронно (не блокируя ответ)
    // Используем setImmediate для запуска после отправки ответа
    setImmediate(async () => {
      // Получаем db заново в асинхронном блоке
      const asyncDb = getDb();
      
      // Функция для обновления статуса в асинхронном блоке
      const updateStatusAsync = async (stage: string, message: string, progress: number) => {
        try {
          console.log(`🔄 Обновляю статус: [${progress}%] ${stage} - ${message} (reportId: ${reportId})`);
          const existingReport = await asyncDb.get<{ report_data: string }>(
            'SELECT report_data FROM reports WHERE id = ?',
            [reportId]
          );
          
          if (existingReport) {
            const reportData = JSON.parse(existingReport.report_data);
            reportData.status = { stage, message, progress };
            await asyncDb.run(
              'UPDATE reports SET report_data = ? WHERE id = ?',
              [JSON.stringify(reportData), reportId]
            );
            console.log(`✅ Статус обновлен: [${progress}%] ${stage} - ${message}`);
          } else {
            console.warn(`⚠️  Отчет не найден для обновления статуса (reportId: ${reportId})`);
          }
        } catch (error) {
          console.error('❌ Ошибка при обновлении статуса (async):', error);
        }
      };
      
      try {
        console.log('📸 Начинаю визуальный анализ скриншотов секций (асинхронно)...');
        console.log('   Количество секций:', Object.keys(sectionScreenshots).length);
        
        // Анализируем каждую секцию отдельно
        const sectionAnalyses: { [key: string]: any } = {};
        const allIssues: any[] = [];
        const allSuggestions: any[] = [];
        let totalScore = 0;
        let sectionCount = 0;
        
        // Анализ header
        if (sectionScreenshots.header) {
          await updateStatusAsync('ai_analysis', 'Анализируем верхнюю часть страницы (header)...', 82);
          await new Promise(resolve => setTimeout(resolve, 500));
          
          console.log('📸 Анализирую header...');
          sectionAnalyses.header = await analyzeScreenshot(`data:image/jpeg;base64,${sectionScreenshots.header}`);
          allIssues.push(...sectionAnalyses.header.issues.map((issue: any) => ({
            ...issue,
            section: 'header'
          })));
          allSuggestions.push(...sectionAnalyses.header.suggestions.map((suggestion: any) => ({
            ...suggestion,
            section: 'header'
          })));
          totalScore += sectionAnalyses.header.overallScore || 0;
          sectionCount++;
          console.log(`✅ Header проанализирован: ${sectionAnalyses.header.issues.length} проблем, оценка ${sectionAnalyses.header.overallScore}`);
        }
        
        // Анализ main
        if (sectionScreenshots.main) {
          await updateStatusAsync('ai_analysis', 'Анализируем основную часть страницы (main)...', 85);
          await new Promise(resolve => setTimeout(resolve, 500));
          
          console.log('📸 Анализирую main...');
          sectionAnalyses.main = await analyzeScreenshot(`data:image/jpeg;base64,${sectionScreenshots.main}`);
          allIssues.push(...sectionAnalyses.main.issues.map((issue: any) => ({
            ...issue,
            section: 'main'
          })));
          allSuggestions.push(...sectionAnalyses.main.suggestions.map((suggestion: any) => ({
            ...suggestion,
            section: 'main'
          })));
          totalScore += sectionAnalyses.main.overallScore || 0;
          sectionCount++;
          console.log(`✅ Main проанализирован: ${sectionAnalyses.main.issues.length} проблем, оценка ${sectionAnalyses.main.overallScore}`);
        }
        
        // Анализ footer
        if (sectionScreenshots.footer) {
          await updateStatusAsync('ai_analysis', 'Анализируем нижнюю часть страницы (footer)...', 88);
          await new Promise(resolve => setTimeout(resolve, 500));
          
          console.log('📸 Анализирую footer...');
          sectionAnalyses.footer = await analyzeScreenshot(`data:image/jpeg;base64,${sectionScreenshots.footer}`);
          allIssues.push(...sectionAnalyses.footer.issues.map((issue: any) => ({
            ...issue,
            section: 'footer'
          })));
          allSuggestions.push(...sectionAnalyses.footer.suggestions.map((suggestion: any) => ({
            ...suggestion,
            section: 'footer'
          })));
          totalScore += sectionAnalyses.footer.overallScore || 0;
          sectionCount++;
          console.log(`✅ Footer проанализирован: ${sectionAnalyses.footer.issues.length} проблем, оценка ${sectionAnalyses.footer.overallScore}`);
        }
        
        // Объединяем результаты в единый отчет
        const averageScore = sectionCount > 0 ? Math.round(totalScore / sectionCount) : 0;
        
        // Объединяем visualDescription в единый текст
        const visualDescriptions = [
          sectionAnalyses.header?.visualDescription,
          sectionAnalyses.main?.visualDescription,
          sectionAnalyses.footer?.visualDescription
        ].filter(Boolean);
        const combinedVisualDescription = visualDescriptions.length > 0 
          ? visualDescriptions.join(' ') 
          : 'Анализ страницы завершен.';
        
        // Объединяем freeFormAnalysis в единый отчет (логично объединяем разделы)
        const freeFormAnalyses = [
          sectionAnalyses.header?.freeFormAnalysis,
          sectionAnalyses.main?.freeFormAnalysis,
          sectionAnalyses.footer?.freeFormAnalysis
        ].filter(Boolean);
        
        let combinedFreeFormAnalysis = '';
        if (freeFormAnalyses.length > 0) {
          // Извлекаем разделы из каждого анализа и объединяем их
          const allGeneralOverviews: string[] = [];
          const allStrengths: string[] = [];
          const allProblems: string[] = [];
          const allRecommendations: string[] = [];
          const allFinalScores: string[] = [];
          
          freeFormAnalyses.forEach((analysis) => {
            if (!analysis) return;
            
            // Извлекаем ОБЩИЙ ОБЗОР
            const overviewMatch = analysis.match(/ОБЩИЙ ОБЗОР:?\s*([\s\S]*?)(?=СИЛЬНЫЕ СТОРОНЫ|ПРОБЛЕМЫ|РЕКОМЕНДАЦИИ|ИТОГОВАЯ ОЦЕНКА|$)/i);
            if (overviewMatch && overviewMatch[1]) {
              allGeneralOverviews.push(overviewMatch[1].trim());
            }
            
            // Извлекаем СИЛЬНЫЕ СТОРОНЫ
            const strengthsMatch = analysis.match(/СИЛЬНЫЕ СТОРОНЫ:?\s*([\s\S]*?)(?=ПРОБЛЕМЫ|РЕКОМЕНДАЦИИ|ИТОГОВАЯ ОЦЕНКА|$)/i);
            if (strengthsMatch && strengthsMatch[1]) {
              allStrengths.push(strengthsMatch[1].trim());
            }
            
            // Извлекаем ПРОБЛЕМЫ
            const problemsMatch = analysis.match(/ПРОБЛЕМЫ:?\s*([\s\S]*?)(?=РЕКОМЕНДАЦИИ|ИТОГОВАЯ ОЦЕНКА|$)/i);
            if (problemsMatch && problemsMatch[1]) {
              allProblems.push(problemsMatch[1].trim());
            }
            
            // Извлекаем РЕКОМЕНДАЦИИ
            const recommendationsMatch = analysis.match(/РЕКОМЕНДАЦИИ:?\s*([\s\S]*?)(?=ИТОГОВАЯ ОЦЕНКА|$)/i);
            if (recommendationsMatch && recommendationsMatch[1]) {
              allRecommendations.push(recommendationsMatch[1].trim());
            }
            
            // Извлекаем ИТОГОВАЯ ОЦЕНКА
            const finalScoreMatch = analysis.match(/ИТОГОВАЯ ОЦЕНКА:?\s*([\s\S]*?)$/i);
            if (finalScoreMatch && finalScoreMatch[1]) {
              allFinalScores.push(finalScoreMatch[1].trim());
            }
          });
          
          // Функция для извлечения отдельных пунктов из текста
          const extractItems = (text: string): string[] => {
            // Разбиваем по строкам, убираем маркеры списка
            return text
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0)
              .map(line => line.replace(/^[-•*]\s*/, '').trim())
              .filter(line => line.length > 0);
          };
          
          // Функция для группировки похожих пунктов
          const groupSimilarItems = (items: string[]): string[] => {
            const grouped: Map<string, string[]> = new Map();
            
            items.forEach(item => {
              // Определяем тип пункта по началу строки
              let key = '';
              if (item.match(/^тип интерфейса:/i)) {
                key = 'Тип интерфейса';
              } else if (item.match(/^первое впечатление:/i)) {
                key = 'Первое впечатление';
              } else if (item.match(/^основная цель страницы:/i)) {
                key = 'Основная цель страницы';
              } else if (item.match(/^мотивация и эмоции:/i)) {
                key = 'Мотивация и эмоции';
              } else {
                // Для остальных используем первые слова как ключ
                const match = item.match(/^([^:]+):/);
                key = match ? match[1].trim() : item.substring(0, 30);
              }
              
              if (!grouped.has(key)) {
                grouped.set(key, []);
              }
              grouped.get(key)!.push(item);
            });
            
            // Объединяем похожие пункты, оставляя самый полный вариант
            const result: string[] = [];
            grouped.forEach((values, key) => {
              // Если есть несколько вариантов, берем самый длинный (наиболее полный)
              const best = values.reduce((a, b) => a.length > b.length ? a : b);
              result.push(best);
            });
            
            return result;
          };
          
          // Функция для удаления упоминаний "быстрая победа" из текста
          const removeQuickWin = (text: string): string => {
            return text
              .replace(/[Бб]ыстрая победа[:\s]*/gi, '')
              .replace(/\([Бб]ыстрая победа\)/gi, '')
              .replace(/[Бб]ыстрая победа[,\s]*/gi, '')
              .replace(/\s+/g, ' ')
              .trim();
          };
          
          // Объединяем разделы в единый отчет, убирая дубликаты
          const parts: string[] = [];
          
          if (allGeneralOverviews.length > 0) {
            // Извлекаем отдельные пункты из всех обзоров
            const allItems: string[] = [];
            allGeneralOverviews.forEach(overview => {
              allItems.push(...extractItems(overview));
            });
            
            // Группируем похожие пункты
            const groupedItems = groupSimilarItems(allItems);
            
            parts.push('ОБЩИЙ ОБЗОР:\n\n' + groupedItems.map(item => `- ${removeQuickWin(item)}`).join('\n'));
          }
          
          if (allStrengths.length > 0) {
            // Извлекаем отдельные пункты из всех сильных сторон
            const allItems: string[] = [];
            allStrengths.forEach(strength => {
              allItems.push(...extractItems(strength));
            });
            
            // Группируем похожие пункты
            const groupedItems = groupSimilarItems(allItems);
            
            parts.push('СИЛЬНЫЕ СТОРОНЫ:\n\n' + groupedItems.map(item => `- ${removeQuickWin(item)}`).join('\n'));
          }
          
          if (allProblems.length > 0) {
            // Для проблем просто объединяем, убирая точные дубликаты
            const allItems: string[] = [];
            allProblems.forEach(problem => {
              allItems.push(...extractItems(problem));
            });
            
            // Убираем точные дубликаты
            const uniqueItems = Array.from(new Set(allItems));
            
            parts.push('ПРОБЛЕМЫ:\n\n' + uniqueItems.map(item => `- ${removeQuickWin(item)}`).join('\n'));
          }
          
          if (allRecommendations.length > 0) {
            // Для рекомендаций просто объединяем, убирая точные дубликаты
            const allItems: string[] = [];
            allRecommendations.forEach(recommendation => {
              allItems.push(...extractItems(recommendation));
            });
            
            // Убираем точные дубликаты
            const uniqueItems = Array.from(new Set(allItems));
            
            parts.push('РЕКОМЕНДАЦИИ:\n\n' + uniqueItems.map(item => `- ${removeQuickWin(item)}`).join('\n'));
          }
          
          if (allFinalScores.length > 0) {
            // Для итоговой оценки берем среднюю оценку и объединяем выводы
            const allKeyFindings = allFinalScores
              .map(s => {
                // Извлекаем "Ключевые выводы" из каждого анализа
                const findingsMatch = s.match(/ключевые выводы:?\s*([^\n]+)/i);
                return findingsMatch ? findingsMatch[1].trim() : null;
              })
              .filter(f => f && f.length > 0);
            
            const uniqueFindings = Array.from(new Set(allKeyFindings));
            
            const finalScoreText = `ИТОГОВАЯ ОЦЕНКА:\n\nОценка: ${averageScore}\n\n` +
              (uniqueFindings.length > 0 ? `Ключевые выводы: ${uniqueFindings.map(f => removeQuickWin(f)).join('. ')}` : '');
            
            parts.push(finalScoreText);
          }
          
          combinedFreeFormAnalysis = parts.join('\n\n');
        }
        
        // Объединяем issues и suggestions, добавляя информацию о секции в описание (если есть)
        const mergedIssues = allIssues.map((issue: any) => {
          if (typeof issue === 'string') {
            return issue;
          }
          // Добавляем информацию о секции в описание, если она есть
          if (issue.section && issue.issue) {
            const sectionName = issue.section === 'header' ? 'верхней части' : 
                               issue.section === 'main' ? 'основной части' : 
                               'нижней части';
            return {
              ...issue,
              issue: `${issue.issue} (${sectionName} страницы)`,
            };
          }
          return issue;
        });
        
        const mergedSuggestions = allSuggestions.map((suggestion: any) => {
          if (typeof suggestion === 'string') {
            return suggestion;
          }
          // Добавляем информацию о секции в описание, если она есть
          if (suggestion.section && suggestion.title) {
            const sectionName = suggestion.section === 'header' ? 'верхней части' : 
                               suggestion.section === 'main' ? 'основной части' : 
                               'нижней части';
            return {
              ...suggestion,
              title: suggestion.title.includes(sectionName) ? suggestion.title : `${suggestion.title} (${sectionName})`,
            };
          }
          return suggestion;
        });
        
        let finalVisionAnalysis = {
          overallScore: averageScore,
          issues: mergedIssues,
          suggestions: mergedSuggestions,
          visualDescription: combinedVisualDescription,
          freeFormAnalysis: combinedFreeFormAnalysis,
        };
        
        console.log('✅ Визуальный анализ всех секций завершен (асинхронно)');
        console.log('   Всего найдено проблем:', finalVisionAnalysis.issues.length);
        console.log('   Всего рекомендаций:', finalVisionAnalysis.suggestions.length);
        console.log('   Средняя оценка:', finalVisionAnalysis.overallScore);
        
        // Проверяем, не является ли это моковым результатом
        const isMockResult = finalVisionAnalysis?.visualDescription?.includes('Визуальный анализ недоступен') ||
                            finalVisionAnalysis?.visualDescription?.includes('недоступны или не настроены') ||
                            (finalVisionAnalysis?.issues?.length === 1 && 
                             typeof finalVisionAnalysis.issues[0] === 'string' &&
                             finalVisionAnalysis.issues[0].includes('недоступен'));
        
        if (isMockResult) {
          console.warn('⚠️  Получен моковый результат - ИИ не сработал, создаю пустой анализ');
          finalVisionAnalysis = {
            overallScore: 0,
            issues: [],
            suggestions: [],
            visualDescription: 'AI анализ недоступен. Скриншот сайта доступен для просмотра.',
            freeFormAnalysis: '',
          };
        }
        
        // Обновляем статус: выявляем сильные стороны
        await updateStatusAsync('ai_analysis', 'Выявляем сильные стороны...', 88);
        
        // Небольшая задержка для визуализации прогресса
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Обновляем статус: определяем проблемы
        await updateStatusAsync('ai_analysis', 'Определяем проблемы и области для улучшения...', 92);
        
        // Небольшая задержка для визуализации прогресса
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Обновляем статус: финализация отчета
        await updateStatusAsync('finalizing', 'Формируем финальный отчет...', 95);
        await new Promise(resolve => setTimeout(resolve, 500)); // Небольшая задержка для визуализации
        
        // Обновляем отчет с результатами AI анализа
        const updatedReport = generateReport({
          url: normalizedUrl,
          metrics,
          visionAnalysis: finalVisionAnalysis,
          screenshots,
          reportId, // Используем тот же ID
        });
        
        // Обновляем статус: завершено
        updatedReport.status = {
          stage: 'completed',
          message: 'Анализ завершен',
          progress: 100,
        };

        // Небольшая задержка перед финальным статусом, чтобы пользователь увидел процесс
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Обновляем статус в БД отдельно (чтобы polling сразу увидел обновление)
        await updateStatusAsync('completed', 'Анализ завершен', 100);

        // Обновляем отчет в БД (уже содержит статус completed)
        await asyncDb.run(
          'UPDATE reports SET report_data = ? WHERE id = ?',
          [JSON.stringify(updatedReport), reportId]
        );
        console.log(`✅ Финальный отчет обновлен (reportId: ${reportId})`);
      } catch (error: any) {
        console.error('❌ Ошибка при асинхронном анализе скриншота:', error.message);
        console.error('   Stack:', error.stack);
        
        // Даже при ошибке обновляем статус до completed, чтобы пользователь видел результат
        // (скриншоты уже отправлены, можно показать частичный отчет)
        try {
          await updateStatusAsync('completed', 'Анализ завершен (частичный результат)', 100);
          
          // Обновляем отчет с частичными данными (без AI анализа)
          const asyncDb = getDb();
          const existingReport = await asyncDb.get<{ report_data: string }>(
            'SELECT report_data FROM reports WHERE id = ?',
            [reportId]
          );
          
          if (existingReport) {
            const reportData = JSON.parse(existingReport.report_data);
            reportData.status = {
              stage: 'completed',
              message: 'Анализ завершен (частичный результат)',
              progress: 100,
            };
            await asyncDb.run(
              'UPDATE reports SET report_data = ? WHERE id = ?',
              [JSON.stringify(reportData), reportId]
            );
            console.log(`✅ Статус обновлен до completed (частичный результат) для reportId: ${reportId}`);
          }
        } catch (statusError) {
          console.error('❌ Ошибка при обновлении статуса после ошибки анализа:', statusError);
        }
      }
    });
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
    
    // Если это ошибка размера изображения, возвращаем специальный статус
    if (error && typeof error === 'object' && 'isSizeError' in error && (error as any).isSizeError) {
      return res.status(413).json({
        error: 'Image too large',
        message: error instanceof Error ? error.message : 'Изображение слишком большое для анализа.',
        hint: 'Попробуйте проанализировать сайт с меньшим количеством контента или используйте другой URL.',
      });
    }
    
    // Если это ошибка недоступности ИИ
    if (error instanceof Error && 
        (error.message.includes('недоступен') || 
         error.message.includes('не настроены') ||
         error.message.includes('API ключей') ||
         error.message.includes('недоступны или не настроены') ||
         error.message.includes('Визуальный анализ недоступен'))) {
      return res.status(503).json({
        error: 'AI service unavailable',
        message: error.message,
        hint: 'Проверьте настройки API ключей (HUGGINGFACE_API_KEY или OPENAI_API_KEY) в переменных окружения Render Dashboard. Также убедитесь, что сервисы доступны (нет таймаутов или ошибок сети).',
      });
    }
    
    // Если это ошибка таймаута навигации
    if (error instanceof Error && 
        (error.name === 'TimeoutError' || 
         error.message.includes('Navigation timeout') ||
         error.message.includes('timeout of') ||
         error.message.includes('exceeded'))) {
      return res.status(504).json({
        error: 'Navigation timeout',
        message: 'Сайт не загрузился за отведенное время. Возможно, сайт медленно загружается или недоступен.',
        hint: 'Попробуйте проанализировать сайт позже или используйте другой URL. Для очень медленных сайтов может потребоваться больше времени.',
      });
    }
    
    // Если это ошибка Puppeteer (браузер не запустился)
    if (error instanceof Error && 
        (error.message.includes('Browser') || 
         error.message.includes('Chrome') ||
         error.message.includes('puppeteer') ||
         error.message.includes('executable'))) {
      return res.status(500).json({
        error: 'Browser initialization failed',
        message: 'Не удалось запустить браузер для анализа. Попробуйте позже.',
        hint: process.env.NODE_ENV === 'production' 
          ? 'Проверьте, что Chrome установлен на сервере (Render).'
          : 'Проверьте установку Puppeteer и Chrome.',
      });
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
