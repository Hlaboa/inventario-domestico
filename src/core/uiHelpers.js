(() => {
  function showToast(message, timeout = 1800) {
    if (!message) return;
    let container = document.querySelector(".toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("visible"));
    setTimeout(() => {
      toast.classList.remove("visible");
      setTimeout(() => toast.remove(), 300);
    }, timeout);
  }

  function resetFilters(refs = {}) {
    const setValue = (el, val = "") => {
      if (!el) return;
      el.value = val;
    };
    setValue(refs.filterSearchInput, "");
    setValue(refs.filterShelfSelect, "");
    setValue(refs.filterBlockSelect, "");
    setValue(refs.filterTypeSelect, "");
    setValue(refs.filterStoreSelect, "");
    setValue(refs.filterStatusSelect, "all");

    setValue(refs.editFilterSearchInput, "");
    setValue(refs.editFilterFamilySelect, "");
    setValue(refs.editFilterTypeSelect, "");
    setValue(refs.editFilterShelfSelect, "");
    setValue(refs.editFilterStoreSelect, "");

    setValue(refs.extraFilterSearchInput, "");
    setValue(refs.extraFilterFamilySelect, "");
    setValue(refs.extraFilterTypeSelect, "");
    setValue(refs.extraFilterStoreSelect, "");
    setValue(refs.extraFilterBuySelect, "all");

    setValue(refs.extraEditFilterSearchInput, "");
    setValue(refs.extraEditFilterFamilySelect, "");
    setValue(refs.extraEditFilterTypeSelect, "");
    setValue(refs.extraEditFilterStoreSelect, "");

    setValue(refs.instancesSearchInput, "");
    setValue(refs.instancesFamilyFilterSelect, "");
    setValue(refs.instancesProducerFilterSelect, "");
    setValue(refs.instancesStoreFilterSelect, "");
  }

  function debounce(fn, wait = 120) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  window.UIHelpers = {
    showToast,
    resetFilters,
    debounce,
  };
})();
