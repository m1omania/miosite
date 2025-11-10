'use client';

import { useState } from 'react';

// Словарь принципов с описаниями
const PRINCIPLES: Record<string, { description: string; category: string }> = {
  // Эвристики Нильсена
  'Видимость статуса системы': {
    description: 'Система должна всегда информировать пользователя о том, что происходит, через соответствующий отзыв в разумное время.',
    category: 'Эвристика Нильсена'
  },
  'Соответствие реальному миру': {
    description: 'Система должна говорить на языке пользователя, используя слова, фразы и понятия, знакомые пользователю.',
    category: 'Эвристика Нильсена'
  },
  'Контроль и свобода пользователя': {
    description: 'Пользователи часто выбирают системные функции по ошибке и им нужна четко обозначенная "аварийная" кнопка выхода.',
    category: 'Эвристика Нильсена'
  },
  'Согласованность и стандарты': {
    description: 'Пользователи не должны задаваться вопросом, означают ли разные слова, ситуации или действия одно и то же.',
    category: 'Эвристика Нильсена'
  },
  'Предотвращение ошибок': {
    description: 'Еще лучше, чем хорошие сообщения об ошибках, — это тщательный дизайн, который в первую очередь предотвращает возникновение проблемы.',
    category: 'Эвристика Нильсена'
  },
  'Узнавание вместо запоминания': {
    description: 'Объекты, действия и опции должны быть видны. Пользователь не должен помнить информацию из одной части диалога в другую.',
    category: 'Эвристика Нильсена'
  },
  'Гибкость и эффективность использования': {
    description: 'Ускорители могут увеличить скорость взаимодействия для опытного пользователя, позволяя системе обслуживать как неопытных, так и опытных пользователей.',
    category: 'Эвристика Нильсена'
  },
  'Эстетика и минимализм': {
    description: 'Диалоги не должны содержать информацию, которая является нерелевантной или редко нужной.',
    category: 'Эвристика Нильсена'
  },
  'Помощь при ошибках': {
    description: 'Сообщения об ошибках должны быть выражены простым языком, точно указывать проблему и конструктивно предлагать решение.',
    category: 'Эвристика Нильсена'
  },
  'Справка и документация': {
    description: 'Хотя лучше, чтобы система использовалась без документации, может потребоваться помощь. Такая информация должна быть легко доступна.',
    category: 'Эвристика Нильсена'
  },
  'Контрастность и доступность': {
    description: 'Достаточный контраст между текстом и фоном обеспечивает читаемость для всех пользователей, включая людей с нарушениями зрения.',
    category: 'Эвристика Нильсена'
  },
  
  // Принципы Дитера Рамса
  'Инновационный дизайн': {
    description: 'Хороший дизайн — инновационный. Возможности для инновации еще не исчерпаны. Технологическое развитие всегда предлагает новые возможности для инновационного дизайна.',
    category: 'Принцип Рамса'
  },
  'Дизайн делает продукт полезным': {
    description: 'Хороший дизайн делает продукт полезным. Продукт покупают для использования. Он должен выполнять определенные функции, быть функциональным и психологически, и эстетически.',
    category: 'Принцип Рамса'
  },
  'Эстетичный дизайн': {
    description: 'Хороший дизайн — эстетичный. Эстетические качества продукта неотъемлемы от его полезности, потому что продукты, которые мы используем каждый день, влияют на нашу личность и благополучие.',
    category: 'Принцип Рамса'
  },
  'Дизайн делает продукт понятным': {
    description: 'Хороший дизайн делает продукт понятным. Он проясняет структуру продукта. Еще лучше, он может заставить продукт говорить. В лучшем случае он сам по себе объясняет.',
    category: 'Принцип Рамса'
  },
  'Ненавязчивый дизайн': {
    description: 'Хороший дизайн — ненавязчивый. Продукты, выполняющие определенную цель, имеют характеристики инструментов. Они не декоративные объекты и не произведения искусства.',
    category: 'Принцип Рамса'
  },
  'Честный дизайн': {
    description: 'Хороший дизайн — честный. Он не делает продукт более инновационным, мощным или ценным, чем он есть на самом деле. Он не пытается манипулировать потребителем обещаниями, которые не может выполнить.',
    category: 'Принцип Рамса'
  },
  'Долговечный дизайн': {
    description: 'Хороший дизайн долговечен. Он избегает быть модным и поэтому никогда не выглядит устаревшим. В отличие от модного дизайна, он прослужит много лет.',
    category: 'Принцип Рамса'
  },
  'Продуманный до мелочей дизайн': {
    description: 'Хороший дизайн продуман до мелочей. Ничего не должно быть произвольным или случайным. Забота и точность в процессе проектирования показывают уважение к пользователю.',
    category: 'Принцип Рамса'
  },
  'Экологичный дизайн': {
    description: 'Хороший дизайн заботится об окружающей среде. Дизайн вносит важный вклад в сохранение окружающей среды. Он экономит ресурсы и сводит к минимуму физическое и визуальное загрязнение на протяжении всего жизненного цикла продукта.',
    category: 'Принцип Рамса'
  },
  'Минималистичный дизайн': {
    description: 'Хороший дизайн — минималистичный. Меньше, но лучше — потому что концентрируется на существенных аспектах, а продукты не обременены несущественными.',
    category: 'Принцип Рамса'
  },
  'Хороший дизайн делает продукт понятным': {
    description: 'Хороший дизайн делает продукт понятным. Он проясняет структуру продукта. Еще лучше, он может заставить продукт говорить. В лучшем случае он сам по себе объясняет.',
    category: 'Принцип Рамса'
  },
  'Хороший дизайн — минималистичный': {
    description: 'Хороший дизайн — минималистичный. Меньше, но лучше — потому что концентрируется на существенных аспектах, а продукты не обременены несущественными.',
    category: 'Принцип Рамса'
  },
  'Хороший дизайн — инновационный': {
    description: 'Хороший дизайн — инновационный. Возможности для инновации еще не исчерпаны. Технологическое развитие всегда предлагает новые возможности для инновационного дизайна.',
    category: 'Принцип Рамса'
  },
  
  // Дополнительные принципы
  'KISS': {
    description: 'Keep it simple, stupid — сохраняй простоту. Дизайн должен быть максимально простым и иметь минимальную сложность.',
    category: 'Принцип индустрии'
  },
  "Don't make me think": {
    description: 'Не заставляй меня думать. Интерфейс должен быть интуитивным, пользователь не должен гадать, как что-то работает.',
    category: 'Принцип индустрии'
  },
  'Закон близости': {
    description: 'Закон близости (Gestalt): элементы, расположенные близко друг к другу, воспринимаются как группа. Группируй связанные элементы визуально.',
    category: 'Принцип индустрии'
  },
  'Закон подобия': {
    description: 'Закон подобия (Gestalt): похожие элементы воспринимаются как функционально связанные. Используй визуальное сходство для обозначения функциональной связи.',
    category: 'Принцип индустрии'
  },
  'Закон Фицса': {
    description: 'Закон Фицса: время для достижения цели зависит от расстояния до цели и размера цели. Важные действия должны быть легко доступны и иметь достаточный размер для клика/тапа.',
    category: 'Принцип индустрии'
  },
  'Закон Хика': {
    description: 'Закон Хика: время принятия решения увеличивается с количеством и сложностью вариантов выбора. Уменьшай количество вариантов на каждом шаге для ускорения принятия решений.',
    category: 'Принцип индустрии'
  },
  'Постепенное раскрытие': {
    description: 'Постепенное раскрытие (Progressive Disclosure): показывай опции и детали только тогда, когда они нужны. Это снижает когнитивную нагрузку.',
    category: 'Принцип индустрии'
  },
  'Обратная связь и отзывчивость': {
    description: 'Обратная связь и отзывчивость: каждое действие пользователя должно вызывать четкий отклик. Пользователь должен понимать, что система обработала его действие.',
    category: 'Принцип индустрии'
  },
  'Эмоциональный дизайн': {
    description: 'Эмоциональный дизайн: создавай положительные эмоциональные реакции, радость, доверие. Хороший дизайн вызывает эмоции и создает приятный пользовательский опыт.',
    category: 'Принцип индустрии'
  }
};

