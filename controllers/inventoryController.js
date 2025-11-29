(() => {
  /**
   * Controlador de inventario: escucha AppStore y usa InventoryView.
   * Separa render y eventos de app.js.
   */
  function create({ store, view, helpers }) {
    if (!store || !view || typeof view.render !== "function") {
      return { dispose() {} };
    }

    const ctx = {};
    const render = () => {
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
