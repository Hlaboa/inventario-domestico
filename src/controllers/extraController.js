(() => {
  /**
   * Controlador para la vista de "Otros productos".
   * Dispara callbacks de render cuando el AppStore cambia.
   */
  function create({ store, onRender, shouldSkip }) {
    if (!store || typeof onRender !== "function") {
      return { dispose() {} };
    }

    let timer = null;
    const DEBOUNCE_MS = 120;

    const run = () => {
      if (typeof shouldSkip === "function" && shouldSkip()) return;
      onRender(store.getState ? store.getState() : {});
    };

    const render = () => {
      if (typeof shouldSkip === "function" && shouldSkip()) return;
      clearTimeout(timer);
      timer = setTimeout(run, DEBOUNCE_MS);
    };

    const unsubscribe =
      typeof store.subscribe === "function" ? store.subscribe(render) : () => {};

    return {
      render,
      dispose() {
        if (typeof unsubscribe === "function") unsubscribe();
      },
    };
  }

  window.ExtraController = { create };
})();
