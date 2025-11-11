import { chromium, Browser, Page } from 'playwright';
import { existsSync } from 'fs';

export interface ScreenshotResult {
  desktop: string; // base64
  mobile: string; // base64
}

let browserInstance: Browser | null = null;

/**
 * Находит путь к Chrome для Playwright (опционально)
 * Playwright обычно сам управляет браузерами, но можно указать путь
 */
function findChromePath(): string | undefined {
  console.log('🔍 Ищу Chrome для Playwright...');
  
  // Если указан явный путь, используем его
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    console.log('✅ Использую явный путь:', process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH);
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }

  // Определяем, где запущен сервер (Render или VPS)
  const isRender = process.env.RENDER === 'true' || existsSync('/opt/render');
  
  // Playwright обычно сам управляет браузерами через npx playwright install
  // Но можно указать путь, если браузер установлен вручную
  if (!isRender) {
    // На VPS Playwright установит браузер автоматически при первом запуске
    // или можно использовать системный Chrome
    const standardPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ];

    for (const path of standardPaths) {
      if (existsSync(path)) {
        console.log('✅ Найден Chrome по стандартному пути:', path);
        return path;
      }
    }
  }

  console.log('🔧 Playwright будет использовать встроенный браузер');
  return undefined;
}

async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
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
      // На Render используем --single-process для ограниченных ресурсов
      launchOptions.args.push('--single-process');
      
      const chromePath = findChromePath();
      if (chromePath) {
        launchOptions.executablePath = chromePath;
        console.log('🔧 Использую Chrome по пути:', chromePath);
      }
    } else if (isVPS) {
      // На VPS оптимизируем для снижения нагрузки на CPU и память
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
      
      // На VPS используем --single-process только если явно указано
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

    // Playwright использует chromium.launch() вместо puppeteer.launch()
    try {
      browserInstance = await chromium.launch(launchOptions);
      
      // Обрабатываем закрытие браузера
      browserInstance.on('disconnected', () => {
        console.warn('⚠️  Browser disconnected, resetting instance');
        browserInstance = null;
      });
      
    } catch (error) {
      console.error('❌ Failed to launch browser:', error);
      browserInstance = null;
      throw error;
    }
  }
  return browserInstance;
}

export async function takeScreenshot(url: string): Promise<ScreenshotResult> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Validate URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    browser = await getBrowser();
    page = await browser.newPage();

    // Block heavy resources to speed up load
    // Playwright использует page.route() вместо setRequestInterception
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      // Block images, media, fonts, stylesheets
      if (resourceType === 'image' || resourceType === 'media' || resourceType === 'font' || resourceType === 'stylesheet') {
        return route.abort();
      }
      return route.continue();
    });

    // Set viewport for desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Navigate to page with timeout
    const startTime = Date.now();
    await page.goto(normalizedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    const loadTime = Date.now() - startTime;

    // Ждем стабилизации страницы (оптимизировано для снижения нагрузки)
    console.log('⏳ Жду стабилизации страницы для скриншота...');
    // Playwright имеет встроенные ожидания, но для совместимости используем setTimeout
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('✅ Страница готова к скриншоту');

    // Take desktop screenshot (viewport only for speed)
    // Playwright возвращает Buffer, нужно конвертировать в base64
    const desktopScreenshotBuffer = await page.screenshot({
      type: 'png',
      fullPage: false,
    });
    const desktopScreenshot = desktopScreenshotBuffer.toString('base64');

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    // Ждем перерисовки (уменьшено время для снижения нагрузки)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Take mobile screenshot (viewport only for speed)
    const mobileScreenshotBuffer = await page.screenshot({
      type: 'png',
      fullPage: false,
    });
    const mobileScreenshot = mobileScreenshotBuffer.toString('base64');

    return {
      desktop: `data:image/png;base64,${desktopScreenshot}`,
      mobile: `data:image/png;base64,${mobileScreenshot}`,
    };
  } catch (error) {
    console.error('Screenshot error:', error);
    throw new Error(`Failed to take screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (page) {
      await page.close();
    }
    // Don't close browser to reuse it
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

export async function getPageMetrics(url: string): Promise<{ loadTime: number; html: string }> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    browser = await getBrowser();
    page = await browser.newPage();

    // Block heavy resources to speed up load
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (resourceType === 'image' || resourceType === 'media' || resourceType === 'font' || resourceType === 'stylesheet') {
        return route.abort();
      }
      return route.continue();
    });

    const startTime = Date.now();
    await page.goto(normalizedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    const loadTime = Date.now() - startTime;

    // Ждем стабилизации страницы (оптимизировано)
    await new Promise(resolve => setTimeout(resolve, 1000));

    const html = await page.content();

    return { loadTime, html };
  } catch (error) {
    console.error('Page metrics error:', error);
    throw new Error(`Failed to get page metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (page) {
      await page.close();
    }
  }
}
