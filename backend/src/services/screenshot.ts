import puppeteer, { Browser, Page } from 'puppeteer';
import { existsSync } from 'fs';
import { readdirSync } from 'fs';
import { join } from 'path';

export interface ScreenshotResult {
  desktop: string; // base64
  mobile: string; // base64
}

let browserInstance: Browser | null = null;

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
  
  // Пробуем найти Chrome в кеше Puppeteer на Render
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
      // На Render используем установленный Chrome и добавляем --single-process
      // (нужен из-за ограниченных ресурсов на Free tier)
      launchOptions.args.push('--single-process');
      
      // Пробуем найти Chrome
      const chromePath = findChromePath();
      if (chromePath) {
        launchOptions.executablePath = chromePath;
        console.log('🔧 Использую Chrome по пути:', chromePath);
      } else {
        console.warn('⚠️  Chrome не найден, Puppeteer попытается найти его автоматически');
      }
    } else if (isVPS) {
      // На VPS больше ресурсов, не нужен --single-process
      // Пробуем найти Chrome в стандартных местах или через Puppeteer
      const chromePath = findChromePath();
      if (chromePath) {
        launchOptions.executablePath = chromePath;
        console.log('🔧 Использую Chrome по пути:', chromePath);
      } else {
        // На VPS Puppeteer должен найти Chrome автоматически
        console.log('🔧 Puppeteer найдет Chrome автоматически');
      }
    }

    browserInstance = await puppeteer.launch(launchOptions);
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

    // Set viewport for desktop
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to page with timeout
    const startTime = Date.now();
    await page.goto(normalizedUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    const loadTime = Date.now() - startTime;

    // Wait a bit for dynamic content
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Take desktop screenshot (full page)
    const desktopScreenshot = await page.screenshot({
      type: 'png',
      fullPage: true, // Screenshot всей страницы
      encoding: 'base64',
    }) as string;

    // Set mobile viewport
    await page.setViewport({ width: 375, height: 667 });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Take mobile screenshot (full page)
    const mobileScreenshot = await page.screenshot({
      type: 'png',
      fullPage: true, // Screenshot всей страницы
      encoding: 'base64',
    }) as string;

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

    const startTime = Date.now();
    await page.goto(normalizedUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    const loadTime = Date.now() - startTime;

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

