'use client';

import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';

interface StepRating {
  context_shifts: number | null;
  navigational_guidance: number | null;
  input_parameters: number | null;
  system_feedback: number | null;
  error_feedback: number | null;
  new_concepts: number | null;
}

interface Step {
  name: string;
  ratings: StepRating;
}

interface Variant {
  name: string;
  role: string;
  task: string;
  steps: Step[];
}

interface AppState {
  versionA: Variant;
  versionB: Variant;
}

const dimensions = {
  context_shifts: {
    label: 'Смена контекста',
    description: 'Степень перехода между UI/инструментами',
    metrics: { 1: 1, 2: 3, 3: 5 },
    options: [
      { value: 1, label: 'Один UI/инструмент (нет смены)' },
      { value: 2, label: 'В рамках продукта, но другая область' },
      { value: 3, label: 'Требуется другой продукт/инструмент' }
    ]
  },
  navigational_guidance: {
    label: 'Навигационная поддержка',
    description: 'Поддержка пользователя при выполнении шагов',
    metrics: { 1: 1, 2: 2, 3: 4, 4: 6, 5: 9 },
    options: [
      { value: 1, label: 'Визард, единственный путь' },
      { value: 2, label: 'Базовая навигация с текстовыми подсказками' },
      { value: 3, label: 'Пошаговая документация' },
      { value: 4, label: 'Базовая документация (разрозненные ссылки)' },
      { value: 5, label: 'Без поддержки - поиск в форумах' }
    ]
  },
  input_parameters: {
    label: 'Входные параметры',
    description: 'Данные/параметры, которые должен указать пользователь',
    metrics: { 0: 0, 1: 1, 2: 3, 3: 5 },
    options: [
      { value: 0, label: 'Ввод не требуется или все по умолчанию' },
      { value: 1, label: 'Простые, очевидные параметры' },
      { value: 2, label: 'Несколько параметров или некоторая сложность' },
      { value: 3, label: 'Требуется экспертиза выше уровня пользователя' }
    ]
  },
  system_feedback: {
    label: 'Обратная связь системы',
    description: 'Ответ системы на действия пользователя',
    metrics: { 0: 0, 1: 1, 2: 2, 3: 4, 4: 6 },
    options: [
      { value: 0, label: 'Не требуется или мгновенный ответ' },
      { value: 1, label: 'Четкое, немедленное подтверждение' },
      { value: 2, label: 'Задержка, но адекватная обратная связь' },
      { value: 3, label: 'Минимальная обратная связь (только песочные часы)' },
      { value: 4, label: 'Нет обратной связи или запутанная' }
    ]
  },
  error_feedback: {
    label: 'Обратная связь по ошибкам',
    description: 'Ответ системы на ошибки',
    metrics: { 0: 0, 1: 1, 2: 3, 3: 5 },
    options: [
      { value: 0, label: 'Ошибки невозможны (ограниченный ввод)' },
      { value: 1, label: 'Четкие сообщения об ошибках и инструкции' },
      { value: 2, label: 'Базовые сообщения об ошибках' },
      { value: 3, label: 'Нет валидации или бесполезные сообщения' }
    ]
  },
  new_concepts: {
    label: 'Новые концепции',
    description: 'Новые знания, необходимые для выполнения',
    metrics: { 0: 0, 1: 1, 2: 3 },
    options: [
      { value: 0, label: 'Только знакомая терминология' },
      { value: 1, label: 'Одна новая концепция с объяснением' },
      { value: 2, label: 'Несколько новых/необъясненных концепций' }
    ]
  }
};

