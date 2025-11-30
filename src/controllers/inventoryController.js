(() => {
  /**
   * Controlador de inventario: escucha AppStore y usa InventoryView.
   * Separa render y eventos de app.js.
   */
  function create({ store, view, helpers, shouldSkip }) {
    if (!store || !view || typeof view.render !== "function") {
      return { dispose() {} };
    }

    const ctx = {};
    let timer = null;
    const DEBOUNCE_MS = 100;

    const run = () => {
      const state = store.getState ? store.getState() : {};
      ctx.refs = ctx.refs || {};
      view.render({
        refs: ctx.refs,
        state: {
          products: state.products || [],
          productDrafts: ctx.productDrafts || [],
        },
        helpers,
      });
    };

    const render = () => {
      if (typeof shouldSkip === "function" && shouldSkip()) return;
      clearTimeout(timer);
      timer = setTimeout(run, DEBOUNCE_MS);
    };

    const unsubscribe =
      typeof store.subscribe === "function" ? store.subscribe(render) : () => {};

    return {
      setRefs(refs) {
        ctx.refs = refs;
      },
      setDrafts(drafts) {
        ctx.productDrafts = drafts;
      },
      render,
      dispose() {
        if (typeof unsubscribe === "function") unsubscribe();
      },
    };
  }

  window.InventoryController = { create };
})();
