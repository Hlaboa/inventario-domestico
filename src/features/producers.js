(() => {
  let ctx = {};

  function init(options = {}) {
    ctx = options || {};
  }

  function render() {
    if (!window.ProducersView || typeof window.ProducersView.render !== "function") return;
    const viewCtx = ctx.context || {};
    window.ProducersView.render(viewCtx);
  }

  window.ProducersFeature = { init, render };
})();
