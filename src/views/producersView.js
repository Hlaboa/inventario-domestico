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
      (typeof context.getProducers === "function"
        ? context.getProducers()
        : []) || [];

    tableBody.innerHTML = "";

    const buildRow = (p) => {
      const nameInput = makeInput("name", p.name);
      const locInput = makeInput("location", p.location);
      const notesInput = makeTextarea("notes", p.notes || "");
      if (rowTemplate && window.AppComponents && typeof window.AppComponents.buildRowWithTemplate === "function") {
        const row = window.AppComponents.buildRowWithTemplate({
          template: rowTemplate,
          dataset: { id: p.id },
          replacements: {
            "[data-slot='name']": nameInput,
            "[data-slot='location']": locInput,
            "[data-slot='notes']": notesInput,
          },
          actions: {
            "[data-role='delete']": { action: "delete", id: p.id },
          },
        });
        if (row) return row;
      }

      const tr = document.createElement("tr");
      tr.dataset.id = p.id;

      let td = document.createElement("td");
      td.appendChild(nameInput);
      tr.appendChild(td);

      td = document.createElement("td");
      td.appendChild(locInput);
      tr.appendChild(td);

      td = document.createElement("td");
      td.appendChild(notesInput);
      tr.appendChild(td);

      td = document.createElement("td");
      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-small btn-danger";
      delBtn.textContent = "✕";
      delBtn.dataset.action = "delete";
      delBtn.dataset.id = p.id;
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
          "No hay productores todavía. Usa 'Añadir productor' para crear uno.",
        emptyColSpan: 4,
        createRow: (item) => buildRow(item),
      });
      filterRows(context);
      return;
    }

    if (items.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.textContent =
        "No hay productores todavía. Usa 'Añadir productor' para crear uno.";
      tr.appendChild(td);
      tableBody.appendChild(tr);
      return;
    }

    items.forEach((p) => {
      const row = buildRow(p);
      if (row) tableBody.appendChild(row);
    });

    filterRows(context);
  }

  function addRow(c) {
    const context = getCtx(c);
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
      (crypto.randomUUID ? crypto.randomUUID() : "prod-" + Date.now()) +
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
          "[data-slot='location']": makeInput("location", ""),
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
    td.appendChild(makeInput("location", ""));
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
    if (tr) tr.remove();
  }

  function readRows(context) {
    const refs = context.refs || {};
    const tableBody = refs.tableBody;
    if (!tableBody) return [];
    const rows = Array.from(tableBody.querySelectorAll("tr"));
    const list = [];
    const now = getNow(context);
    const existing =
      (typeof context.getProducers === "function"
        ? context.getProducers()
        : []) || [];

    for (const tr of rows) {
      const id = tr.dataset.id;
      if (!id) continue;

      const getField = (selector) => {
        const el = tr.querySelector(selector);
        return el ? el.value.trim() : "";
      };

      const name = getField('input[data-field="name"]');
      const location = getField('input[data-field="location"]');
      const notes = (tr.querySelector('textarea[data-field="notes"]') || {})
        .value;

      if (!name && !location && !notes) continue;

      const prev = existing.find((p) => p.id === id) || {};
      const createdAt = prev.createdAt || now;

      list.push({
        id,
        name,
        location,
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
    const filterLoc = refs.locationFilter?.value || "";

    Array.from(tableBody.querySelectorAll("tr")).forEach((tr) => {
      const id = tr.dataset.id;
      if (!id) {
        tr.style.display = "";
        return;
      }
      const nameEl = tr.querySelector('input[data-field="name"]');
      const locEl = tr.querySelector('input[data-field="location"]');
      const notesEl = tr.querySelector('textarea[data-field="notes"]');

      const name = (nameEl && nameEl.value) || "";
      const location = (locEl && locEl.value) || "";
      const notes = (notesEl && notesEl.value) || "";

      if (filterLoc && location !== filterLoc) {
        tr.style.display = "none";
        return;
      }

      if (search) {
        const haystack = `${name} ${location} ${notes}`.toLowerCase();
        if (!haystack.includes(search)) {
          tr.style.display = "none";
          return;
        }
      }

      tr.style.display = "";
    });
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
    if (refs.locationFilter) {
      refs.locationFilter.addEventListener("change", () => filterRows());
    }

    render(context);
  }

  window.ProducersView = { init, render, addRow, save, filterRows };
})();
