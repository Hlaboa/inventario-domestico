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
    if (refs.typeFilter) {
      refs.typeFilter.addEventListener("change", () => actions.filter?.());
    }
    if (refs.locationFilter) {
      refs.locationFilter.addEventListener("change", () => actions.filter?.());
    }
  }

  function render() {
    if (!window.StoresView || typeof window.StoresView.render !== "function") return;
    const viewCtx = ctx.context || {};
    window.StoresView.render(viewCtx);
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
        if (window.StoresView && typeof window.StoresView.addRow === "function") {
          window.StoresView.addRow(options.context);
        }
      },
      save: () => {
        if (window.StoresView && typeof window.StoresView.save === "function") {
          window.StoresView.save(options.context);
        }
      },
      filter: () => {
        if (window.StoresView && typeof window.StoresView.filterRows === "function") {
          window.StoresView.filterRows(options.context);
        }
      },
    };
  }

  window.StoresFeature = { init, render, handleClick, getActions: () => actions };
})();
