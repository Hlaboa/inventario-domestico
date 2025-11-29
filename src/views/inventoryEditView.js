(() => {
  let ctx = null;

  const getCtx = (c) => c || ctx || {};
  const nowIso = (c) =>
    (c && typeof c.nowIsoString === "function"
      ? c.nowIsoString()
      : new Date().toISOString());

  const defaultSort = (a, b) =>
    (a.shelf || "").localeCompare(b.shelf || "", "es", { sensitivity: "base" }) ||
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

  const matchesStore = (context, productId, storeId) => {
    if (!storeId) return true;
    if (typeof context.matchesStore === "function") {
      return context.matchesStore(productId, storeId);
    }
    return true;
  };

  const buildStripeMap = (context, items) =>
    typeof context.buildFamilyStripeMap === "function"
      ? context.buildFamilyStripeMap(items)
      : {};

  function buildRow(product, stripe, context) {
    const refs = context.refs || {};
    const helpers = context.helpers || {};
    const rowTemplate = refs.rowTemplate || refs.editRowTemplate;

    const famSel = helpers.createFamilySelect
      ? helpers.createFamilySelect(product.block || "")
      : makeInput(helpers, "block", product.block);
    const typeSel = helpers.createTypeSelect
      ? helpers.createTypeSelect(product.block || "", product.type || "")
      : makeInput(helpers, "type", product.type);
    if (helpers.linkFamilyTypeSelects) {
      helpers.linkFamilyTypeSelects(famSel, typeSel);
    }

    const selectionBtn = helpers.createSelectionButton
      ? helpers.createSelectionButton(product.selectionId, product.id)
      : null;
    const haveCheckbox = makeInput(helpers, "have", "", "checkbox");
    haveCheckbox.checked = !!product.have;
    const adqInput = makeInput(
      helpers,
      "acquisitionDate",
      product.acquisitionDate || "",
      "date"
    );

    if (
      rowTemplate &&
      window.AppComponents &&
      typeof window.AppComponents.buildRowWithTemplate === "function"
    ) {
      const row = window.AppComponents.buildRowWithTemplate({
        template: rowTemplate,
        stripe,
        dataset: { id: product.id },
        text: {
          "[data-field='selectionText']": helpers.getSelectionLabelForProduct
            ? helpers.getSelectionLabelForProduct(product)
            : "",
          "[data-field='stores']": helpers.getSelectionStoresForProduct
            ? helpers.getSelectionStoresForProduct(product)
            : "",
        },
        actions: {
          "[data-role='selection-btn']": {
            action: "select-selection",
            id: product.id,
          },
          "[data-role='move']": { action: "move-to-extra", id: product.id },
          "[data-role='delete']": { action: "delete", id: product.id },
        },
        replacements: {
          "[data-slot='name']": makeInput(helpers, "name", product.name),
          "[data-slot='block']": famSel,
          "[data-slot='type']": typeSel,
          "[data-slot='shelf']": makeInput(helpers, "shelf", product.shelf),
          "[data-slot='quantity']": makeInput(
            helpers,
            "quantity",
            product.quantity
          ),
          "[data-slot='have']": haveCheckbox,
          "[data-slot='acquisitionDate']": adqInput,
          "[data-slot='expiryText']": makeInput(
            helpers,
            "expiryText",
            product.expiryText
          ),
          "[data-slot='notes']": makeTextarea(helpers, "notes", product.notes || ""),
          "[data-role='selection-btn']": selectionBtn,
        },
      });
      if (row) return row;
    }

    const tr = document.createElement("tr");
    tr.dataset.id = product.id;
    tr.classList.add(`family-stripe-${stripe}`);

    let td = document.createElement("td");
    td.appendChild(makeInput(helpers, "name", product.name));
    tr.appendChild(td);

    td = document.createElement("td");
    td.appendChild(famSel);
    tr.appendChild(td);

    td = document.createElement("td");
    td.appendChild(typeSel);
    tr.appendChild(td);

    td = document.createElement("td");
    td.appendChild(makeInput(helpers, "shelf", product.shelf));
    tr.appendChild(td);

    td = document.createElement("td");
    td.appendChild(makeInput(helpers, "quantity", product.quantity));
    tr.appendChild(td);

    td = document.createElement("td");
    td.className = "selection-td";
    const selCell = document.createElement("div");
    selCell.className = "selection-cell";
    const selText = document.createElement("span");
    selText.className = "selection-text";
    selText.textContent = helpers.getSelectionLabelForProduct
      ? helpers.getSelectionLabelForProduct(product)
      : "";
    selCell.appendChild(selText);
    if (selectionBtn) selCell.appendChild(selectionBtn);
    td.appendChild(selCell);
    tr.appendChild(td);

    td = document.createElement("td");
    const spanStores = document.createElement("span");
    spanStores.textContent = helpers.getSelectionStoresForProduct
      ? helpers.getSelectionStoresForProduct(product)
      : "";
    td.appendChild(spanStores);
    tr.appendChild(td);

    td = document.createElement("td");
    td.appendChild(haveCheckbox);
    tr.appendChild(td);

    td = document.createElement("td");
    td.appendChild(adqInput);
    tr.appendChild(td);

    td = document.createElement("td");
    td.appendChild(makeInput(helpers, "expiryText", product.expiryText));
    tr.appendChild(td);

    td = document.createElement("td");
    td.appendChild(makeTextarea(helpers, "notes", product.notes || ""));
    tr.appendChild(td);

    td = document.createElement("td");
    const moveBtn = document.createElement("button");
    moveBtn.className = "btn btn-small btn-icon";
    moveBtn.textContent = "→";
    moveBtn.dataset.action = "move-to-extra";
    moveBtn.dataset.id = product.id;
    td.appendChild(moveBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-small btn-danger";
    delBtn.textContent = "✕";
    delBtn.dataset.action = "delete";
    delBtn.dataset.id = product.id;
    td.appendChild(delBtn);
    tr.appendChild(td);

    return tr;
  }

  function render(c) {
    const context = getCtx(c);
    const refs = context.refs || {};
    const tableBody = refs.tableBody;
    if (!tableBody) return;

    const items =
      (typeof context.getProducts === "function"
        ? context.getProducts()
        : []) || [];
    const sorter = context.sorter || defaultSort;
    items.sort(sorter);
    const stripeMap = buildStripeMap(context, items);

    const rowTemplate = refs.rowTemplate || refs.editRowTemplate;
    if (
      rowTemplate &&
      window.AppComponents &&
      typeof window.AppComponents.renderTable === "function"
    ) {
      window.AppComponents.renderTable(tableBody, items, {
        template: rowTemplate,
        emptyMessage:
          "No hay productos todavía. Usa 'Añadir producto' para crear uno nuevo.",
        emptyColSpan: 12,
        createRow: (item) => {
          const stripe =
            stripeMap[(item.block || "").trim() || "__none__"] || 0;
          return buildRow(item, stripe, context);
        },
      });
    } else {
      tableBody.innerHTML = "";
      if (items.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 12;
        td.textContent =
          "No hay productos todavía. Usa 'Añadir producto' para crear uno nuevo.";
        tr.appendChild(td);
        tableBody.appendChild(tr);
      } else {
        const frag = document.createDocumentFragment();
        items.forEach((p) => {
          const stripe =
            stripeMap[(p.block || "").trim() || "__none__"] || 0;
          const row = buildRow(p, stripe, context);
          if (row) frag.appendChild(row);
        });
        tableBody.appendChild(frag);
      }
    }

    filterRows(context);
  }

  function addRow(c) {
    const context = getCtx(c);
    const refs = context.refs || {};
    const defaults =
      (typeof context.getDefaults === "function"
        ? context.getDefaults()
        : {}) || {};
    const id =
      (crypto.randomUUID ? crypto.randomUUID() : "prod-" + Date.now()) +
      "-" +
      Math.random().toString(36).slice(2);

    const product = {
      id,
      name: "",
      block: defaults.block || "",
      type: defaults.type || "",
      shelf: defaults.shelf || "",
      quantity: "",
      have: false,
      acquisitionDate: "",
      expiryText: "",
      notes: "",
      selectionId: "",
    };

    const stripeMap = buildStripeMap(context, [product]);
    const row = buildRow(
      product,
      stripeMap[(product.block || "").trim() || "__none__"] || 0,
      context
    );
    if (row && refs.tableBody) refs.tableBody.prepend(row);
  }

  function collectRows(context) {
    const refs = context.refs || {};
    const tableBody = refs.tableBody;
    if (!tableBody) return [];
    const rows = Array.from(tableBody.querySelectorAll("tr"));
    const list = [];
    const now = nowIso(context);

    rows.forEach((tr) => {
      const id = tr.dataset.id;
      if (!id) return;

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
      const acquisitionDate = getField("acquisitionDate");
      const expiryText = getField("expiryText");
      const notes = (tr.querySelector('textarea[data-field="notes"]') || {})
        .value;
      const have = !!getField("have");

      const existing =
        (typeof context.findById === "function"
          ? context.findById(id)
          : null) || {};
      const createdAt = existing.createdAt || now;
      const selectionId = existing.selectionId || "";

      list.push({
        id,
        name,
        block,
        type,
        shelf,
        quantity,
        have,
        acquisitionDate,
        expiryText,
        notes,
        selectionId,
        createdAt,
        updatedAt: now,
      });
    });

    const sorter = context.sorter || defaultSort;
    return list.sort(sorter);
  }

  function save(c) {
    const context = getCtx(c);
    const list = collectRows(context);
    if (typeof context.persist === "function") {
      context.persist(list);
    }
    if (typeof context.onAfterSave === "function") {
      context.onAfterSave(list);
    }
    render(context);
  }

  function filterRows(c) {
    const context = getCtx(c);
    const refs = context.refs || {};
    const tableBody = refs.tableBody;
    if (!tableBody) return;

    const rows = Array.from(tableBody.querySelectorAll("tr"));
    const search = (refs.searchInput?.value || "").toLowerCase();
    const filterBlock = refs.familyFilter?.value || "";
    const filterType = refs.typeFilter?.value || "";
    const filterShelf = refs.shelfFilter?.value || "";
    const filterStoreId = refs.storeFilter?.value || "";

    const predicate = (tr) => {
      const id = tr.dataset.id;
      if (!id) return true;
      const name = (tr.querySelector('input[data-field="name"]') || {}).value || "";
      const block = (tr.querySelector('[data-field="block"]') || {}).value || "";
      const type = (tr.querySelector('[data-field="type"]') || {}).value || "";
      const shelf = (tr.querySelector('input[data-field="shelf"]') || {}).value || "";
      const notes = (tr.querySelector('textarea[data-field="notes"]') || {})
        .value || "";

      if (filterBlock && block !== filterBlock) return false;
      if (filterType && type !== filterType) return false;
      if (filterShelf && shelf !== filterShelf) return false;
      if (filterStoreId && !matchesStore(context, id, filterStoreId)) {
        return false;
      }
      if (search) {
        const haystack = `${name} ${block} ${type} ${shelf} ${notes}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    };

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
  }

  function handleClick(e) {
    const context = getCtx();
    const target = e.target.closest("button,[data-action],[data-role]") || e.target;
    if (!target) return;
    const roleActionMap = {
      "selection-btn": "select-selection",
      move: "move-to-extra",
      delete: "delete",
    };
    let action = target.dataset.action || roleActionMap[target.dataset.role];
    if (!action && target.closest("button")) {
      const text = target.closest("button").textContent.trim();
      if (text === "✕") action = "delete";
      if (text === "→") action = "move-to-extra";
    }
    if (!action) return;
    const tr = target.closest("tr");
    const id = tr?.dataset.id || target.dataset.id;
    if (!id) return;

    if (action === "delete") {
      if (typeof context.onDelete === "function") {
        context.onDelete(id);
      } else if (tr) {
        tr.remove();
      }
      return;
    }
    if (action === "move-to-extra" && typeof context.onMoveToExtra === "function") {
      context.onMoveToExtra(id);
      return;
    }
    if (
      action === "select-selection" &&
      typeof context.onSelectSelection === "function"
    ) {
      context.onSelectSelection(id);
    }
  }

  function getDefaults(context) {
    const refs = context.refs || {};
    return {
      block: refs.familyFilter ? refs.familyFilter.value || "" : "",
      type: refs.typeFilter ? refs.typeFilter.value || "" : "",
      shelf: refs.shelfFilter ? refs.shelfFilter.value || "" : "",
    };
  }

  function init(c) {
    ctx = c;
    const context = getCtx(c);
    if (!context.getDefaults) {
      context.getDefaults = () => getDefaults(context);
    }
    const refs = context.refs || {};
    if (refs.tableBody) refs.tableBody.addEventListener("click", handleClick);
    if (refs.addButton) refs.addButton.addEventListener("click", () => addRow());
    if (refs.saveButton) refs.saveButton.addEventListener("click", () => save());

    const filterListener = () => filterRows();
    [refs.searchInput, refs.familyFilter, refs.typeFilter, refs.shelfFilter, refs.storeFilter].forEach(
      (el) => {
        if (!el) return;
        const evt = el.tagName === "INPUT" ? "input" : "change";
        el.addEventListener(evt, filterListener);
      }
    );

    render(context);
  }

  window.InventoryEditView = { init, render, addRow, save, filterRows };
})();
