import { NextRequest, NextResponse } from 'next/server';

// Используем серверную переменную окружения (без NEXT_PUBLIC_) для безопасности
// NEXT_PUBLIC_API_URL используется только для клиентской части (если нужно)
const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://53893873b619.vps.myjino.ru:4001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📥 API route: получен запрос', { url: body.url, hasImage: !!body.image });
    
    // Увеличиваем таймаут для больших запросов (анализ сайта может занять время)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 минуты
    
    try {
      console.log('🔄 API route: отправляю запрос на backend', BACKEND_URL);
      
      const response = await fetch(`${BACKEND_URL}/api/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      console.log('📥 API route: получен ответ от backend', { status: response.status, ok: response.ok });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error', message: 'Failed to parse error response' }));
        console.error('❌ API route: ошибка от backend', { 
          status: response.status, 
          error: errorData.error,
          message: errorData.message,
          fullError: errorData
        });
        
        // Передаем детали ошибки от backend клиенту
        return NextResponse.json(
          { 
            error: errorData.error || 'Backend error',
            message: errorData.message || errorData.error || 'Unknown error',
            details: process.env.NODE_ENV === 'development' ? errorData : undefined
          },
          { status: response.status }
        );
      }

      const data = await response.json();
      console.log('✅ API route: успешный ответ от backend', { reportId: data.reportId });
      return NextResponse.json(data);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      console.error('❌ API route: ошибка fetch', { 
        name: fetchError.name, 
        message: fetchError.message,
        code: fetchError.code,
        cause: fetchError.cause
      });
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout - анализ занял слишком много времени' },
          { status: 504 }
        );
      }
      
      // Проверяем, может ли это быть проблема с подключением
      if (fetchError.code === 'ECONNREFUSED' || fetchError.message?.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { error: 'Не удалось подключиться к backend серверу. Проверьте доступность сервера.' },
          { status: 503 }
        );
      }
      
      if (fetchError.message?.includes('fetch failed') || fetchError.message?.includes('network')) {
        return NextResponse.json(
          { error: 'Ошибка сети при подключении к backend. Проверьте доступность сервера.' },
          { status: 503 }
        );
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error('❌ API route: общая ошибка', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Proxy error',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      },
      { status: 500 }
    );
  }
}

