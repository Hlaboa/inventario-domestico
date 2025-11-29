(() => {
  const listeners = new Set();
  let state = {
    products: [],
    extraProducts: [],
    unifiedProducts: [],
    suppliers: [],
    producers: [],
    classifications: [],
    productInstances: [],
  };

  function getState() {
    return state;
  }

  function hydrate(data = {}) {
    state = { ...state, ...data };
    notify();
    return state;
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function notify() {
    listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (err) {
        console.error("AppState subscriber error", err);
      }
    });
  }

  window.AppState = {
    getState,
    hydrate,
    subscribe,
  };
})();
