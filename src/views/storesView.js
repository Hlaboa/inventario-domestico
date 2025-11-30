(() => {
  let ctx = null;

  const getCtx = (c) => c || ctx || {};
  const getNow = (c) =>
    (c && typeof c.nowIsoString === "function"
      ? c.nowIsoString()
      : new Date().toISOString());

  const makeInput = (field, value = "", type = "text") => {
    if (window.AppUtils && typeof window.AppUtils.createTableInput === "function") {
      return window.AppUtils.createTableInput(field, value, type);
    }
    const input = document.createElement("input");
    input.type = type;
    input.value = value || "";
    input.className = "table-input";
    if (field) input.dataset.field = field;
    return input;
  };

  const makeTextarea = (field, value = "") => {
    if (
      window.AppUtils &&
      typeof window.AppUtils.createTableTextarea === "function"
    ) {
      return window.AppUtils.createTableTextarea(field, value);
    }
    const area = document.createElement("textarea");
    area.className = "table-input";
    if (field) area.dataset.field = field;
    area.value = value || "";
    return area;
  };

  function render(c) {
    const context = getCtx(c);
    const refs = context.refs || {};
    const tableBody = refs.tableBody;
    const rowTemplate = refs.rowTemplate;
    if (!tableBody) return;

    const list =
      (typeof context.getStores === "function" ? context.getStores() : []) || [];

    const buildRow = (s) => {
      const nameInput = makeInput("name", s.name);
      const sel = document.createElement("select");
      sel.className = "table-input";
      sel.dataset.field = "type";
      ["", "fisico", "online"].forEach((val) => {
        const o = document.createElement("option");
        o.value = val;
        if (val === "") o.textContent = "—";
        else if (val === "fisico") o.textContent = "Físico";
        else if (val === "online") o.textContent = "Online";
        sel.appendChild(o);
      });
      sel.value = s.type || "";
      const locInput = makeInput("location", s.location);
      const webInput = makeInput("website", s.website);
      const notesInput = makeTextarea("notes", s.notes || "");

      if (rowTemplate && window.AppComponents && typeof window.AppComponents.buildRowWithTemplate === "function") {
        const row = window.AppComponents.buildRowWithTemplate({
          template: rowTemplate,
          dataset: { id: s.id },
          replacements: {
            "[data-slot='name']": nameInput,
            "[data-slot='type']": sel,
            "[data-slot='location']": locInput,
            "[data-slot='website']": webInput,
            "[data-slot='notes']": notesInput,
          },
          actions: {
            "[data-role='delete']": { action: "delete", id: s.id },
          },
        });
        if (row) return row;
      }

      const tr = document.createElement("tr");
      tr.dataset.id = s.id;

      let td = document.createElement("td");
      td.appendChild(nameInput);
      tr.appendChild(td);

      td = document.createElement("td");
      td.appendChild(sel);
      tr.appendChild(td);

      td = document.createElement("td");
      td.appendChild(locInput);
      tr.appendChild(td);

      td = document.createElement("td");
      td.appendChild(webInput);
      tr.appendChild(td);

      td = document.createElement("td");
      td.appendChild(notesInput);
      tr.appendChild(td);

      td = document.createElement("td");
      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-small btn-danger btn-trash";
      delBtn.textContent = "🗑";
      delBtn.dataset.action = "delete";
      delBtn.dataset.id = s.id;
      delBtn.title = "Eliminar tienda";
      delBtn.setAttribute("aria-label", "Eliminar tienda");
      td.appendChild(delBtn);
      tr.appendChild(td);

      return tr;
    };

    const items = list
      .slice()
      .sort(
        (a, b) =>
          (a.location || "").localeCompare(b.location || "", "es", {
            sensitivity: "base",
          }) ||
          (a.name || "").localeCompare(b.name || "", "es", {
            sensitivity: "base",
          })
      );

    if (rowTemplate && window.AppComponents && typeof window.AppComponents.renderTable === "function") {
      window.AppComponents.renderTable(tableBody, items, {
        template: rowTemplate,
        emptyMessage:
          "No hay tiendas todavía. Usa 'Añadir tienda' para crear una.",
        emptyColSpan: 6,
        createRow: (item) => buildRow(item),
      });
    } else {
      tableBody.innerHTML = "";
      if (items.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 6;
        td.textContent =
          "No hay tiendas todavía. Usa 'Añadir tienda' para crear una.";
        tr.appendChild(td);
        tableBody.appendChild(tr);
      } else {
        items.forEach((s) => {
          const row = buildRow(s);
          if (row) tableBody.appendChild(row);
        });
      }
    }

    filterRows(context);
  }

  function addRow(c) {
    const context = getCtx(c);
    if (context._addingRow) return;
    context._addingRow = true;
    setTimeout(() => {
      context._addingRow = false;
    }, 0);
    const refs = context.refs || {};
    const tableBody = refs.tableBody;
    const rowTemplate = refs.rowTemplate;
    if (!tableBody) return;

    if (
      tableBody.children.length === 1 &&
      !tableBody.children[0].dataset.id
    ) {
      tableBody.innerHTML = "";
    }

    const id =
      (crypto.randomUUID ? crypto.randomUUID() : "store-" + Date.now()) +
      "-" +
      Math.random().toString(36).slice(2);

    if (
      rowTemplate &&
      window.AppComponents &&
      typeof window.AppComponents.buildRowWithTemplate === "function"
    ) {
      const row = window.AppComponents.buildRowWithTemplate({
        template: rowTemplate,
        dataset: { id },
        replacements: {
          "[data-slot='name']": makeInput("name", ""),
          "[data-slot='type']": (() => {
            const sel = document.createElement("select");
            sel.className = "table-input";
            sel.dataset.field = "type";
            ["", "fisico", "online"].forEach((val) => {
              const o = document.createElement("option");
              o.value = val;
              if (val === "") o.textContent = "—";
              else if (val === "fisico") o.textContent = "Físico";
              else if (val === "online") o.textContent = "Online";
              sel.appendChild(o);
            });
            return sel;
          })(),
          "[data-slot='location']": makeInput("location", ""),
          "[data-slot='website']": makeInput("website", ""),
          "[data-slot='notes']": makeTextarea("notes", ""),
        },
        actions: {
          "[data-role='delete']": { action: "delete", id },
        },
      });
      if (row) {
        tableBody.prepend(row);
        return;
      }
    }

    const tr = document.createElement("tr");
    tr.dataset.id = id;

    let td = document.createElement("td");
    td.appendChild(makeInput("name", ""));
    tr.appendChild(td);

    td = document.createElement("td");
    const sel = document.createElement("select");
    sel.className = "table-input";
    sel.dataset.field = "type";
    ["", "fisico", "online"].forEach((val) => {
      const o = document.createElement("option");
      o.value = val;
      if (val === "") o.textContent = "—";
      else if (val === "fisico") o.textContent = "Físico";
      else if (val === "online") o.textContent = "Online";
      sel.appendChild(o);
    });
    td.appendChild(sel);
    tr.appendChild(td);

    td = document.createElement("td");
    td.appendChild(makeInput("location", ""));
    tr.appendChild(td);

    td = document.createElement("td");
    td.appendChild(makeInput("website", ""));
    tr.appendChild(td);

    td = document.createElement("td");
    td.appendChild(makeTextarea("notes", ""));
    tr.appendChild(td);

    td = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-small btn-danger";
    delBtn.textContent = "✕";
    delBtn.dataset.action = "delete";
    delBtn.dataset.id = id;
    td.appendChild(delBtn);
    tr.appendChild(td);

    tableBody.prepend(tr);
  }

  function handleClick(e) {
    const target = e.target;
    if (!target || target.dataset.action !== "delete") return;
    const tr = target.closest("tr");
    if (!tr) return;
    const ok =
      typeof window.confirm === "function"
        ? window.confirm("¿Eliminar esta tienda?")
        : true;
    if (!ok) return;
    tr.remove();
  }

  function readRows(context) {
    const refs = context.refs || {};
    const tableBody = refs.tableBody;
    if (!tableBody) return [];
    const rows = Array.from(tableBody.querySelectorAll("tr"));
    const list = [];
    const now = getNow(context);
    const existing =
      (typeof context.getStores === "function" ? context.getStores() : []) || [];

    for (const tr of rows) {
      const id = tr.dataset.id;
      if (!id) continue;

      const getField = (selector) => {
        const el = tr.querySelector(selector);
        return el ? el.value.trim() : "";
      };

      const name = getField('input[data-field="name"]');
      const typeEl = tr.querySelector('select[data-field="type"]');
      const type = typeEl ? typeEl.value : "";
      const location = getField('input[data-field="location"]');
      const website = getField('input[data-field="website"]');
      const notes = (tr.querySelector('textarea[data-field="notes"]') || {})
        .value;

      if (!name && !location && !website && !notes && !type) continue;

      const prev = existing.find((s) => s.id === id) || {};
      const createdAt = prev.createdAt || now;

      list.push({
        id,
        name,
        type,
        location,
        website,
        notes,
        createdAt,
        updatedAt: now,
      });
    }

    return list;
  }

  function filterRows(c) {
    const context = getCtx(c);
    const refs = context.refs || {};
    const tableBody = refs.tableBody;
    if (!tableBody) return;

    const search = (refs.searchInput?.value || "").toLowerCase();
    const filterType = refs.typeFilter?.value || "";
    const filterLoc = refs.locationFilter?.value || "";

    Array.from(tableBody.querySelectorAll("tr")).forEach((tr) => {
      const id = tr.dataset.id;
      if (!id) {
        tr.style.display = "";
        return;
      }
      const nameEl = tr.querySelector('input[data-field="name"]');
      const typeEl = tr.querySelector('select[data-field="type"]');
      const locEl = tr.querySelector('input[data-field="location"]');
      const webEl = tr.querySelector('input[data-field="website"]');
      const notesEl = tr.querySelector('textarea[data-field="notes"]');

      const name = (nameEl && nameEl.value) || "";
      const type = typeEl ? typeEl.value : "";
      const location = (locEl && locEl.value) || "";
      const website = (webEl && webEl.value) || "";
      const notes = (notesEl && notesEl.value) || "";

      if (filterType && type !== filterType) {
        tr.style.display = "none";
        return;
      }

      if (filterLoc && location !== filterLoc) {
        tr.style.display = "none";
        return;
      }

      if (search) {
        const haystack = `${name} ${location} ${website} ${notes}`.toLowerCase();
        if (!haystack.includes(search)) {
          tr.style.display = "none";
          return;
        }
      }

      tr.style.display = "";
    });

    if (refs.summary) {
      const dataRows = Array.from(tableBody.querySelectorAll("tr[data-id]"));
      const total =
        typeof context.getStores === "function"
          ? (context.getStores() || []).length
          : dataRows.length;
      const visible = dataRows.filter((tr) => tr.style.display !== "none").length;
      const filtered =
        visible !== total || (search || "").trim() || filterType || filterLoc;
      refs.summary.textContent = `Total: ${total}${filtered ? ` · Visibles: ${visible}` : ""}`;
    }
  }

  function save(c) {
    const context = getCtx(c);
    const list = readRows(context);
    if (typeof context.persist === "function") {
      context.persist(list);
    }
    render(context);
    if (typeof context.onAfterSave === "function") {
      context.onAfterSave(list);
    }
  }

  function init(c) {
    ctx = c;
    const context = getCtx(c);
    const refs = context.refs || {};

    if (refs.tableBody) {
      refs.tableBody.addEventListener("click", handleClick);
    }
    if (refs.addButton) {
      refs.addButton.addEventListener("click", () => addRow());
    }
    if (refs.saveButton) {
      refs.saveButton.addEventListener("click", () => save());
    }
    if (refs.searchInput) {
      refs.searchInput.addEventListener("input", () => filterRows());
    }
    if (refs.typeFilter) {
      refs.typeFilter.addEventListener("change", () => filterRows());
    }
    if (refs.locationFilter) {
      refs.locationFilter.addEventListener("change", () => filterRows());
    }

    render(context);
  }

  window.StoresView = { init, render, addRow, save, filterRows };
})();
