(() => {
  /**
   * Controlador para la vista de instancias (selección de productos).
   * Mantiene sincronizados los datos de contexto con el AppStore.
   */
  function create({ store, view, feature, context }) {
    if (!store) {
      return { dispose() {} };
    }

    const ctx = context || {};

    const render = () => {
      if (typeof ctx.shouldRender === "function" && !ctx.shouldRender()) {
        return;
      }
      const state = store.getState ? store.getState() : {};
      if (ctx.data) {
        ctx.data.instances = state.productInstances || ctx.data.instances || [];
        ctx.data.producers = state.producers || ctx.data.producers || [];
        ctx.data.stores = state.suppliers || ctx.data.stores || [];
      }
      if (feature && typeof feature.render === "function") {
        feature.render();
        return;
      }
      if (view && typeof view.render === "function") {
        view.render(ctx);
      }
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

  window.InstancesController = { create };
})();
