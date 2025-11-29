(() => {
  const appState = window.AppState;
  const dataService = window.DataService;
  const storage = window.AppStorage;

  const initialState = {
    products: [],
    extraProducts: [],
    unifiedProducts: [],
    suppliers: [],
    producers: [],
    classifications: [],
    productInstances: [],
  };

  let state = { ...initialState, ...(appState?.getState?.() || {}) };
  const listeners = new Set();

  const captureState = (next = {}) => {
    state = { ...initialState, ...next };
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
    captureState({ ...state, ...(patch || {}) });
    appState?.hydrate?.(state);
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
    const normalized = Array.isArray(list) ? list : [];
    captureState({ ...state, [name]: normalized });
    appState?.hydrate?.({ [name]: normalized });
    dataService?.persistState?.(state);
    notify();
    return normalized;
  }

  function persist(next) {
    dataService?.persistState?.(next || state);
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
