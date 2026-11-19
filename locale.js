(() => {
  const messages = {
    "Language": "Idioma",
    "Portfolio": "Portfólio",
    "Main navigation": "Navegação principal",
    "Case studies": "Estudos de caso",
    "Case study": "Estudo de caso",
    "Projects": "Projetos",
    "Source": "Código-fonte",
    "Source code": "Código-fonte",
    "Sample data and changes are stored in this browser.": "Os dados de exemplo e as alterações ficam salvos neste navegador.",
    "Back": "Voltar",
    "Date": "Data",
    "Time": "Horário",
    "Patient": "Paciente",
    "Consultation": "Consulta",
    "Cleaning": "Limpeza",
    "Changes could not be saved in this browser.": "Não foi possível salvar as alterações neste navegador.",
    "Open full site": "Abrir site completo",
    "An employee time tracking demo.": "Demonstração de controle de jornada de funcionários.",
    "ShiftLedger | React Demo": "ShiftLedger | Demo em React",
    "TEAM TIME TRACKER": "CONTROLE DE JORNADA",
    "Log a shift. See where the hours went.": "Registre uma jornada e acompanhe as horas trabalhadas.",
    "Demo role": "Perfil da demonstração",
    "Employee view": "Visão do funcionário",
    "Manager view": "Visão do gestor",
    "Log a shift": "Registrar jornada",
    "Log your first shift": "Registre sua primeira jornada",
    "Enter your start, end, and unpaid break. You can load an example and check it before saving.": "Informe a entrada, a saída e o intervalo. Você pode carregar um exemplo e conferir os valores antes de salvar.",
    "Employee": "Funcionário",
    "Start time": "Entrada",
    "End time": "Saída",
    "Break (minutes)": "Intervalo (minutos)",
    "Log shift": "Salvar jornada",
    "Use example hours": "Usar horários de exemplo",
    "Team work hours": "Horas da equipe",
    "All employees": "Todos os funcionários",
    "From": "De",
    "To": "Até",
    "Clear filters": "Limpar filtros",
    "Total work hours": "Total de horas trabalhadas",
    "Work hours": "Horas de trabalho",
    "Start": "Entrada",
    "End": "Saída",
    "Break": "Intervalo",
    "Worked": "Tempo trabalhado",
    "No shifts match these filters.": "Nenhum registro para estes filtros.",
    "End time must be after start time, and the break must be shorter than the shift. Split overnight shifts at midnight.": "A saída deve ser posterior à entrada e o intervalo deve ser menor que a jornada. Divida jornadas que passam da meia-noite em dois registros.",
    "This shift overlaps an existing entry.": "Este horário se sobrepõe a um registro existente.",
    "Shift logged.": "Jornada registrada."
  };
  const key = 'wesley-portfolio-language';
  const supported = value => {
    const base = value?.toLowerCase().split('-')[0];
    if (base === 'pt') return 'pt-BR';
    if (base === 'en') return 'en';
  };
  let saved;
  try { saved = supported(localStorage.getItem(key)); } catch { /* Storage can be disabled. */ }
  const requested = supported(new URLSearchParams(location.search).get('lang'));
  const language = requested || saved || (navigator.languages || []).map(supported).find(Boolean)
    || supported(navigator.language) || 'en';
  if (requested) {
    try { localStorage.setItem(key, language); } catch { /* The URL still keeps the preference. */ }
  }
  document.documentElement.lang = language;

  const t = text => language === 'pt-BR' && Object.hasOwn(messages, text) ? messages[text] : text;
  const date = value => language === 'pt-BR' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.split('-').reverse().join('/') : value;

  function url(href) {
    const link = new URL(href, location.href);
    if (link.origin === location.origin && ['http:', 'https:'].includes(link.protocol)) {
      if (language === 'pt-BR' || requested) link.searchParams.set('lang', language);
    }
    return link.href;
  }

  function textNode(text) {
    const plain = text.trim();
    return plain ? text.replace(plain, t(plain)) : text;
  }

  function apply(root) {
    if (language === 'pt-BR') {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: node => node.parentElement?.closest('script, style')
          ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
      });
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const translated = textNode(node.data);
        if (node.data === translated) continue;
        if (node.parentElement?.matches('option:not([value])')) node.parentElement.value = node.data.trim();
        node.data = translated;
      }
      for (const item of root.querySelectorAll('[aria-label], [title], [placeholder], meta[name="description"]')) {
        for (const attribute of ['aria-label', 'title', 'placeholder', 'content']) {
          if (item.hasAttribute(attribute)) item.setAttribute(attribute, t(item.getAttribute(attribute)));
        }
      }
    }
    for (const link of root.querySelectorAll('a[href]')) {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('#')) link.href = url(href);
    }
  }

  // Translate literal template labels before Angular compiles the template.
  function template(markup) {
    if (language !== 'pt-BR') return markup;
    return markup.replace(/>([^<>]+)(?=<)/g, (_, text) => '>' + textNode(text))
      .replace(/(aria-label|placeholder|title)="([^"]+)"/g, (_, key, value) => key + '="' + t(value) + '"');
  }

  function initialize() {
    apply(document);
    const mount = document.querySelector('[data-language-menu]');
    if (!mount || window.self !== window.top) return;
    const select = document.createElement('select');
    select.className = 'language-picker';
    select.setAttribute('aria-label', t('Language'));
    select.add(new Option('EN', 'en'));
    select.add(new Option('PT-BR', 'pt-BR'));
    select.value = language;
    select.addEventListener('change', () => {
      const next = new URL(location.href);
      next.searchParams.set('lang', select.value);
      const project = document.querySelector('.project-card[aria-pressed="true"]')?.dataset.project;
      if (project) next.searchParams.set('demo', project);
      try { localStorage.setItem(key, select.value); } catch { /* The URL carries the choice. */ }
      location.assign(next);
    });
    mount.replaceChildren(select);
  }

  window.siteLocale = { language, t, date, url, apply, template };
  document.addEventListener('DOMContentLoaded', initialize, { once: true });
})();
