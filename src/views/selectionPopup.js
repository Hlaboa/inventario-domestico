(() => {
  let ctx = null;

  function getCtx(c) {
    return c || ctx || {};
  }

  function init(c) {
    ctx = c;
    const context = getCtx(c);
    const refs = context.refs || {};
    const { overlay, popup, closeBtn } = refs;
    if (closeBtn) closeBtn.addEventListener("click", () => close());
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
      });
    }
    if (typeof context.initDrag === "function") context.initDrag();
    if (typeof context.initAutocomplete === "function") context.initAutocomplete();
    if (typeof context.initResize === "function") context.initResize();
    if (typeof context.initKeydown === "function") context.initKeydown();
    if (typeof context.initScroll === "function") context.initScroll();
  }

  function open(title) {
    const context = getCtx();
    const refs = context.refs || {};
    if (refs.title) refs.title.textContent = title || "Seleccionar";
    if (refs.overlay) refs.overlay.classList.add("visible");
    if (refs.popup) refs.popup.classList.add("visible");
  }

  function close() {
    const context = getCtx();
    const refs = context.refs || {};
    if (refs.overlay) refs.overlay.classList.remove("visible");
    if (refs.popup) refs.popup.classList.remove("visible");
    if (typeof context.onClose === "function") context.onClose();
  }

  function setList(htmlList) {
    const context = getCtx();
    const refs = context.refs || {};
    if (refs.list) {
      refs.list.innerHTML = "";
      if (htmlList instanceof HTMLElement) {
        refs.list.appendChild(htmlList);
      }
    }
  }

  window.SelectionPopup = { init, open, close, setList };
})();
