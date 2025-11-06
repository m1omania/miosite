(function() {
  'use strict';

  // Конфигурация по умолчанию
  const defaultConfig = {
    apiUrl: 'http://localhost:3001',
    buttonColor: '#3b82f6',
    buttonText: 'Проверить UX сайта',
    textColor: '#ffffff',
    containerId: 'ux-audit-widget',
  };

  // Получение конфигурации из data-атрибутов
  function getConfig() {
    const script = document.currentScript || document.querySelector('script[data-widget="ux-audit"]');
    if (!script) return defaultConfig;

    return {
      apiUrl: script.getAttribute('data-api-url') || defaultConfig.apiUrl,
      buttonColor: script.getAttribute('data-button-color') || defaultConfig.buttonColor,
      buttonText: script.getAttribute('data-button-text') || defaultConfig.buttonText,
      textColor: script.getAttribute('data-text-color') || defaultConfig.textColor,
      containerId: script.getAttribute('data-container-id') || defaultConfig.containerId,
    };
  }

  // Создание виджета
  function createWidget(config) {
    const container = document.getElementById(config.containerId);
    if (!container) {
      console.error('Container with id "' + config.containerId + '" not found');
      return;
    }

    // Создание формы
    const form = document.createElement('form');
    form.className = 'ux-audit-widget-form';
    form.style.cssText = 'max-width: 600px; margin: 0 auto; padding: 20px;';

    const inputGroup = document.createElement('div');
    inputGroup.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px;';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Введите URL сайта';
    input.style.cssText = 'flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;';

    const button = document.createElement('button');
    button.type = 'submit';
    button.textContent = config.buttonText;
    button.style.cssText = `padding: 10px 20px; background-color: ${config.buttonColor}; color: ${config.textColor}; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;`;
    
    button.onmouseover = function() {
      this.style.opacity = '0.9';
    };
    button.onmouseout = function() {
      this.style.opacity = '1';
    };

    inputGroup.appendChild(input);
    inputGroup.appendChild(button);
    form.appendChild(inputGroup);

    // Блок результатов
    const resultsDiv = document.createElement('div');
    resultsDiv.className = 'ux-audit-results';
    resultsDiv.style.cssText = 'display: none; margin-top: 20px;';

    // Блок ошибок
    const errorDiv = document.createElement('div');
    errorDiv.className = 'ux-audit-error';
    errorDiv.style.cssText = 'display: none; padding: 10px; background-color: #fee; border: 1px solid #fcc; border-radius: 4px; color: #c33; margin-top: 10px;';

    // Блок загрузки
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'ux-audit-loading';
    loadingDiv.style.cssText = 'display: none; text-align: center; padding: 20px;';
    loadingDiv.innerHTML = '<div style="display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid ' + config.buttonColor + '; border-radius: 50%; animation: spin 1s linear infinite;"></div><p style="margin-top: 10px; color: #666;">Анализ сайта...</p>';

    // Добавление анимации
    const style = document.createElement('style');
    style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
    document.head.appendChild(style);

    form.appendChild(errorDiv);
    form.appendChild(loadingDiv);
    container.appendChild(form);
    container.appendChild(resultsDiv);

    // Обработка отправки формы
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const url = input.value.trim();
      if (!url) {
        showError('Введите URL сайта');
        return;
      }

      errorDiv.style.display = 'none';
      loadingDiv.style.display = 'block';
      resultsDiv.style.display = 'none';
      button.disabled = true;

      try {
        const normalizedUrl = url.startsWith('http') ? url : 'https://' + url;
        const response = await fetch(config.apiUrl + '/api/audit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: normalizedUrl }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Ошибка при анализе сайта');
        }

        const data = await response.json();
        displayResults(data.report, resultsDiv, config);
        resultsDiv.style.display = 'block';
      } catch (error) {
        showError(error.message || 'Произошла ошибка');
      } finally {
        loadingDiv.style.display = 'none';
        button.disabled = false;
      }
    });

    function showError(message) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }

    function displayResults(report, container, config) {
      container.innerHTML = '';

      // Заголовок
      const title = document.createElement('h3');
      title.textContent = 'Результаты анализа';
      title.style.cssText = 'font-size: 18px; font-weight: bold; margin-bottom: 15px;';
      container.appendChild(title);

      // Метрики
      const metricsDiv = document.createElement('div');
      metricsDiv.style.cssText = 'background: #f5f5f5; padding: 15px; border-radius: 4px; margin-bottom: 15px;';
      metricsDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
          <div><strong>Время загрузки:</strong> ${(report.metrics.loadTime / 1000).toFixed(2)} сек</div>
          <div><strong>CTA кнопки:</strong> ${report.metrics.ctas.count}</div>
          <div><strong>Контрастность:</strong> ${report.metrics.contrast.score}/100</div>
          <div><strong>Адаптивность:</strong> ${report.metrics.responsive ? 'Да' : 'Нет'}</div>
        </div>
      `;
      container.appendChild(metricsDiv);

      // Проблемы
      if (report.categories && report.categories.length > 0) {
        const issuesDiv = document.createElement('div');
        issuesDiv.style.cssText = 'margin-bottom: 15px;';
        const issuesTitle = document.createElement('h4');
        issuesTitle.textContent = 'Найденные проблемы:';
        issuesTitle.style.cssText = 'font-size: 16px; font-weight: bold; margin-bottom: 10px;';
        issuesDiv.appendChild(issuesTitle);

        report.categories.forEach(function(category) {
          const categoryDiv = document.createElement('div');
          categoryDiv.style.cssText = 'padding: 10px; margin-bottom: 10px; border-left: 4px solid ' + config.buttonColor + '; background: #fff;';
          const catTitle = document.createElement('div');
          catTitle.textContent = category.name;
          catTitle.style.cssText = 'font-weight: bold; margin-bottom: 5px;';
          categoryDiv.appendChild(catTitle);
          
          if (category.issues && category.issues.length > 0) {
            category.issues.slice(0, 3).forEach(function(issue) {
              const issueDiv = document.createElement('div');
              issueDiv.style.cssText = 'font-size: 14px; color: #666; margin-left: 10px;';
              issueDiv.textContent = '• ' + issue.title;
              categoryDiv.appendChild(issueDiv);
            });
          }
          
          issuesDiv.appendChild(categoryDiv);
        });

        container.appendChild(issuesDiv);
      }

      // Рекомендации
      if (report.recommendations && report.recommendations.length > 0) {
        const recDiv = document.createElement('div');
        recDiv.style.cssText = 'margin-bottom: 15px;';
        const recTitle = document.createElement('h4');
        recTitle.textContent = 'Рекомендации:';
        recTitle.style.cssText = 'font-size: 16px; font-weight: bold; margin-bottom: 10px;';
        recDiv.appendChild(recTitle);

        report.recommendations.slice(0, 3).forEach(function(rec) {
          const recItem = document.createElement('div');
          recItem.style.cssText = 'padding: 10px; margin-bottom: 10px; background: #fff; border-radius: 4px;';
          recItem.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">${rec.title}</div>
            <div style="font-size: 14px; color: #666;">${rec.description}</div>
          `;
          recDiv.appendChild(recItem);
        });

        container.appendChild(recDiv);
      }

      // Форма заявки
      const leadForm = createLeadForm(report.id, config);
      container.appendChild(leadForm);
    }

    function createLeadForm(reportId, config) {
      const formDiv = document.createElement('div');
      formDiv.style.cssText = 'margin-top: 20px; padding: 20px; background: #f9f9f9; border-radius: 4px;';

      const formTitle = document.createElement('h4');
      formTitle.textContent = 'Заказать правки';
      formTitle.style.cssText = 'font-size: 16px; font-weight: bold; margin-bottom: 15px;';
      formDiv.appendChild(formTitle);

      const form = document.createElement('form');
      form.id = 'ux-audit-lead-form';

      const fields = [
        { name: 'name', label: 'Имя *', type: 'text', required: true },
        { name: 'phone', label: 'Телефон *', type: 'tel', required: true },
        { name: 'email', label: 'Email *', type: 'email', required: true },
        { name: 'comment', label: 'Комментарий', type: 'textarea', required: false },
      ];

      fields.forEach(function(field) {
        const fieldDiv = document.createElement('div');
        fieldDiv.style.cssText = 'margin-bottom: 15px;';

        const label = document.createElement('label');
        label.textContent = field.label;
        label.style.cssText = 'display: block; font-size: 14px; font-weight: 500; margin-bottom: 5px;';
        label.setAttribute('for', field.name);
        fieldDiv.appendChild(label);

        let input;
        if (field.type === 'textarea') {
          input = document.createElement('textarea');
          input.rows = 4;
        } else {
          input = document.createElement('input');
          input.type = field.type;
        }
        input.name = field.name;
        input.id = field.name;
        input.required = field.required;
        input.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; box-sizing: border-box;';
        fieldDiv.appendChild(input);

        form.appendChild(fieldDiv);
      });

      const submitButton = document.createElement('button');
      submitButton.type = 'submit';
      submitButton.textContent = 'Отправить заявку';
      submitButton.style.cssText = `width: 100%; padding: 12px; background-color: ${config.buttonColor}; color: ${config.textColor}; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;`;
      form.appendChild(submitButton);

      const successDiv = document.createElement('div');
      successDiv.style.cssText = 'display: none; padding: 10px; background-color: #dfd; border: 1px solid #ada; border-radius: 4px; color: #3a3; margin-top: 10px; text-align: center;';

      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(form);
        const data = {
          reportId: reportId,
          name: formData.get('name'),
          phone: formData.get('phone'),
          email: formData.get('email'),
          comment: formData.get('comment'),
        };

        submitButton.disabled = true;
        submitButton.textContent = 'Отправка...';

        try {
          const response = await fetch(config.apiUrl + '/api/leads', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          });

          if (!response.ok) {
            throw new Error('Ошибка при отправке заявки');
          }

          successDiv.textContent = 'Спасибо! Мы свяжемся с вами в ближайшее время.';
          successDiv.style.display = 'block';
          form.reset();
        } catch (error) {
          alert('Ошибка при отправке заявки');
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = 'Отправить заявку';
        }
      });

      formDiv.appendChild(form);
      formDiv.appendChild(successDiv);

      return formDiv;
    }
  }

  // Инициализация виджета
  function init() {
    const config = getConfig();
    createWidget(config);
  }

  // Запуск при загрузке DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


