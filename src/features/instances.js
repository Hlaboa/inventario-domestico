(() => {
  let ctx = {};

  function init(options = {}) {
    ctx = options || {};
    const refs = ctx.refs || {};
    if (refs.tableBody) {
      refs.tableBody.addEventListener("click", handleClick);
      refs.tableBody.addEventListener("input", handleInput);
      refs.tableBody.addEventListener("change", handleInput);
    }
    if (refs.addButton) refs.addButton.addEventListener("click", () => ctx.actions?.add?.());
    if (refs.saveButton) refs.saveButton.addEventListener("click", () => ctx.actions?.save?.());
  }

  function getState() {
    const getInstances = ctx.getInstances || (() => []);
    return {
      instances: getInstances(),
    };
  }

  function render() {
    if (!window.InstancesView || typeof window.InstancesView.render !== "function") return;
    const viewCtx =
      typeof ctx.getContext === "function"
        ? ctx.getContext()
        : ctx.context || {};
    window.InstancesView.render(viewCtx);
  }

  function handleClick(e) {
    const target = e.target.closest("button,[data-action],[data-role]") || e.target;
    if (!target) return;
    const roleActionMap = {
      delete: "delete",
    };
    let action = target.dataset.action || roleActionMap[target.dataset.role];
    if (!action && target.closest("button")) {
      const text = target.closest("button").textContent.trim();
      if (text === "✕") action = "delete";
    }
    if (!action) return;
    const id = target.dataset.id || target.closest("tr")?.dataset.id;
    if (!id) return;

    if (action === "delete") {
      ctx.actions?.delete?.(id);
    }
  }

  function handleInput(e) {
    const target = e.target;
    if (!target || !target.dataset || !target.dataset.field || !target.dataset.id) return;
    const field = target.dataset.field;
    const id = target.dataset.id;
    const value =
      target.type === "checkbox"
        ? target.checked
        : target.tagName === "SELECT"
        ? target.value
        : (target.value || "").trim();
    ctx.actions?.updateField?.(id, field, value);
  }

  window.InstancesFeature = {
    init,
    render,
    handleClick,
    handleInput,
    state: getState,
  };
})();
