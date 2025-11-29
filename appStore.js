(() => {
  const appState = window.AppState;
  const dataService = window.DataService;
  const storage = window.AppStorage;

  /**
   * Tipos base (JSDoc para autocompletado)
   * @typedef {Object} BaseEntity
   * @property {string} [id]
   * @property {string} [createdAt]
   * @property {string} [updatedAt]
   *
   * @typedef {BaseEntity & {name:string, block?:string, type?:string, shelf?:string, quantity?:string, have?:boolean, buy?:boolean, selectionId?:string, notes?:string, scope?:("almacen"|"otros")}} Product
   * @typedef {BaseEntity & {productId?:string, productName?:string, producerId?:string, brand?:string, storeIds?:string[], notes?:string}} Instance
   */

  const nowIso = () => new Date().toISOString();
  const ensureId = (val, prefix) =>
    val && String(val).trim().length > 0
      ? val
      : (crypto?.randomUUID ? crypto.randomUUID() : `${prefix}-${Math.random().toString(36).slice(2)}`);

  const initialState = {
    products: [],
    extraProducts: [],
    unifiedProducts: [],
    suppliers: [],
    producers: [],
    classifications: [],
    productInstances: [],
  };

  function normalizeUnifiedList(list) {
    if (!Array.isArray(list)) return [];
    return list.map((p) => {
      const scope = p.scope === "otros" ? "otros" : "almacen";
      return {
        ...p,
        scope,
        id: ensureId(p.id, scope === "otros" ? "extra" : "prod"),
        createdAt: p.createdAt || nowIso(),
        updatedAt: p.updatedAt || p.createdAt || nowIso(),
      };
    });
  }

  function deriveSeparate(unified) {
    const list = normalizeUnifiedList(unified);
    return {
      products: list.filter((p) => p.scope === "almacen"),
      extraProducts: list.filter((p) => p.scope === "otros"),
      unifiedProducts: list,
    };
  }

  function ensureStateShape(next = {}) {
    const unified = normalizeUnifiedList(next.unifiedProducts || []);
    const derived = deriveSeparate(unified);
    const products =
      derived.products.length > 0
        ? derived.products
        : Array.isArray(next.products)
        ? next.products
        : [];
    const extraProducts =
      derived.extraProducts.length > 0
        ? derived.extraProducts
        : Array.isArray(next.extraProducts)
        ? next.extraProducts
        : [];
    return {
      ...initialState,
      ...next,
      unifiedProducts: derived.unifiedProducts,
      products,
      extraProducts,
    };
  }

  let state = ensureStateShape(appState?.getState?.() || {});
  const listeners = new Set();

  const captureState = (next = {}) => {
    state = ensureStateShape(next);
  };

  const notify = () => {
    listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (err) {
        console.error("AppStore subscriber error", err);
      }
    });
  };

  if (appState?.subscribe) {
    appState.subscribe((next) => {
      captureState(next || {});
      notify();
    });
  }

  const dataSetters = {
    products: dataService?.setProducts,
    extraProducts: dataService?.setExtraProducts,
    unifiedProducts: dataService?.setUnifiedProducts,
    suppliers: dataService?.setSuppliers,
    producers: dataService?.setProducers,
    productInstances: dataService?.setProductInstances,
    classifications: dataService?.setClassifications,
  };

  const selectorFallback = {
    families: (s) => Array.from(new Set([...(s.products || []), ...(s.extraProducts || [])].map((p) => (p.block || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    types: (s, family = "") => {
      const fam = (family || "").trim();
      const source = [...(s.products || []), ...(s.extraProducts || []), ...(s.classifications || [])];
      return Array.from(
        new Set(
          source
            .filter((c) => !fam || (c.block || "").trim() === fam)
            .map((c) => (c.type || "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
    },
    producerLocations: (s) =>
      Array.from(new Set((s.producers || []).map((p) => (p.location || "").trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" })
      ),
    storeLocations: (s) =>
      Array.from(new Set((s.suppliers || []).map((p) => (p.location || "").trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" })
      ),
  };

  function getState() {
    return state;
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function setState(patch) {
    const merged = ensureStateShape({ ...state, ...(patch || {}) });
    captureState(merged);
    appState?.hydrate?.({
      unifiedProducts: state.unifiedProducts,
      products: state.products,
      extraProducts: state.extraProducts,
      suppliers: state.suppliers,
      producers: state.producers,
      classifications: state.classifications,
      productInstances: state.productInstances,
    });
    dataService?.persistState?.(state);
    notify();
    return state;
  }

  function setEntity(name, list) {
    const setter = dataSetters[name];
    if (typeof setter === "function") {
      const res = setter(list);
      captureState(appState?.getState?.() || state);
      notify();
      return res;
    }

    if (name === "products" || name === "extraProducts") {
      const current = state || {};
      const originalProducts = name === "products" ? (Array.isArray(list) ? list : []) : current.products || [];
      const originalExtras = name === "extraProducts" ? (Array.isArray(list) ? list : []) : current.extraProducts || [];
      const products = originalProducts.map((p) => ({ ...p }));
      const extras = originalExtras.map((p) => ({ ...p }));
      const unified = normalizeUnifiedList([
        ...products.map((p) => ({ ...p, scope: "almacen" })),
        ...extras.map((p) => ({ ...p, scope: "otros" })),
      ]);
      const nextState = ensureStateShape({ ...current, unifiedProducts: unified });
      captureState(nextState);
      if (name === "products") {
        appState?.hydrate?.({ products: originalProducts });
      } else {
        appState?.hydrate?.({ extraProducts: originalExtras });
      }
      dataService?.persistState?.(nextState);
      notify();
      return nextState[name];
    }

    if (name === "unifiedProducts") {
      const unified = normalizeUnifiedList(list);
      const nextState = ensureStateShape({ ...state, unifiedProducts: unified });
      captureState(nextState);
      appState?.hydrate?.({
        unifiedProducts: nextState.unifiedProducts,
        products: nextState.products,
        extraProducts: nextState.extraProducts,
      });
      dataService?.persistState?.(nextState);
      notify();
      return nextState.unifiedProducts;
    }

    const normalized = Array.isArray(list) ? list : [];
    const nextState = ensureStateShape({ ...state, [name]: normalized });
    captureState(nextState);
    appState?.hydrate?.({ [name]: normalized });
    dataService?.persistState?.(nextState);
    notify();
    return normalized;
  }

  function persist(next) {
    dataService?.persistState?.(ensureStateShape(next || state));
  }

  function bootstrap() {
    let loaded = null;
    if (dataService?.hydrateFromStorage) {
      loaded = dataService.hydrateFromStorage();
    } else if (storage?.loadAllData) {
      loaded = storage.loadAllData();
      appState?.hydrate?.(loaded);
    }
    if (loaded) {
      captureState({ ...state, ...loaded });
      notify();
    }
    return state;
  }

  const selectors = {
    families: (s) =>
      (dataService?.selectors?.families
        ? dataService.selectors.families(s || state)
        : selectorFallback.families(s || state)),
    types: (s, family = "") =>
      (dataService?.selectors?.types
        ? dataService.selectors.types(s || state, family)
        : selectorFallback.types(s || state, family)),
    producerLocations: (s) =>
      (dataService?.selectors?.producerLocations
        ? dataService.selectors.producerLocations(s || state)
        : selectorFallback.producerLocations(s || state)),
    storeLocations: (s) =>
      (dataService?.selectors?.storeLocations
        ? dataService.selectors.storeLocations(s || state)
        : selectorFallback.storeLocations(s || state)),
  };

  window.AppStore = {
    bootstrap,
    getState,
    setState,
    setEntity,
    persist,
    subscribe,
    actions: {
      setProducts: (list) => setEntity("products", list),
      setExtraProducts: (list) => setEntity("extraProducts", list),
      setUnifiedProducts: (list) => setEntity("unifiedProducts", list),
      setSuppliers: (list) => setEntity("suppliers", list),
      setProducers: (list) => setEntity("producers", list),
      setProductInstances: (list) => setEntity("productInstances", list),
      setClassifications: (list) => setEntity("classifications", list),
    },
    selectors,
  };
})();
