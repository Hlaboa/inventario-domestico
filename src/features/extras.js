(() => {
  let ctx = {};

  function init(options = {}) {
    ctx = options;
    const refs = ctx.refs || {};
    if (refs.tableBody) {
      refs.tableBody.addEventListener("click", handleClick);
    }
  }

  function getState() {
    const getExtras = ctx.getExtras || (() => []);
    const getDrafts = ctx.getDrafts || (() => []);
    return {
      extras: getExtras(),
      drafts: getDrafts(),
    };
  }

  function render() {
    if (!window.ExtrasView || typeof window.ExtrasView.render !== "function") return;
    const viewCtx =
      typeof ctx.getContext === "function"
        ? ctx.getContext()
        : {
            refs: ctx.refs || {},
            getExtras: ctx.getExtras || (() => []),
            getDrafts: ctx.getDrafts || (() => []),
            buildFamilyStripeMap: ctx.buildFamilyStripeMap,
            helpers: ctx.helpers || {},
            getSelectionInstanceForProduct: ctx.getSelectionInstanceForProduct,
            getStoreNames: ctx.getStoreNames,
            onToggleBuy: ctx.actions?.toggleBuy,
            onMoveToAlmacen: ctx.actions?.moveToAlmacen,
            onSelectSelection: ctx.actions?.selectSelection,
            onDelete: ctx.actions?.delete,
            onCancelDraft: ctx.actions?.cancelDraft,
          };
    window.ExtrasView.render(viewCtx);
  }

  function handleClick(e) {
    const target = e.target.closest("button,[data-action],[data-role],input[type='checkbox']") || e.target;
    if (!target) return;
    const roleActionMap = {
      "selection-btn": "select-selection",
      move: "move-to-almacen",
      delete: "delete",
    };
    let action = target.dataset.action || roleActionMap[target.dataset.role];
    if (!action && target.closest("button")) {
      const text = target.closest("button").textContent.trim();
      if (text === "✕") action = "delete";
      if (text === "→") action = "move-to-almacen";
    }

    if (target.matches('input[type="checkbox"][data-field="buy"]')) {
      const id = target.dataset.id;
      ctx.actions?.toggleBuy?.(id, target.checked);
      return;
    }

    if (!action) return;
    const id = target.dataset.id || target.closest("tr")?.dataset.id;
    if (!id) return;

    if (action === "move-to-almacen") {
      ctx.actions?.moveToAlmacen?.(id);
      return;
    }
    if (action === "select-selection") {
      ctx.actions?.selectSelection?.(id);
      return;
    }
    if (action === "delete") {
      ctx.actions?.delete?.(id);
      return;
    }
    if (action === "cancel-draft") {
      ctx.actions?.cancelDraft?.(id);
    }
  }

  window.ExtrasFeature = {
    init,
    render,
    handleClick,
    state: getState,
  };
})();
