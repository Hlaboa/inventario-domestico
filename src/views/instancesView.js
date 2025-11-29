(() => {
  let ctx = null;

  const getCtx = (c) => c || ctx || {};
  const getNow = (c) =>
    (c && typeof c.nowIsoString === "function"
      ? c.nowIsoString()
      : new Date().toISOString());

  function render(c) {
    const context = getCtx(c);
    const refs = context.refs || {};
    const tableBody = refs.tableBody;
    const rowTemplate = refs.rowTemplate;
    if (!tableBody) return;

    const {
      instances = [],
      getFamilyForInstance = () => "",
      getProducerName = () => "",
      getStoreNames = () => "",
    } = context.data || {};
    const producersList = (context.data && context.data.producers) || [];
    const storesList = (context.data && context.data.stores) || [];
    const allProducts =
      (typeof context.getAllProducts === "function" && context.getAllProducts()) ||
      context.data?.allProducts ||
      [];
    const productById = new Map();
    const productByName = new Map();
    allProducts.forEach((p) => {
      if (p.id) productById.set(p.id, p);
      const lower = (p.name || "").trim().toLowerCase();
      if (lower && !productByName.has(lower)) {
        productByName.set(lower, p);
      }
    });

    const producerNameFor = (id) => {
      if (typeof context.getProducerName === "function") {
        const name = context.getProducerName(id);
        if (name) return name;
      }
      if (typeof getProducerName === "function") {
        const name = getProducerName(id);
        if (name) return name;
      }
      const p = producersList.find((x) => x.id === id);
      return p ? p.name || "" : "";
    };

    const storeNamesFor = (ids) => {
      if (typeof context.getStoreNames === "function") {
        const s = context.getStoreNames(ids);
        if (s) return s;
      }
      if (typeof getStoreNames === "function") {
        const s = getStoreNames(ids);
        if (s) return s;
      }
      if (!Array.isArray(ids)) return "";
      const names = ids
        .map((id) => {
          const store = storesList.find((s) => s.id === id);
          return store ? store.name || "" : "";
        })
        .filter(Boolean);
      return names.join(", ");
    };

    const search = (refs.searchInput?.value || "").toLowerCase();
    const filterFamily = refs.familyFilter?.value || "";
    const filterProducerId = refs.producerFilter?.value || "";
    const filterStoreId = refs.storeFilter?.value || "";

    tableBody.innerHTML = "";
    let items = instances.slice();

    // Enriquecer con familia calculada (y actualizar instancia en memoria)
    items = items.map((inst) => {
      const lower = (inst.productName || "").trim().toLowerCase();
      const matchById = inst.productId ? productById.get(inst.productId) : null;
      const matchByName = lower ? productByName.get(lower) : null;
      const family =
        inst.block ||
        (matchById && matchById.block) ||
        (matchByName && matchByName.block) ||
        getFamilyForInstance(inst);
      if (family && !inst.block) inst.block = family;
      return { ...inst, block: family };
    });

    items = items.filter((inst) => {
      const family = getFamilyForInstance(inst);
      if (filterFamily && family !== filterFamily) {
        return false;
      }
      if (filterProducerId && inst.producerId !== filterProducerId) {
        return false;
      }
      if (filterStoreId) {
        if (!inst.storeIds || !inst.storeIds.includes(filterStoreId)) {
          return false;
        }
      }

      if (search) {
        const prodName = inst.productName || "";
        const producerName = producerNameFor(inst.producerId);
        const brand = inst.brand || "";
        const stores = storeNamesFor(inst.storeIds);
        const notes = inst.notes || "";
        const haystack = `${prodName} ${producerName} ${brand} ${stores} ${notes}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    });

    const stripeMap =
      typeof context.buildFamilyStripeMap === "function"
        ? context.buildFamilyStripeMap(
            items.map((inst) => ({
              block: getFamilyForInstance(inst),
            }))
          )
        : {};

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

    items.forEach((inst) => {
      const family = inst.block || getFamilyForInstance(inst) || "";
      const stripeKey = family || "__none__";
      const stripe = stripeMap[stripeKey] || 0;

      const inputName = makeInput("productName", inst.productName);
      inputName.dataset.id = inst.id;
      inputName.dataset.field = "productName";
      inputName.classList.add("product-name-input");
      inputName.setAttribute("autocomplete", "off");
      inputName.placeholder = "Escribe para buscar en tu inventario...";

      const createBtn = document.createElement("button");
      createBtn.type = "button";
      createBtn.className = "btn btn-small btn-icon";
      createBtn.textContent = "+";
      createBtn.title = "Crear producto en 'Otros productos'";
      createBtn.dataset.action = "create-product-selection";

      const familyCell = document.createElement("td");
      familyCell.className = "instances-family-cell";
      familyCell.textContent = family || "—";

      const selProducer = document.createElement("select");
      selProducer.className = "table-input";
      selProducer.dataset.field = "producerId";
      selProducer.dataset.id = inst.id;
      const producerOptions = context.data?.producers || [];
      const optNone = document.createElement("option");
      optNone.value = "";
      optNone.textContent = "Sin productor";
      selProducer.appendChild(optNone);
      producerOptions
        .slice()
        .sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" })
        )
        .forEach((p) => {
          const o = document.createElement("option");
          o.value = p.id;
          o.textContent = p.name || "(sin nombre)";
          selProducer.appendChild(o);
        });
      selProducer.value = inst.producerId || "";

      const brandInput = makeInput("brand", inst.brand || "");

      const selStores = document.createElement("select");
      selStores.className = "table-input inline-stores-select";
      selStores.multiple = true;
      selStores.dataset.field = "storeIds";
      selStores.dataset.id = inst.id;
      const storeOptions = context.data?.stores || [];
      storeOptions
        .slice()
        .sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" })
        )
        .forEach((s) => {
          const o = document.createElement("option");
          o.value = s.id;
          o.textContent = s.name || "(sin nombre)";
          o.selected = Array.isArray(inst.storeIds) && inst.storeIds.includes(s.id);
          selStores.appendChild(o);
        });

      const notesArea = makeTextarea("notes", inst.notes || "");

      let row = null;
      if (rowTemplate && window.AppComponents && typeof window.AppComponents.buildRowWithTemplate === "function") {
        row = window.AppComponents.buildRowWithTemplate({
          template: rowTemplate,
          stripe,
          dataset: { id: inst.id },
          text: {
            "[data-field='family']": family || "—",
          },
          actions: {
            "[data-role='delete']": { action: "delete-instance", id: inst.id },
            "[data-action='create-product-selection']": {
              action: "create-product-selection",
              id: inst.id,
            },
          },
          replacements: {
            "[data-slot='productName']": (() => {
              const wrap = document.createElement("div");
              wrap.className = "instances-product-cell";
              wrap.appendChild(inputName);
              wrap.appendChild(createBtn);
              return wrap;
            })(),
            "[data-slot='producer']": selProducer,
            "[data-slot='brand']": brandInput,
            "[data-slot='stores']": selStores,
            "[data-slot='notes']": notesArea,
          },
        });
      }

      if (!row) {
        row = document.createElement("tr");
        row.dataset.id = inst.id;
        row.classList.add(`family-stripe-${stripe}`);

        // Producto
        let td = document.createElement("td");
        td.appendChild(inputName);
        td.appendChild(createBtn);
        row.appendChild(td);

        // Familia
        row.appendChild(familyCell);

        // Productor
        td = document.createElement("td");
        td.appendChild(selProducer);
        row.appendChild(td);

        // Marca
        td = document.createElement("td");
        td.appendChild(brandInput);
        row.appendChild(td);

        // Tiendas
        td = document.createElement("td");
        td.appendChild(selStores);
        row.appendChild(td);

        // Notas
        td = document.createElement("td");
        td.appendChild(notesArea);
        row.appendChild(td);

        // Acciones
        td = document.createElement("td");
        const delBtn = document.createElement("button");
        delBtn.className = "btn btn-small btn-danger";
        delBtn.dataset.action = "delete-instance";
        delBtn.dataset.id = inst.id;
        delBtn.textContent = "✕";
        td.appendChild(delBtn);
        row.appendChild(td);
      }

      const familyCellEl =
        row.querySelector(".instances-family-cell") ||
        row.querySelector('[data-field="family"]');
      const createBtnEl =
        row.querySelector('[data-action="create-product-selection"]') || createBtn;
      const inputNameEl =
        row.querySelector('input[data-field="productName"]') || inputName;

      if (
        inputNameEl &&
        typeof context.isKnownProduct === "function" &&
        typeof context.getFamilyByProductName === "function"
      ) {
        const updateMissingState = () => {
          const known = context.isKnownProduct(inputNameEl.value, inst.productId);
          row.classList.toggle("instance-missing-product", !known);
          if (familyCellEl) {
            familyCellEl.textContent =
              context.getFamilyByProductName(inputNameEl.value) || "—";
          }
          if (createBtnEl) {
            createBtnEl.style.display = known ? "none" : "inline-flex";
          }
        };
        inputNameEl.addEventListener("input", updateMissingState);
        updateMissingState();
      }

      tableBody.appendChild(row);
    });

    if (typeof context.attachMultiSelectToggle === "function") {
      Array.from(tableBody.querySelectorAll('select[multiple][data-field="storeIds"]')).forEach(
        (sel) => context.attachMultiSelectToggle(sel)
      );
    }
  }

  function persistAndRender(context, list, options = {}) {
    const data = context.data || {};
    if (typeof context.persist === "function") {
      context.persist(list, options);
    }
    context.data = { ...data, instances: list };
    render(context);
    if (typeof context.onAfterSave === "function") {
      context.onAfterSave(list);
    }
  }

  function collectRows(context) {
    const refs = context.refs || {};
    const tableBody = refs.tableBody;
    if (!tableBody) return [];
    const rows = Array.from(tableBody.querySelectorAll("tr"));
    const now = getNow(context);
    const existing = context.data?.instances || [];
    const byId = new Map();
    existing.forEach((inst) => {
      if (inst && inst.id) byId.set(inst.id, inst);
    });

    for (const tr of rows) {
      const id = tr.dataset.id;
      if (!id) continue;

      const getField = (selector) => {
        const el = tr.querySelector(selector);
        return el ? el.value.trim() : "";
      };
      const getStoreIds = () => {
        const sel = tr.querySelector('select[data-field="storeIds"]');
        if (!sel) return [];
        return Array.from(sel.selectedOptions)
          .map((o) => o.value)
          .filter(Boolean);
      };

    const productName = getField('input[data-field="productName"]');
    const producerId = getField('select[data-field="producerId"]');
    const brand = getField('input[data-field="brand"]');
    const storeIds = getStoreIds();
    const notes = getField('textarea[data-field="notes"]');
    const filterFamily = refs.familyFilter?.value || "";
    const block = prev.block || filterFamily;

      // Si la fila está vacía y ya existía, la conservamos intacta.
      if (
        !productName &&
        !producerId &&
        !brand &&
        storeIds.length === 0 &&
        !notes &&
        byId.has(id)
      ) {
        continue;
      }

      const prev = byId.get(id) || {};
      const createdAt = prev.createdAt || now;

      byId.set(id, {
        id,
        productId: prev.productId || "",
        productName,
        producerId,
        brand,
        storeIds,
        notes,
        block,
        createdAt,
        updatedAt: now,
      });
    }

    // Reconstruir la lista manteniendo el orden previo y agregando nuevos al frente.
    const ordered = [];
    existing.forEach((inst) => {
      const updated = byId.get(inst.id);
      if (updated) {
        ordered.push(updated);
        byId.delete(inst.id);
      }
    });
    // Nuevos (no estaban antes): al principio para que se vean arriba.
    Array.from(byId.values()).forEach((inst) => {
      if (!existing.find((e) => e.id === inst.id)) {
        ordered.unshift(inst);
      }
    });

    return ordered;
  }

  function addRow(c) {
    const context = getCtx(c);
    const refs = context.refs || {};
    const tableBody = refs.tableBody;
    if (!tableBody) return;

    if (
      tableBody.children.length === 1 &&
      !tableBody.children[0].dataset.id
    ) {
      tableBody.innerHTML = "";
    }

    const now = getNow(context);
    const id =
      (crypto.randomUUID ? crypto.randomUUID() : "inst-" + Date.now()) +
      "-" +
      Math.random().toString(36).slice(2);

    const inst = {
      id,
      productId: "",
      productName: "",
      producerId: refs.producerFilter?.value || "",
      brand: "",
      storeIds: refs.storeFilter?.value ? [refs.storeFilter.value] : [],
      notes: "",
      block: refs.familyFilter?.value || "",
      createdAt: now,
      updatedAt: now,
    };

    const data = context.data || {};
    const nextData = { ...data, instances: [inst, ...(data.instances || [])] };
    context.data = nextData;
    render(context);
  }

  function handleClick(e) {
    let target = e.target;
    if (
      (!target.dataset || (!target.dataset.action && !target.dataset.role)) &&
      typeof target.closest === "function"
    ) {
      target = target.closest("button,[data-action],[data-role]") || target;
    }
    const roleActionMap = { delete: "delete-instance" };
    const action = target.dataset.action || roleActionMap[target.dataset.role];
    if (!action) return;
    if (action === "delete-instance") {
      const tr = target.closest("tr");
      if (!tr) return;
      const id = target.dataset.id || tr.dataset.id;
      const current = (getCtx().data?.instances || []).filter((i) => i.id !== id);
      persistAndRender(getCtx(), current, { allowClear: true });
    } else if (action === "create-product-selection") {
      if (typeof getCtx().onCreateProduct === "function") {
        const tr = target.closest("tr");
        getCtx().onCreateProduct(tr);
      }
    }
  }

  function save(c) {
    const context = getCtx(c);
    const list = collectRows(context);
    persistAndRender(context, list, { allowClear: true });
  }

  function bindFilters(context) {
    const refs = context.refs || {};
    const handle =
      window.AppUtils && typeof window.AppUtils.debounce === "function"
        ? window.AppUtils.debounce(() => render(context), 120)
        : () => render(context);
    refs.searchInput?.addEventListener("input", handle);
    refs.familyFilter?.addEventListener("change", handle);
    refs.producerFilter?.addEventListener("change", handle);
    refs.storeFilter?.addEventListener("change", handle);
  }

  function init(c) {
    ctx = c;
    const context = getCtx(c);
    const refs = context.refs || {};
    bindFilters(context);
    refs.addButton?.addEventListener("click", () => addRow());
    refs.saveButton?.addEventListener("click", () => save());
    refs.tableBody?.addEventListener("click", handleClick);
    render(context);
  }

  window.InstancesView = { init, render, addRow, save };
})();
