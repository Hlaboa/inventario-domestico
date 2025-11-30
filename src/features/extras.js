(() => {
  let ctx = {};
  let actions = {};

  function init(options = {}) {
    ctx = options;
    const defaults = buildDefaultActions(ctx);
    actions = { ...defaults, ...(ctx.actions || {}) };
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
            onToggleBuy: actions.toggleBuy,
            onMoveToAlmacen: actions.moveToAlmacen,
            onSelectSelection: actions.selectSelection,
            onDelete: actions.delete,
            onCancelDraft: actions.cancelDraft,
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
      edit: "edit-extra",
      "save-draft-extra": "save-draft-extra",
    };
    let action = target.dataset.action || roleActionMap[target.dataset.role];
    if (!action && target.closest("button")) {
      const text = target.closest("button").textContent.trim();
      if (text === "✕") action = "delete";
      if (text === "→") action = "move-to-almacen";
    }

    if (target.matches('input[type="checkbox"][data-field="buy"]')) {
      const id = target.dataset.id;
      actions.toggleBuy?.(id, target.checked);
      return;
    }

    if (!action) return;
    const id = target.dataset.id || target.closest("tr")?.dataset.id;
    if (!id) return;

    if (action === "move-to-almacen") {
      actions.moveToAlmacen?.(id);
      return;
    }
    if (action === "edit-extra") {
      actions.startEdit?.(id);
      return;
    }
    if (action === "save-draft-extra") {
      actions.saveDraft?.(id);
      return;
    }
    if (action === "select-selection") {
      actions.selectSelection?.(id);
      return;
    }
    if (action === "delete") {
      actions.delete?.(id);
      return;
    }
    if (action === "cancel-draft") {
      actions.cancelDraft?.(id);
    }
  }

  function buildDefaultActions(options = {}) {
    const persistUnified =
      typeof options.persistUnified === "function" ? options.persistUnified : null;
    const getExtras = typeof options.getExtras === "function" ? options.getExtras : () => [];
    const getPantry =
      typeof options.getPantryProducts === "function" ? options.getPantryProducts : () => [];
    const onChange = typeof options.onChange === "function" ? options.onChange : () => {};
    const nowIsoString =
      typeof options.nowIsoString === "function"
        ? options.nowIsoString
        : () => new Date().toISOString();

    const updateUnified = (updater) => {
      if (!persistUnified) return;
      const extras = getExtras() || [];
      const pantry = getPantry() || [];
      const nextExtras = updater(extras.slice());
      const unified = [
        ...pantry.map((p) => ({ ...p, scope: "almacen" })),
        ...nextExtras.map((p) => ({
          ...p,
          scope: p && p.scope === "almacen" ? "almacen" : "otros",
        })),
      ];
      persistUnified(unified);
      onChange();
    };

    return {
      toggleBuy: (id, checked) => {
        updateUnified((extras) =>
          extras.map((p) =>
            String(p.id) === String(id) ? { ...p, buy: checked, have: !checked } : p
          )
        );
      },
      moveToAlmacen: (id) => {
        updateUnified((extras) => {
          const idx = extras.findIndex((p) => String(p.id) === String(id));
          if (idx === -1) return extras;
          const item = extras[idx];
          const now = nowIsoString();
          extras.splice(idx, 1);
          return [
            ...extras,
            {
              ...item,
              scope: "almacen",
              updatedAt: now,
              have: item.have !== undefined ? !!item.have : !item.buy,
              buy: !!item.buy,
            },
          ];
        });
      },
      delete: (id) => {
        updateUnified((extras) => extras.filter((p) => String(p.id) !== String(id)));
      },
      selectSelection: options.actions?.selectSelection,
      cancelDraft: options.actions?.cancelDraft,
      startEdit: options.actions?.startEdit,
      saveDraft: options.actions?.saveDraft,
    };
  }

  window.ExtrasFeature = {
    init,
    render,
    handleClick,
    state: getState,
    getActions: () => actions,
  };
})();
