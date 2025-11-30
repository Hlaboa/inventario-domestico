(() => {
  let ctx = null;
  const rowMap = new Map();
  const hashMap = new Map();
  let stripeCacheKey = "";
  let stripeCache = {};
  let filtersActive = false;
  let lastEditTs = 0;

  const stripeClassRegex = /^family-stripe-/;

  const getCtx = (c) => c || ctx || {};
  const getNow = (c) =>
    (c && typeof c.nowIsoString === "function"
      ? c.nowIsoString()
      : new Date().toISOString());

  function getStripeMap(context, items, getFamilyForInstance) {
    const signature = items
      .map((inst) => ((getFamilyForInstance(inst) || "").trim() || "__none__"))
      .join("|");
    if (signature === stripeCacheKey && stripeCache) return stripeCache;
    stripeCacheKey = signature;
    stripeCache =
      typeof context.buildFamilyStripeMap === "function"
        ? context.buildFamilyStripeMap(items.map((inst) => ({ block: getFamilyForInstance(inst) })))
        : {};
    return stripeCache || {};
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

  function getRowHash(inst) {
    const storeIds = Array.isArray(inst.storeIds) ? inst.storeIds.join(",") : "";
    return [
      inst.id,
      inst.productId,
      inst.productName,
      inst.producerId,
      inst.brand,
      inst.block,
      storeIds,
      inst.notes,
    ].join("||");
  }

  function shouldDeferRender(context) {
    const refs = context.refs || {};
    const active = document.activeElement;
    if (!active || !refs.tableBody) return false;
    if (!refs.tableBody.contains(active)) return false;
    const now = Date.now();
    if (now - lastEditTs < 450) return true;
    return false;
  }

  function render(c) {
    const context = getCtx(c);
    const refs = context.refs || {};
    const tableBody = refs.tableBody;
    const rowTemplate = refs.rowTemplate;
    if (!tableBody) return;
    if (shouldDeferRender(context)) return;
    if (context.__skipNextRender) {
      context.__skipNextRender = false;
      return;
    }

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

    const existingRows = new Map();
    tableBody.querySelectorAll("tr[data-id]").forEach((tr) => {
      if (tr.dataset.id) existingRows.set(tr.dataset.id, tr);
    });

    let items = instances
      .slice()
      .sort((a, b) => {
        const famA = (a.block || getFamilyForInstance(a) || "").toLowerCase();
        const famB = (b.block || getFamilyForInstance(b) || "").toLowerCase();
        const cmpFam = famA.localeCompare(famB, "es", { sensitivity: "base" });
        if (cmpFam !== 0) return cmpFam;
        return (a.productName || "").localeCompare(b.productName || "", "es", {
          sensitivity: "base",
        });
      });

    // Enriquecer con familia calculada (y actualizar instancia en memoria)
    items = items.map((inst) => {
      const lower = (inst.productName || "").trim().toLowerCase();
      const matchById = inst.productId ? productById.get(inst.productId) : null;
      const matchByName = lower ? productByName.get(lower) : null;
      const idMatchesName =
        !!(matchById && lower && (matchById.name || "").trim().toLowerCase() === lower);
      const family =
        inst.block ||
        (matchByName && matchByName.block) ||
        (idMatchesName && matchById && matchById.block) ||
        getFamilyForInstance(inst);
      if (family && !inst.block) inst.block = family;
      return { ...inst, block: family };
    });

    const stripeMap = getStripeMap(context, items, getFamilyForInstance);

    const frag = document.createDocumentFragment();
    const nextRowMap = new Map();
    const nextHashMap = new Map();

    const buildStoreSelector = (inst) => {
      const selStores = document.createElement("select");
      selStores.className = "table-input inline-stores-select visually-hidden";
      selStores.multiple = true;
      selStores.dataset.field = "storeIds";
      selStores.dataset.id = inst.id;
      const storeOptions = context.data?.stores || [];
      const getOptions = () =>
        Array.from(
          (selStores && (selStores.options || selStores.children)) || []
        );
      const getSelectedOptions = () => {
        const opts = selStores ? selStores.selectedOptions : null;
        if (opts && typeof opts.length !== "undefined" && opts.length > 0) {
          return Array.from(opts);
        }
        return getOptions().filter((o) => o && o.selected);
      };
      storeOptions
        .slice()
        .sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "es", {
            sensitivity: "base",
          })
        )
        .forEach((s) => {
          const o = document.createElement("option");
          o.value = s.id;
          o.textContent = s.name || "(sin nombre)";
          o.selected = Array.isArray(inst.storeIds) && inst.storeIds.includes(s.id);
          selStores.appendChild(o);
        });

      const chips = document.createElement("div");
      chips.className = "inline-store-chips instances-store-chips";
      const renderChips = () => {
        const selectedIds = new Set(getSelectedOptions().map((o) => o.value));
        chips.innerHTML = "";
        storeOptions
          .slice()
          .sort((a, b) =>
            (a.name || "").localeCompare(b.name || "", "es", {
              sensitivity: "base",
            })
          )
          .forEach((s) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "store-chip-toggle";
            chip.textContent = s.name || "(sin nombre)";
            chip.dataset.id = s.id;
            const isSelected = selectedIds.has(s.id);
            chip.classList.toggle("selected", isSelected);
            chip.addEventListener("click", () => {
              const opt = getOptions().find((o) => o.value === s.id);
              if (opt) {
                opt.selected = !opt.selected;
                selStores.dispatchEvent(new Event("change", { bubbles: true }));
              }
            });
            chips.appendChild(chip);
          });
      };
      selStores.addEventListener("change", renderChips);
      renderChips();

      const wrapper = document.createElement("div");
      wrapper.className = "stores-chip-wrapper instances-stores-wrapper";
      wrapper.appendChild(selStores);
      wrapper.appendChild(chips);

      return { wrapper, selStores };
    };

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
      const hash = getRowHash(inst);
      const existing = existingRows.get(inst.id);
      let row = existing && hashMap.get(inst.id) === hash ? existing : null;
      if (row) {
        existingRows.delete(inst.id);
      }
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
  createBtn.setAttribute("aria-label", "Crear producto en 'Otros productos'");
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

      const { wrapper: storesWrapper, selStores } = buildStoreSelector(inst);

      const notesArea = makeTextarea("notes", inst.notes || "");
      notesArea.classList.add("instances-notes-input");

      if (!row && rowTemplate && window.AppComponents && typeof window.AppComponents.buildRowWithTemplate === "function") {
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
              wrap.className = "instances-product-wrap";
              wrap.appendChild(inputName);
              wrap.appendChild(createBtn);
              return wrap;
            })(),
            "[data-slot='producer']": selProducer,
            "[data-slot='brand']": brandInput,
            "[data-slot='stores']": storesWrapper,
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
        td.classList.add("instances-product-cell");
        const wrap = document.createElement("div");
        wrap.className = "instances-product-wrap";
        wrap.appendChild(inputName);
        wrap.appendChild(createBtn);
        td.appendChild(wrap);
        row.appendChild(td);

        // Familia
        row.appendChild(familyCell);

        // Productor
        td = document.createElement("td");
        td.appendChild(selProducer);
        td.classList.add("instances-producer-cell");
        row.appendChild(td);

        // Marca
        td = document.createElement("td");
        td.appendChild(brandInput);
        row.appendChild(td);

        // Tiendas
        td = document.createElement("td");
        td.classList.add("instances-stores-cell");
        td.appendChild(storesWrapper);
        row.appendChild(td);

        // Notas
        td = document.createElement("td");
        td.appendChild(notesArea);
        td.classList.add("instances-notes-cell");
        row.appendChild(td);

        // Acciones
        td = document.createElement("td");
        const delBtn = document.createElement("button");
        delBtn.className = "btn btn-small btn-danger btn-trash";
        delBtn.dataset.action = "delete-instance";
        delBtn.dataset.id = inst.id;
        delBtn.textContent = "🗑";
        delBtn.title = "Eliminar selección";
        delBtn.setAttribute("aria-label", "Eliminar selección");
        td.appendChild(delBtn);
        row.appendChild(td);
      }

      applyStripe(row, stripe);
      row.dataset.family = family || "";
      row.dataset.producerId = inst.producerId || "";
        row.dataset.storeIds = Array.isArray(inst.storeIds) ? inst.storeIds.join(",") : "";
        row.dataset.isNew = inst.__isNew ? "1" : "";

        const familyCellEl =
          row.querySelector(".instances-family-cell") ||
          row.querySelector('[data-field="family"]');
      const createBtnEl =
        row.querySelector('[data-action="create-product-selection"]') || createBtn;
      const inputNameEl =
        row.querySelector('input[data-field="productName"]') || inputName;
      const notesCellEl =
        (notesArea && notesArea.closest && notesArea.closest("td")) ||
        row.querySelector(".instances-notes-cell");
      if (notesCellEl) notesCellEl.classList.add("instances-notes-cell");
      if (row.querySelector(".instances-stores-cell") === null) {
        const storesCell = (storesWrapper && storesWrapper.closest && storesWrapper.closest("td")) || null;
        if (storesCell) storesCell.classList.add("instances-stores-cell");
      }
      const productCellEl =
        (inputName && inputName.closest && inputName.closest("td")) ||
        row.querySelector(".instances-product-cell") ||
        (row.querySelector("td") || null);
      if (productCellEl) productCellEl.classList.add("instances-product-cell");
      const producerCellEl =
        (selProducer && selProducer.closest && selProducer.closest("td")) ||
        row.querySelector(".instances-producer-cell");
      if (producerCellEl) producerCellEl.classList.add("instances-producer-cell");
      const deleteBtnEl =
        row.querySelector('[data-action="delete-instance"]') ||
        row.querySelector('[data-role="delete"]');
      if (deleteBtnEl) {
        deleteBtnEl.classList.add("btn", "btn-small", "btn-danger", "btn-trash");
        deleteBtnEl.textContent = "🗑";
        deleteBtnEl.title = deleteBtnEl.title || "Eliminar selección";
        deleteBtnEl.setAttribute("aria-label", deleteBtnEl.getAttribute("aria-label") || "Eliminar selección");
      }

      if (inputNameEl) {
        const getFamilyForName = (name) => {
          const lower = (name || "").trim().toLowerCase();
          const prodById = inst.productId ? productById.get(inst.productId) : null;
          const prodByName = lower ? productByName.get(lower) : null;
          const idMatchesName =
            !!(prodById && lower && (prodById.name || "").trim().toLowerCase() === lower);
          if (idMatchesName && prodById && prodById.block) return prodById.block;
          if (prodByName && prodByName.block) return prodByName.block;
          if (!lower && prodById && prodById.block) return prodById.block;
          if (typeof context.getFamilyByProductName === "function") {
            return context.getFamilyByProductName(name) || "";
          }
          return "";
        };
        const isKnown = (name) => {
          const lower = (name || "").trim().toLowerCase();
          const prodById = inst.productId ? productById.get(inst.productId) : null;
          const idMatchesName =
            !!(prodById && lower && (prodById.name || "").trim().toLowerCase() === lower);
          const hasByName = lower && productByName.has(lower);
          const helperKnown =
            typeof context.isKnownProduct === "function"
              ? context.isKnownProduct(name, inst.productId)
              : false;
          return !!((idMatchesName && prodById) || hasByName || helperKnown);
        };
        const updateMissingState = () => {
          const known = isKnown(inputNameEl.value);
          row.classList.toggle("instance-missing-product", !known);
          row.dataset.missing = known ? "0" : "1";
          if (familyCellEl) {
            const famText = getFamilyForName(inputNameEl.value) || "—";
            familyCellEl.textContent = famText;
          }
          if (createBtnEl) {
            createBtnEl.style.display = known ? "none" : "inline-flex";
          }
        };
        if (inputNameEl.__missingHandler) {
          inputNameEl.removeEventListener("input", inputNameEl.__missingHandler);
        }
        inputNameEl.__missingHandler = updateMissingState;
        inputNameEl.addEventListener("input", updateMissingState);
        updateMissingState();
      }

      frag.appendChild(row);
      nextRowMap.set(inst.id, row);
      nextHashMap.set(inst.id, hash);
    });

    existingRows.forEach((row) => row.remove());

    rowMap.clear();
    nextRowMap.forEach((row, id) => rowMap.set(id, row));
    hashMap.clear();
    nextHashMap.forEach((hash, id) => hashMap.set(id, hash));

    tableBody.appendChild(frag);
    context.__lastItemsCount = items.length;

    if (typeof context.attachMultiSelectToggle === "function") {
      Array.from(tableBody.querySelectorAll('select[multiple][data-field="storeIds"]')).forEach(
        (sel) => {
          if (sel.dataset.enhanced === "1") return;
          context.attachMultiSelectToggle(sel);
          sel.dataset.enhanced = "1";
        }
      );
    }

    filterRows(context);
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
        const opts =
          (sel.selectedOptions && sel.selectedOptions.length
            ? Array.from(sel.selectedOptions)
            : Array.from(sel.options || sel.children || [])) || [];
        return opts
          .filter((o) => !sel.selectedOptions || sel.selectedOptions.length ? true : o.selected)
          .map((o) => o.value)
          .filter(Boolean);
      };

    const productName = getField('input[data-field="productName"]');
    const producerId = getField('select[data-field="producerId"]');
    const brand = getField('input[data-field="brand"]');
    const storeIds = getStoreIds();
    const notes = getField('textarea[data-field="notes"]');
    const filterFamily = refs.familyFilter?.value || "";
    const prev = byId.get(id) || {};
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
    if (context._addingRow) return;
    context._addingRow = true;
    setTimeout(() => {
      context._addingRow = false;
    }, 0);
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
      __isNew: true,
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
      const ok =
        typeof window.confirm === "function"
          ? window.confirm("¿Eliminar esta selección?")
          : true;
      if (!ok) return;
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

  function filterRows(context) {
    const ctx = getCtx(context);
    const refs = ctx.refs || {};
    const tableBody = refs.tableBody;
    if (!tableBody) return;
    const search = (refs.searchInput?.value || "").toLowerCase();
    const filterFamily = refs.familyFilter?.value || "";
    const filterProducerId = refs.producerFilter?.value || "";
    const filterStoreId = refs.storeFilter?.value || "";

    const rows = Array.from(tableBody.querySelectorAll("tr"));
    const hasFilters = !!(search || filterFamily || filterProducerId || filterStoreId);
    filtersActive = hasFilters;
    rows.forEach((row) => {
      const name =
        (row.querySelector('input[data-field="productName"]')?.value || "").toLowerCase();
      const brand =
        (row.querySelector('input[data-field="brand"]')?.value || "").toLowerCase();
      const notes =
        (row.querySelector('textarea[data-field="notes"]')?.value || "").toLowerCase();
      const family =
        (row.querySelector('[data-field="family"]')?.textContent || "").trim() ||
        row.dataset.family ||
        "";
      const producerId =
        row.querySelector('select[data-field="producerId"]')?.value || "";
      const producerName =
        row
          .querySelector('select[data-field="producerId"] option:checked')
          ?.textContent?.toLowerCase() || "";
      const storeSelect = row.querySelector('select[data-field="storeIds"]');
      const storeIds = storeSelect
        ? Array.from(storeSelect.selectedOptions || []).map((o) => o.value)
        : [];
      const storeNames = storeSelect
        ? Array.from(storeSelect.selectedOptions || []).map((o) => o.textContent || "")
        : [];

      if (row.dataset.isNew === "1") {
        row.style.display = "";
        return;
      }

      let visible = true;
      if (hasFilters) {
        if (filterFamily && family !== filterFamily) visible = false;
        if (visible && filterProducerId && producerId !== filterProducerId) visible = false;
        if (visible && filterStoreId && !storeIds.includes(filterStoreId)) visible = false;
        if (visible && search) {
          const haystack = `${name} ${brand} ${notes} ${family} ${producerName} ${storeNames.join(" ")}`.toLowerCase();
          if (!haystack.includes(search)) visible = false;
        }
      }
      row.style.display = visible ? "" : "none";
    });

    if (refs.summary) {
      const rowCount = rows.filter((tr) => tr.dataset.id).length;
      const total = Array.isArray(context.data?.instances)
        ? context.data.instances.length || rowCount
        : typeof context.__lastItemsCount === "number"
        ? context.__lastItemsCount || rowCount
        : rowCount;
      const visible = rows.filter((tr) => tr.style.display !== "none" && tr.dataset.id).length;
      const filtered = hasFilters || visible !== total;
      refs.summary.textContent = `Total: ${total}${filtered ? ` · Visibles: ${visible}` : ""}`;
    }
  }

  function bindFilters(context) {
    const refs = context.refs || {};
    const handle =
      window.AppUtils && typeof window.AppUtils.debounce === "function"
        ? window.AppUtils.debounce(() => filterRows(context), 120)
        : () => filterRows(context);
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
    const refilterOnEdit =
      window.AppUtils && typeof window.AppUtils.debounce === "function"
        ? window.AppUtils.debounce(() => filterRows(context), 120)
        : () => filterRows(context);
    refs.addButton?.addEventListener("click", () => addRow());
    refs.saveButton?.addEventListener("click", () => save());
    refs.tableBody?.addEventListener("click", handleClick);
    const markEdit = () => {
      lastEditTs = Date.now();
    };
    refs.tableBody?.addEventListener("input", refilterOnEdit);
    refs.tableBody?.addEventListener("input", markEdit);
    refs.tableBody?.addEventListener("keydown", markEdit);
    refs.tableBody?.addEventListener("change", refilterOnEdit);
    render(context);
  }

  window.InstancesView = { init, render, addRow, save };
})();
