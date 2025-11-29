(() => {
  let ctx = null;

  const getCtx = (c) => c || ctx || {};
  const getNow = (c) =>
    (c && typeof c.nowIsoString === "function"
      ? c.nowIsoString()
      : new Date().toISOString());

  const makeInput = (field, value = "", type = "text") => {
    const input = document.createElement("input");
    input.type = type;
    input.value = value || "";
    input.className = "table-input";
    input.dataset.field = field;
    return input;
  };

  function render(c) {
    const context = getCtx(c);
    const refs = context.refs || {};
    const tableBody = refs.tableBody;
    const rowTemplate = refs.rowTemplate;
    if (!tableBody) return;

    const list =
      (typeof context.getClassifications === "function"
        ? context.getClassifications()
        : []) || [];

    tableBody.innerHTML = "";

    const components = window.AppComponents || {};
    const canUseTemplate =
      rowTemplate &&
      typeof components.cloneRowFromTemplate === "function" &&
      typeof components.hydrateRow === "function";

    const buildRow = (c) => {
      const blockInput = makeInput("block", c.block);
      const typeInput = makeInput("type", c.type);
      const notesInput = makeInput("notes", c.notes);
      if (canUseTemplate) {
        const row = components.cloneRowFromTemplate(rowTemplate);
        if (!row) return null;
        components.hydrateRow(row, {
          dataset: { id: c.id },
          replacements: {
            "[data-slot='block']": blockInput,
            "[data-slot='type']": typeInput,
            "[data-slot='notes']": notesInput,
          },
          actions: {
            "[data-role='delete']": {
              action: "delete-classification",
              id: c.id,
            },
          },
        });
        return row;
      }

      const tr = document.createElement("tr");
      tr.dataset.id = c.id;

      let td = document.createElement("td");
      td.appendChild(blockInput);
      tr.appendChild(td);

      td = document.createElement("td");
      td.appendChild(typeInput);
      tr.appendChild(td);

      td = document.createElement("td");
      td.appendChild(notesInput);
      tr.appendChild(td);

      td = document.createElement("td");
      const del = document.createElement("button");
      del.className = "btn btn-small btn-danger";
      del.dataset.action = "delete-classification";
      del.dataset.id = c.id;
      del.textContent = "✕";
      td.appendChild(del);
      tr.appendChild(td);

      return tr;
    };

    if (canUseTemplate && typeof components.renderTable === "function") {
      components.renderTable(tableBody, list, {
        template: rowTemplate,
        emptyMessage:
          "No hay combinaciones todavía. Añade una familia/tipo para empezar.",
        emptyColSpan: 4,
        createRow: (item) => buildRow(item),
      });
      return;
    }

    if (list.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.textContent =
        "No hay combinaciones todavía. Añade una familia/tipo para empezar.";
      tr.appendChild(td);
      tableBody.appendChild(tr);
      return;
    }

    list.forEach((c) => {
      const row = buildRow(c);
      if (row) tableBody.appendChild(row);
    });
  }

  function addRow(c) {
    const context = getCtx(c);
    const refs = context.refs || {};
    const tableBody = refs.tableBody;
    const rowTemplate = refs.rowTemplate;
    if (!tableBody) return;

    const id =
      (crypto.randomUUID ? crypto.randomUUID() : "cls-" + Date.now()) +
      "-" +
      Math.random().toString(36).slice(2);

    const row =
      rowTemplate && window.AppComponents
        ? (() => {
            const base = window.AppComponents.cloneRowFromTemplate(rowTemplate);
            if (!base) return null;
            window.AppComponents.hydrateRow(base, {
              dataset: { id },
              replacements: {
                "[data-slot='block']": makeInput("block", ""),
                "[data-slot='type']": makeInput("type", ""),
                "[data-slot='notes']": makeInput("notes", ""),
              },
              actions: {
                "[data-role='delete']": {
                  action: "delete-classification",
                  id,
                },
              },
            });
            return base;
          })()
        : null;

    if (row) {
      tableBody.prepend(row);
      return;
    }

    const tr = document.createElement("tr");
    tr.dataset.id = id;

    let td = document.createElement("td");
    td.appendChild(makeInput("block", ""));
    tr.appendChild(td);

    td = document.createElement("td");
    td.appendChild(makeInput("type", ""));
    tr.appendChild(td);

    td = document.createElement("td");
    td.appendChild(makeInput("notes", ""));
    tr.appendChild(td);

    td = document.createElement("td");
    const del = document.createElement("button");
    del.className = "btn btn-small btn-danger";
    del.dataset.action = "delete-classification";
    del.dataset.id = id;
    del.textContent = "✕";
    td.appendChild(del);
    tr.appendChild(td);

    tableBody.prepend(tr);
  }

  function handleClick(e) {
    const target = e.target;
    if (!target || target.dataset.action !== "delete-classification") return;
    const tr = target.closest("tr");
    if (tr) tr.remove();
  }

  function collectRows(context) {
    const refs = context.refs || {};
    const tableBody = refs.tableBody;
    if (!tableBody) return [];
    const rows = Array.from(tableBody.querySelectorAll("tr"));
    const list = [];
    const seen = new Set();
    const now = getNow(context);
    const existing =
      (typeof context.getClassifications === "function"
        ? context.getClassifications()
        : []) || [];

    rows.forEach((tr) => {
      const id = tr.dataset.id;
      if (!id) return;
      const getField = (selector) => {
        const el = tr.querySelector(selector);
        return el ? el.value.trim() : "";
      };
      const block = getField('input[data-field="block"]');
      const type = getField('input[data-field="type"]');
      const notes = getField('input[data-field="notes"]');
      if (!block && !type && !notes) return;
      const key = `${block.toLowerCase()}|||${type.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      const previous = existing.find((c) => c.id === id) || {};
      const createdAt = previous.createdAt || now;
      list.push({
        id,
        block,
        type,
        notes,
        createdAt,
        updatedAt: now,
      });
    });

    return list;
  }

  function save(c) {
    const context = getCtx(c);
    const list = collectRows(context);
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
    const tableBody = refs.tableBody;
    if (tableBody) {
      tableBody.addEventListener("click", handleClick);
    }
    if (refs.addButton) {
      refs.addButton.addEventListener("click", () => addRow());
    }
    if (refs.saveButton) {
      refs.saveButton.addEventListener("click", () => save());
    }
    render(context);
  }

  window.ClassificationView = { init, render, save, addRow };
})();
