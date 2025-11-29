(() => {
  let ctx = {};

  function init(options = {}) {
    ctx = options || {};
  }

  function render() {
    if (!window.StoresView || typeof window.StoresView.render !== "function") return;
    const viewCtx = ctx.context || {};
    window.StoresView.render(viewCtx);
  }

  window.StoresFeature = { init, render };
})();
