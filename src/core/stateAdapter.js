(() => {
  const appStore = window.AppStore;
  const appState = window.AppState;
  const dataService = window.DataService;
  const utils = window.AppUtils || {};

  const ensureObject =
    (utils && typeof utils.ensureObject === "function"
      ? utils.ensureObject
      : (val) =>
          val && typeof val === "object" && !Array.isArray(val) ? val : {});

  const baseState = {
    products: [],
    extraProducts: [],
    unifiedProducts: [],
    suppliers: [],
    producers: [],
    classifications: [],
    productInstances: [],
  };

  let localState = { ...baseState };
  const localListeners = new Set();

  function notifyLocal() {
    localListeners.forEach((fn) => {
      try {
        fn(getState());
      } catch (err) {
        console.error("StateAdapter subscriber error", err);
      }
    });
  }

  function getState() {
    if (appStore && typeof appStore.getState === "function") {
      return appStore.getState() || baseState;
    }
    if (appState && typeof appState.getState === "function") {
      return appState.getState() || baseState;
    }
    return localState;
  }

  function setState(patch) {
    const next = ensureObject(patch);
    if (appStore && typeof appStore.setState === "function") {
      return appStore.setState(next);
    }
    if (appState && typeof appState.hydrate === "function") {
      return appState.hydrate(next);
    }
    localState = { ...localState, ...next };
    if (dataService && typeof dataService.persistState === "function") {
      dataService.persistState(localState);
    }
    notifyLocal();
    return localState;
  }

  const entityActionMap = {
    products: "setProducts",
    extraProducts: "setExtraProducts",
    unifiedProducts: "setUnifiedProducts",
    suppliers: "setSuppliers",
    producers: "setProducers",
    productInstances: "setProductInstances",
    classifications: "setClassifications",
  };

  function setEntity(name, list) {
    const actionName = entityActionMap[name];
    if (
      appStore &&
      appStore.actions &&
      actionName &&
      typeof appStore.actions[actionName] === "function"
    ) {
      return appStore.actions[actionName](list);
    }
    if (appStore && typeof appStore.setEntity === "function") {
      return appStore.setEntity(name, list);
    }
    const current = getState();
    const next = { ...current, [name]: Array.isArray(list) ? list : [] };
    return setState(next);
  }

  function subscribe(fn) {
    if (appStore && typeof appStore.subscribe === "function") {
      return appStore.subscribe(fn);
    }
    if (appState && typeof appState.subscribe === "function") {
      return appState.subscribe(fn);
    }
    if (typeof fn !== "function") return () => {};
    localListeners.add(fn);
    return () => localListeners.delete(fn);
  }

  const selectorFallback = {
    families: (s) =>
      Array.from(
        new Set(
          [...(s.products || []), ...(s.extraProducts || [])]
            .map((p) => (p.block || "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    types: (s, family = "") => {
      const fam = (family || "").trim();
      const source = [
        ...(s.products || []),
        ...(s.extraProducts || []),
        ...(s.classifications || []),
      ];
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
      Array.from(
        new Set(
          (s.producers || []).map((p) => (p.location || "").trim()).filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    storeLocations: (s) =>
      Array.from(
        new Set(
          (s.suppliers || []).map((p) => (p.location || "").trim()).filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    shoppingSummary: (s) => {
      const current = s || {};
      const groups = new Map();
      const add = (store, item) => {
        const key = store && store.trim().length ? store : "Sin tienda";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
      };
      (current.products || []).forEach((p) => {
        if (p.have) return;
        add(p.storeName || "", { source: "almacén", product: p });
      });
      (current.extraProducts || []).forEach((p) => {
        if (!p.buy) return;
        add(p.storeName || "", { source: "otros", product: p });
      });
      let totalItems = 0;
      const stores = [];
      groups.forEach((items, store) => {
        totalItems += items.length;
        stores.push({ store, count: items.length, items });
      });
      return {
        totalStores: stores.length,
        totalItems,
        stores,
      };
    },
  };

  const selectors = {
    families: (s = getState()) =>
      appStore && appStore.selectors && typeof appStore.selectors.families === "function"
        ? appStore.selectors.families(s)
        : selectorFallback.families(s),
    types: (s = getState(), family = "") =>
      appStore && appStore.selectors && typeof appStore.selectors.types === "function"
        ? appStore.selectors.types(s, family)
        : selectorFallback.types(s, family),
    producerLocations: (s = getState()) =>
      appStore &&
      appStore.selectors &&
      typeof appStore.selectors.producerLocations === "function"
        ? appStore.selectors.producerLocations(s)
        : selectorFallback.producerLocations(s),
    storeLocations: (s = getState()) =>
      appStore &&
      appStore.selectors &&
      typeof appStore.selectors.storeLocations === "function"
        ? appStore.selectors.storeLocations(s)
        : selectorFallback.storeLocations(s),
    shoppingSummary: (s = getState()) =>
      appStore &&
      appStore.selectors &&
      typeof appStore.selectors.shoppingSummary === "function"
        ? appStore.selectors.shoppingSummary(s)
        : selectorFallback.shoppingSummary(s),
  };

  window.StateAdapter = {
    bootstrap: () => {
      if (appStore && typeof appStore.bootstrap === "function") {
        return appStore.bootstrap();
      }
      if (dataService && typeof dataService.hydrateFromStorage === "function") {
        return dataService.hydrateFromStorage();
      }
      if (appState && typeof appState.getState === "function") {
        return appState.getState();
      }
      return getState();
    },
    getState,
    setState,
    setEntity,
    subscribe,
    selectors,
  };
})();
