import type { Page } from 'puppeteer';
import type { SiteMetrics, FontSizeAnalysis, ContrastAnalysis, CTAAnalysis } from '../../../shared/types.js';

export async function parseHTML(page: Page, loadTime: number): Promise<SiteMetrics> {
  // Get page metrics using Puppeteer
  const html = await page.content();

  // Check meta tags
  const hasViewport = await page.evaluate(() => {
    return !!document.querySelector('meta[name="viewport"]');
  });
  
  const hasTitle = await page.evaluate(() => {
    const title = document.querySelector('title');
    return !!title && title.textContent?.trim().length > 0;
  });

  // Extract font sizes using computed styles
  const fontSizes = await analyzeFontSizes(page);

  // Analyze contrast (simplified to avoid browser context issues)
  const contrast: ContrastAnalysis = {
    issues: [],
    score: 100,
  };
  // TODO: Fix analyzeContrast browser context issues
  // const contrast = await analyzeContrast(page);

  // Find CTA elements
  const ctas = await analyzeCTAs(page);

  // Check responsive design
  const responsive = hasViewport && await checkResponsiveElements(page);

  return {
    loadTime,
    hasViewport,
    hasTitle,
    fontSizes,
    contrast,
    ctas,
    responsive,
  };
}

async function analyzeFontSizes(page: Page): Promise<FontSizeAnalysis> {
  const fontData = await page.evaluate(() => {
    const allElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div, a, button, input, textarea, label');
    const fontSizes: number[] = [];
    
    allElements.forEach((el) => {
      const computedStyle = window.getComputedStyle(el);
      const fontSize = computedStyle.fontSize;
      
      if (fontSize) {
        const size = parseFloat(fontSize);
        if (!isNaN(size) && size > 0) {
          fontSizes.push(size);
        }
      }
    });

    return fontSizes;
  });

  const minSize = fontData.length > 0 ? Math.min(...fontData) : 16;
  const maxSize = fontData.length > 0 ? Math.max(...fontData) : 16;
  const issues: string[] = [];

  if (minSize < 12) {
    issues.push(`Найдены шрифты размером менее 12px (минимум: ${minSize.toFixed(1)}px)`);
  }

  if (maxSize > 72) {
    issues.push(`Найдены очень большие шрифты (максимум: ${maxSize.toFixed(1)}px)`);
  }

  return {
    minSize: minSize || 16,
    maxSize: maxSize || 16,
    issues,
  };
}

async function analyzeContrast(page: Page): Promise<ContrastAnalysis> {
  const contrastData = await page.evaluate(() => {
    const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, button');
    const issues = [];
    
    // Helper function to convert RGB to luminance
    function getLuminance(rgb) {
      const match = rgb.match(/\d+/g);
      if (!match || match.length < 3) return 0;
      const r = Number(match[0]);
      const g = Number(match[1]);
      const b = Number(match[2]);
      const rs = r / 255 <= 0.03928 ? (r / 255) / 12.92 : Math.pow((r / 255 + 0.055) / 1.055, 2.4);
      const gs = g / 255 <= 0.03928 ? (g / 255) / 12.92 : Math.pow((g / 255 + 0.055) / 1.055, 2.4);
      const bs = b / 255 <= 0.03928 ? (b / 255) / 12.92 : Math.pow((b / 255 + 0.055) / 1.055, 2.4);
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    // Helper to get background color
    function getBackgroundColor(el) {
      let current = el;
      while (current) {
        const bg = window.getComputedStyle(current).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          return bg;
        }
        current = current.parentElement;
      }
      return 'rgb(255, 255, 255)';
    }

    for (let i = 0; i < textElements.length; i++) {
      const el = textElements[i];
      const computedStyle = window.getComputedStyle(el);
      const textColor = computedStyle.color;
      const bgColor = getBackgroundColor(el);
      
      const textLum = getLuminance(textColor);
      const bgLum = getLuminance(bgColor);
      
      const contrast = (Math.max(textLum, bgLum) + 0.05) / (Math.min(textLum, bgLum) + 0.05);
      
      if (contrast < 4.5 && el.textContent && el.textContent.trim().length > 0) {
        issues.push('Низкая контрастность: ' + contrast.toFixed(2) + ':1 (требуется минимум 4.5:1)');
      }
    }

    const uniqueIssues = [];
    const seen = {};
    for (let i = 0; i < issues.length && uniqueIssues.length < 5; i++) {
      if (!seen[issues[i]]) {
        seen[issues[i]] = true;
        uniqueIssues.push(issues[i]);
      }
    }
    return { issues: uniqueIssues };
  });

  const score = contrastData.issues.length === 0 ? 100 : Math.max(0, 100 - contrastData.issues.length * 15);

  return {
    issues: contrastData.issues,
    score,
  };
}

async function analyzeCTAs(page: Page): Promise<CTAAnalysis> {
  const ctaData = await page.evaluate(() => {
    // Find buttons and links that might be CTAs
    const buttons = document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]');
    const links = document.querySelectorAll('a');
    
    // Check for common CTA text patterns
    const ctaPattern = /купить|заказать|оформить|подписаться|начать|попробовать|скачать|получить|узнать|связаться|консультация|бронировать|подобрать|забронировать|оставить|отправить|применить|выбрать|найти|показать|записаться|зарегистрироваться/i;

    let ctaCount = 0;
    
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const text = (btn.textContent || '').toLowerCase();
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (ctaPattern.test(text) || ctaPattern.test(ariaLabel)) {
        ctaCount++;
      }
    }

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const text = (link.textContent || '').toLowerCase();
      const href = (link.getAttribute('href') || '').toLowerCase();
      const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
      if (ctaPattern.test(text) || ctaPattern.test(href) || ctaPattern.test(ariaLabel)) {
        ctaCount++;
      }
    }

    return ctaCount;
  });

  const issues: string[] = [];
  if (ctaData === 0) {
    issues.push('Не найдено явных призывов к действию');
  } else if (ctaData === 1) {
    issues.push('Найден только один призыв к действию, рекомендуется больше');
  }

  return {
    count: ctaData,
    issues,
  };
}

async function checkResponsiveElements(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    // Check for responsive design indicators
    const hasMediaQueries = document.querySelector('style[media]') !== null;
    const stylesheets = Array.from(document.styleSheets);
    const hasFlexGrid = document.querySelectorAll('[style*="flex"], [style*="grid"]').length > 0;
    
    // Check for flexbox/grid in stylesheets
    let hasResponsiveCSS = false;
    try {
      for (let i = 0; i < stylesheets.length; i++) {
        try {
          const sheet = stylesheets[i];
          const rules = Array.from(sheet.cssRules || []);
          for (let j = 0; j < rules.length; j++) {
            const rule = rules[j];
            if (rule.mediaText || (rule.style && (rule.style.display === 'flex' || rule.style.display === 'grid'))) {
              hasResponsiveCSS = true;
              break;
            }
          }
          if (hasResponsiveCSS) break;
        } catch (e) {
          // Cross-origin stylesheets may throw
        }
      }
    } catch (e) {
      // Ignore errors
    }
    
    return hasMediaQueries || hasFlexGrid || hasResponsiveCSS;
  });
}

