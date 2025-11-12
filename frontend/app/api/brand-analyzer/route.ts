import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';
// @ts-ignore - node-vibrant types may not be available
// import Vibrant from 'node-vibrant'; // Temporarily disabled

interface BrandAnalysisResult {
  url: string;
  metadata: {
    title: string | null;
    description: string | null;
    keywords: string | null;
    favicon: string | null;
  };
  logo: {
    favicon: string | null;
    metaLogo: string | null;
    imageLogos: string[];
  };
  colors: {
    dominant: string[];
    palette: Array<{ color: string; population: number }>;
  };
  fonts: {
    googleFonts: string[];
    systemFonts: string[];
    customFonts: string[];
  };
  images: Array<{
    url: string;
    alt: string | null;
    type: 'main' | 'icon' | 'other';
  }>;
  cssStyles: {
    backgroundColor: string[];
    color: string[];
    borderColor: string[];
  };
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }
  return normalized;
}

function extractColorsFromCSS(cssText: string): string[] {
  const colorRegex = /(?:color|background|border)[-a-z]*:\s*([#a-fA-F0-9]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)|[a-z]+)/gi;
  const matches = cssText.match(colorRegex);
  if (!matches) return [];
  
  const colors = new Set<string>();
  matches.forEach(match => {
    const colorMatch = match.match(/([#a-fA-F0-9]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)|[a-z]+)/i);
    if (colorMatch) {
      colors.add(colorMatch[1].toLowerCase());
    }
  });
  return Array.from(colors);
}

async function extractColorsFromImage(imageUrl: string): Promise<string[]> {
  try {
    const response = await axios.get(imageUrl, { 
      responseType: 'arraybuffer', 
      timeout: 5000,
      maxContentLength: 10 * 1024 * 1024, // 10MB max
      maxBodyLength: 10 * 1024 * 1024
    });
    const buffer = Buffer.from(response.data);
    
    // Check if buffer is valid image
    if (buffer.length === 0) {
      return [];
    }
    
    const palette = await Vibrant.fromBuffer(buffer).getPalette();
    
    const colors: string[] = [];
    if (palette?.Vibrant) colors.push(palette.Vibrant.hex);
    if (palette?.Muted) colors.push(palette.Muted.hex);
    if (palette?.DarkVibrant) colors.push(palette.DarkVibrant.hex);
    if (palette?.DarkMuted) colors.push(palette.DarkMuted.hex);
    if (palette?.LightVibrant) colors.push(palette.LightVibrant.hex);
    if (palette?.LightMuted) colors.push(palette.LightMuted.hex);
    
    return colors;
  } catch (error) {
    console.error('Error extracting colors from image:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    if (!isValidUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const normalizedUrl = normalizeUrl(url);
    const baseUrl = new URL(normalizedUrl).origin;

    // Fetch HTML
    let html: string;
    try {
      console.log('Fetching HTML from:', normalizedUrl);
      const response = await axios.get(normalizedUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 500 // Accept redirects and client errors
      });
      html = response.data;
      console.log('HTML fetched successfully, length:', html?.length || 0);
    } catch (error: any) {
      console.error('Error fetching HTML:', error);
      if (error.response?.status === 404) {
        return NextResponse.json(
          { error: 'Website not found (404)' },
          { status: 404 }
        );
      }
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        return NextResponse.json(
          { error: 'Website is not accessible' },
          { status: 503 }
        );
      }
      if (error.response?.status >= 400 && error.response?.status < 500) {
        return NextResponse.json(
          { error: `Website returned error ${error.response.status}` },
          { status: error.response.status }
        );
      }
      throw error;
    }

    let $: cheerio.CheerioAPI;
    try {
      $ = cheerio.load(html);
    } catch (error) {
      console.error('Error loading HTML with cheerio:', error);
      throw new Error('Failed to parse HTML');
    }
    
    const result: BrandAnalysisResult = {
      url: normalizedUrl,
      metadata: {
        title: $('title').text() || null,
        description: $('meta[name="description"]').attr('content') || null,
        keywords: $('meta[name="keywords"]').attr('content') || null,
        favicon: null
      },
      logo: {
        favicon: null,
        metaLogo: null,
        imageLogos: []
      },
      colors: {
        dominant: [],
        palette: []
      },
      fonts: {
        googleFonts: [],
        systemFonts: [],
        customFonts: []
      },
      images: [],
      cssStyles: {
        backgroundColor: [],
        color: [],
        borderColor: []
      }
    };

    // Extract favicon
    const faviconHref = $('link[rel="icon"]').attr('href') || 
                       $('link[rel="shortcut icon"]').attr('href') ||
                       $('link[rel="apple-touch-icon"]').attr('href');
    if (faviconHref) {
      result.logo.favicon = faviconHref.startsWith('http') ? faviconHref : new URL(faviconHref, baseUrl).href;
      result.metadata.favicon = result.logo.favicon;
    }

    // Extract meta logos (og:image, twitter:image)
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      result.logo.metaLogo = ogImage.startsWith('http') ? ogImage : new URL(ogImage, baseUrl).href;
    }

    // Extract logo images
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      const alt = $(el).attr('alt') || '';
      if (src) {
        const fullUrl = src.startsWith('http') ? src : new URL(src, baseUrl).href;
        const lowerAlt = alt.toLowerCase();
        if (lowerAlt.includes('logo') || lowerAlt.includes('brand') || 
            $(el).attr('class')?.toLowerCase().includes('logo') ||
            $(el).attr('id')?.toLowerCase().includes('logo')) {
          result.logo.imageLogos.push(fullUrl);
        }
        result.images.push({
          url: fullUrl,
          alt: alt || null,
          type: lowerAlt.includes('logo') || lowerAlt.includes('icon') ? 'icon' : 'main'
        });
      }
    });

    // Extract colors from inline styles and CSS
    const allStyles = new Set<string>();
    $('[style]').each((_, el) => {
      const style = $(el).attr('style') || '';
      const colors = extractColorsFromCSS(style);
      colors.forEach(c => allStyles.add(c));
    });

    // Extract from style tags
    $('style').each((_, el) => {
      const cssText = $(el).html() || '';
      const colors = extractColorsFromCSS(cssText);
      colors.forEach(c => allStyles.add(c));
    });

    // Extract from link stylesheets (basic extraction)
    $('link[rel="stylesheet"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        // Note: Full CSS parsing would require fetching the stylesheet
        // This is a simplified version
      }
    });

    result.cssStyles.backgroundColor = Array.from(allStyles).slice(0, 20);
    result.cssStyles.color = Array.from(allStyles).slice(0, 20);
    result.cssStyles.borderColor = Array.from(allStyles).slice(0, 20);

    // Extract dominant colors from main images (limit to avoid timeout)
    // Make this optional - if it fails, continue without colors
    // Temporarily disabled to avoid issues with node-vibrant in Next.js
    // TODO: Re-enable when node-vibrant is properly configured
    /*
    try {
      const mainImages = result.images.slice(0, 2); // Reduced to 2 to avoid timeout
      const colorPromises = mainImages.map(async (img) => {
        try {
          const colors = await extractColorsFromImage(img.url);
          return colors;
        } catch (error) {
          console.log(`Skipping color extraction for ${img.url}:`, error);
          return [];
        }
      });
      
      const colorResults = await Promise.allSettled(colorPromises);
      colorResults.forEach((colorResult) => {
        if (colorResult.status === 'fulfilled' && colorResult.value.length > 0) {
          result.colors.dominant.push(...colorResult.value);
        }
      });
    } catch (error) {
      console.log('Color extraction failed, continuing without dominant colors:', error);
      // Continue without dominant colors
    }
    */

    // Remove duplicates and limit
    result.colors.dominant = [...new Set(result.colors.dominant)].slice(0, 10);

    // Extract fonts
    $('link[href*="fonts.googleapis.com"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const fontMatch = href.match(/family=([^&:]+)/);
      if (fontMatch) {
        const fontName = decodeURIComponent(fontMatch[1]).replace(/\+/g, ' ');
        result.fonts.googleFonts.push(fontName);
      }
    });

    // Extract @font-face fonts
    $('style').each((_, el) => {
      const cssText = $(el).html() || '';
      const fontFaceRegex = /@font-face\s*\{[^}]*font-family:\s*['"]?([^'";}]+)['"]?/gi;
      let match;
      while ((match = fontFaceRegex.exec(cssText)) !== null) {
        result.fonts.customFonts.push(match[1].trim());
      }
    });

    // Extract system fonts from computed styles (simplified - check common font families)
    $('body, h1, h2, h3, p, div').each((_, el) => {
      const fontFamily = $(el).attr('style')?.match(/font-family:\s*([^;]+)/i);
      if (fontFamily) {
        const fonts = fontFamily[1].split(',').map(f => f.trim().replace(/['"]/g, ''));
        fonts.forEach(font => {
          if (!font.includes('google') && !font.includes('font-face')) {
            if (!result.fonts.systemFonts.includes(font)) {
              result.fonts.systemFonts.push(font);
            }
          }
        });
      }
    });

    // Remove duplicates
    result.fonts.googleFonts = [...new Set(result.fonts.googleFonts)];
    result.fonts.customFonts = [...new Set(result.fonts.customFonts)];
    result.fonts.systemFonts = [...new Set(result.fonts.systemFonts)].slice(0, 20);

    // Limit images
    result.images = result.images.slice(0, 20);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Brand analysis error:', error);
    const errorMessage = error?.message || error?.toString() || 'Failed to analyze website';
    console.error('Error details:', {
      message: errorMessage,
      stack: error?.stack,
      name: error?.name
    });
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

