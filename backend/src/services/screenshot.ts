import puppeteer, { Browser, Page } from 'puppeteer';

export interface ScreenshotResult {
  desktop: string; // base64
  mobile: string; // base64
}

let browserInstance: Browser | null = null;

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
        '--single-process', // Важно для Render free plan
      ],
    };

    // На Render используем установленный Chrome
    if (process.env.NODE_ENV === 'production') {
      // Проверяем, есть ли Chrome в стандартных местах
      const chromePaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
      ];
      
      // Если Chrome установлен через puppeteer, используем его
      const puppeteerChrome = process.env.PUPPETEER_EXECUTABLE_PATH;
      if (puppeteerChrome) {
        launchOptions.executablePath = puppeteerChrome;
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

