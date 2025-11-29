(() => {
  function nowIsoString() {
    return new Date().toISOString();
  }

  function safeLoadList(storageKey, normalizeItem) {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return typeof normalizeItem === "function"
        ? parsed.map((item) => normalizeItem(item))
        : parsed;
    } catch {
      return [];
    }
  }

  function saveList(storageKey, list) {
    const data = Array.isArray(list) ? list : [];
    localStorage.setItem(storageKey, JSON.stringify(data));
  }

  function createTableInput(field, value = "", type = "text") {
    const input = document.createElement("input");
    input.type = type;
    input.value = value || "";
    input.className = "table-input";
    if (field) input.dataset.field = field;
    return input;
  }

  function createTableTextarea(field, value = "") {
    const area = document.createElement("textarea");
    area.className = "table-input";
    if (field) area.dataset.field = field;
    area.value = value || "";
    return area;
  }

  function setSelectOptions(
    select,
    options,
    { allLabel, keepCurrent = true, defaultValue = "" } = {}
  ) {
    if (!select) return;
    const current = keepCurrent ? select.value : "";
    select.innerHTML = "";
    if (typeof allLabel === "string") {
      const optAll = document.createElement("option");
      optAll.value = "";
      optAll.textContent = allLabel;
      select.appendChild(optAll);
    }
    const normalized = (options || []).map((opt) =>
      typeof opt === "string"
        ? { value: opt, label: opt }
        : { value: opt.value, label: opt.label || opt.value }
    );
    normalized.forEach(({ value, label }) => {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = label || "";
      select.appendChild(o);
    });
    const hasCurrent = current && normalized.some((o) => o.value === current);
    if (hasCurrent) {
      select.value = current;
    } else if (defaultValue) {
      select.value = defaultValue;
    }
  }

  /**
   * Valida que el valor sea un objeto plano; devuelve {} en caso contrario.
   * @param {unknown} value
   * @returns {Record<string, any>}
   */
  function ensureObject(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
    return {};
  }

  function debounce(fn, wait = 120) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  window.AppUtils = {
    nowIsoString,
    safeLoadList,
    saveList,
    createTableInput,
    createTableTextarea,
    setSelectOptions,
    ensureObject,
    debounce,
  };
})();
