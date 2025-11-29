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

  function commitDraftProducts({
    tableBody,
    drafts = [],
    getPantryProducts = () => [],
    getOtherProducts = () => [],
    persistUnified = () => {},
    nowIsoString: nowFn = nowIsoString,
    allowedIds = null,
  } = {}) {
    if (!tableBody || drafts.length === 0) {
      return { drafts, unified: null };
    }
    const rows = Array.from(tableBody.querySelectorAll(".product-draft-row"));
    if (rows.length === 0) return { drafts, unified: null };

    let unified = [
      ...getPantryProducts().map((p) => ({ ...p, scope: "almacen" })),
      ...getOtherProducts().map((p) => ({ ...p, scope: "otros" })),
    ];
    let updatedDrafts = drafts.slice();
    let added = false;

    rows.forEach((tr) => {
      const draftId = tr.dataset.draftId;
      if (allowedIds && allowedIds.length && !allowedIds.includes(draftId)) {
        return;
      }
      const getField = (field) => {
        const el = tr.querySelector(`[data-field="${field}"]`);
        if (!el) return "";
        if (el.type === "checkbox") return el.checked;
        return el.value.trim();
      };
      const name = getField("name");
      if (!name) return;
      const block = getField("block");
      const type = getField("type");
      const shelf = getField("shelf");
      const quantity = getField("quantity");
      const have = !!getField("have");
      const acquisitionDate = getField("acquisitionDate");
      const expiryText = getField("expiryText");
      const notes = (tr.querySelector('textarea[data-field="notes"]') || {}).value;
      const now = nowFn();
      const newProd = {
        id:
          (crypto.randomUUID ? crypto.randomUUID() : "prod-" + Date.now()) +
          "-" +
          Math.random().toString(36).slice(2),
        name,
        block,
        type,
        shelf,
        quantity,
        have,
        acquisitionDate,
        expiryText,
        notes,
        scope: "almacen",
        selectionId: "",
        createdAt: now,
        updatedAt: now,
      };
      unified = [newProd, ...unified];
      updatedDrafts = updatedDrafts.filter((d) => d.id !== draftId);
      added = true;
    });

    if (added) {
      persistUnified(unified);
    }

    return { drafts: updatedDrafts, unified };
  }

  function commitDraftExtras({
    tableBody,
    drafts = [],
    getPantryProducts = () => [],
    getOtherProducts = () => [],
    persistUnified = () => {},
    nowIsoString: nowFn = nowIsoString,
    allowedIds = null,
  } = {}) {
    if (!tableBody || drafts.length === 0) {
      return { drafts, unified: null };
    }
    const rows = Array.from(tableBody.querySelectorAll(".extra-draft-row"));
    if (rows.length === 0) return { drafts, unified: null };

    let unified = [
      ...getPantryProducts().map((p) => ({ ...p, scope: "almacen" })),
      ...getOtherProducts().map((p) => ({ ...p, scope: "otros" })),
    ];
    let updatedDrafts = drafts.slice();
    let added = false;

    rows.forEach((tr) => {
      const draftId = tr.dataset.draftId;
      if (allowedIds && allowedIds.length && !allowedIds.includes(draftId)) {
        return;
      }
      const getField = (field) => {
        const el = tr.querySelector(`[data-field="${field}"]`);
        if (!el) return "";
        if (el.type === "checkbox") return el.checked;
        return el.value.trim();
      };
      const name = getField("name");
      if (!name) return;
      const block = getField("block");
      const type = getField("type");
      const quantity = getField("quantity");
      const buy = !!getField("buy");
      const notes = (tr.querySelector('textarea[data-field="notes"]') || {}).value;
      const now = nowFn();
      const newExtra = {
        id:
          (crypto.randomUUID ? crypto.randomUUID() : "extra-" + Date.now()) +
          "-" +
          Math.random().toString(36).slice(2),
        name,
        block,
        type,
        quantity,
        notes,
        buy,
        scope: "otros",
        selectionId: "",
        createdAt: now,
        updatedAt: now,
      };
      unified = [newExtra, ...unified];
      updatedDrafts = updatedDrafts.filter((d) => d.id !== draftId);
      added = true;
    });

    if (added) {
      persistUnified(unified);
    }

    return { drafts: updatedDrafts, unified };
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
    commitDraftProducts,
    commitDraftExtras,
  };
})();
