(() => {
  let ctx = null;
  const rowMap = new Map();
  const hashMap = new Map();
  const stripeClassRegex = /^family-stripe-/;
  let stripeCacheKey = "";
  let stripeCache = {};
  const selectionLabelCache = new Map();
  const selectionStoresCache = new Map();

  const getCtx = (c) => c || ctx || {};

  const defaultSort = (a, b) =>
    (a.block || "").localeCompare(b.block || "", "es", { sensitivity: "base" }) ||
    (a.type || "").localeCompare(b.type || "", "es", { sensitivity: "base" }) ||
    (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" });

  const makeInput = (helpers, field, value = "", type = "text") => {
    if (helpers && typeof helpers.createTableInput === "function") {
      return helpers.createTableInput(field, value, type);
    }
    const input = document.createElement("input");
    input.type = type;
    input.value = value || "";
    input.className = "table-input";
    if (field) input.dataset.field = field;
    return input;
  };

  const makeTextarea = (helpers, field, value = "") => {
    if (helpers && typeof helpers.createTableTextarea === "function") {
      return helpers.createTableTextarea(field, value);
    }
    const area = document.createElement("textarea");
    area.className = "table-input";
    if (field) area.dataset.field = field;
    area.value = value || "";
    return area;
  };

  const debounce = (fn) =>
    window.AppUtils && typeof window.AppUtils.debounce === "function"
      ? window.AppUtils.debounce(fn, 150)
      : fn;

  const buildStripeMap = (context, items) =>
    typeof context.buildFamilyStripeMap === "function"
      ? context.buildFamilyStripeMap(items)
      : {};

  function getStripeMap(context, items) {
    const signature = items
      .map((p) => ((p.block || "").trim() || "__none__"))
      .join("|");
    if (signature === stripeCacheKey && stripeCache) return stripeCache;
    stripeCacheKey = signature;
    stripeCache = buildStripeMap(context, items);
    return stripeCache || {};
  }

  function getSelectionLabelCached(item, context) {
    const key = item.selectionId || item.id || "";
    const helpers = context.helpers || {};
    if (!key || typeof helpers.getSelectionLabelForProduct !== "function") {
      return helpers.getSelectionLabelForProduct
        ? helpers.getSelectionLabelForProduct(item)
        : "";
    }
    if (selectionLabelCache.has(key)) return selectionLabelCache.get(key);
    const value = helpers.getSelectionLabelForProduct(item) || "";
    selectionLabelCache.set(key, value);
    return value;
  }

  function getSelectionStoresCached(item, context) {
    const key = item.selectionId || item.id || "";
    const helpers = context.helpers || {};
    if (!key || typeof helpers.getSelectionStoresForProduct !== "function") {
      return helpers.getSelectionStoresForProduct
        ? helpers.getSelectionStoresForProduct(item)
        : "";
    }
    if (selectionStoresCache.has(key)) return selectionStoresCache.get(key);
    const value = helpers.getSelectionStoresForProduct(item) || "";
    selectionStoresCache.set(key, value);
    return value;
  }

  const getRowHash = (item, context) => {
    const helpers = context.helpers || {};
    const selectionLabel = helpers.getSelectionLabelForProduct
      ? helpers.getSelectionLabelForProduct(item)
      : "";
    const storesLabel = helpers.getSelectionStoresForProduct
      ? helpers.getSelectionStoresForProduct(item)
      : "";
    return [
      item.id,
      item.name,
      item.block,
      item.type,
      item.quantity,
      item.buy ? "1" : "0",
      item.notes,
      selectionLabel,
      storesLabel,
    ].join("||");
  };

  function applyStripe(row, stripe) {
    if (!row || typeof row.classList === "undefined") return;
    Array.from(row.classList)
      .filter((cls) => stripeClassRegex.test(cls))
      .forEach((cls) => row.classList.remove(cls));
    if (typeof stripe === "number") {
      row.classList.add(`family-stripe-${stripe}`);
    }
  }

  function buildRow(item, stripe, context) {
    const refs = context.refs || {};
    const helpers = context.helpers || {};
    const rowTemplate = refs.rowTemplate;

    const selectionBtn = helpers.createSelectionButton
      ? helpers.createSelectionButton(item.selectionId, item.id)
      : null;

    if (
      rowTemplate &&
      window.AppComponents &&
      typeof window.AppComponents.buildRowWithTemplate === "function"
    ) {
      const row = window.AppComponents.buildRowWithTemplate({
        template: rowTemplate,
        stripe,
        dataset: { id: item.id },
        text: {
          "[data-field='name']": item.name,
          "[data-field='block']": item.block,
          "[data-field='type']": item.type,
          "[data-field='quantity']": item.quantity,
          "[data-field='notes']": item.notes,
          "[data-field='stores']": getSelectionStoresCached(item, context),
          "[data-field='selectionText']": getSelectionLabelCached(item, context),
        },
        checkboxes: {
          'input[data-field="buy"]': !!item.buy,
        },
        attributes: {
          'input[data-field="buy"]': { dataset: { id: item.id } },
        },
        actions: {
          "[data-role='edit']": { action: "edit-extra", id: item.id },
          "[data-role='move']": { action: "move-to-almacen", id: item.id },
        },
        replacements: {
          "[data-role='selection-btn']": selectionBtn,
        },
      });
      if (row) return row;
    }

    const tr = document.createElement("tr");
    tr.dataset.id = item.id;
    tr.classList.add(`family-stripe-${stripe}`);

    const addCellText = (t) => {
      const td = document.createElement("td");
      td.textContent = t || "";
      tr.appendChild(td);
    };

    addCellText(item.name || "");
    addCellText(item.block || "");
    addCellText(item.type || "");
    addCellText(item.quantity || "");
    const selTd = document.createElement("td");
    selTd.className = "selection-td";
    const selCell = document.createElement("div");
    selCell.className = "selection-cell";
    const selText = document.createElement("div");
    selText.className = "selection-text";
    selText.textContent = getSelectionLabelCached(item, context);
    selCell.appendChild(selectionBtn || document.createElement("span"));
    selCell.appendChild(selText);
    selTd.appendChild(selCell);
    tr.appendChild(selTd);

    addCellText(getSelectionStoresCached(item, context));

    let td = document.createElement("td");
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = !!item.buy;
    chk.dataset.field = "buy";
    chk.dataset.id = item.id;
    chk.addEventListener("change", () => {
      const ctx = getCtx();
      if (typeof ctx.onToggleBuy === "function") {
        ctx.onToggleBuy(item.id, chk.checked);
      }
    });
    td.appendChild(chk);
    tr.appendChild(td);

    addCellText(item.notes || "");

  td = document.createElement("td");
  const editBtn = document.createElement("button");
  editBtn.className = "btn btn-small btn-icon";
  editBtn.textContent = "✎";
  editBtn.title = "Editar producto";
  editBtn.setAttribute("aria-label", "Editar producto");
  editBtn.dataset.action = "edit-extra";
  editBtn.dataset.id = item.id;
    td.appendChild(editBtn);

    const moveBtn = document.createElement("button");
    moveBtn.className = "btn btn-small btn-icon";
    moveBtn.textContent = "→";
    moveBtn.title = "Mover a almacén";
    moveBtn.setAttribute("aria-label", "Mover a almacén");
    moveBtn.dataset.action = "move-to-almacen";
    moveBtn.dataset.id = item.id;
    td.appendChild(moveBtn);

    tr.appendChild(td);
    return tr;
  }

  function decorateRow(row, item, stripe, context) {
    if (!row) return;
    applyStripe(row, stripe);
    row.dataset.id = item.id;
    row.dataset.block = item.block || "";
    row.dataset.type = item.type || "";
    row.dataset.buy = item.buy ? "1" : "0";
    const selectionLabel = getSelectionLabelCached(item, context);
    const storesLabel = getSelectionStoresCached(item, context);
    const inst =
      typeof context.getSelectionInstanceForProduct === "function"
        ? context.getSelectionInstanceForProduct(item)
        : null;
    const storeIds = Array.isArray(inst?.storeIds) ? inst.storeIds : [];
    row.dataset.storeIds = storeIds.join(",");
    row.dataset.search = `${item.name || ""} ${item.block || ""} ${item.type || ""} ${item.quantity || ""} ${selectionLabel} ${storesLabel} ${item.notes || ""}`.toLowerCase();
    const buyChk = row.querySelector('input[data-field="buy"]');
    if (buyChk) buyChk.checked = !!item.buy;
  }

  function hasActiveFilters(refs = {}) {
    const search = (refs.searchInput?.value || "").trim();
    const filterFamily = refs.familyFilter?.value || "";
    const filterType = refs.typeFilter?.value || "";
    const filterStore = refs.storeFilter?.value || "";
    const filterBuy = refs.buyFilter?.value || "all";
    return (
      search ||
      filterFamily ||
      filterType ||
      filterStore ||
      filterBuy === "yes" ||
      filterBuy === "no"
    );
  }

  function renderDrafts(context, tableBody, drafts = null) {
    const helpers = context.helpers || {};
    const list =
      drafts ||
      ((typeof context.getDrafts === "function" ? context.getDrafts() : []) || []);
    list.forEach((d) => {
      const tr = document.createElement("tr");
      tr.className = "extra-draft-row";
      tr.dataset.draftId = d.id;
      if (d.originalId) tr.dataset.originalId = d.originalId;

      let td = document.createElement("td");
      td.appendChild(makeInput(helpers, "name", d.name || ""));
      tr.appendChild(td);

      td = document.createElement("td");
      const famSel = helpers.createFamilySelect
        ? helpers.createFamilySelect(d.block || "")
        : makeInput(helpers, "block", d.block || "");
      famSel.dataset.field = "block";
      td.appendChild(famSel);
      tr.appendChild(td);

      td = document.createElement("td");
      const typeSel = helpers.createTypeSelect
        ? helpers.createTypeSelect(d.block || "", d.type || "")
        : makeInput(helpers, "type", d.type || "");
      typeSel.dataset.field = "type";
      if (helpers.linkFamilyTypeSelects) {
        helpers.linkFamilyTypeSelects(famSel, typeSel);
      }
      td.appendChild(typeSel);
      tr.appendChild(td);

      td = document.createElement("td");
      td.appendChild(makeInput(helpers, "quantity", d.quantity || ""));
      tr.appendChild(td);

      td = document.createElement("td");
      td.textContent = "—";
      tr.appendChild(td);

      td = document.createElement("td");
      td.textContent = "—";
      tr.appendChild(td);

      td = document.createElement("td");
      const buyChk = makeInput(helpers, "buy", d.buy ? "on" : "", "checkbox");
      buyChk.checked = !!d.buy;
      buyChk.dataset.id = d.originalId || d.id;
      buyChk.addEventListener("change", () => {
        if (typeof context.onToggleBuy === "function") {
          context.onToggleBuy(d.originalId || d.id, buyChk.checked);
        }
      });
      td.appendChild(buyChk);
      tr.appendChild(td);

      td = document.createElement("td");
      td.appendChild(makeTextarea(helpers, "notes", d.notes || ""));
      tr.appendChild(td);

      td = document.createElement("td");
      const saveBtn = document.createElement("button");
      saveBtn.className = "btn btn-small btn-success";
      saveBtn.dataset.action = "save-draft-extra";
      saveBtn.dataset.id = d.id;
      saveBtn.title = "Guardar producto";
      saveBtn.setAttribute("aria-label", "Guardar producto");
      saveBtn.textContent = "✓";
      td.appendChild(saveBtn);

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "btn btn-small btn-danger";
      cancelBtn.dataset.action = "cancel-draft-extra";
      cancelBtn.dataset.id = d.id;
      cancelBtn.textContent = "✕";
      td.appendChild(cancelBtn);

      if (d.originalId) {
        const moveBtn = document.createElement("button");
        moveBtn.className = "btn btn-small btn-icon";
        moveBtn.dataset.action = "move-to-almacen";
        moveBtn.dataset.id = d.originalId;
        moveBtn.title = "Mover a almacén";
        moveBtn.setAttribute("aria-label", "Mover a almacén");
        moveBtn.textContent = "→";
        td.appendChild(moveBtn);

        const delBtn = document.createElement("button");
        delBtn.className = "btn btn-small btn-danger btn-trash";
        delBtn.dataset.action = "delete";
        delBtn.dataset.id = d.originalId;
        delBtn.textContent = "🗑";
        delBtn.title = "Eliminar producto";
        delBtn.setAttribute("aria-label", "Eliminar producto");
        td.appendChild(delBtn);
      }

      tr.appendChild(td);

      tableBody.appendChild(tr);
    });
    return list.length;
  }

  function render(c) {
    const context = getCtx(c);
    const refs = context.refs || {};
    const tableBody = refs.tableBody;
    if (!tableBody) return;

    const drafts =
      (typeof context.getDrafts === "function" ? context.getDrafts() : []) || [];
    const extras =
      (typeof context.getExtras === "function"
        ? context.getExtras()
        : []) || [];
    const editingIds = new Set(drafts.map((d) => d && d.originalId).filter(Boolean));
    const filteredExtras = extras.filter((p) => !editingIds.has(p.id));
    const sorted = filteredExtras.slice().sort(defaultSort);
    const stripeMap = getStripeMap(context, sorted);

    selectionLabelCache.clear();
    selectionStoresCache.clear();

    tableBody.querySelectorAll(".extra-draft-row").forEach((tr) => tr.remove());
    tableBody
      .querySelectorAll("tr:not([data-id])")
      .forEach((tr) => tr.remove());

    const existingRows = new Map();
    tableBody.querySelectorAll("tr[data-id]").forEach((tr) => {
      if (tr.dataset.id) existingRows.set(tr.dataset.id, tr);
    });

    const frag = document.createDocumentFragment();
    const nextRowMap = new Map();
    const nextHashMap = new Map();
    const draftsCount = renderDrafts(context, frag, drafts);

    sorted.forEach((p) => {
      const stripe = stripeMap[(p.block || "").trim() || "__none__"] || 0;
      const hash = getRowHash(p, context);
      const existing = existingRows.get(p.id);
      const reuse = existing && hashMap.get(p.id) === hash;
      if (existing && !reuse) {
        existing.remove();
      }
      let row = reuse ? existing : null;
      if (!row) {
        row = buildRow(p, stripe, context);
      }
      if (row) {
        decorateRow(row, p, stripe, context);
        const buyChk = row.querySelector('input[data-field="buy"]');
        if (buyChk) buyChk.checked = !!p.buy;
        frag.appendChild(row);
        nextRowMap.set(p.id, row);
        nextHashMap.set(p.id, hash);
      }
    });

    existingRows.forEach((row, id) => {
      if (!nextRowMap.has(id)) row.remove();
    });

    rowMap.clear();
    nextRowMap.forEach((row, id) => rowMap.set(id, row));
    hashMap.clear();
    nextHashMap.forEach((hash, id) => hashMap.set(id, hash));

    if (nextRowMap.size === 0 && draftsCount === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 9;
      td.textContent =
        "No hay otros productos. Usa 'Editar lista' para añadir algunos.";
      tr.appendChild(td);
      frag.appendChild(tr);
    }

    tableBody.appendChild(frag);

    filterRows(context);
  }

  function filterRows(context) {
    const refs = context.refs || {};
    const tableBody = refs.tableBody;
    if (!tableBody) return;
    const search = (refs.searchInput?.value || "").toLowerCase();
    const filterFamily = refs.familyFilter?.value || "";
    const filterType = refs.typeFilter?.value || "";
    const filterStore = refs.storeFilter?.value || "";
    const filterBuy = refs.buyFilter?.value || "all";

    const rows = Array.from(tableBody.querySelectorAll("tr[data-id]"));
    rows.forEach((row) => {
      const block = row.dataset.block || "";
      const type = row.dataset.type || "";
      const buy = row.dataset.buy === "1";
      const storeIds = (row.dataset.storeIds || "").split(",").filter(Boolean);
      const haystack = row.dataset.search || "";
      let visible = true;
      if (filterFamily && block !== filterFamily) visible = false;
      if (visible && filterType && type !== filterType) visible = false;
      if (visible && filterStore && !storeIds.includes(filterStore)) visible = false;
      if (visible && filterBuy === "yes" && !buy) visible = false;
      if (visible && filterBuy === "no" && buy) visible = false;
      if (visible && search && !haystack.includes(search)) visible = false;
      row.style.display = visible ? "" : "none";
    });
  }

  function handleClick(e) {
    const context = getCtx();
    const target = e.target.closest("button,[data-action],[data-role]") || e.target;
    if (!target) return;
    const roleActionMap = {
      "selection-btn": "select-selection",
      move: "move-to-almacen",
      delete: "delete",
      edit: "edit-extra",
      "save-draft-extra": "save-draft-extra",
    };
    let action = target.dataset.action || roleActionMap[target.dataset.role];
    if (!action && target.closest("button")) {
      const text = target.closest("button").textContent.trim();
      if (text === "✕") action = "delete";
      if (text === "→") action = "move-to-almacen";
    }

    if (action === "cancel-draft-extra") {
      const id = target.dataset.id;
      if (typeof context.onCancelDraft === "function") {
        context.onCancelDraft(id);
      } else {
        const row = target.closest("tr");
        if (row) row.remove();
      }
      return;
    }

    if (target.matches('input[type="checkbox"][data-field="buy"]')) {
      const id = target.dataset.id;
      const row = target.closest("tr");
      if (row) {
        row.dataset.buy = target.checked ? "1" : "0";
      }
      if (hasActiveFilters(context.refs)) {
        filterRows(context);
      }
      if (typeof context.onToggleBuy === "function") {
        context.onToggleBuy(id, target.checked);
      }
      return;
    }

    if (!action) return;
    const id = target.dataset.id || target.closest("tr")?.dataset.id;
    if (!id) return;

    if (action === "move-to-almacen") {
      const ok = typeof window.confirm === "function" ? window.confirm("¿Mover este producto a almacén?") : true;
      if (!ok) return;
      if (typeof context.onMoveToAlmacen === "function") {
        context.onMoveToAlmacen(id);
      }
      return;
    }
    if (action === "edit-extra") {
      if (typeof context.onEdit === "function") {
        context.onEdit(id);
      }
      return;
    }
    if (action === "save-draft-extra") {
      if (typeof context.onSaveDraft === "function") {
        context.onSaveDraft(id);
      }
      return;
    }
    if (action === "select-selection") {
      if (typeof context.onSelectSelection === "function") {
        context.onSelectSelection(id);
      }
      return;
    }
    if (action === "delete" && typeof context.onDelete === "function") {
      const ok = typeof window.confirm === "function" ? window.confirm("¿Eliminar este producto?") : true;
      if (!ok) return;
      context.onDelete(id);
    }
  }

  function init(c) {
    ctx = c;
    const context = getCtx(c);
    const refs = context.refs || {};
    if (refs.tableBody) refs.tableBody.addEventListener("click", handleClick);

    const refilter = debounce(() => filterRows(context));
    [refs.searchInput, refs.familyFilter, refs.typeFilter, refs.storeFilter, refs.buyFilter].forEach(
      (el) => {
        if (!el) return;
        const evt = el.tagName === "INPUT" ? "input" : "change";
        el.addEventListener(evt, refilter);
      }
    );

    render(context);
  }

  window.ExtrasView = { init, render };
})();
