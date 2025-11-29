(() => {
  let ctx = {};
  let actions = {};

  function init(options = {}) {
    ctx = options || {};
    const defaults = buildDefaultActions(ctx);
    actions = { ...defaults, ...(ctx.actions || {}) };
    const refs = ctx.refs || {};
    if (refs.tableBody) {
      refs.tableBody.addEventListener("click", handleClick);
    }
    if (refs.addButton) {
      refs.addButton.addEventListener("click", () => actions.add?.());
    }
    if (refs.saveButton) {
      refs.saveButton.addEventListener("click", () => actions.save?.());
    }
    if (refs.searchInput) {
      refs.searchInput.addEventListener("input", () => actions.filter?.());
    }
    if (refs.locationFilter) {
      refs.locationFilter.addEventListener("change", () => actions.filter?.());
    }
  }

  function render() {
    if (!window.ProducersView || typeof window.ProducersView.render !== "function") return;
    const viewCtx = ctx.context || {};
    window.ProducersView.render(viewCtx);
  }

  function handleClick(e) {
    const target = e.target?.closest("button,[data-action]") || e.target;
    if (!target) return;
    const action = target.dataset.action;
    if (action === "delete" && target.closest("tr")) {
      const row = target.closest("tr");
      if (row && typeof row.remove === "function") row.remove();
    }
  }

  function buildDefaultActions(options = {}) {
    return {
      add: () => {
        if (window.ProducersView && typeof window.ProducersView.addRow === "function") {
          window.ProducersView.addRow(options.context);
        }
      },
      save: () => {
        if (window.ProducersView && typeof window.ProducersView.save === "function") {
          window.ProducersView.save(options.context);
        }
      },
      filter: () => {
        if (window.ProducersView && typeof window.ProducersView.filterRows === "function") {
          window.ProducersView.filterRows(options.context);
        }
      },
    };
  }

  window.ProducersFeature = { init, render, handleClick, getActions: () => actions };
})();