interface PrincipleTooltipProps {
  principleName: string;
  children: React.ReactNode;
}

export default function PrincipleTooltip({ principleName, children }: PrincipleTooltipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const principle = PRINCIPLES[principleName];

  if (!principle) {
    // Если принцип не найден в словаре, просто возвращаем текст без подсказки
    return <>{children}</>;
  }

  return (
    <span className="relative inline-block">
      <span
        className="border-b border-dashed border-blue-500 cursor-help text-blue-600 hover:text-blue-800 transition-colors"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {children}
      </span>
      
      {isHovered && (
        <div
          className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-80 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-xl border border-gray-700"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="font-semibold text-blue-400 mb-1">{principleName}</div>
          <div className="text-xs text-gray-400 mb-2">{principle.category}</div>
          <div className="text-gray-200 leading-relaxed">{principle.description}</div>
          {/* Стрелка */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}
    </span>
  );
}

/**
 * Функция для парсинга текста и выделения принципов
 */
export function parseTextWithPrinciples(text: string): (string | { type: 'principle'; name: string; text: string })[] {
  if (!text) return [text];
  
  const parts: (string | { type: 'principle'; name: string; text: string })[] = [];
  let lastIndex = 0;
  
  // Создаем регулярное выражение для поиска всех принципов
  const principleNames = Object.keys(PRINCIPLES);
  const matches: Array<{ index: number; length: number; name: string }> = [];
  
  principleNames.forEach(name => {
    // Экранируем спецсимволы для regex
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Паттерны для поиска:
    // 1. В кавычках: "принцип" или «принцип»
    // 2. В скобках: (принцип)
    // 3. Перед скобкой: принцип (Нильсен) или принцип (Рамс)
    // 4. Просто в тексте (с границами слов)
    const patterns = [
      new RegExp(`[""]${escapedName}[""]`, 'gi'),
      new RegExp(`[«»]${escapedName}[«»]`, 'gi'),
      new RegExp(`\\(${escapedName}\\)`, 'gi'),
      new RegExp(`\\b${escapedName}(?=\\s*[\\(\\[«"])`, 'gi'),
      new RegExp(`\\b${escapedName}\\b`, 'gi')
    ];
    
    patterns.forEach(pattern => {
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        // Проверяем, не находится ли совпадение внутри другого совпадения
        if (!match) break;
        const isInsideOther = matches.some(existing => 
          match!.index >= existing.index && match!.index < existing.index + existing.length
        );
        
        if (!isInsideOther) {
          matches.push({
            index: match.index,
            length: match[0].length,
            name: name
          });
        }
      }
    });
  });
  
  // Сортируем совпадения по индексу
  matches.sort((a, b) => a.index - b.index);
  
  // Убираем перекрывающиеся совпадения
  const nonOverlapping: typeof matches = [];
  matches.forEach(match => {
    const overlaps = nonOverlapping.some(existing => {
      const matchEnd = match.index + match.length;
      const existingEnd = existing.index + existing.length;
      return (
        (match.index >= existing.index && match.index < existingEnd) ||
        (existing.index >= match.index && existing.index < matchEnd) ||
        (match.index < existing.index && matchEnd > existing.index)
      );
    });
    
    if (!overlaps) {
      nonOverlapping.push(match);
    }
  });
  
  // Разбиваем текст на части
  nonOverlapping.forEach(match => {
    // Добавляем текст до принципа
    if (match.index > lastIndex) {
      const beforeText = text.substring(lastIndex, match.index);
      if (beforeText) {
        parts.push(beforeText);
      }
    }
    
    // Добавляем принцип
    const principleText = text.substring(match.index, match.index + match.length);
    // Убираем кавычки для отображения
    const cleanText = principleText.replace(/^["«]|["»]$/g, '');
    parts.push({
      type: 'principle',
      name: match.name,
      text: cleanText || principleText
    });
    
    lastIndex = match.index + match.length;
  });
  
  // Добавляем оставшийся текст
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      parts.push(remainingText);
    }
  }
  
  // Если принципов не найдено, возвращаем весь текст
  if (parts.length === 0) {
    parts.push(text);
  }
  
  return parts;
}

