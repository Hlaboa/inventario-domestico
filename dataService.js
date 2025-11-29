(() => {
  const storage = window.AppStorage || {};
  const stateStore = window.AppState;
  const utils = window.AppUtils || {};

  const nowIsoString =
    (utils && typeof utils.nowIsoString === "function"
      ? utils.nowIsoString
      : () => new Date().toISOString());

  const normalizers =
    storage.normalize ||
    {
      product: (p) => p,
      extraProduct: (p) => p,
      unifiedProduct: (p) => p,
      supplier: (p) => p,
      producer: (p) => p,
      instance: (p) => p,
      classification: (p) => p,
    };

  const storageKeys =
    storage.keys || {
      unifiedProducts: "productosCocinaUnificados",
      suppliers: "proveedoresCocina",
      producers: "productoresCocina",
      productInstances: "instanciasProductosCocina",
      classifications: "clasificacionesProductosCocina",
    };

  const saveMap = {
    unifiedProducts: storage.saveUnifiedProducts,
    suppliers: storage.saveSuppliers,
    producers: storage.saveProducers,
    productInstances: storage.saveProductInstances,
    classifications: storage.saveClassifications,
  };

  const normalizerMap = {
    unifiedProducts: normalizers.unifiedProduct,
    suppliers: normalizers.supplier,
    producers: normalizers.producer,
    productInstances: normalizers.instance,
    classifications: normalizers.classification,
  };

  const loadMap = {
    unifiedProducts: storage.loadUnifiedProducts,
    suppliers: storage.loadSuppliers,
    producers: storage.loadProducers,
    productInstances: storage.loadProductInstances,
    classifications: storage.loadClassifications,
  };

  function fallbackLoad(key, normalize) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return typeof normalize === "function"
        ? parsed.map((item) => normalize(item))
        : parsed;
    } catch {
      return [];
    }
  }

  function fallbackSave(key, list) {
    const data = Array.isArray(list) ? list : [];
    localStorage.setItem(key, JSON.stringify(data));
  }

  function normalizeList(list, normalizer) {
    if (!Array.isArray(list)) return [];
    if (typeof normalizer !== "function") return list.filter(Boolean);
    return list.map((item) => normalizer(item));
  }

  function ensureClassifications(products, extras, classifications) {
    const list = Array.isArray(classifications) ? classifications.slice() : [];
    const combos = new Set(list.map((c) => `${c.block}|||${c.type}`));
    const now = nowIsoString();

    [...products, ...extras].forEach((p) => {
      const block = (p.block || "").trim();
      const type = (p.type || "").trim();
      if (!block && !type) return;
      const key = `${block}|||${type}`;
      if (combos.has(key)) return;
      combos.add(key);
      list.push(
        normalizers.classification({
          id:
            (crypto.randomUUID
              ? crypto.randomUUID()
              : "cls-" + Math.random().toString(36).slice(2)),
          block,
          type,
          notes: "",
          createdAt: now,
          updatedAt: now,
        })
      );
    });

    return list;
  }

  function buildUnifiedList(products = [], extras = [], existing = []) {
    const now = nowIsoString();
    const map = new Map();
    const add = (item, scope) => {
      if (!item) return;
      const id =
        item.id ||
        (crypto.randomUUID
          ? crypto.randomUUID()
          : `${scope}-` + Math.random().toString(36).slice(2));
      const current = existing.find((u) => u.id === id) || {};
      map.set(id, {
        ...current,
        ...item,
        id,
        scope,
        createdAt: item.createdAt || current.createdAt || now,
        updatedAt: now,
      });
    };
    products.forEach((p) => add(p, "almacen"));
    extras.forEach((p) => add(p, "otros"));
    existing
      .filter((u) => u && u.scope && !map.has(u.id))
      .forEach((u) => map.set(u.id, u));
    return Array.from(map.values());
  }

  function loadAllFromStorage() {
    if (typeof storage.loadAllData === "function") {
      const data = storage.loadAllData();
      const unified = normalizeList(
        data.unifiedProducts || [],
        normalizers.unifiedProduct
      );
      const legacyProducts = normalizeList(data.products || [], normalizers.product);
      const legacyExtras = normalizeList(data.extraProducts || [], normalizers.extraProduct);
      const products =
        unified.length > 0
          ? unified.filter((p) => p.scope === "almacen")
          : legacyProducts;
      const extraProducts =
        unified.length > 0
          ? unified.filter((p) => p.scope === "otros")
          : legacyExtras;

      return {
        products: normalizeList(products, normalizers.product),
        extraProducts: normalizeList(extraProducts, normalizers.extraProduct),
        unifiedProducts:
          unified.length > 0
            ? unified
            : normalizeList(
                [
                  ...products.map((p) => ({ ...p, scope: "almacen" })),
                  ...extraProducts.map((p) => ({ ...p, scope: "otros" })),
                ],
                normalizers.unifiedProduct
              ),
        suppliers: normalizeList(data.suppliers || [], normalizers.supplier),
        producers: normalizeList(data.producers || [], normalizers.producer),
        classifications: normalizeList(
          data.classifications || [],
          normalizers.classification
        ),
        productInstances: normalizeList(
          data.productInstances || [],
          normalizers.instance
        ),
      };
    }

    const unifiedProducts = normalizeList(
      (loadMap.unifiedProducts && loadMap.unifiedProducts()) ||
        fallbackLoad(storageKeys.unifiedProducts, normalizers.unifiedProduct),
      normalizers.unifiedProduct
    );
    const legacyProducts = fallbackLoad("inventarioCocinaAlmacen", normalizers.product);
    const legacyExtras = fallbackLoad("otrosProductosCompra", normalizers.extraProduct);
    const products = unifiedProducts.length
      ? unifiedProducts
          .filter((p) => p.scope === "almacen")
          .map((p) => ({ ...p, scope: "almacen" }))
      : legacyProducts.map((p) => ({ ...p, scope: "almacen" }));
    const extraProducts = unifiedProducts.length
      ? unifiedProducts
          .filter((p) => p.scope === "otros")
          .map((p) => ({ ...p, scope: "otros" }))
      : legacyExtras.map((p) => ({ ...p, scope: "otros" }));
    const suppliers = normalizeList(
      (loadMap.suppliers && loadMap.suppliers()) ||
        fallbackLoad(storageKeys.suppliers, normalizers.supplier),
      normalizers.supplier
    );
    const producers = normalizeList(
      (loadMap.producers && loadMap.producers()) ||
        fallbackLoad(storageKeys.producers, normalizers.producer),
      normalizers.producer
    );
    const classifications = ensureClassifications(
      products,
      extraProducts,
      normalizeList(
        (loadMap.classifications &&
          loadMap.classifications(products, extraProducts)) ||
          fallbackLoad(storageKeys.classifications, normalizers.classification),
        normalizers.classification
      )
    );
    const productInstances = normalizeList(
      (loadMap.productInstances && loadMap.productInstances()) ||
        fallbackLoad(storageKeys.productInstances, normalizers.instance),
      normalizers.instance
    );

    const unified =
      unifiedProducts.length > 0
        ? unifiedProducts
        : [
            ...products.map((p) => ({ ...p, scope: "almacen" })),
            ...extraProducts.map((p) => ({ ...p, scope: "otros" })),
          ];

    return {
      products,
      extraProducts,
      unifiedProducts: unified,
      suppliers,
      producers,
      classifications,
      productInstances,
    };
  }

  function persistEntity(name, list) {
    const saveFn = saveMap[name];
    if (typeof saveFn === "function") {
      saveFn(list);
      return;
    }
    const key = storageKeys[name];
    if (key) {
      fallbackSave(key, list);
    }
  }

  function persistState(nextState) {
    const state = nextState || (stateStore && stateStore.getState()) || {};
    const unified = buildUnifiedList(
      state.products,
      state.extraProducts,
      state.unifiedProducts
    );

    persistEntity("unifiedProducts", unified);
    // Compat: seguir guardando las listas separadas mientras migramos vistas
    persistEntity(
      "products",
      normalizeList(
        (state.products || []).map((p) => ({ ...p, scope: "almacen" })),
        normalizers.product
      )
    );
    persistEntity(
      "extraProducts",
      normalizeList(
        (state.extraProducts || []).map((p) => ({ ...p, scope: "otros" })),
        normalizers.extraProduct
      )
    );
    persistEntity(
      "suppliers",
      normalizeList(state.suppliers, normalizers.supplier)
    );
    persistEntity(
      "producers",
      normalizeList(state.producers, normalizers.producer)
    );
    persistEntity(
      "classifications",
      normalizeList(state.classifications, normalizers.classification)
    );
    persistEntity(
      "productInstances",
      normalizeList(state.productInstances, normalizers.instance)
    );
  }

  function setEntity(name, list) {
    const normalizer = normalizerMap[name] || ((item) => item);
    const normalized = normalizeList(list, normalizer);
    if (stateStore && typeof stateStore.hydrate === "function") {
      stateStore.hydrate({ [name]: normalized });
    }

    if (name === "products" || name === "extraProducts" || name === "unifiedProducts") {
      const state =
        (stateStore && typeof stateStore.getState === "function"
          ? stateStore.getState()
          : {}) || {};
      const unified = buildUnifiedList(
        name === "products" ? normalized : state.products,
        name === "extraProducts" ? normalized : state.extraProducts,
        name === "unifiedProducts" ? normalized : state.unifiedProducts
      );
      persistEntity("unifiedProducts", unified);
    }

    persistEntity(name, normalized);
    return normalized;
  }

  function hydrateFromStorage() {
    const data = loadAllFromStorage();
    if (stateStore && typeof stateStore.hydrate === "function") {
      stateStore.hydrate(data);
    }
    return data;
  }

  function getFamilies(state) {
    const current = state || (stateStore && stateStore.getState()) || {};
    if (current.classifications && current.classifications.length > 0) {
      return Array.from(
        new Set(
          current.classifications
            .map((c) => (c.block || "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
    }
    return Array.from(
      new Set(
        [...(current.products || []), ...(current.extraProducts || [])]
          .map((p) => (p.block || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }

  function getTypes(state, family = "") {
    const fam = (family || "").trim();
    const current = state || (stateStore && stateStore.getState()) || {};
    const source =
      current.classifications && current.classifications.length > 0
        ? current.classifications
        : [...(current.products || []), ...(current.extraProducts || [])];

    const types = source
      .filter((c) => !fam || (c.block || "").trim() === fam)
      .map((c) => (c.type || "").trim())
      .filter(Boolean);

    return Array.from(new Set(types)).sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" })
    );
  }

  function getProducerLocations(state) {
    const current = state || (stateStore && stateStore.getState()) || {};
    return Array.from(
      new Set(
        (current.producers || [])
          .map((p) => (p.location || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }

  function getStoreLocations(state) {
    const current = state || (stateStore && stateStore.getState()) || {};
    return Array.from(
      new Set(
        (current.suppliers || [])
          .map((s) => (s.location || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }

  window.DataService = {
    hydrateFromStorage,
    persistState,
    setProducts: (list) => setEntity("products", list),
    setExtraProducts: (list) => setEntity("extraProducts", list),
    setUnifiedProducts: (list) => setEntity("unifiedProducts", list),
    setSuppliers: (list) => setEntity("suppliers", list),
    setProducers: (list) => setEntity("producers", list),
    setProductInstances: (list) => setEntity("productInstances", list),
    setClassifications: (list) => setEntity("classifications", list),
    selectors: {
      families: getFamilies,
      types: getTypes,
      producerLocations: getProducerLocations,
      storeLocations: getStoreLocations,
    },
    normalizers,
  };
})();
