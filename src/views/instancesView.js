(() => {
  let ctx = null;
  const rowMap = new Map();
  const hashMap = new Map();
  let stripeCacheKey = "";
  let stripeCache = {};
  let filtersActive = false;
  let lastEditTs = 0;
  let currentScrollHandler = null;
  const stripeClassRegex = /^family-stripe-/;
  const storeNamesSep = " · ";
  const DEFAULT_ROW_HEIGHT = 64;
  const BUFFER_ROWS = 1;
  const FULL_RENDER_THRESHOLD = 320;
  const scrollSelector = ".table-scroll";

  const getCtx = (c) => c || ctx || {};
  const getNow = (c) =>
    (c && typeof c.nowIsoString === "function"
      ? c.nowIsoString()
      : new Date().toISOString());

  const removeScrollHandler = () => {
    if (currentScrollHandler) {
      window.removeEventListener("scroll", currentScrollHandler);
      currentScrollHandler = null;
    }
  };

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

  function getSelectedStoreData(sel) {
    if (!sel) return { ids: [], names: [], namesLower: "" };
    const opts = sel.selectedOptions && sel.selectedOptions.length
      ? Array.from(sel.selectedOptions)
      : Array.from(sel.options || sel.children || []);
    const ids = [];
    const names = [];
    opts.forEach((o) => {
      if (!o || !o.selected) return;
      const id = o.value;
      if (id) ids.push(id);
      const name = (o.textContent || "").trim();
      if (name) names.push(name);
    });
    const namesLower = names.map((n) => n.toLowerCase()).join(storeNamesSep);
    return { ids, names, namesLower };
  }

  function hydrateRowDataset(row, refs = {}) {
    if (!row) return;
    const { inputNameEl, brandInput, notesArea, selProducer, selStores, familyCellEl } = refs;
    if (inputNameEl) {
      row.dataset.name = (inputNameEl.value || "").trim().toLowerCase();
    }
    if (brandInput) {
      row.dataset.brand = (brandInput.value || "").trim().toLowerCase();
    }
    if (notesArea) {
      row.dataset.notes = (notesArea.value || "").trim().toLowerCase();
    }
    if (familyCellEl) {
      const famText = (familyCellEl.textContent || "").trim();
      row.dataset.family = famText;
    }
    if (selProducer) {
      row.dataset.producerId = selProducer.value || "";
      const name =
        selProducer.options && selProducer.selectedIndex >= 0
          ? (selProducer.options[selProducer.selectedIndex].textContent || "").trim()
          : "";
      row.dataset.producerName = (name || "").toLowerCase();
    }
    if (selStores) {
      const { ids, namesLower } = getSelectedStoreData(selStores);
      row.dataset.storeIds = ids.join(",");
      row.dataset.storeNames = namesLower;
    }
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
    const sortedProducers = producersList
      .slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" }));
    const sortedStores = storesList
      .slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" }));
    const producerSignature = sortedProducers.map((p) => `${p.id || ""}::${p.name || ""}`).join("|");
    const storeSignature = sortedStores.map((s) => `${s.id || ""}::${s.name || ""}`).join("|");
    const producerById = new Map(sortedProducers.map((p) => [p.id, p]));
    const producerOptionsHtml = sortedProducers
      .map((p) => `<option value="${p.id}">${p.name || "(sin nombre)"}</option>`)
      .join("");
    const storeById = new Map(sortedStores.map((s) => [s.id, s]));
    const storeOptionsHtml = sortedStores
      .map((s) => `<option value="${s.id}">${s.name || "(sin nombre)"}</option>`)
      .join("");
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
          const store = storeById.get(id);
          return store ? store.name || "" : "";
        })
        .filter(Boolean);
      return names.join(", ");
    };

    // Renderizamos siempre limpio para respetar el orden por familia
    tableBody.innerHTML = "";
    rowMap.clear();
    hashMap.clear();
    removeScrollHandler();
    context.__pageSize = 20;

    const normalized = instances.slice().map((inst) => {
      const familyRaw = inst.block || getFamilyForInstance(inst) || "";
      const lower = (inst.productName || "").trim().toLowerCase();
      const matchById = inst.productId ? productById.get(inst.productId) : null;
      const matchByName = lower ? productByName.get(lower) : null;
      const idMatchesName =
        !!(matchById && lower && (matchById.name || "").trim().toLowerCase() === lower);
      const familyResolved =
        familyRaw ||
        (matchByName && matchByName.block) ||
        (idMatchesName && matchById && matchById.block) ||
        "";
      const family = (familyResolved || "").trim();

      const producerName =
        (inst.producerName || "").trim() ||
        (inst.producerId ? (producerById.get(inst.producerId)?.name || "") : "") ||
        getProducerName(inst.producerId) ||
        "";
      const storeNames = storeNamesFor(inst.storeIds);
      const haystack = [
        inst.productName || "",
        inst.brand || "",
        inst.notes || "",
        family || "",
        producerName,
        storeNames,
      ]
        .join(" ")
        .toLowerCase();

      const knownFromId = inst.productId ? productById.get(inst.productId) : null;
      const knownFromName = matchByName;
      const knownFromHelper =
        typeof context.isKnownProduct === "function"
          ? context.isKnownProduct(inst.productName, inst.productId)
          : false;
      const missing = !(knownFromId || knownFromName || knownFromHelper);

      return {
        ...inst,
        block: family || inst.block || "",
        __familySort: (family || "__none__").toLowerCase(),
        __producerName: producerName,
        __storeNames: storeNames,
        __haystack: haystack,
        __missing: missing ? "1" : "0",
      };
    });
    const sortByFamilyProduct = (a, b) => {
      const cmpFam = (a.__familySort || "").localeCompare(b.__familySort || "", "es", {
        sensitivity: "base",
      });
      if (cmpFam !== 0) return cmpFam;
      return (a.productName || "").localeCompare(b.productName || "", "es", {
        sensitivity: "base",
      });
    };
    const items = normalized.sort(sortByFamilyProduct);
    context.__normKey = null;
    context.__normalized = items;
    if (context.data) {
      context.data.instances = items.slice();
      context.__currentItems = items.slice();
      context.__filteredItems = null;
    }

    const filterSearch = (refs.searchInput?.value || "").toLowerCase();
    const filterFamily = refs.familyFilter?.value || "";
    const filterProducerId = refs.producerFilter?.value || "";
    const filterStoreId = refs.storeFilter?.value || "";
    const filterMissing =
      typeof context.getMissingFilterActive === "function"
        ? !!context.getMissingFilterActive()
        : false;
    const filterSignature = `${filterSearch}|${filterFamily}|${filterProducerId}|${filterStoreId}|${filterMissing}`;
    if (context.__lastFilterSignature !== filterSignature) {
      context.__lastFilterSignature = filterSignature;
      context.__pageIndex = 0;
      context.__forceScrollTop = true;
    }
    const matchesFilters = (inst) => {
      if (!inst) return false;
      if (filterFamily && (inst.block || "") !== filterFamily) return false;
      if (filterProducerId && (inst.producerId || "") !== filterProducerId) return false;
      if (filterStoreId) {
        const ids = Array.isArray(inst.storeIds) ? inst.storeIds : [];
        if (!ids.includes(filterStoreId)) return false;
      }
      if (filterMissing && inst.__missing !== "1") return false;
      if (filterSearch) {
        const hay = inst.__haystack || "";
        if (!hay.includes(filterSearch)) return false;
      }
      return true;
    };

    const filteredItems = items.filter((inst) => matchesFilters(inst));
    context.__filteredItems = filteredItems.slice();

    const stripeMap = getStripeMap(context, filteredItems.slice(0, BUFFER_ROWS * 2 + 100), getFamilyForInstance);

    const frag = document.createDocumentFragment();
    const nextRowMap = new Map();
    const nextHashMap = new Map();
    const shouldRenderChips = filteredItems.length <= 120;

    const buildStoreSelector = (inst) => {
      const selStores = document.createElement("select");
      selStores.className = "table-input inline-stores-select visually-hidden";
      selStores.setAttribute("aria-hidden", "true");
      selStores.tabIndex = -1;
      selStores.multiple = true;
      selStores.dataset.field = "storeIds";
      selStores.dataset.id = inst.id;
      let optionsLoaded = false;
      const ensureOptions = () => {
        if (optionsLoaded) return;
        selStores.innerHTML = storeOptionsHtml;
        Array.from(selStores.options || []).forEach((o) => {
          o.selected = Array.isArray(inst.storeIds) && inst.storeIds.includes(o.value);
        });
        optionsLoaded = true;
      };
      const getOptions = () =>
        Array.from((selStores && (selStores.options || selStores.children)) || []);
      const getSelectedOptions = () => {
        ensureOptions();
        const opts = selStores ? selStores.selectedOptions : null;
        if (opts && typeof opts.length !== "undefined" && opts.length > 0) {
          return Array.from(opts);
        }
        return getOptions().filter((o) => o && o.selected);
      };

      const wrapper = document.createElement("div");
      wrapper.className = "stores-chip-wrapper instances-stores-wrapper";
      wrapper.appendChild(selStores);

      const summary = document.createElement("div");
      summary.className = "instances-stores-summary";
      const renderSummary = () => {
        const names = Array.isArray(inst.storeIds)
          ? inst.storeIds
              .map((id) => (storeById.get(id)?.name || "").trim())
              .filter(Boolean)
          : [];
        summary.textContent = names.length ? names.join(" · ") : "Sin tiendas";
      };
      renderSummary();

      let chips = null;
      const renderChips = () => {
        if (!chips) return;
        ensureOptions();
        const selectedIds = new Set(getSelectedOptions().map((o) => o.value));
        chips.innerHTML = "";
        sortedStores.forEach((s) => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "store-chip-toggle";
          chip.textContent = s.name || "(sin nombre)";
          chip.dataset.id = s.id;
          const isSelected = selectedIds.has(s.id);
          chip.classList.toggle("selected", isSelected);
          chip.addEventListener("click", () => {
            ensureOptions();
            const opt = getOptions().find((o) => o.value === s.id);
            if (opt) {
              opt.selected = !opt.selected;
              selStores.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });
          chips.appendChild(chip);
        });
      };

      const ensureChips = () => {
        if (chips) return chips;
        chips = document.createElement("div");
        chips.className = "inline-store-chips instances-store-chips visually-hidden";
        chips.style.display = "none";
        renderChips();
        let escHandler = null;
        selStores.addEventListener("change", () => {
          ensureOptions();
          const selectedIds = Array.from(selStores.selectedOptions || [])
            .map((o) => o.value)
            .filter(Boolean);
          inst.storeIds = selectedIds;
          renderSummary();
          renderChips();
        });
        const hideChips = () => {
          chips.style.display = "none";
          chips.classList.add("visually-hidden");
          if (escHandler) {
            window.removeEventListener("keydown", escHandler, true);
            escHandler = null;
          }
        };
        escHandler = (e) => {
          if (e.key === "Escape") {
            hideChips();
          }
        };
        chips.__hideChips = hideChips;
        return chips;
      };

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-icon btn-ghost stores-edit-btn";
      editBtn.textContent = "✎";
      editBtn.title = "Editar tiendas";
      editBtn.setAttribute("aria-label", "Editar tiendas");
      editBtn.style.minWidth = "28px";
      editBtn.style.padding = "4px";
      editBtn.addEventListener("click", () => {
        const c = ensureChips();
        if (!wrapper.contains(c)) {
          wrapper.appendChild(c);
        }
        c.style.display = "flex";
        c.classList.remove("visually-hidden");
        if (typeof c.__hideChips === "function") {
          window.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
              c.__hideChips();
            }
          }, { once: true, capture: true });
        }
        ensureOptions();
        renderChips();
      });

      const summaryRow = document.createElement("div");
      summaryRow.className = "instances-stores-row";
      summaryRow.style.display = "flex";
      summaryRow.style.alignItems = "center";
      summaryRow.style.justifyContent = "space-between";
      summaryRow.appendChild(summary);
      summaryRow.appendChild(editBtn);

      wrapper.appendChild(summaryRow);

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

    const renderRow = (inst) => {
      const hash = getRowHash(inst);
      let row = null;
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
      selProducer.dataset.selectedProducer = inst.producerId || "";
      let producerOptionsLoaded = false;
      const ensureProducerOptions = () => {
        if (producerOptionsLoaded) return;
        selProducer.innerHTML = `<option value=\"\">Sin productor</option>${producerOptionsHtml}`;
        selProducer.value = selProducer.dataset.selectedProducer || "";
        producerOptionsLoaded = true;
      };
      // Mostrar el productor actual sin cargar todas las opciones (se completan al foco/click)
      if (!producerOptionsLoaded && inst.producerId) {
        const currentProducer = producerById.get(inst.producerId);
        if (currentProducer) {
          const opt = document.createElement("option");
          opt.value = inst.producerId;
          opt.textContent = currentProducer.name || "(sin nombre)";
          selProducer.appendChild(opt);
          selProducer.value = inst.producerId;
        }
      }
      // Carga perezosa al foco/click para reducir coste inicial
      selProducer.addEventListener("focus", ensureProducerOptions, { once: true });
      selProducer.addEventListener("click", ensureProducerOptions, { once: true });

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
            row.dataset.family = famText;
          }
          if (createBtnEl) {
            createBtnEl.style.display = known ? "none" : "inline-flex";
          }
          hydrateRowDataset(row, {
            inputNameEl,
            familyCellEl,
            brandInput,
            notesArea,
            selProducer,
            selStores,
          });
        };
        if (inputNameEl.__missingHandler) {
          inputNameEl.removeEventListener("input", inputNameEl.__missingHandler);
        }
        inputNameEl.__missingHandler = updateMissingState;
        inputNameEl.addEventListener("input", updateMissingState);
        updateMissingState();
      }

      const updateDataset = () =>
        hydrateRowDataset(row, {
          inputNameEl,
          brandInput,
          notesArea,
          selProducer,
          selStores,
          familyCellEl,
        });
      brandInput?.addEventListener("input", updateDataset);
      notesArea?.addEventListener("input", updateDataset);
      selProducer?.addEventListener("change", updateDataset);
      selStores?.addEventListener("change", updateDataset);
      updateDataset();

      return { row, hash };
    };

    const ROW_HEIGHT = context.__rowHeight || DEFAULT_ROW_HEIGHT;
    const calcWindow = () => {
      const scrollContainer = tableBody.closest(scrollSelector);
      const viewportH = scrollContainer ? scrollContainer.clientHeight : Math.min(window.innerHeight || 800, 800);
      const rawScrollTop = scrollContainer ? scrollContainer.scrollTop : Math.max(0, -(tableBody.getBoundingClientRect().top || 0));
      const maxScroll = Math.max(0, filteredItems.length * ROW_HEIGHT - viewportH);
      const scrollTop = Math.min(rawScrollTop, maxScroll);
      if (rawScrollTop !== scrollTop) {
        context.__forceScrollTop = true;
      }
      const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
      const visibleCount = Math.min(25, Math.ceil(viewportH / ROW_HEIGHT) + BUFFER_ROWS * 2);
      const endIdx = Math.min(filteredItems.length, startIdx + visibleCount);
      return { startIdx, endIdx, scrollContainer };
    };

    const renderWindow = () => {
      const useVirtual = filteredItems.length > FULL_RENDER_THRESHOLD;
      const { startIdx, endIdx } = calcWindow();
      const beforeH = startIdx * ROW_HEIGHT;
      const afterH = Math.max(0, (filteredItems.length - endIdx) * ROW_HEIGHT);

      const frag = document.createDocumentFragment();

      if (useVirtual && beforeH > 0) {
        const spacerTop = document.createElement("tr");
        spacerTop.className = "instances-spacer";
        const td = document.createElement("td");
        td.colSpan = 7;
        td.style.height = `${beforeH}px`;
        spacerTop.appendChild(td);
        frag.appendChild(spacerTop);
      }

      const slice = useVirtual ? filteredItems.slice(startIdx, endIdx) : filteredItems.slice();
      const inUse = new Set();
      slice.forEach((inst) => {
        const hash = getRowHash(inst);
        let row = rowMap.get(inst.id);
        if (!row || hashMap.get(inst.id) !== hash) {
          const built = renderRow(inst);
          row = built.row;
          hashMap.set(inst.id, built.hash);
          rowMap.set(inst.id, row);
        }
        frag.appendChild(row);
        inUse.add(inst.id);
      });

      if (useVirtual && afterH > 0) {
        const spacerBottom = document.createElement("tr");
        spacerBottom.className = "instances-spacer";
        const td = document.createElement("td");
        td.colSpan = 7;
        td.style.height = `${afterH}px`;
        spacerBottom.appendChild(td);
        frag.appendChild(spacerBottom);
      }

      tableBody.innerHTML = "";
      tableBody.appendChild(frag);

      if (slice.length && !context.__rowHeight) {
        const first = tableBody.querySelector("tr.instances-spacer ~ tr");
        if (first) {
          context.__rowHeight = first.getBoundingClientRect().height || ROW_HEIGHT;
        }
      }

      context.__lastItemsCount = filteredItems.length;

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
    };

    const scheduleWindow = () => {
      if (context.__windowRaf) return;
      context.__windowRaf = requestAnimationFrame(() => {
        context.__windowRaf = null;
        renderWindow();
      });
    };

    if (!context.__scrollBound) {
      context.__scrollBound = true;
      window.addEventListener("scroll", scheduleWindow, { passive: true });
      window.addEventListener("resize", scheduleWindow);
      const scroller = tableBody.closest(scrollSelector);
      if (scroller) {
        scroller.addEventListener("scroll", scheduleWindow, { passive: true });
      }
    }

    if (context.__forceScrollTop) {
      const scrollContainer = tableBody.closest(scrollSelector);
      if (scrollContainer && typeof scrollContainer.scrollTo === "function") {
        scrollContainer.scrollTo({ top: 0, behavior: "auto" });
      } else if (typeof window !== "undefined") {
        const top =
          (tableBody.getBoundingClientRect
            ? tableBody.getBoundingClientRect().top + (window.pageYOffset || 0)
            : 0) - 60;
        window.scrollTo({ top: Math.max(top, 0), behavior: "auto" });
      }
      context.__forceScrollTop = false;
    }

    renderWindow();

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

  function cancelNewRow(context) {
    const ctx = getCtx(context);
    const refs = ctx.refs || {};
    const tableBody = refs.tableBody;
    if (!tableBody) return;
    const rows = Array.from(tableBody.querySelectorAll("tr[data-is-new='1']"));
    if (!rows.length) return;
    const isEmptyRow = (tr) => {
      const getVal = (sel) => (tr.querySelector(sel)?.value || "").trim();
      const name = getVal("input[data-field='productName']");
      const brand = getVal("input[data-field='brand']");
      const notes = getVal("textarea[data-field='notes']");
      const selStores = tr.querySelector('select[data-field="storeIds"]');
      const stores =
        selStores && selStores.selectedOptions
          ? Array.from(selStores.selectedOptions).map((o) => o.value).filter(Boolean)
          : [];
      return !name && !brand && !notes && stores.length === 0;
    };
    const targetRow = rows.find(isEmptyRow) || rows[rows.length - 1];
    const id = targetRow?.dataset?.id;
    if (id && ctx.data && Array.isArray(ctx.data.instances)) {
      ctx.data.instances = ctx.data.instances.filter((inst) => inst.id !== id);
    }
    if (targetRow) {
      targetRow.remove();
    }
    render(ctx);
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
    const filterMissing =
      typeof ctx.getMissingFilterActive === "function" ? !!ctx.getMissingFilterActive() : false;

    const allItems =
      (ctx.__currentItems && Array.isArray(ctx.__currentItems) && ctx.__currentItems) ||
      (ctx.data && Array.isArray(ctx.data.instances) && ctx.data.instances) ||
      [];

    const hasFilters = !!(search || filterFamily || filterProducerId || filterStoreId || filterMissing);
    filtersActive = hasFilters;

    const matches = (item) => {
      if (!item) return false;
      if (filterFamily && (item.block || "") !== filterFamily) return false;
      if (filterProducerId && (item.producerId || "") !== filterProducerId) return false;
      if (filterStoreId) {
        const ids = Array.isArray(item.storeIds) ? item.storeIds : [];
        if (!ids.includes(filterStoreId)) return false;
      }
      if (filterMissing && item.__missing !== "1") return false;
      if (search) {
        const hay = item.__haystack || "";
        if (!hay.includes(search)) return false;
      }
      return true;
    };

    // Visibilidad de filas renderizadas
    const rows = Array.from(tableBody.querySelectorAll("tr"));
    rows.forEach((row) => {
      if (row.classList.contains("instances-spacer")) {
        row.style.display = "";
        return;
      }
      if (row.dataset.isNew === "1") {
        row.style.display = "";
        return;
      }
      const id = row.dataset.id;
      if (!id) return;
      const item = allItems.find((i) => i && i.id === id);
      const visible = matches(item);
      row.style.display = visible ? "" : "none";
    });

    if (refs.summary) {
      const total = allItems.length;
      const visible = allItems.filter((it) => matches(it)).length;
      const missing = allItems.filter((it) => it && it.__missing === "1").length;
      const filtered = hasFilters && visible !== total;
      const parts = [`Total: ${total}`];
      if (missing > 0) {
        parts.push(`No conciliados: ${missing}`);
      }
      if (filtered) {
        parts.push(`Visibles: ${visible}`);
      }
      refs.summary.textContent = parts.join(" · ");
    }
  }

  function bindFilters(context) {
    const refs = context.refs || {};
    const handle =
      window.AppUtils && typeof window.AppUtils.debounce === "function"
        ? window.AppUtils.debounce(() => {
            context.__forceScrollTop = true;
            render(context);
          }, 120)
        : () => {
            context.__forceScrollTop = true;
            render(context);
          };
    refs.searchInput?.addEventListener("input", handle);
    refs.familyFilter?.addEventListener("change", handle);
    refs.producerFilter?.addEventListener("change", handle);
    refs.storeFilter?.addEventListener("change", handle);

    const escHandler = (e) => {
      if (e.key === "Escape") {
        cancelNewRow(context);
      }
    };
    refs.tableBody?.addEventListener("keydown", escHandler, { capture: true });
  }

  function init(c) {
    ctx = c;
    const context = getCtx(c);
    const refs = context.refs || {};
    bindFilters(context);
    const attachButtons = context.attachButtonHandlers !== false;
    const refilterOnEdit =
      window.AppUtils && typeof window.AppUtils.debounce === "function"
        ? window.AppUtils.debounce(() => filterRows(context), 120)
        : () => filterRows(context);
    if (attachButtons) {
      refs.addButton?.addEventListener("click", () => addRow());
      refs.saveButton?.addEventListener("click", () => save());
    }
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
