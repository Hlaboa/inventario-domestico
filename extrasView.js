(() => {
  let ctx = null;

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

  function matchesStore(context, product, storeId) {
    if (!storeId || !product) return true;
    if (typeof context.getSelectionInstanceForProduct === "function") {
      const inst = context.getSelectionInstanceForProduct(product);
      if (!inst) return false;
      return Array.isArray(inst.storeIds) && inst.storeIds.includes(storeId);
    }
    return true;
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
          "[data-field='stores']": helpers.getSelectionStoresForProduct
            ? helpers.getSelectionStoresForProduct(item)
            : "",
          "[data-field='selectionText']": helpers.getSelectionLabelForProduct
            ? helpers.getSelectionLabelForProduct(item)
            : "",
        },
        checkboxes: {
          'input[data-field="buy"]': !!item.buy,
        },
        attributes: {
          'input[data-field="buy"]': { dataset: { id: item.id } },
        },
        actions: {
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
    selText.textContent = helpers.getSelectionLabelForProduct
      ? helpers.getSelectionLabelForProduct(item)
      : "";
    selCell.appendChild(selectionBtn || document.createElement("span"));
    selCell.appendChild(selText);
    selTd.appendChild(selCell);
    tr.appendChild(selTd);

    addCellText(
      helpers.getSelectionStoresForProduct
        ? helpers.getSelectionStoresForProduct(item)
        : ""
    );

    let td = document.createElement("td");
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = !!item.buy;
    chk.dataset.field = "buy";
    chk.dataset.id = item.id;
    td.appendChild(chk);
    tr.appendChild(td);

    addCellText(item.notes || "");

    td = document.createElement("td");
    const moveBtn = document.createElement("button");
    moveBtn.className = "btn btn-small btn-icon";
    moveBtn.textContent = "→";
    moveBtn.dataset.action = "move-to-almacen";
    moveBtn.dataset.id = item.id;
    td.appendChild(moveBtn);

    tr.appendChild(td);
    return tr;
  }

  function renderDrafts(context, tableBody) {
    const helpers = context.helpers || {};
    const drafts =
      (typeof context.getDrafts === "function" ? context.getDrafts() : []) || [];
    drafts.forEach((d) => {
      const tr = document.createElement("tr");
      tr.className = "extra-draft-row";
      tr.dataset.draftId = d.id;

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
      td.appendChild(buyChk);
      tr.appendChild(td);

      td = document.createElement("td");
      td.appendChild(makeTextarea(helpers, "notes", d.notes || ""));
      tr.appendChild(td);

      td = document.createElement("td");
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "btn btn-small btn-danger";
      cancelBtn.dataset.action = "cancel-draft-extra";
      cancelBtn.dataset.id = d.id;
      cancelBtn.textContent = "✕";
      td.appendChild(cancelBtn);
      tr.appendChild(td);

      tableBody.appendChild(tr);
    });
    return drafts.length;
  }

  function render(c) {
    const context = getCtx(c);
    const refs = context.refs || {};
    const tableBody = refs.tableBody;
    if (!tableBody) return;

    tableBody.innerHTML = "";
    const extras =
      (typeof context.getExtras === "function"
        ? context.getExtras()
        : []) || [];

    const search = (refs.searchInput?.value || "").toLowerCase();
    const filterFamily = refs.familyFilter?.value || "";
    const filterType = refs.typeFilter?.value || "";
    const filterStore = refs.storeFilter?.value || "";
    const filterBuy = refs.buyFilter?.value || "all";

    const filtered = extras
      .filter((p) => {
        if (filterFamily && (p.block || "") !== filterFamily) return false;
        if (filterType && (p.type || "") !== filterType) return false;
        if (filterStore && !matchesStore(context, p, filterStore)) return false;
        if (filterBuy !== "all") {
          const buyVal = filterBuy === "yes";
          if (!!p.buy !== buyVal) return false;
        }
        if (search) {
          const inst = context.getSelectionInstanceForProduct
            ? context.getSelectionInstanceForProduct(p)
            : null;
          const stores =
            inst && context.getStoreNames
              ? context.getStoreNames(inst.storeIds)
              : "";
          const haystack = `${p.name || ""} ${p.block || ""} ${p.type || ""} ${
            p.notes || ""
          } ${stores || ""}`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      })
      .sort(defaultSort);

    const stripeMap = buildStripeMap(context, filtered);
    const draftsCount = renderDrafts(context, tableBody);

    if (
      refs.rowTemplate &&
      window.AppComponents &&
      typeof window.AppComponents.renderTable === "function"
    ) {
      window.AppComponents.renderTable(tableBody, filtered, {
        template: refs.rowTemplate,
        emptyMessage:
          "No hay otros productos. Usa 'Editar lista' para añadir algunos.",
        emptyColSpan: 9,
        createRow: (item) => {
          const stripe =
            stripeMap[(item.block || "").trim() || "__none__"] || 0;
          return buildRow(item, stripe, context);
        },
        beforeAppend: (row) => {
          if (row && typeof row.classList !== "undefined") {
            row.classList.add("extra-row");
          }
        },
      });
    } else if (filtered.length === 0 && draftsCount === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 9;
      td.textContent =
        "No hay otros productos. Usa 'Editar lista' para añadir algunos.";
      tr.appendChild(td);
      tableBody.appendChild(tr);
    } else {
      const frag = document.createDocumentFragment();
      filtered.forEach((p) => {
        const stripe =
          stripeMap[(p.block || "").trim() || "__none__"] || 0;
        const row = buildRow(p, stripe, context);
        if (row) frag.appendChild(row);
      });
      tableBody.appendChild(frag);
    }
  }

  function handleClick(e) {
    const context = getCtx();
    const target = e.target.closest("button,[data-action],[data-role]") || e.target;
    if (!target) return;
    const roleActionMap = {
      "selection-btn": "select-selection",
      move: "move-to-almacen",
      delete: "delete",
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
      if (typeof context.onToggleBuy === "function") {
        context.onToggleBuy(id, target.checked);
      }
      return;
    }

    if (!action) return;
    const id = target.dataset.id || target.closest("tr")?.dataset.id;
    if (!id) return;

    if (action === "move-to-almacen") {
      if (typeof context.onMoveToAlmacen === "function") {
        context.onMoveToAlmacen(id);
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
      context.onDelete(id);
    }
  }

  function init(c) {
    ctx = c;
    const context = getCtx(c);
    const refs = context.refs || {};
    if (refs.tableBody) refs.tableBody.addEventListener("click", handleClick);

    const rerender = debounce(() => render());
    [refs.searchInput, refs.familyFilter, refs.typeFilter, refs.storeFilter, refs.buyFilter].forEach(
      (el) => {
        if (!el) return;
        const evt = el.tagName === "INPUT" ? "input" : "change";
        el.addEventListener(evt, rerender);
      }
    );

    render(context);
  }

  window.ExtrasView = { init, render };
})();
