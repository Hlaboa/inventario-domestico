(() => {
  /**
   * Controlador simple que sincroniza el estado del AppStore con callbacks de render.
   * Permite desacoplar app.js de la fuente de estado.
   */
  function create(store, { onState } = {}) {
    if (!store || typeof store.subscribe !== "function") {
      return { dispose() {} };
    }

    const handler = (next) => {
      if (typeof onState === "function") {
        onState(next || store.getState());
      }
    };

    const unsubscribe = store.subscribe(handler);
    // Render inicial
    handler(store.getState());

    return {
      dispose() {
        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
      },
    };
  }

  window.ViewControllers = { create };
})();
