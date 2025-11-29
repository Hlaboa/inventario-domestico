(() => {
  function create({ store, onRender }) {
    if (!store || typeof onRender !== "function") return { dispose() {} };
    const render = () => onRender(store.getState ? store.getState() : {});
    const unsubscribe =
      typeof store.subscribe === "function" ? store.subscribe(render) : () => {};
    return {
      render,
      dispose() {
        if (typeof unsubscribe === "function") unsubscribe();
      },
    };
  }

  window.StoresController = { create };
})();
