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
    const getProducts = ctx.getProducts || (() => []);
    const getDrafts = ctx.getDrafts || (() => []);
    return {
      products: getProducts(),
      productDrafts: getDrafts(),
    };
  }

  function render() {
    if (!window.InventoryView || typeof window.InventoryView.render !== "function") return;
    const viewCtx =
      typeof ctx.getInventoryContext === "function"
        ? ctx.getInventoryContext()
        : {
            refs: ctx.refs || {},
            state: getState(),
            helpers: ctx.helpers || {},
          };
    window.InventoryView.render(viewCtx);
  }

  function handleClick(e) {
    const target = e.target.closest("button,[data-action],[data-role]") || e.target;
    if (!target) return;
    const roleActionMap = {
      "selection-btn": "select-selection",
      move: "move-to-extra",
      delete: "delete",
      "save-draft-product": "save-draft-product",
      "cancel-draft-product": "cancel-draft-product",
      edit: "edit-product",
      "delete-product": "delete-product",
    };
    let action = target.dataset.action || roleActionMap[target.dataset.role];
    if (!action && target.closest("button")) {
      const text = target.closest("button").textContent.trim();
      if (text === "✕") action = "delete";
      if (text === "→") action = "move-to-extra";
    }

    if (target.matches('input[type="checkbox"][data-field="have"]')) {
      const id = target.dataset.id;
      const onToggle = ctx.actions?.toggleHave;
      if (onToggle) onToggle(id, target.checked);
      return;
    }

    if (!action) return;
    const id = target.dataset.id || target.closest("tr")?.dataset.id;

    if (action === "cancel-draft-product") {
      ctx.actions?.cancelDraft?.(id);
      return;
    }
    if (action === "save-draft-product") {
      ctx.actions?.saveDraft?.(id);
      return;
    }
    if (action === "move-to-extra") {
      const originalId = target.dataset.originalId || target.closest("tr")?.dataset.originalId;
      ctx.actions?.moveToExtra?.(originalId || id);
      return;
    }
    if (action === "edit-product") {
      ctx.actions?.startEdit?.(id);
      return;
    }
    if (action === "delete-product") {
      const origId = target.dataset.originalId || target.closest("tr")?.dataset.originalId || id;
      ctx.actions?.deleteProduct?.(origId || id);
      return;
    }
    if (action === "select-selection") {
      ctx.actions?.selectSelection?.(id);
      return;
    }
  }

  window.InventoryFeature = {
    init,
    render,
    handleClick,
  };
})();
