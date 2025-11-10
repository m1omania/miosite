import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://53893873b619.vps.myjino.ru:4001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Увеличиваем таймаут для больших запросов (анализ сайта может занять время)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 минуты
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        return NextResponse.json(
          { error: errorData.error || 'Backend error' },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout - анализ занял слишком много времени' },
          { status: 504 }
        );
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Proxy error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