export default function ComplexityAnalyzer() {
  const [view, setView] = useState<'home' | 'analysis' | 'reports'>('home');
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [currentReportName, setCurrentReportName] = useState<string>('');
  const [state, setState] = useState<AppState>({
    versionA: {
      name: '',
      role: '',
      task: '',
      steps: []
    },
    versionB: {
      name: '',
      role: '',
      task: '',
      steps: []
    }
  });

  const [activeTab, setActiveTab] = useState<'versionA' | 'versionB' | 'comparison'>('versionA');
  const [expandedSteps, setExpandedSteps] = useState<{ [key: string]: boolean }>({});
  const [savedReports, setSavedReports] = useState<Array<{ id: string; name: string; date: string; data: AppState }>>([]);

  // Загрузка сохраненных отчетов при монтировании
  useEffect(() => {
    const saved = localStorage.getItem('complexityReports');
    if (saved) {
      try {
        setSavedReports(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading saved reports:', e);
      }
    }
  }, []);

  // Автосохранение текущей оценки при изменении состояния
  useEffect(() => {
    if (currentReportId && view === 'analysis') {
      setSavedReports(prevReports => {
        const updatedReports = prevReports.map(r => 
          r.id === currentReportId 
            ? { ...r, data: state, date: new Date().toLocaleString('ru-RU') }
            : r
        );
        localStorage.setItem('complexityReports', JSON.stringify(updatedReports));
        return updatedReports;
      });
    }
  }, [state, currentReportId, view]);

  const calculateStepScore = (ratings: StepRating): number => {
    let total = 0;
    for (const [dimKey, rating] of Object.entries(ratings)) {
      if (rating !== null) {
        const dimConfig = dimensions[dimKey as keyof typeof dimensions];
        if (dimConfig) {
          const metrics = dimConfig.metrics as Record<number, number>;
          total += metrics[rating] || 0;
        }
      }
    }
    return total;
  };

  const calculateTotalScore = (version: 'versionA' | 'versionB'): number => {
    return state[version].steps.reduce((sum, step) => sum + calculateStepScore(step.ratings), 0);
  };

  const addStep = (version: 'versionA' | 'versionB') => {
    // Получаем первые значения из options для каждого измерения
    const getFirstValue = (dimKey: keyof typeof dimensions): number => {
      const dimConfig = dimensions[dimKey];
      return dimConfig.options[0]?.value ?? 0;
    };
    
    const stepData: Step = {
      name: '',
      ratings: {
        context_shifts: getFirstValue('context_shifts'),
        navigational_guidance: getFirstValue('navigational_guidance'),
        input_parameters: getFirstValue('input_parameters'),
        system_feedback: getFirstValue('system_feedback'),
        error_feedback: getFirstValue('error_feedback'),
        new_concepts: getFirstValue('new_concepts')
      }
    };
    
    const newStepIndex = state[version].steps.length;
    
    // Новый шаг развернут
    setExpandedSteps({
      ...expandedSteps,
      [`${version}-${newStepIndex}`]: true
    });
    
    setState({
      ...state,
      [version]: {
        ...state[version],
        steps: [...state[version].steps, stepData]
      }
    });
  };
  
  const toggleStep = (version: 'versionA' | 'versionB', stepIndex: number) => {
    const key = `${version}-${stepIndex}`;
    setExpandedSteps({
      ...expandedSteps,
      [key]: !expandedSteps[key]
    });
  };

  const updateStepName = (version: 'versionA' | 'versionB', stepIndex: number, name: string) => {
    const newSteps = [...state[version].steps];
    newSteps[stepIndex] = { ...newSteps[stepIndex], name };
    setState({
      ...state,
      [version]: {
        ...state[version],
        steps: newSteps
      }
    });
  };

  const updateRating = (version: 'versionA' | 'versionB', stepIndex: number, dimension: keyof StepRating, value: number) => {
    const newSteps = [...state[version].steps];
    newSteps[stepIndex] = {
      ...newSteps[stepIndex],
      ratings: {
        ...newSteps[stepIndex].ratings,
        [dimension]: value
      }
    };
    setState({
      ...state,
      [version]: {
        ...state[version],
        steps: newSteps
      }
    });
  };

  const removeStep = (version: 'versionA' | 'versionB', stepIndex: number) => {
    const newSteps = state[version].steps.filter((_, i) => i !== stepIndex);
    setState({
      ...state,
      [version]: {
        ...state[version],
        steps: newSteps
      }
    });
  };

  const removeVersionB = () => {
    setState({
      ...state,
      versionB: {
        name: '',
        role: '',
        task: '',
        steps: []
      }
    });
    setActiveTab('versionA');
    // Очищаем состояние развернутости для версии B
    const newExpandedSteps: { [key: string]: boolean } = {};
    Object.keys(expandedSteps).forEach(key => {
      if (!key.startsWith('versionB-')) {
        newExpandedSteps[key] = expandedSteps[key];
      }
    });
    setExpandedSteps(newExpandedSteps);
  };

  const cloneFromA = () => {
    setState({
      ...state,
      versionB: {
        name: state.versionA.name + ' (копия)',
        role: state.versionA.role,
        task: state.versionA.task,
        steps: JSON.parse(JSON.stringify(state.versionA.steps))
      }
    });
  };

  const createNewReport = () => {
    const newReportId = `report-${Date.now()}`;
    const newReportName = `Оценка ${new Date().toLocaleDateString('ru-RU')}`;
    
    const newReport = {
      id: newReportId,
      name: newReportName,
      date: new Date().toLocaleString('ru-RU'),
      data: {
        versionA: {
          name: '',
          role: '',
          task: '',
          steps: []
        },
        versionB: {
          name: '',
          role: '',
          task: '',
          steps: []
        }
      }
    };
    
    const updatedReports = [...savedReports, newReport];
    setSavedReports(updatedReports);
    localStorage.setItem('complexityReports', JSON.stringify(updatedReports));
    
    setCurrentReportId(newReportId);
    setCurrentReportName(newReportName);
    setState(newReport.data);
    setActiveTab('versionA');
    setExpandedSteps({});
    setView('analysis');
  };

  const loadReport = (reportId: string) => {
    const report = savedReports.find(r => r.id === reportId);
    if (report) {
      setCurrentReportId(report.id);
      setCurrentReportName(report.name);
      setState(report.data);
      setActiveTab('versionA');
      setExpandedSteps({});
      setView('analysis');
    }
  };

  const deleteReport = (reportId: string) => {
    if (confirm('Удалить эту оценку?')) {
      const updatedReports = savedReports.filter(r => r.id !== reportId);
      setSavedReports(updatedReports);
      localStorage.setItem('complexityReports', JSON.stringify(updatedReports));
      
      if (currentReportId === reportId) {
        setView('home');
        setCurrentReportId(null);
        setCurrentReportName('');
        setState({
          versionA: {
            name: '',
            role: '',
            task: '',
            steps: []
          },
          versionB: {
            name: '',
            role: '',
            task: '',
            steps: []
          }
        });
      }
    }
  };

  const updateReportName = (newName: string) => {
    if (!currentReportId) return;
    
    setCurrentReportName(newName);
    const updatedReports = savedReports.map(r => 
      r.id === currentReportId 
        ? { ...r, name: newName }
        : r
    );
    setSavedReports(updatedReports);
    localStorage.setItem('complexityReports', JSON.stringify(updatedReports));
  };

  const exportReport = () => {
    if (!currentReportId) return;
    
    const report = savedReports.find(r => r.id === currentReportId);
    if (!report) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPos = margin;
    
    // Helper function to add new page if needed
    const checkNewPage = (requiredSpace: number) => {
      if (yPos + requiredSpace > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }
    };
    
    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Отчет по анализу сложности', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;
    
    // Report name and date
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Название: ${report.name}`, margin, yPos);
    yPos += 7;
    doc.text(`Дата: ${report.date}`, margin, yPos);
    yPos += 15;
    
    // Version A
    checkNewPage(50);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Версия A', margin, yPos);
    yPos += 10;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    if (report.data.versionA.name) {
      doc.text(`Название: ${report.data.versionA.name}`, margin, yPos);
      yPos += 7;
    }
    if (report.data.versionA.task) {
      const taskLines = doc.splitTextToSize(`Задача: ${report.data.versionA.task}`, pageWidth - 2 * margin);
      doc.text(taskLines, margin, yPos);
      yPos += taskLines.length * 7;
    }
    
    const versionAScore = calculateTotalScore('versionA');
    doc.setFont('helvetica', 'bold');
    doc.text(`Общая сложность: ${versionAScore}`, margin, yPos);
    yPos += 10;
    
    // Version A Steps
    if (report.data.versionA.steps.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Шаги:', margin, yPos);
      yPos += 8;
      
      report.data.versionA.steps.forEach((step, index) => {
        checkNewPage(20);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const stepScore = calculateStepScore(step.ratings);
        doc.text(`Шаг ${index + 1}: ${step.name || `Шаг ${index + 1}`} (Сложность: ${stepScore})`, margin + 5, yPos);
        yPos += 7;
        
        // Ratings
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        Object.entries(dimensions).forEach(([dimKey, dimConfig]) => {
          const rating = step.ratings[dimKey as keyof StepRating];
          if (rating !== null) {
            const option = dimConfig.options.find(opt => opt.value === rating);
            if (option) {
              const metrics = dimConfig.metrics as Record<number, number>;
              const value = metrics[rating] || 0;
              checkNewPage(7);
              doc.text(`  • ${dimConfig.label}: ${option.label} (${value})`, margin + 10, yPos);
              yPos += 6;
            }
          }
        });
        yPos += 3;
      });
    }
    
    yPos += 10;
    
    // Version B (if exists)
    if (report.data.versionB.steps.length > 0 || report.data.versionB.name || report.data.versionB.task) {
      checkNewPage(50);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Версия B', margin, yPos);
      yPos += 10;
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      if (report.data.versionB.name) {
        doc.text(`Название: ${report.data.versionB.name}`, margin, yPos);
        yPos += 7;
      }
      if (report.data.versionB.task) {
        const taskLines = doc.splitTextToSize(`Задача: ${report.data.versionB.task}`, pageWidth - 2 * margin);
        doc.text(taskLines, margin, yPos);
        yPos += taskLines.length * 7;
      }
      
      const versionBScore = calculateTotalScore('versionB');
      doc.setFont('helvetica', 'bold');
      doc.text(`Общая сложность: ${versionBScore}`, margin, yPos);
      yPos += 10;
      
      // Version B Steps
      if (report.data.versionB.steps.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Шаги:', margin, yPos);
        yPos += 8;
        
        report.data.versionB.steps.forEach((step, index) => {
          checkNewPage(20);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          const stepScore = calculateStepScore(step.ratings);
          doc.text(`Шаг ${index + 1}: ${step.name || `Шаг ${index + 1}`} (Сложность: ${stepScore})`, margin + 5, yPos);
          yPos += 7;
          
          // Ratings
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          Object.entries(dimensions).forEach(([dimKey, dimConfig]) => {
            const rating = step.ratings[dimKey as keyof StepRating];
            if (rating !== null) {
              const option = dimConfig.options.find(opt => opt.value === rating);
              if (option) {
                const metrics = dimConfig.metrics as Record<number, number>;
                const value = metrics[rating] || 0;
                checkNewPage(7);
                doc.text(`  • ${dimConfig.label}: ${option.label} (${value})`, margin + 10, yPos);
                yPos += 6;
              }
            }
          });
          yPos += 3;
        });
      }
      
      // Comparison
      checkNewPage(20);
      yPos += 10;
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Сравнение', margin, yPos);
      yPos += 10;
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const diff = versionBScore - versionAScore;
      doc.text(`Версия A: ${versionAScore}`, margin, yPos);
      yPos += 7;
      doc.text(`Версия B: ${versionBScore}`, margin, yPos);
      yPos += 7;
      doc.setFont('helvetica', 'bold');
      doc.text(`Разница: ${diff > 0 ? '+' : ''}${diff}`, margin, yPos);
    }
    
    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Страница ${i} из ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }
    
    // Save PDF
    doc.save(`${report.name.replace(/\s+/g, '_')}.pdf`);
  };

  // Home view - только заголовок и кнопки
  if (view === 'home') {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Анализ сложности
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Оценка сложности интерфейса по методике IBM Complexity Analysis
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={createNewReport}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Новая оценка
            </button>
            <button
              onClick={() => setView('reports')}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Мои оценки
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Reports view - список всех отчетов
  if (view === 'reports') {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Анализ сложности
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Оценка сложности интерфейса по методике IBM Complexity Analysis
          </p>
          <div className="flex gap-4 justify-center mb-8">
            <button
              onClick={createNewReport}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Новая оценка
            </button>
            <button
              onClick={() => setView('reports')}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Мои оценки
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl mb-6">Мои оценки</h2>
          {savedReports.length === 0 ? (
            <p className="text-gray-600 text-center py-8">Нет сохраненных оценок</p>
          ) : (
            <div className="space-y-3">
              {savedReports.map((report) => (
                <div key={report.id} className="border rounded-lg p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="font-medium text-lg">{report.name}</div>
                    <div className="text-sm text-gray-600 mt-1">{report.date}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadReport(report.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Загрузить
                    </button>
                    <button
                      onClick={() => deleteReport(report.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Analysis view - форма анализа
  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header with buttons */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Анализ сложности
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Оценка сложности интерфейса по методике IBM Complexity Analysis
        </p>
        <div className="flex gap-4 justify-center mb-6">
          <button
            onClick={createNewReport}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Новая оценка
          </button>
          <button
            onClick={() => setView('reports')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Мои оценки
          </button>
        </div>
      </div>

      {/* Report controls */}
      {currentReportId && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div className="flex-1 mr-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Название оценки
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={currentReportName}
                onChange={(e) => updateReportName(e.target.value)}
                placeholder="Введите название оценки"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={exportReport}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Загрузить отчет
              </button>
              <button
                onClick={() => deleteReport(currentReportId)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Удалить оценку
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-300 mb-6 justify-center">
        <button
          onClick={() => setActiveTab('versionA')}
          className={`px-6 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'versionA'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Версия A
        </button>
        {state.versionB.steps.length > 0 || state.versionB.name || state.versionB.task ? (
          <>
            <button
              onClick={() => setActiveTab('versionB')}
              className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'versionB'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Версия B
            </button>
            <button
              onClick={() => setActiveTab('comparison')}
              className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'comparison'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Сравнение
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              addStep('versionB');
              setActiveTab('versionB');
            }}
            className="px-6 py-3 font-medium transition-colors border-b-2 border-transparent text-gray-600 hover:text-gray-900"
          >
            Добавить версию
          </button>
        )}
      </div>

      {/* Version A Tab */}
      {activeTab === 'versionA' && (
        <div>
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl mb-4">Версия A</h2>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded">
              <p className="text-sm text-gray-700">
                Заполните информацию о вашем интерфейсе и задаче пользователя. Затем добавьте шаги и оцените сложность каждого шага по 6 измерениям.
              </p>
            </div>
        <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Название версии
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Например: Текущая версия"
                value={state.versionA.name}
                onChange={(e) => setState({ ...state, versionA: { ...state.versionA, name: e.target.value } })}
          />
        </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Описание задачи
          </label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-y"
                placeholder="Например: Установка программного обеспечения"
                value={state.versionA.task}
                onChange={(e) => setState({ ...state, versionA: { ...state.versionA, task: e.target.value } })}
          />
        </div>
          </div>

          {/* Steps */}
          <div className="space-y-4 mb-6">
            {state.versionA.steps.map((step, stepIndex) => {
              const isExpanded = expandedSteps[`versionA-${stepIndex}`] !== false;
              const stepScore = calculateStepScore(step.ratings);
              
              return (
              <div key={stepIndex} id={`step-versionA-${stepIndex}`} className="bg-blue-50 border border-gray-300 rounded-lg p-5">
        <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleStep('versionA', stepIndex)}
                      className="text-lg hover:text-blue-600 transition-colors"
                    >
                      Шаг {stepIndex + 1}: {step.name || 'Без названия'}
                    </button>
                    {!isExpanded && (
                      <span className="text-sm text-gray-600">(Сложность: {stepScore})</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleStep('versionA', stepIndex)}
                      className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                    >
                      {isExpanded ? 'Свернуть' : 'Развернуть'}
                    </button>
            <button
                    onClick={() => removeStep('versionA', stepIndex)}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
                          Удалить
            </button>
                  </div>
        </div>
                
                {isExpanded && (
                  <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Название шага</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={step.name}
                    onChange={(e) => updateStepName('versionA', stepIndex, e.target.value)}
                    placeholder="Например: Выключить файрволл"
                  />
            </div>

                {Object.entries(dimensions).map(([dimKey, dimConfig]) => (
                  <div key={dimKey} className="mb-4">
                    <label className="block text-sm text-gray-700 mb-1">
                      {dimConfig.label}
                    </label>
                    <div className="text-xs text-gray-600 mb-2">{dimConfig.description}</div>
                    <div className="space-y-2">
                      {dimConfig.options.map((option) => {
                        const isChecked = step.ratings[dimKey as keyof StepRating] === option.value;
                return (
                          <label
                            key={option.value}
                            className="flex items-start p-2 cursor-pointer hover:bg-gray-50 rounded"
                          >
                            <input
                              type="radio"
                              name={`versionA-${stepIndex}-${dimKey}`}
                              value={option.value}
                              checked={isChecked}
                              onChange={() => updateRating('versionA', stepIndex, dimKey as keyof StepRating, option.value)}
                              className="mt-1 mr-2"
                            />
                            <span className="text-sm">
                              {option.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                
                <div className="mt-4 p-4 bg-yellow-50 border border-gray-300 rounded-lg text-center">
                  <div className="text-sm text-gray-600 mb-1">Сложность шага</div>
                  <div className="text-3xl text-blue-600">
                    {stepScore}
            </div>
              </div>
                  </>
                )}
              </div>
            );
            })}
              </div>

          {/* Add Step Button */}
          <div className="mb-6">
            <button
              onClick={() => addStep('versionA')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Добавить шаг
            </button>
          </div>

          {/* Total Score */}
          {state.versionA.steps.length > 0 && (
            <div className="bg-yellow-50 border border-gray-300 rounded-lg p-6 mb-6">
              <div className="text-center mb-4">
                <div className="text-sm text-gray-600 mb-2">Общая сложность Версии A</div>
                <div className="text-5xl text-blue-600">
                  {calculateTotalScore('versionA')}
                </div>
              </div>
              
              {/* Steps breakdown */}
              <div className="mt-6 space-y-4" style={{ overflow: 'visible' }}>
                {state.versionA.steps.map((step, index) => {
                  const stepScore = calculateStepScore(step.ratings);
                  const maxScore = Math.max(...state.versionA.steps.map(s => calculateStepScore(s.ratings)), 1);
                  
                  // Вычисляем вклад каждого критерия
                  const criteriaColors = {
                    context_shifts: '#3B82F6', // blue
                    navigational_guidance: '#10B981', // green
                    input_parameters: '#F59E0B', // amber
                    system_feedback: '#EF4444', // red
                    error_feedback: '#8B5CF6', // purple
                    new_concepts: '#EC4899' // pink
                  };
                  
                  const criteriaContributions: Array<{ key: string; label: string; description: string; value: number; color: string }> = [];
                  Object.entries(dimensions).forEach(([dimKey, dimConfig]) => {
                    const rating = step.ratings[dimKey as keyof StepRating];
                    if (rating !== null) {
                      const metrics = dimConfig.metrics as Record<number, number>;
                      const contribution = metrics[rating] || 0;
                      criteriaContributions.push({
                        key: dimKey,
                        label: dimConfig.label,
                        description: dimConfig.description,
                        value: contribution,
                        color: criteriaColors[dimKey as keyof typeof criteriaColors]
                      });
                    }
                  });
                  
                  const totalContribution = criteriaContributions.reduce((sum, c) => sum + c.value, 0);

  return (
                    <div key={index} className="bg-white rounded-lg p-4 border border-gray-200" style={{ overflow: 'visible' }}>
                      <div className="flex justify-between items-center mb-2">
                        <div className="font-medium">Шаг {index + 1}: {step.name || `Шаг ${index + 1}`}</div>
                        <div className="text-lg text-blue-600">{stepScore}</div>
                      </div>
                      <div className="w-full bg-gray-200 h-4 flex relative" style={{ borderRadius: '9999px', overflow: 'visible' }}>
                        {criteriaContributions.map((criteria, critIndex) => {
                          const segmentWidth = totalContribution > 0 ? (criteria.value / totalContribution) * 100 : 0;
              return (
                <div
                              key={criteria.key}
                              className="h-4 transition-all duration-500 cursor-help group relative"
                              style={{
                                width: `${segmentWidth}%`,
                                backgroundColor: criteria.color,
                                overflow: 'visible',
                                position: 'relative'
                              }}
                            >
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-[100]">
                                <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-xl" style={{ whiteSpace: 'normal', minWidth: '200px', maxWidth: '300px' }}>
                                  <div className="mb-1">{criteria.label}</div>
                                  <div className="text-gray-300 text-xs mb-1">{criteria.description}</div>
                                  <div className="text-blue-300 font-medium">Значение: {criteria.value}</div>
                                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full">
                                    <div className="border-4 border-transparent border-t-gray-900"></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
                      )}
                    </div>
      )}

      {/* Version B Tab */}
      {activeTab === 'versionB' && (
        <div>
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl">Версия B</h2>
              <button
                onClick={removeVersionB}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Удалить версию
              </button>
            </div>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded">
              <p className="text-sm text-gray-700">
                Создайте вторую версию интерфейса для сравнения. Вы можете клонировать Версию A или начать с чистого листа.
              </p>
                      </div>
        <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Название версии
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Например: Новая версия"
                value={state.versionB.name}
                onChange={(e) => setState({ ...state, versionB: { ...state.versionB, name: e.target.value } })}
          />
        </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Описание задачи
          </label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-y"
                placeholder="Например: Установка программного обеспечения"
                value={state.versionB.task}
                onChange={(e) => setState({ ...state, versionB: { ...state.versionB, task: e.target.value } })}
          />
        </div>
            <div className="flex gap-3">
                        <button
                onClick={cloneFromA}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                Клонировать из Версии A
                        </button>
        </div>
      </div>

          {/* Steps */}
          <div className="space-y-4 mb-6">
            {state.versionB.steps.map((step, stepIndex) => {
              const isExpanded = expandedSteps[`versionB-${stepIndex}`] !== false;
              const stepScore = calculateStepScore(step.ratings);
              
              return (
              <div key={stepIndex} id={`step-versionB-${stepIndex}`} className="bg-orange-50 border border-gray-300 rounded-lg p-5">
          <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleStep('versionB', stepIndex)}
                      className="text-lg hover:text-orange-600 transition-colors"
                    >
                      Шаг {stepIndex + 1}: {step.name || 'Без названия'}
                    </button>
                    {!isExpanded && (
                      <span className="text-sm text-gray-600">(Сложность: {stepScore})</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleStep('versionB', stepIndex)}
                      className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                    >
                      {isExpanded ? 'Свернуть' : 'Развернуть'}
                    </button>
            <button
                    onClick={() => removeStep('versionB', stepIndex)}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
                    Удалить
            </button>
                  </div>
          </div>

                {isExpanded && (
                  <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Название шага</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={step.name}
                    onChange={(e) => updateStepName('versionB', stepIndex, e.target.value)}
                    placeholder="Например: Выключить файрволл"
                  />
            </div>

                {Object.entries(dimensions).map(([dimKey, dimConfig]) => (
                  <div key={dimKey} className="mb-4">
                    <label className="block text-sm text-gray-700 mb-1">
                      {dimConfig.label}
                    </label>
                    <div className="text-xs text-gray-600 mb-2">{dimConfig.description}</div>
            <div className="space-y-2">
                      {dimConfig.options.map((option) => {
                        const isChecked = step.ratings[dimKey as keyof StepRating] === option.value;
                  return (
                          <label
                            key={option.value}
                            className="flex items-start p-2 cursor-pointer hover:bg-gray-50 rounded"
                          >
                  <input
                    type="radio"
                              name={`versionB-${stepIndex}-${dimKey}`}
                              value={option.value}
                              checked={isChecked}
                              onChange={() => updateRating('versionB', stepIndex, dimKey as keyof StepRating, option.value)}
                    className="mt-1 mr-2"
                  />
                            <span className="text-sm">
                              {option.label}
                            </span>
                </label>
                  );
                })}
          </div>
        </div>
                ))}
                
                <div className="mt-4 p-4 bg-yellow-50 border border-gray-300 rounded-lg text-center">
                  <div className="text-sm text-gray-600 mb-1">Сложность шага</div>
                  <div className="text-3xl font-bold text-blue-600">
                    {stepScore}
                      </div>
                    </div>
                  </>
                )}
                  </div>
            );
            })}
                </div>

          {/* Add Step Button */}
          <div className="mb-6">
            <button
              onClick={() => addStep('versionB')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Добавить шаг
            </button>
          </div>

          {/* Total Score */}
          {state.versionB.steps.length > 0 && (
            <div className="bg-yellow-50 border border-gray-300 rounded-lg p-6 mb-6" style={{ overflow: 'visible' }}>
              <div className="text-center mb-4">
                <div className="text-sm text-gray-600 mb-2">Общая сложность Версии B</div>
                <div className="text-5xl text-blue-600">
                  {calculateTotalScore('versionB')}
                </div>
          </div>

              {/* Steps breakdown */}
              <div className="mt-6 space-y-4" style={{ overflow: 'visible' }}>
                {state.versionB.steps.map((step, index) => {
                  const stepScore = calculateStepScore(step.ratings);
                  const maxScore = Math.max(...state.versionB.steps.map(s => calculateStepScore(s.ratings)), 1);
                  
                  // Вычисляем вклад каждого критерия
                  const criteriaColors = {
                    context_shifts: '#3B82F6', // blue
                    navigational_guidance: '#10B981', // green
                    input_parameters: '#F59E0B', // amber
                    system_feedback: '#EF4444', // red
                    error_feedback: '#8B5CF6', // purple
                    new_concepts: '#EC4899' // pink
                  };
                  
                  const criteriaContributions: Array<{ key: string; label: string; description: string; value: number; color: string }> = [];
                  Object.entries(dimensions).forEach(([dimKey, dimConfig]) => {
                    const rating = step.ratings[dimKey as keyof StepRating];
                    if (rating !== null) {
                      const metrics = dimConfig.metrics as Record<number, number>;
                      const contribution = metrics[rating] || 0;
                      criteriaContributions.push({
                        key: dimKey,
                        label: dimConfig.label,
                        description: dimConfig.description,
                        value: contribution,
                        color: criteriaColors[dimKey as keyof typeof criteriaColors]
                      });
                    }
                  });
                  
                  const totalContribution = criteriaContributions.reduce((sum, c) => sum + c.value, 0);
                
                return (
                    <div key={index} className="bg-white rounded-lg p-4 border border-gray-200" style={{ overflow: 'visible' }}>
                      <div className="flex justify-between items-center mb-2">
                        <div className="font-medium">Шаг {index + 1}: {step.name || `Шаг ${index + 1}`}</div>
                        <div className="text-lg text-blue-600">{stepScore}</div>
                      </div>
                      <div className="w-full bg-gray-200 h-4 flex relative" style={{ borderRadius: '9999px', overflow: 'visible' }}>
                        {criteriaContributions.map((criteria, critIndex) => {
                          const segmentWidth = totalContribution > 0 ? (criteria.value / totalContribution) * 100 : 0;
                          return (
                            <div
                              key={criteria.key}
                              className="h-4 transition-all duration-500 cursor-help group relative"
                              style={{
                                width: `${segmentWidth}%`,
                                backgroundColor: criteria.color,
                                overflow: 'visible',
                                position: 'relative'
                              }}
                            >
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-[100]">
                                <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-xl" style={{ whiteSpace: 'normal', minWidth: '200px', maxWidth: '300px' }}>
                                  <div className="mb-1">{criteria.label}</div>
                                  <div className="text-gray-300 text-xs mb-1">{criteria.description}</div>
                                  <div className="text-blue-300 font-medium">Значение: {criteria.value}</div>
                                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full">
                                    <div className="border-4 border-transparent border-t-gray-900"></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
              </div>
          )}
              </div>
      )}

      {/* Comparison Tab */}
      {activeTab === 'comparison' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl mb-4">Сравнение версий</h2>
          
          {state.versionA.steps.length === 0 || state.versionB.steps.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Сначала создайте и оцените обе версии интерфейса</p>
              </div>
          ) : (
            <>
              {/* Comparison Summary */}
              <div className="grid grid-cols-4 gap-4 mb-6 p-6 bg-blue-50 rounded-lg">
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-2">{state.versionA.name || 'Версия A'}</div>
                  <div className="text-3xl text-blue-600">
                    {calculateTotalScore('versionA')}
                  </div>
              </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-2">{state.versionB.name || 'Версия B'}</div>
                  <div className="text-3xl text-orange-600">
                    {calculateTotalScore('versionB')}
                  </div>
            </div>
                {(() => {
                  const totalA = calculateTotalScore('versionA');
                  const totalB = calculateTotalScore('versionB');
                  const diff = totalB - totalA;
                  const percentChange = totalA > 0 ? parseFloat(((diff / totalA) * 100).toFixed(1)) : 0;
                  
                  return (
                    <>
                      <div className="text-center">
                        <div className="text-sm text-gray-600 mb-2">Разница</div>
                        <div className={`text-3xl ${diff < 0 ? 'text-green-600' : diff > 0 ? 'text-red-600' : ''}`}>
                          {diff > 0 ? '+' : ''}{diff}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-600 mb-2">Изменение</div>
                        <div className={`text-3xl ${diff < 0 ? 'text-green-600' : diff > 0 ? 'text-red-600' : ''}`}>
                          {percentChange > 0 ? '+' : ''}{percentChange}%
                        </div>
                      </div>
                    </>
                  );
                })()}
          </div>

              {/* Comparison Grid */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {[
                  { version: 'versionA' as const, name: state.versionA.name || 'Версия A', color: 'blue' },
                  { version: 'versionB' as const, name: state.versionB.name || 'Версия B', color: 'orange' }
                ].map(({ version, name, color }) => {
                  const variant = state[version];
                  const total = calculateTotalScore(version);
                  const totalA = calculateTotalScore('versionA');
                  const totalB = calculateTotalScore('versionB');
                  const bestTotal = Math.min(totalA, totalB);
                  const worstTotal = Math.max(totalA, totalB);
                  
                          return (
                            <div
                      key={version}
                      className={`border-2 rounded-lg p-6 ${
                        total === bestTotal
                          ? 'border-green-500 bg-green-50'
                          : total === worstTotal
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <h3 className="text-xl mb-3">{name}</h3>
                      <p className="text-sm text-gray-600 mb-2"><strong>Задача:</strong> {variant.task || 'Не указано'}</p>
                      <p className="text-sm text-gray-600 mb-4"><strong>Количество шагов:</strong> {variant.steps.length}</p>
                      <div className="bg-yellow-50 rounded-lg p-4 text-center">
                        <div className="text-sm text-gray-600 mb-1">Общая сложность</div>
                        <div className="text-4xl text-blue-600">{total}</div>
          </div>
        </div>
                );
              })}
            </div>

              {/* Step-by-step Comparison */}
              {(() => {
                const maxSteps = Math.max(state.versionA.steps.length, state.versionB.steps.length);
                
                return (
                  <div className="mb-6">
                    <h3 className="text-xl mb-4">Сравнение по шагам</h3>
                    {Array.from({ length: maxSteps }).map((_, index) => {
                      const stepA = state.versionA.steps[index];
                      const stepB = state.versionB.steps[index];
                      
                      if (!stepA && !stepB) return null;
                      
                      const scoreA = stepA ? calculateStepScore(stepA.ratings) : 0;
                      const scoreB = stepB ? calculateStepScore(stepB.ratings) : 0;
                      const diff = scoreB - scoreA;
                      
                      return (
                        <div key={index} className="border rounded-lg p-4 mb-4">
                          <div className="flex justify-between items-center mb-3">
                            <strong className="text-lg">Шаг {index + 1}</strong>
                            <span className={`px-3 py-1 rounded text-sm ${diff < 0 ? 'bg-green-100 text-green-700' : diff > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                              Разница: {diff > 0 ? '+' : ''}{diff}
                            </span>
              </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-blue-50 rounded">
                              <strong>{state.versionA.name || 'Версия A'}</strong><br />
                              {stepA?.name || `Шаг ${index + 1}`}<br />
                              <span className="text-2xl">{scoreA}</span>
              </div>
                            <div className="text-center p-3 bg-orange-50 rounded">
                              <strong>{state.versionB.name || 'Версия B'}</strong><br />
                              {stepB?.name || `Шаг ${index + 1}`}<br />
                              <span className="text-2xl">{scoreB}</span>
              </div>
              </div>
    </div>
  );
                    })}
              </div>
                );
              })()}

              {/* Bar Chart Comparison */}
              {(() => {
                const totalA = calculateTotalScore('versionA');
                const totalB = calculateTotalScore('versionB');
                const maxValue = 30;
                const chartHeight = 300;
                const chartWidth = 450;
                const barWidth = 80;
                const heightA = (totalA / maxValue) * chartHeight;
                const heightB = (totalB / maxValue) * chartHeight;
                const yAxisLabels = [30, 25, 20, 15, 10, 5, 0];
                
                return (
                  <div className="mb-6 p-6 bg-white border border-gray-300 rounded-lg">
                    <h3 className="text-xl mb-6 text-center">Сравнение общей сложности</h3>
                    <div className="flex items-start justify-center">
                      {/* Y-axis label */}
                      <div className="flex items-center justify-center mr-3" style={{ width: '50px', height: `${chartHeight}px` }}>
                        <div className="text-sm font-medium text-gray-700" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}>
                          Сложность
            </div>
          </div>

                      {/* Chart container */}
                      <div style={{ width: `${chartWidth}px`, height: `${chartHeight + 80}px`, position: 'relative' }}>
                        {/* Y-axis labels */}
                        <div className="absolute left-0 top-0" style={{ width: '40px', height: `${chartHeight}px` }}>
                          {yAxisLabels.map((value, index) => {
                            const yPosition = chartHeight - (index * chartHeight) / (yAxisLabels.length - 1);
                          return (
                            <div
                                key={value}
                                className="absolute text-sm text-gray-600"
                              style={{
                                  right: '8px',
                                  top: `${yPosition}px`,
                                  transform: 'translateY(-50%)',
                                  lineHeight: '1'
                                }}
                              >
                                {value}
          </div>
                          );
                      })}
        </div>
                        
                        {/* Chart area with grid and bars */}
                        <div 
                          className="relative"
                          style={{ 
                            marginLeft: '40px',
                            width: `${chartWidth - 40}px`,
                            height: `${chartHeight}px`,
                            position: 'relative'
                          }}
                        >
                          {/* Grid lines - horizontal */}
                          {yAxisLabels.map((value, index) => {
                            const yPosition = chartHeight - (index * chartHeight) / (yAxisLabels.length - 1);
                            return (
                              <div
                                key={value}
                                className="absolute border-t border-gray-200"
                                style={{
                                  left: '0',
                                  right: '0',
                                  top: `${yPosition}px`,
                                  height: '1px',
                                  width: '100%'
                                }}
                              ></div>
                );
              })}
                          
                          {/* Y-axis line (vertical) */}
                          <div 
                            className="absolute border-l border-gray-400"
                            style={{
                              left: '0',
                              top: '0',
                              bottom: '0',
                              width: '1px',
                              height: `${chartHeight}px`
                            }}
                          ></div>
                          
                          {/* X-axis line (horizontal) */}
                          <div 
                            className="absolute border-t border-gray-400"
                            style={{
                              left: '0',
                              right: '0',
                              bottom: '0',
                              height: '1px',
                              width: '100%'
                            }}
                          ></div>
                          
                          {/* Bars container */}
                          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-16" style={{ height: `${chartHeight}px` }}>
                            {/* Version A bar */}
                            <div className="flex flex-col items-center">
                              <div
                                className="bg-teal-500 transition-all duration-500"
                                style={{ 
                                  width: `${barWidth}px`,
                                  height: `${heightA}px`, 
                                  minHeight: heightA > 0 ? '2px' : '0',
                                }}
                              ></div>
                            </div>
                            
                            {/* Version B bar */}
                            <div className="flex flex-col items-center">
                              <div
                                className="bg-orange-300 transition-all duration-500"
                                style={{ 
                                  width: `${barWidth}px`,
                                  height: `${heightB}px`, 
                                  minHeight: heightB > 0 ? '2px' : '0',
                                }}
                              ></div>
                            </div>
                          </div>
                          
                          {/* Labels below X-axis */}
                          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-16" style={{ top: `${chartHeight}px`, marginTop: '8px' }}>
                            <div className="text-xs font-medium text-center" style={{ width: `${barWidth}px` }}>
                              {state.versionA.name || 'Версия A'}
                            </div>
                            <div className="text-xs font-medium text-center" style={{ width: `${barWidth}px` }}>
                              {state.versionB.name || 'Версия B'}
                            </div>
                          </div>
              </div>
              </div>
            </div>
    </div>
  );
              })()}

              {/* Step-by-step Comparison Chart */}
              {(() => {
                const maxSteps = Math.max(state.versionA.steps.length, state.versionB.steps.length);
                if (maxSteps === 0) return null;
                
                const allStepScores: number[] = [];
                state.versionA.steps.forEach(step => {
                  allStepScores.push(calculateStepScore(step.ratings));
                });
                state.versionB.steps.forEach(step => {
                  allStepScores.push(calculateStepScore(step.ratings));
                });
                const maxValue = Math.max(...allStepScores, 16);
                // Округляем до ближайшего четного числа для меток
                const roundedMax = Math.ceil(maxValue / 2) * 2;
                const chartHeight = 300;
                const chartWidth = Math.max(400, maxSteps * 120);
                const barWidth = 30;
                const stepLabels = Array.from({ length: maxSteps }, (_, i) => `Шаг ${i + 1}`);
                // Метки оси Y с шагом 2: 0, 2, 4, 6, 8, 10, 12, 14, 16
                const yAxisLabels: number[] = [];
                for (let i = 0; i <= roundedMax; i += 2) {
                  yAxisLabels.push(i);
                }

  return (
                  <div className="mb-6 p-6 bg-white border border-gray-300 rounded-lg">
                    <h3 className="text-xl mb-6 text-center">График сравнения по шагам</h3>
                    
                    {/* Legend */}
                    <div className="flex justify-center gap-6 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-teal-500"></div>
                        <span className="text-sm font-medium">{state.versionA.name || 'Версия A'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-orange-300"></div>
                        <span className="text-sm font-medium">{state.versionB.name || 'Версия B'}</span>
                      </div>
          </div>

                    <div className="flex items-start justify-center">
                      {/* Y-axis label */}
                      <div className="flex items-center justify-center mr-3" style={{ width: '50px', height: `${chartHeight}px` }}>
                        <div className="text-sm font-medium text-gray-700" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}>
                          Сложность
            </div>
          </div>

                      {/* Chart container */}
                      <div style={{ width: `${chartWidth}px`, height: `${chartHeight + 80}px`, position: 'relative' }}>
                        {/* Y-axis labels */}
                        <div className="absolute left-0 top-0" style={{ width: '40px', height: `${chartHeight}px` }}>
                          {yAxisLabels.map((value, index) => {
                            const yPosition = chartHeight - (index * chartHeight) / (yAxisLabels.length - 1);
                            return (
                              <div
                                key={value}
                                className="absolute text-sm text-gray-600"
                                style={{
                                  right: '8px',
                                  top: `${yPosition}px`,
                                  transform: 'translateY(-50%)',
                                  lineHeight: '1'
                                }}
                              >
                                {value}
                </div>
                            );
                          })}
            </div>
                        
                        {/* Chart area with grid and bars */}
                        <div 
                          className="relative"
                          style={{ 
                            marginLeft: '40px',
                            width: `${chartWidth - 40}px`,
                            height: `${chartHeight}px`,
                            position: 'relative'
                          }}
                        >
                          {/* Grid lines - horizontal */}
                          {yAxisLabels.map((value, index) => {
                            const yPosition = chartHeight - (index * chartHeight) / (yAxisLabels.length - 1);
                            return (
                              <div
                                key={value}
                                className="absolute border-t border-gray-200"
                                style={{
                                  left: '0',
                                  right: '0',
                                  top: `${yPosition}px`,
                                  height: '1px',
                                  width: '100%'
                                }}
                              ></div>
                            );
                          })}
                          
                          {/* Y-axis line (vertical) */}
                          <div 
                            className="absolute border-l border-gray-400"
                            style={{
                              left: '0',
                              top: '0',
                              bottom: '0',
                              width: '1px',
                              height: `${chartHeight}px`
                            }}
                          ></div>
                          
                          {/* X-axis line (horizontal) */}
                          <div 
                            className="absolute border-t border-gray-400"
                            style={{
                              left: '0',
                              right: '0',
                              bottom: '0',
                              height: '1px',
                              width: '100%'
                            }}
                          ></div>
                          
                          {/* Bars container */}
                          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-8" style={{ height: `${chartHeight}px` }}>
                            {stepLabels.map((label, stepIndex) => {
                              const stepA = state.versionA.steps[stepIndex];
                              const stepB = state.versionB.steps[stepIndex];
                              const scoreA = stepA ? calculateStepScore(stepA.ratings) : 0;
                              const scoreB = stepB ? calculateStepScore(stepB.ratings) : 0;
                              const heightA = (scoreA / roundedMax) * chartHeight;
                              const heightB = (scoreB / roundedMax) * chartHeight;
                              
                              return (
                                <div key={stepIndex} className="flex flex-col items-center" style={{ width: '100px' }}>
                                  {/* Grouped bars */}
                                  <div className="flex items-end gap-2" style={{ height: `${chartHeight}px` }}>
                                    {/* Version A bar */}
                                    <div className="flex flex-col items-center">
                                      <div
                                        className="bg-teal-500 transition-all duration-500"
                                        style={{ 
                                          width: `${barWidth}px`,
                                          height: `${heightA}px`, 
                                          minHeight: heightA > 0 ? '2px' : '0',
                                        }}
                                      ></div>
          </div>

                                    {/* Version B bar */}
                                    <div className="flex flex-col items-center">
                                      <div
                                        className="bg-orange-300 transition-all duration-500"
                                        style={{ 
                                          width: `${barWidth}px`,
                                          height: `${heightB}px`, 
                                          minHeight: heightB > 0 ? '2px' : '0',
                                        }}
                                      ></div>
                </div>
            </div>
                                </div>
                              );
                            })}
          </div>

                          {/* Labels below X-axis */}
                          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-8" style={{ top: `${chartHeight}px`, marginTop: '8px' }}>
                            {stepLabels.map((label, stepIndex) => (
                              <div key={stepIndex} className="text-xs font-medium text-center" style={{ width: '100px' }}>
                                {label}
                              </div>
                            ))}
                          </div>
                        </div>
            </div>
          </div>

                    {/* X-axis label */}
                    <div className="text-center mt-4">
                      <div className="text-sm text-gray-600">Шаги</div>
            </div>
          </div>
                );
              })()}

              {/* Hotspots */}
              {(() => {
                const allHotspots: Array<{ version: string; stepIndex: number; name: string; score: number }> = [];
                
                state.versionA.steps.forEach((step, index) => {
                  allHotspots.push({
                    version: state.versionA.name || 'Версия A',
                    stepIndex: index,
                    name: step.name,
                    score: calculateStepScore(step.ratings)
                  });
                });
                
                state.versionB.steps.forEach((step, index) => {
                  allHotspots.push({
                    version: state.versionB.name || 'Версия B',
                    stepIndex: index,
                    name: step.name,
                    score: calculateStepScore(step.ratings)
                  });
                });
                
                allHotspots.sort((a, b) => b.score - a.score);
                const topHotspots = allHotspots.slice(0, 5);
                
                if (topHotspots.length > 0) {
                  return (
                    <div>
                      <h3 className="text-xl mb-4">Точки сложности (топ-5)</h3>
            <div className="space-y-2">
                        {topHotspots.map((hotspot, idx) => (
                          <div key={idx} className="border rounded-lg p-3">
                            <strong>{idx + 1}. {hotspot.version} - Шаг {hotspot.stepIndex + 1}</strong><br />
                            {hotspot.name}<br />
                            <span className="text-lg text-red-600">{hotspot.score}</span>
                          </div>
              ))}
            </div>
          </div>
                  );
                }
                return null;
              })()}
            </>
          )}
          </div>
      )}
    </div>
  );
}
