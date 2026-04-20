(() => {
  const storage = window.AppStorage || {};
  const stateStore = window.AppState;
  const utils = window.AppUtils || {};

  const PANTRY_API_BASE = "http://127.0.0.1:8040";
  const PANTRY_SNAPSHOT_PATH = "/api/pantry/snapshot";
  let apiConnected = null;
  let apiWarningLogged = false;
  let pendingApiSnapshot = null;
  let apiPersistTimer = null;
  let apiLoadPromise = null;
  let pantryStatus = {
    connected: null,
    checking: true,
    blocking: true,
    message: "Conectando con la API local de pantry...",
  };
  const API_PERSIST_DEBOUNCE = 140;

  const nowIsoString =
    (utils && typeof utils.nowIsoString === "function"
      ? utils.nowIsoString
      : () => new Date().toISOString());

  function buildSnapshot(state) {
    const source = state && typeof state === "object" ? state : {};
    const sourceProducts = Array.isArray(source.products) ? source.products : [];
    const sourceExtraProducts = Array.isArray(source.extraProducts)
      ? source.extraProducts
      : [];
    const sourceUnifiedProducts = Array.isArray(source.unifiedProducts)
      ? source.unifiedProducts
      : [];
    const unifiedProducts = sourceUnifiedProducts.length
      ? sourceUnifiedProducts
      : [
          ...sourceProducts
            .filter((item) => item && typeof item === "object")
            .map((item) => ({ ...item, scope: "almacen" })),
          ...sourceExtraProducts
            .filter((item) => item && typeof item === "object")
            .map((item) => ({ ...item, scope: "otros" })),
        ];
    const products = unifiedProducts.length
      ? unifiedProducts.filter((item) => item && item.scope === "almacen")
      : sourceProducts;
    const extraProducts = unifiedProducts.length
      ? unifiedProducts.filter((item) => item && item.scope === "otros")
      : sourceExtraProducts;
    return {
      products,
      extraProducts,
      unifiedProducts,
      suppliers: Array.isArray(source.suppliers) ? source.suppliers : [],
      producers: Array.isArray(source.producers) ? source.producers : [],
      productInstances: Array.isArray(source.productInstances)
        ? source.productInstances
        : [],
      classifications: Array.isArray(source.classifications)
        ? source.classifications
        : [],
      orders: Array.isArray(source.orders) ? source.orders : [],
    };
  }

  function saveSnapshotCache(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return;
    try {
      const normalized = buildSnapshot(snapshot);
      persistEntityImmediate("products", normalized.products);
      persistEntityImmediate("extraProducts", normalized.extraProducts);
      persistEntityImmediate("unifiedProducts", normalized.unifiedProducts);
      persistEntityImmediate("suppliers", normalized.suppliers);
      persistEntityImmediate("producers", normalized.producers);
      persistEntityImmediate("productInstances", normalized.productInstances);
      persistEntityImmediate("classifications", normalized.classifications);
      persistEntityImmediate("orders", normalized.orders);
    } catch (err) {
      console.warn("Pantry cache update failed", err);
    }
  }

  function emitPantryStatus(patch = {}) {
    pantryStatus = { ...pantryStatus, ...patch };
    if (
      window &&
      typeof window.dispatchEvent === "function" &&
      typeof window.CustomEvent === "function"
    ) {
      window.dispatchEvent(new window.CustomEvent("pantry:status", { detail: pantryStatus }));
    }
    return pantryStatus;
  }

  function setApiConnected() {
    apiConnected = true;
    apiWarningLogged = false;
    emitPantryStatus({
      connected: true,
      checking: false,
      blocking: false,
      message: "Pantry API conectada.",
      error: "",
    });
  }

  function setApiUnavailable(message, err) {
    apiConnected = false;
    const detail = err && (err.message || String(err));
    emitPantryStatus({
      connected: false,
      checking: false,
      blocking: true,
      message,
      error: detail || "",
    });
    if (!apiWarningLogged) {
      console.warn(detail ? `${message}:` : message, detail || "");
      apiWarningLogged = true;
    }
  }

  function canWritePantry() {
    if (apiConnected === true) return true;
    setApiUnavailable(
      "Pantry API no disponible. Escritura bloqueada para evitar divergencias con localStorage."
    );
    return false;
  }

  async function fetchPantrySnapshot() {
    const fetchImpl = window.fetch;
    if (typeof fetchImpl !== "function") return null;
    const url = `${PANTRY_API_BASE}${PANTRY_SNAPSHOT_PATH}`;
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Pantry snapshot fetch failed with status ${response.status}`);
    }
    const payload = await response.json();
    return payload;
  }

  async function pushPantrySnapshot(snapshot) {
    const fetchImpl = window.fetch;
    if (typeof fetchImpl !== "function") return null;
    const url = `${PANTRY_API_BASE}${PANTRY_SNAPSHOT_PATH}`;
    const payload = buildSnapshot(snapshot);
    const response = await fetchImpl(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Pantry snapshot push failed with status ${response.status}`);
    }
    return payload;
  }

  function scheduleApiSnapshot(snapshot) {
    if (typeof window.fetch !== "function") {
      setApiUnavailable("Pantry API no disponible. Este navegador no expone fetch.");
      return;
    }
    pendingApiSnapshot = buildSnapshot(snapshot);
    if (apiPersistTimer) {
      clearTimeout(apiPersistTimer);
    }
    apiPersistTimer = setTimeout(async () => {
      apiPersistTimer = null;
      const payload = pendingApiSnapshot;
      pendingApiSnapshot = null;
      try {
        await pushPantrySnapshot(payload);
        saveSnapshotCache(payload);
        setApiConnected();
        console.debug("Pantry API snapshot persisted");
      } catch (err) {
        setApiUnavailable(
          "Pantry API no disponible. No se ha guardado el ultimo cambio.",
          err
        );
      }
    }, API_PERSIST_DEBOUNCE);
  }

  async function refreshFromApi() {
    if (apiLoadPromise) return apiLoadPromise;
    if (typeof window.fetch !== "function") {
      setApiUnavailable("Pantry API no disponible. Este navegador no expone fetch.");
      return null;
    }
    apiLoadPromise = (async () => {
      try {
        const remote = await fetchPantrySnapshot();
        if (remote && typeof remote === "object") {
          saveSnapshotCache(remote);
          setApiConnected();
          console.info("Pantry API snapshot loaded");
        }
        return remote;
      } catch (err) {
        setApiUnavailable(
          "Pantry API no disponible al arrancar. La app queda bloqueada para evitar multiples verdades.",
          err
        );
        return null;
      }
    })();
    const result = await apiLoadPromise;
    apiLoadPromise = null;
    return result;
  }

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
      order: (p) => p,
    };

  const defaultStorageKeys = {
    products: "inventarioCocinaAlmacen",
    extraProducts: "otrosProductosCompra",
    unifiedProducts: "productosCocinaUnificados",
    suppliers: "proveedoresCocina",
    producers: "productoresCocina",
    productInstances: "instanciasProductosCocina",
    classifications: "clasificacionesProductosCocina",
    orders: "pedidosCocina",
  };
  const storageKeys = { ...defaultStorageKeys, ...(storage.keys || {}) };

  const saveMap = {
    products: storage.saveProducts,
    extraProducts: storage.saveExtraProducts,
    unifiedProducts: storage.saveUnifiedProducts,
    suppliers: storage.saveSuppliers,
    producers: storage.saveProducers,
    productInstances: storage.saveProductInstances,
    classifications: storage.saveClassifications,
    orders: storage.saveOrders,
  };

  const normalizerMap = {
    products: normalizers.product,
    extraProducts: normalizers.extraProduct,
    unifiedProducts: normalizers.unifiedProduct,
    suppliers: normalizers.supplier,
    producers: normalizers.producer,
    productInstances: normalizers.instance,
    classifications: normalizers.classification,
    orders: normalizers.order,
  };

  const loadMap = {
    products: storage.loadProducts,
    extraProducts: storage.loadExtraProducts,
    unifiedProducts: storage.loadUnifiedProducts,
    suppliers: storage.loadSuppliers,
    producers: storage.loadProducers,
    productInstances: storage.loadProductInstances,
    classifications: storage.loadClassifications,
    orders: storage.loadOrders,
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
    return list
      .map((item) => normalizer(item))
      .filter(Boolean);
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
        item.id !== undefined && item.id !== null
          ? String(item.id)
          : (crypto.randomUUID
              ? crypto.randomUUID()
              : `${scope}-` + Math.random().toString(36).slice(2));
      const current = existing.find((u) => u.id === id) || {};
      const base = scope === "otros"
        ? (() => {
            const hasBuy = item.buy !== undefined;
            const hasHave = item.have !== undefined;
            const buy = hasBuy ? !!item.buy : hasHave ? !item.have : false;
            const have = hasHave ? !!item.have : hasBuy ? !item.buy : false;
            return { buy, have };
          })()
        : {};
      map.set(id, {
        ...current,
        ...item,
        ...base,
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
        orders: normalizeList(data.orders || [], normalizers.order),
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
    const orders = normalizeList(
      (loadMap.orders && loadMap.orders()) ||
        fallbackLoad(storageKeys.orders, normalizers.order),
      normalizers.order
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
      orders,
    };
  }

  const pendingPersists = new Map();
  let persistIdleHandle = null;
  let persistTimer = null;
  const PERSIST_DEBOUNCE = 140;
  const PERF_LOG_THRESHOLD = 0; // log todo para diagnóstico
  const perfLog = (label, duration, extra = "") => {
    if (duration < PERF_LOG_THRESHOLD) return;
    const suffix = extra ? ` ${extra}` : "";
    console.log(`[perf] ${label}: ${duration.toFixed(1)}ms${suffix}`);
  };

  function persistEntityImmediate(name, list) {
    const t0 = performance.now();
    const key = storageKeys[name];
    const tryFallbackSave = () => {
      if (!key) return;
      try {
        fallbackSave(key, list);
      } catch {}
    };

    const saveFn = saveMap[name];
    if (typeof saveFn === "function") {
      try {
        saveFn(list);
        const duration = performance.now() - t0;
        perfLog(`persistEntityImmediate:${name}`, duration, `items=${Array.isArray(list) ? list.length : 0}`);
        return;
      } catch {
        tryFallbackSave();
        const duration = performance.now() - t0;
        perfLog(`persistEntityImmediate:${name}`, duration, `fallback items=${Array.isArray(list) ? list.length : 0}`);
        return;
      }
    }
    tryFallbackSave();
    const duration = performance.now() - t0;
    perfLog(`persistEntityImmediate:${name}`, duration, `items=${Array.isArray(list) ? list.length : 0}`);
  }

  function flushPendingPersists() {
    const entries = Array.from(pendingPersists.entries());
    pendingPersists.clear();
    entries.forEach(([name, data]) => persistEntityImmediate(name, data));
  }

  function schedulePersist() {
    if (typeof window.setTimeout !== "function") {
      flushPendingPersists();
      return;
    }
    if (typeof window.cancelIdleCallback === "function" && persistIdleHandle) {
      window.cancelIdleCallback(persistIdleHandle);
      persistIdleHandle = null;
    }
    window.clearTimeout(persistTimer);
    const run = () => {
      persistIdleHandle = null;
      flushPendingPersists();
    };
    if (typeof window.requestIdleCallback === "function") {
      persistIdleHandle = window.requestIdleCallback(run, { timeout: PERSIST_DEBOUNCE });
    } else {
      persistTimer = window.setTimeout(run, PERSIST_DEBOUNCE);
    }
  }

  function persistEntity(name, list) {
    pendingPersists.set(name, Array.isArray(list) ? list : []);
    schedulePersist();
  }

  function persistState(nextState) {
    if (!canWritePantry()) return false;
    const state = nextState || (stateStore && stateStore.getState()) || {};
    const unified = buildUnifiedList(
      state.products,
      state.extraProducts,
      state.unifiedProducts
    );

    scheduleApiSnapshot({
      ...state,
      unifiedProducts: unified,
    });
    return true;
  }

  function setEntity(name, list) {
    if (!canWritePantry()) {
      const current =
        stateStore && typeof stateStore.getState === "function"
          ? stateStore.getState()
          : {};
      return Array.isArray(current[name]) ? current[name] : [];
    }
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
      scheduleApiSnapshot({
        ...state,
        unifiedProducts: unified,
      });
      return normalized;
    }

    const state =
      stateStore && typeof stateStore.getState === "function"
        ? stateStore.getState()
        : null;
    if (state) {
      scheduleApiSnapshot(state);
    }
    return normalized;
  }

  function hydrateFromStorage() {
    const data = loadAllFromStorage();
    if (stateStore && typeof stateStore.hydrate === "function") {
      stateStore.hydrate(data);
    }
    hydrateFromApi();
    return data;
  }

  function hydrateFromApi() {
    return refreshFromApi().then((remote) => {
      if (remote && typeof remote === "object" && stateStore && typeof stateStore.hydrate === "function") {
        stateStore.hydrate(buildSnapshot(remote));
      }
      return remote;
    });
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
    hydrateFromApi,
    getPantryStatus: () => ({ ...pantryStatus }),
    isPantryWriteBlocked: () => apiConnected !== true,
    persistState,
    setProducts: (list) => setEntity("products", list),
    setExtraProducts: (list) => setEntity("extraProducts", list),
    setUnifiedProducts: (list) => setEntity("unifiedProducts", list),
    setSuppliers: (list) => setEntity("suppliers", list),
    setProducers: (list) => setEntity("producers", list),
    setProductInstances: (list) => setEntity("productInstances", list),
    setClassifications: (list) => setEntity("classifications", list),
    setOrders: (list) => setEntity("orders", list),
    selectors: {
      families: getFamilies,
      types: getTypes,
      producerLocations: getProducerLocations,
      storeLocations: getStoreLocations,
    },
    normalizers,
  };
})();
