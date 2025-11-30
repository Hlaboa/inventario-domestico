(() => {
  const rowMap = new Map();
  const hashMap = new Map();
  const selectionLabelCache = new Map();
  const selectionStoresCache = new Map();
  let stripeCacheKey = "";
  let stripeCache = {};

  const stripeClassRegex = /^family-stripe-/;

  function getStripeMap(items, helpers) {
    const signature = items
      .map((p) => ((p.block || "").trim() || "__none__"))
      .join("|");
    if (signature === stripeCacheKey && stripeCache) return stripeCache;
    stripeCacheKey = signature;
    stripeCache =
      typeof helpers.buildFamilyStripeMap === "function"
        ? helpers.buildFamilyStripeMap(items)
        : {};
    return stripeCache || {};
  }

  function getRowHash(p, helpers) {
    return [
      p.id,
      p.name,
      p.block,
      p.type,
      p.shelf,
      p.quantity,
      p.selectionId,
      p.have ? "1" : "0",
      p.acquisitionDate,
      p.expiryText,
      p.notes,
      helpers.getSelectionLabelForProduct ? helpers.getSelectionLabelForProduct(p) : "",
      helpers.getSelectionStoresForProduct ? helpers.getSelectionStoresForProduct(p) : "",
    ].join("||");
  }

  function getSelectionLabelCached(p, helpers) {
    const key = p.selectionId || p.id || "";
    if (!key || typeof helpers.getSelectionLabelForProduct !== "function") {
      return helpers.getSelectionLabelForProduct ? helpers.getSelectionLabelForProduct(p) : "";
    }
    if (selectionLabelCache.has(key)) return selectionLabelCache.get(key);
    const value = helpers.getSelectionLabelForProduct(p) || "";
    selectionLabelCache.set(key, value);
    return value;
  }

  function getSelectionStoresCached(p, helpers) {
    const key = p.selectionId || p.id || "";
    if (!key || typeof helpers.getSelectionStoresForProduct !== "function") {
      return helpers.getSelectionStoresForProduct ? helpers.getSelectionStoresForProduct(p) : "";
    }
    if (selectionStoresCache.has(key)) return selectionStoresCache.get(key);
    const value = helpers.getSelectionStoresForProduct(p) || "";
    selectionStoresCache.set(key, value);
    return value;
  }

  function applyStripe(row, stripe) {
    if (!row || typeof row.classList === "undefined") return;
    Array.from(row.classList)
      .filter((cls) => stripeClassRegex.test(cls))
      .forEach((cls) => row.classList.remove(cls));
    if (typeof stripe === "number") {
      row.classList.add(`family-stripe-${stripe}`);
    }
  }

  const EXPECTED_COLUMNS = 12;

  function render({ refs, state, helpers }) {
    const {
      productTableBody,
      filterSearchInput,
      filterShelfSelect,
      filterBlockSelect,
      filterTypeSelect,
      filterStoreSelect,
      filterStatusSelect,
      summaryInfo,
      inventoryRowTemplate,
    } = refs;
    if (refs && refs.__skipNextRender) {
      refs.__skipNextRender = false;
      return;
    }
    const { products, productDrafts } = state;
    const editingIds = new Set(
      (productDrafts || [])
        .map((d) => d && d.originalId)
        .filter(Boolean)
    );
    if (!productTableBody) return;
    selectionLabelCache.clear();
    selectionStoresCache.clear();
    productTableBody.querySelectorAll(".product-draft-row").forEach((tr) => tr.remove());
    productTableBody
      .querySelectorAll("tr:not([data-id]):not(.product-draft-row)")
      .forEach((tr) => tr.remove());
    const existingRows = new Map();
    productTableBody.querySelectorAll("tr[data-id]").forEach((tr) => {
      if (tr.dataset.id) existingRows.set(tr.dataset.id, tr);
    });

    const components = window.AppComponents || {};
    const canUseTemplate =
      inventoryRowTemplate &&
      typeof components.cloneRowFromTemplate === "function" &&
      typeof components.hydrateRow === "function";

    const buildRowFromTemplate = (product, stripe) => {
      if (!canUseTemplate) return null;
      const row = components.cloneRowFromTemplate(inventoryRowTemplate);
      if (!row) return null;
      const selectionBtn = helpers.createSelectionButton(product.selectionId, product.id);

      components.hydrateRow(row, {
        dataset: { id: product.id },
        classes: [`family-stripe-${stripe}`],
        text: {
          "[data-field='name']": product.name || "",
          "[data-field='block']": product.block || "",
          "[data-field='type']": product.type || "",
          "[data-field='have']": product.have ? "1" : "",
          "[data-field='shelf']": product.shelf || "",
          "[data-field='quantity']": product.quantity || "",
          "[data-field='selectionText']": getSelectionLabelCached(product, helpers),
          "[data-field='stores']": getSelectionStoresCached(product, helpers),
          "[data-field='acquisitionDate']": product.acquisitionDate || "",
          "[data-field='expiryText']": product.expiryText || "",
          "[data-field='notes']": product.notes || "",
        },
        checkboxes: {
          "input[data-field='have']": !!product.have,
        },
        attributes: {
          "input[data-field='have']": { dataset: { id: product.id } },
        },
        actions: {
          "[data-role='selection-btn']": { action: "select-selection", id: product.id },
          "[data-role='edit']": { action: "edit-product", id: product.id },
        },
        replacements: {
          "[data-role='selection-btn']": selectionBtn,
        },
      });

      return row;
    };

    const buildFallbackRow = (p, stripe) => {
      const tr = document.createElement("tr");
      tr.dataset.id = p.id;
      tr.classList.add(`family-stripe-${stripe}`);

      const addCellText = (text) => {
        const td = document.createElement("td");
        td.textContent = text || "";
        tr.appendChild(td);
      };

      addCellText(p.name || "");
      addCellText(p.block || "");
      addCellText(p.type || "");

      let td = document.createElement("td");
      const haveCheck = document.createElement("input");
      haveCheck.type = "checkbox";
      haveCheck.checked = !!p.have;
      haveCheck.dataset.field = "have";
      haveCheck.dataset.id = p.id;
      td.appendChild(haveCheck);
      tr.appendChild(td);

      addCellText(p.shelf || "");
      addCellText(p.quantity || "");
      const selTd = document.createElement("td");
      selTd.className = "selection-td";
      const selCell = document.createElement("div");
      selCell.className = "selection-cell";
      const selBtn = helpers.createSelectionButton(p.selectionId, p.id);
      selCell.appendChild(selBtn);
      const selText = document.createElement("div");
      selText.className = "selection-text";
      selText.textContent = helpers.getSelectionLabelForProduct(p);
      selCell.appendChild(selText);
      selTd.appendChild(selCell);
      tr.appendChild(selTd);

      const storesTd = document.createElement("td");
      const storesDiv = document.createElement("div");
      storesDiv.className = "stores-text";
      storesDiv.textContent = getSelectionStoresCached(p, helpers);
      storesTd.appendChild(storesDiv);
      tr.appendChild(storesTd);

      addCellText(p.acquisitionDate || "");
      addCellText(p.expiryText || "");
      addCellText(p.notes || "");

    td = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-small btn-icon";
    editBtn.textContent = "✎";
    editBtn.title = "Editar producto";
    editBtn.setAttribute("aria-label", "Editar producto");
    editBtn.dataset.action = "edit-product";
    editBtn.dataset.id = p.id;
    td.appendChild(editBtn);

    tr.appendChild(td);
    return tr;
  };

    const draftsByOriginal = new Map();
    const orphanDrafts = [];
    productDrafts.forEach((d) => {
      if (d.originalId) draftsByOriginal.set(d.originalId, d);
      else orphanDrafts.push(d);
    });

    const sortedAll = products.slice().sort(helpers.compareShelfBlockTypeName);
    const stripeMap = getStripeMap(sortedAll, helpers);

    const frag =
      typeof document !== "undefined" && document.createDocumentFragment
        ? document.createDocumentFragment()
        : null;
    const target = frag || productTableBody;
    const rows = [];
    const nextRowMap = new Map();
    const nextHashMap = new Map();

    // Construir orden combinado de productos y drafts en su posición original
    const orderedEntries = orphanDrafts.map((d) => ({ type: "draft", draft: d }));
    sortedAll.forEach((p) => {
      const draft = draftsByOriginal.get(p.id);
      if (draft) {
        orderedEntries.push({ type: "draft", draft });
      } else if (!editingIds.has(p.id)) {
        orderedEntries.push({ type: "product", product: p });
      }
    });

    orderedEntries.forEach((entry) => {
      if (entry.type === "draft") {
        const d = entry.draft;
        const tr = document.createElement("tr");
        tr.className = "product-draft-row";
        tr.dataset.draftId = d.id;
        if (d.originalId) tr.dataset.originalId = d.originalId;
        const stripe = stripeMap[(d.block || "").trim() || "__none__"] || 0;
        applyStripe(tr, stripe);

        let td = document.createElement("td");
        td.appendChild(helpers.createTableInput("name", d.name || ""));
        tr.appendChild(td);

        td = document.createElement("td");
        const famSel = helpers.createFamilySelect(d.block || "");
        famSel.dataset.field = "block";
        td.appendChild(famSel);
        tr.appendChild(td);

        td = document.createElement("td");
        const typeSel = helpers.createTypeSelect(d.block || "", d.type || "");
        typeSel.dataset.field = "type";
        helpers.linkFamilyTypeSelects(famSel, typeSel);
        td.appendChild(typeSel);
        tr.appendChild(td);

        td = document.createElement("td");
        const haveChk = helpers.createTableInput(
          "have",
          d.have ? "on" : "",
          "checkbox"
        );
        haveChk.checked = !!d.have;
        td.appendChild(haveChk);
        tr.appendChild(td);

        td = document.createElement("td");
        td.appendChild(helpers.createTableInput("shelf", d.shelf || ""));
        tr.appendChild(td);

        td = document.createElement("td");
        td.appendChild(helpers.createTableInput("quantity", d.quantity || ""));
        tr.appendChild(td);

        td = document.createElement("td");
        td.textContent = "—";
        tr.appendChild(td);

        td = document.createElement("td");
        td.textContent = "—";
        tr.appendChild(td);

        td = document.createElement("td");
        const adq = helpers.createTableInput(
          "acquisitionDate",
          d.acquisitionDate || "",
          "date"
        );
        td.appendChild(adq);
        tr.appendChild(td);

        td = document.createElement("td");
        td.appendChild(helpers.createTableInput("expiryText", d.expiryText || ""));
        tr.appendChild(td);

        td = document.createElement("td");
        td.appendChild(helpers.createTableTextarea("notes", d.notes || ""));
        tr.appendChild(td);

        td = document.createElement("td");
        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "btn btn-small btn-success";
        saveBtn.dataset.action = "save-draft-product";
        saveBtn.dataset.id = d.id;
        saveBtn.title = "Guardar producto";
        saveBtn.setAttribute("aria-label", "Guardar producto");
        saveBtn.textContent = "✓";
        td.appendChild(saveBtn);

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "btn btn-small btn-danger";
        cancelBtn.dataset.action = "cancel-draft-product";
        cancelBtn.dataset.id = d.id;
        cancelBtn.textContent = "✕";
        cancelBtn.title = "Cancelar";
        cancelBtn.setAttribute("aria-label", "Cancelar");
        td.appendChild(cancelBtn);

        if (d.originalId) {
          const moveBtn = document.createElement("button");
          moveBtn.type = "button";
          moveBtn.className = "btn btn-small btn-icon";
          moveBtn.dataset.action = "move-to-extra";
          moveBtn.dataset.id = d.originalId || d.id;
          moveBtn.dataset.originalId = d.originalId || "";
          moveBtn.title = "Mover a otros productos";
          moveBtn.setAttribute("aria-label", "Mover a otros productos");
          moveBtn.textContent = "→";
          td.appendChild(moveBtn);

          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "btn btn-small btn-danger btn-trash";
          delBtn.dataset.action = "delete-product";
          delBtn.dataset.id = d.originalId || d.id;
          delBtn.dataset.originalId = d.originalId || "";
          delBtn.textContent = "🗑";
          delBtn.title = "Eliminar producto";
          delBtn.setAttribute("aria-label", "Eliminar producto");
          td.appendChild(delBtn);
        }
        tr.appendChild(td);
        target.appendChild(tr);
        return;
      }

      const p = entry.product;
      const stripe = stripeMap[(p.block || "").trim() || "__none__"] || 0;
      const hash = getRowHash(p, helpers);
      const existing = existingRows.get(p.id);
      const reuse = existing && hashMap.get(p.id) === hash;
      if (existing && !reuse) {
        existing.remove();
      }
      let tr = reuse ? existing : null;
      if (!tr) {
        tr = buildRowFromTemplate(p, stripe) || buildFallbackRow(p, stripe);
      }
      if (!tr || tr.children.length !== EXPECTED_COLUMNS) {
        tr = buildFallbackRow(p, stripe);
      }
      if (tr) {
        applyStripe(tr, stripe);
        tr.dataset.id = p.id;
        tr.dataset.block = p.block || "";
        tr.dataset.type = p.type || "";
        tr.dataset.have = p.have ? "1" : "0";
        const selectionLabel = getSelectionLabelCached(p, helpers) || "";
        const storesLabel = getSelectionStoresCached(p, helpers) || "";
        tr.dataset.search = `${p.name || ""} ${p.block || ""} ${p.type || ""} ${p.shelf || ""} ${p.quantity || ""} ${p.notes || ""} ${selectionLabel} ${storesLabel}`.toLowerCase();

        if (target) target.appendChild(tr);
        rows.push({ row: tr, product: p });
        nextRowMap.set(p.id, tr);
        nextHashMap.set(p.id, hash);
      }
    });

    existingRows.forEach((row, id) => {
      if (!nextRowMap.has(id)) {
        row.remove();
      }
    });

    rowMap.clear();
    nextRowMap.forEach((row, id) => rowMap.set(id, row));
    hashMap.clear();
    nextHashMap.forEach((hash, id) => hashMap.set(id, hash));

    if (rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 12;
      td.textContent = "No hay productos que coincidan con los filtros.";
      tr.appendChild(td);
      target.appendChild(tr);
    }

    if (frag) {
      productTableBody.appendChild(frag);
    }

    filterRows({ refs, state, helpers });
  }

  function filterRows({ refs, state, helpers }) {
    const {
      productTableBody,
      filterSearchInput,
      filterShelfSelect,
      filterBlockSelect,
      filterTypeSelect,
      filterStoreSelect,
      filterStatusSelect,
      summaryInfo,
    } = refs;
    if (!productTableBody) return;
    const search = (filterSearchInput.value || "").toLowerCase();
    const filterBlock = filterBlockSelect.value || "";
    const filterType = filterTypeSelect.value || "";
    const filterShelf = filterShelfSelect.value || "";
    const filterStoreId = filterStoreSelect.value || "";
    const status = filterStatusSelect.value || "all";
    const map = new Map((state.products || []).map((p) => [p.id, p]));

    const predicate = (tr) => {
      const id = tr.dataset.id;
      const p = id ? map.get(id) : null;
      if (!p) return true;
      if (filterBlock && (p.block || "") !== filterBlock) return false;
      if (filterType && (p.type || "") !== filterType) return false;
      if (filterShelf && (p.shelf || "") !== filterShelf) return false;
      if (filterStoreId && !helpers.productMatchesStore(p, filterStoreId)) return false;
      if (status === "have" && !p.have) return false;
      if (status === "missing" && p.have) return false;
      if (search) {
        const haystack = `${p.name || ""} ${p.block || ""} ${p.type || ""} ${p.shelf || ""} ${p.quantity || ""} ${p.notes || ""} ${helpers.getSelectionLabelForProduct(p)} ${helpers.getSelectionStoresForProduct(p)}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    };

    const rows = Array.from(productTableBody.querySelectorAll("tr"));
    if (
      window.AppComponents &&
      typeof window.AppComponents.filterRowsByPredicates === "function"
    ) {
      window.AppComponents.filterRowsByPredicates(rows, [predicate]);
    } else {
      rows.forEach((tr) => {
        tr.style.display = predicate(tr) ? "" : "none";
      });
    }

    if (summaryInfo) {
      const visible = rows.filter((tr) => tr.style.display !== "none" && tr.dataset.id);
      const totalAll = (state.products || []).filter(Boolean).length;
      const missingVisible = visible.filter((tr) => {
        const p = map.get(tr.dataset.id);
        return p && !p.have;
      }).length;
      summaryInfo.textContent = `Total: ${totalAll} · Visible: ${visible.length} · Faltan: ${missingVisible}`;
    }
  }

  function bind({ refs, state, helpers }) {
    const {
      productTableBody,
      filterSearchInput,
      filterShelfSelect,
      filterBlockSelect,
      filterTypeSelect,
      filterStoreSelect,
      filterStatusSelect,
    } = refs;

    const debouncedRender =
      window.AppUtils && typeof window.AppUtils.debounce === "function"
        ? window.AppUtils.debounce(() => filterRows({ refs, state, helpers }), 80)
        : () => filterRows({ refs, state, helpers });

    filterSearchInput.addEventListener("input", debouncedRender);
    filterShelfSelect.addEventListener("change", debouncedRender);
    filterBlockSelect.addEventListener("change", debouncedRender);
    filterTypeSelect.addEventListener("change", debouncedRender);
    filterStoreSelect.addEventListener("change", debouncedRender);
    filterStatusSelect.addEventListener("change", debouncedRender);
    productTableBody.addEventListener("click", helpers.handleInventoryTableClick);
    filterRows({ refs, state, helpers });
  }

  window.InventoryView = { render, bind, init: bind };
})();
