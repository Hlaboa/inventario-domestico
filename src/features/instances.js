(() => {
  let ctx = {};
  const debounceTimers = new Map();
  const DEBOUNCE_FIELDS = new Set(["productName", "brand", "notes"]);
  const DEBOUNCE_MS = 160;

  const scheduleUpdate = (id, field, value, immediate = false) => {
    const key = `${id}:${field}`;
    if (immediate) {
      const t = debounceTimers.get(key);
      if (t) {
        clearTimeout(t);
        debounceTimers.delete(key);
      }
      ctx.actions?.updateField?.(id, field, value);
      return;
    }
    const existing = debounceTimers.get(key);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      debounceTimers.delete(key);
      ctx.actions?.updateField?.(id, field, value);
    }, DEBOUNCE_MS);
    debounceTimers.set(key, t);
  };

  function init(options = {}) {
    ctx = options || {};
    const refs = ctx.refs || {};
    if (refs.tableBody) {
      refs.tableBody.addEventListener("click", handleClick);
      refs.tableBody.addEventListener("input", handleInput);
      refs.tableBody.addEventListener("change", handleInput);
      refs.tableBody.addEventListener(
        "blur",
        (e) => handleInput(e, { immediate: true }),
        true
      );
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

  function handleInput(e, opts = {}) {
    const target = e.target;
    if (!target || !target.dataset || !target.dataset.field || !target.dataset.id) return;
    const field = target.dataset.field;
    const id = target.dataset.id;
    let value;
    if (target.type === "checkbox") {
      value = target.checked;
    } else if (target.tagName === "SELECT" && target.multiple) {
      value = Array.from(target.selectedOptions || [])
        .map((o) => o.value)
        .filter(Boolean);
    } else if (target.tagName === "SELECT") {
      value = target.value;
    } else {
      value = (target.value || "").trim();
    }
    const isText =
      target.tagName === "TEXTAREA" ||
      (target.tagName === "INPUT" && (!target.type || target.type === "text"));
    const immediate = opts.immediate || (e.type === "change" && !isText);
    if (isText && DEBOUNCE_FIELDS.has(field) && !immediate) {
      scheduleUpdate(id, field, value);
    } else {
      scheduleUpdate(id, field, value, true);
    }
  }

  window.InstancesFeature = {
    init,
    render,
    handleClick,
    handleInput,
    state: getState,
  };
})();
