(() => {
  function cloneRowFromTemplate(template) {
    if (!template || !template.content) return null;
    const frag = template.content.cloneNode(true);
    const row = frag.querySelector("tr") || frag.firstElementChild;
    return row || null;
  }

  function applyAttributes(el, attrs = {}) {
    if (!el || !attrs) return;
    Object.entries(attrs).forEach(([attr, value]) => {
      if (attr === "dataset" && value && typeof value === "object") {
        Object.entries(value).forEach(([key, val]) => {
          if (val !== undefined) el.dataset[key] = val;
        });
      } else if (value !== undefined && value !== null) {
        el.setAttribute(attr, value);
      }
    });
  }

  function hydrateRow(row, config = {}) {
    if (!row) return null;
    const {
      dataset,
      classes = [],
      text = {},
      checkboxes = {},
      attributes = {},
      actions = {},
      replacements = {},
    } = config;

    if (dataset && typeof dataset === "object") {
      Object.entries(dataset).forEach(([key, value]) => {
        if (value !== undefined) row.dataset[key] = value;
      });
    }

    classes.forEach((cls) => {
      if (cls) row.classList.add(cls);
    });

    Object.entries(text || {}).forEach(([selector, value]) => {
      const el = row.querySelector(selector);
      if (!el) return;
      el.textContent = value === undefined || value === null ? "" : String(value);
    });

    Object.entries(checkboxes || {}).forEach(([selector, value]) => {
      const el = row.querySelector(selector);
      if (!el || !("checked" in el)) return;
      el.checked = !!value;
    });

    Object.entries(attributes || {}).forEach(([selector, attrs]) => {
      const el = row.querySelector(selector);
      if (!el) return;
      applyAttributes(el, attrs);
    });

    Object.entries(actions || {}).forEach(([selector, actionConfig]) => {
      const el = row.querySelector(selector);
      if (!el || !actionConfig) return;
      if (actionConfig.action) el.dataset.action = actionConfig.action;
      if (actionConfig.id !== undefined) el.dataset.id = actionConfig.id;
    });

    Object.entries(replacements || {}).forEach(([selector, node]) => {
      const placeholder = row.querySelector(selector);
      if (!placeholder || !node) return;
      const isCell = placeholder.tagName && (placeholder.tagName === "TD" || placeholder.tagName === "TH");
      if (isCell) {
        placeholder.innerHTML = "";
        placeholder.appendChild(node);
      } else {
        placeholder.replaceWith(node);
      }
    });

    return row;
  }

  function renderTable(target, items, options = {}) {
    if (!target) return;
    const {
      template,
      createRow,
      emptyMessage,
      emptyColSpan = 1,
      beforeAppend,
    } = options;
    const list = Array.isArray(items) ? items : [];
    target.innerHTML = "";

    if (list.length === 0) {
      if (emptyMessage) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = emptyColSpan;
        td.textContent = emptyMessage;
        tr.appendChild(td);
        target.appendChild(tr);
      }
      return;
    }

    const frag = document.createDocumentFragment();
    list.forEach((item, index) => {
      const row =
        typeof createRow === "function"
          ? createRow(item, {
              index,
              template,
              cloneRowFromTemplate,
              hydrateRow,
            })
          : null;
      if (row) {
        if (typeof beforeAppend === "function") {
          beforeAppend(row, item, index);
        }
        frag.appendChild(row);
      }
    });
    target.appendChild(frag);
  }

  function buildRowWithTemplate({
    template,
    stripe,
    dataset = {},
    text = {},
    actions = {},
    replacements = {},
    classes = [],
    fallback,
  }) {
    const row = cloneRowFromTemplate(template);
    if (row) {
      const extraClasses = Array.isArray(classes) ? classes : [classes];
      const stripeClasses =
        typeof stripe === "number" ? [`family-stripe-${stripe}`] : [];
      hydrateRow(row, {
        dataset,
        classes: [...extraClasses.filter(Boolean), ...stripeClasses],
        text,
        actions,
        replacements,
      });
      return row;
    }
    return typeof fallback === "function" ? fallback() : null;
  }

  /**
   * Aplica predicados a un conjunto de filas de tabla para mostrarlas u ocultarlas.
   * Cada predicado debe devolver true para dejar la fila visible.
   */
  function filterRowsByPredicates(rows, predicates = []) {
    const list = Array.isArray(rows) ? rows : Array.from(rows || []);
    const checks = (Array.isArray(predicates) ? predicates : []).filter(Boolean);
    list.forEach((row) => {
      const visible = checks.every((fn) => {
        try {
          return fn(row) !== false;
        } catch {
          return false;
        }
      });
      row.style.display = visible ? "" : "none";
    });
  }

  window.AppComponents = {
    cloneRowFromTemplate,
    hydrateRow,
    renderTable,
    buildRowWithTemplate,
    filterRowsByPredicates,
  };
})();
