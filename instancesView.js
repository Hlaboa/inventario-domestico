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
    if (!tableBody) return;

    const {
      instances = [],
      getFamilyForInstance = () => "",
      getProducerName = () => "",
      getStoreNames = () => "",
    } = context.data || {};

    const search = (refs.searchInput?.value || "").toLowerCase();
    const filterFamily = refs.familyFilter?.value || "";
    const filterProducerId = refs.producerFilter?.value || "";
    const filterStoreId = refs.storeFilter?.value || "";

    tableBody.innerHTML = "";
    let items = instances.slice();

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
        const producerName = getProducerName(inst.producerId);
        const brand = inst.brand || "";
        const stores = getStoreNames(inst.storeIds);
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
      const tr = document.createElement("tr");
      tr.dataset.id = inst.id;
      const stripeKey = getFamilyForInstance(inst) || "__none__";
      const stripe = stripeMap[stripeKey] || 0;
      tr.classList.add(`family-stripe-${stripe}`);

      // Producto
      let td = document.createElement("td");
      const inputName = makeInput("productName", inst.productName);
      inputName.dataset.id = inst.id;
      inputName.dataset.field = "productName";
      inputName.setAttribute("list", "productsDatalist");
      inputName.classList.add("product-name-input");
      inputName.setAttribute("autocomplete", "off");
      inputName.placeholder = "Escribe para buscar en tu inventario...";
      td.appendChild(inputName);
      const createBtn = document.createElement("button");
      createBtn.type = "button";
      createBtn.className = "btn btn-small btn-icon";
      createBtn.textContent = "+";
      createBtn.title = "Crear producto en 'Otros productos'";
      createBtn.dataset.action = "create-product-selection";
      td.appendChild(createBtn);
      tr.appendChild(td);

      // Familia
      td = document.createElement("td");
      td.className = "instances-family-cell";
      td.textContent = getFamilyForInstance(inst) || "—";
      tr.appendChild(td);
      if (
        typeof context.isKnownProduct === "function" &&
        typeof context.getFamilyByProductName === "function"
      ) {
        const updateMissingState = () => {
          const known = context.isKnownProduct(inputName.value, inst.productId);
          tr.classList.toggle("instance-missing-product", !known);
          td.textContent = context.getFamilyByProductName(inputName.value) || "—";
          if (createBtn) {
            createBtn.style.display = known ? "none" : "inline-flex";
          }
        };
        inputName.addEventListener("input", updateMissingState);
        updateMissingState();
      }

      // Productor
      td = document.createElement("td");
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
      td.appendChild(selProducer);
      tr.appendChild(td);

      // Marca
      td = document.createElement("td");
      td.appendChild(makeInput("brand", inst.brand || ""));
      tr.appendChild(td);

      // Tiendas
      td = document.createElement("td");
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
      td.appendChild(selStores);
      tr.appendChild(td);

      // Notas
      td = document.createElement("td");
      td.appendChild(makeTextarea("notes", inst.notes || ""));
      tr.appendChild(td);

      // Acciones
      td = document.createElement("td");
      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-small btn-danger";
      delBtn.dataset.action = "delete-instance";
      delBtn.dataset.id = inst.id;
      delBtn.textContent = "✕";
      td.appendChild(delBtn);
      tr.appendChild(td);

      tableBody.appendChild(tr);
    });

    if (typeof context.attachMultiSelectToggle === "function") {
      Array.from(tableBody.querySelectorAll('select[multiple][data-field="storeIds"]')).forEach(
        (sel) => context.attachMultiSelectToggle(sel)
      );
    }
  }

  function persistAndRender(context, list) {
    const data = context.data || {};
    if (typeof context.persist === "function") {
      context.persist(list);
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
    const list = [];
    const now = getNow(context);
    const existing = context.data?.instances || [];

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

      if (!productName && !producerId && !brand && storeIds.length === 0 && !notes) {
        continue;
      }

      const prev = existing.find((i) => i.id === id) || {};
      const createdAt = prev.createdAt || now;

      list.push({
        id,
        productId: prev.productId || "",
        productName,
        producerId,
        brand,
        storeIds,
        notes,
        createdAt,
        updatedAt: now,
      });
    }

    return list;
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
      producerId: "",
      brand: "",
      storeIds: [],
      notes: "",
      createdAt: now,
      updatedAt: now,
    };

    const data = context.data || {};
    const nextData = { ...data, instances: [inst, ...(data.instances || [])] };
    context.data = nextData;
    render(context);
  }

  function handleClick(e) {
    const target = e.target;
    const action = target.dataset.action;
    if (!action) return;
    if (action === "delete-instance") {
      const tr = target.closest("tr");
      if (!tr) return;
      const id = tr.dataset.id;
      const current = (getCtx().data?.instances || []).filter(
        (i) => i.id !== id
      );
      persistAndRender(getCtx(), current);
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
    persistAndRender(context, list);
  }

  function bindFilters(context) {
    const refs = context.refs || {};
    const handle = () => render(context);
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
