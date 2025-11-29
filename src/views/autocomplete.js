(() => {
  let ctx = null;
  let dropdown = null;
  let currentInput = null;

  const escapeHtml = (str) =>
    (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  function ensureDropdown(onSelect) {
    if (dropdown) return dropdown;
    if (window.UIHelpers && typeof window.UIHelpers.createAutocompleteDropdown === "function") {
      dropdown = window.UIHelpers.createAutocompleteDropdown({ onSelect });
      return dropdown;
    }
    const div = document.createElement("div");
    div.id = "productAutocompleteDropdown";
    div.className = "product-autocomplete-dropdown";
    div.style.display = "none";
    div.addEventListener("mousedown", (e) => {
      const item = e.target.closest(".product-autocomplete-item");
      if (!item) return;
      e.preventDefault();
      const name = item.dataset.name || "";
      if (typeof onSelect === "function") onSelect(name);
    });
    dropdown = div;
    document.body.appendChild(div);
    return dropdown;
  }

  function isOpen() {
    return dropdown && dropdown.style.display !== "none";
  }

  function hide() {
    if (!dropdown) return;
    dropdown.style.display = "none";
    dropdown.innerHTML = "";
    currentInput = null;
    document.body.classList.remove("lock-scroll");
  }

  function show(input, suggestions = []) {
    if (!dropdown || !input) return;
    currentInput = input;

    if (suggestions.length === 0) {
      dropdown.innerHTML =
        '<div class="product-autocomplete-empty">Sin coincidencias en tu inventario.</div>';
    } else {
      dropdown.innerHTML = suggestions
        .map(
          (p) => `
        <div class="product-autocomplete-item" data-name="${escapeHtml(p.name)}">
          <span class="product-autocomplete-name">${escapeHtml(p.name)}</span>
          <span class="product-autocomplete-meta">${[p.block || "", p.type || "", p.kind || ""]
            .filter(Boolean)
            .map(escapeHtml)
            .join(" · ")}</span>
        </div>`
        )
        .join("");
    }

    const rect = input.getBoundingClientRect();
    const left = rect.left + window.scrollX;
    const top = rect.bottom + window.scrollY + 4;
    const width = Math.max(rect.width, 240);

    dropdown.style.minWidth = width + "px";
    dropdown.style.left = left + "px";
    dropdown.style.top = top + "px";
    dropdown.style.display = "block";
    document.body.classList.add("lock-scroll");
  }

  function applySelection(name) {
    if (!currentInput) return;
    currentInput.value = name;
    currentInput.focus();
    currentInput.dispatchEvent(new Event("input", { bubbles: true }));
    hide();
  }

  function handleDocumentClick(e) {
    if (!dropdown || dropdown.style.display === "none") return;
    if (dropdown.contains(e.target)) return;
    if (currentInput && e.target === currentInput) return;
    hide();
  }

  function handleGlobalScroll(e) {
    if (!isOpen()) return;
    const overDropdown = dropdown && dropdown.contains(e.target);
    const overInput = currentInput && currentInput.contains(e.target);
    if (overDropdown || overInput) return;
    hide();
  }

  function handleWheel(e) {
    if (!isOpen()) return;
    const maxScroll = Math.max(dropdown.scrollHeight - dropdown.clientHeight, 0);
    if (maxScroll <= 0) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    const next = Math.min(Math.max(dropdown.scrollTop + e.deltaY, 0), maxScroll);
    dropdown.scrollTop = next;
  }

  function init(options = {}) {
    ctx = options;
    const { tableBody, getSuggestions } = ctx;
    if (!tableBody || typeof getSuggestions !== "function") return;

    dropdown = ensureDropdown(applySelection);

    const isProductInput = (target) =>
      target && target.dataset && target.dataset.field === "productName";

    const onFocusInput = (e) => {
      const input = e.target;
      if (!isProductInput(input)) return;
      const list = getSuggestions(input.value || "");
      show(input, list);
    };

    const onInputChange = (e) => {
      const input = e.target;
      if (!isProductInput(input)) return;
      const list = getSuggestions(input.value || "");
      show(input, list);
    };

    const onKeydown = (e) => {
      if (e.key === "Escape") hide();
    };

    tableBody.addEventListener("focusin", onFocusInput);
    tableBody.addEventListener("input", onInputChange);
    tableBody.addEventListener("keydown", onKeydown);

    document.addEventListener("mousedown", handleDocumentClick);
    window.addEventListener("scroll", handleGlobalScroll, true);
    window.addEventListener("resize", hide);
    window.addEventListener("wheel", handleWheel, { passive: false, capture: true });
  }

  window.ProductAutocomplete = { init };
})();
