// ==============================
//  CLAVES LOCALSTORAGE
// ==============================

const STORAGE_KEY_SUPPLIERS = "proveedoresCocina"; // Tiendas
const STORAGE_KEY_PRODUCERS = "productoresCocina"; // Productores
const STORAGE_KEY_INSTANCES = "instanciasProductosCocina"; // Selección de productos
const STORAGE_KEY_CLASSIFICATIONS = "clasificacionesProductosCocina"; // Familias/Tipos

// ==============================
//  ESTADO
// ==============================

let products = []; // almacén (cache derivada)
let extraProducts = []; // otros productos (cache derivada)
let unifiedProducts = []; // listado unificado con scope (cache)
let suppliers = []; // tiendas (cache)
let producers = []; // productores (cache)
let productInstances = []; // selección producto+productor+marca+tiendas (cache)
let classifications = []; // combinaciones familia/tipo (cache)
let productDrafts = [];
let extraDrafts = [];
const stateAdapter = window.StateAdapter || null;
const appUtils = window.AppUtils || {};
const debounce =
  (appUtils && typeof appUtils.debounce === "function"
    ? appUtils.debounce
    : (fn, wait = 80) => {
        let t = null;
        return (...args) => {
          clearTimeout(t);
          t = setTimeout(() => fn(...args), wait);
        };
      });
let isSyncingFromStore = false;

function getStateSnapshot() {
  if (stateAdapter && typeof stateAdapter.getState === "function") {
    return stateAdapter.getState() || {};
  }
  if (window.AppStore && typeof window.AppStore.getState === "function") {
    return window.AppStore.getState() || {};
  }
  if (window.AppState && typeof window.AppState.getState === "function") {
    return window.AppState.getState() || {};
  }
  return {
    products,
    extraProducts,
    unifiedProducts,
    suppliers,
    producers,
    productInstances,
    classifications,
  };
}

function getSuppliersList() {
  const state = getStateSnapshot();
  const list = Array.isArray(state.suppliers) && state.suppliers.length ? state.suppliers : suppliers;
  suppliers = Array.isArray(list) ? list : [];
  return suppliers;
}

function getProducersList() {
  const state = getStateSnapshot();
  const list = Array.isArray(state.producers) && state.producers.length ? state.producers : producers;
  producers = Array.isArray(list) ? list : [];
  return producers;
}

function getClassificationsList() {
  const state = getStateSnapshot();
  const list =
    Array.isArray(state.classifications) && state.classifications.length
      ? state.classifications
      : classifications;
  classifications = Array.isArray(list) ? list : [];
  return classifications;
}

function getInstancesList() {
  const state = getStateSnapshot();
  const list =
    Array.isArray(state.productInstances) && state.productInstances.length
      ? state.productInstances
      : productInstances;
  productInstances = Array.isArray(list) ? list : [];
  return productInstances;
}

function setInstancesList(list) {
  const next = Array.isArray(list) ? list : [];
  productInstances = next;
  if (isSyncingFromStore) return next;
  if (stateAdapter && typeof stateAdapter.setEntity === "function") {
    stateAdapter.setEntity("productInstances", next);
    syncFromAppStore();
    return next;
  }
  if (
    window.AppStore &&
    window.AppStore.actions &&
    typeof window.AppStore.actions.setProductInstances === "function"
  ) {
    window.AppStore.actions.setProductInstances(next);
    syncFromAppStore();
    return next;
  }
  if (window.DataService && typeof window.DataService.setProductInstances === "function") {
    productInstances = window.DataService.setProductInstances(next);
    return productInstances;
  }
  if (window.AppStorage && typeof window.AppStorage.saveProductInstances === "function") {
    window.AppStorage.saveProductInstances(productInstances);
    return productInstances;
  }
  if (typeof appUtils.saveList === "function") {
    appUtils.saveList(STORAGE_KEY_INSTANCES, productInstances);
    return productInstances;
  }
  try {
    localStorage.setItem(STORAGE_KEY_INSTANCES, JSON.stringify(productInstances));
  } catch {}
  return productInstances;
}

function setSuppliersList(list) {
  const next = Array.isArray(list) ? list : [];
  suppliers = next;
  memoStores = [];
  memoStoreLocations = [];
  if (isSyncingFromStore) return suppliers;
  if (stateAdapter && typeof stateAdapter.setEntity === "function") {
    stateAdapter.setEntity("suppliers", next);
    syncFromAppStore();
    return getSuppliersList();
  }
  if (
    window.AppStore &&
    window.AppStore.actions &&
    typeof window.AppStore.actions.setSuppliers === "function"
  ) {
    window.AppStore.actions.setSuppliers(next);
    syncFromAppStore();
    return getSuppliersList();
  }
  if (window.DataService && typeof window.DataService.setSuppliers === "function") {
    suppliers = window.DataService.setSuppliers(next);
    return suppliers;
  }
  if (window.AppStorage && typeof window.AppStorage.saveSuppliers === "function") {
    window.AppStorage.saveSuppliers(next);
    return suppliers;
  }
  if (typeof appUtils.saveList === "function") {
    appUtils.saveList(STORAGE_KEY_SUPPLIERS, suppliers);
    return suppliers;
  }
  try {
    localStorage.setItem(STORAGE_KEY_SUPPLIERS, JSON.stringify(suppliers));
  } catch {}
  return suppliers;
}

function setProducersList(list) {
  const next = Array.isArray(list) ? list : [];
  producers = next;
  memoProducerFilterOptions = "";
  memoProducerLocations = [];
  if (isSyncingFromStore) return producers;
  if (stateAdapter && typeof stateAdapter.setEntity === "function") {
    stateAdapter.setEntity("producers", next);
    syncFromAppStore();
    return getProducersList();
  }
  if (
    window.AppStore &&
    window.AppStore.actions &&
    typeof window.AppStore.actions.setProducers === "function"
  ) {
    window.AppStore.actions.setProducers(next);
    syncFromAppStore();
    return getProducersList();
  }
  if (window.DataService && typeof window.DataService.setProducers === "function") {
    producers = window.DataService.setProducers(next);
    return producers;
  }
  if (window.AppStorage && typeof window.AppStorage.saveProducers === "function") {
    window.AppStorage.saveProducers(next);
    return producers;
  }
  if (typeof appUtils.saveList === "function") {
    appUtils.saveList(STORAGE_KEY_PRODUCERS, producers);
    return producers;
  }
  try {
    localStorage.setItem(STORAGE_KEY_PRODUCERS, JSON.stringify(producers));
  } catch {}
  return producers;
}

function setClassificationsList(list) {
  const next = Array.isArray(list) ? list : [];
  classifications = next;
  if (isSyncingFromStore) return classifications;
  if (stateAdapter && typeof stateAdapter.setEntity === "function") {
    stateAdapter.setEntity("classifications", next);
    syncFromAppStore();
    return getClassificationsList();
  }
  if (
    window.AppStore &&
    window.AppStore.actions &&
    typeof window.AppStore.actions.setClassifications === "function"
  ) {
    window.AppStore.actions.setClassifications(next);
    syncFromAppStore();
    return getClassificationsList();
  }
  if (
    window.DataService &&
    typeof window.DataService.setClassifications === "function"
  ) {
    classifications = window.DataService.setClassifications(next);
    return classifications;
  }
  if (window.AppStorage && typeof window.AppStorage.saveClassifications === "function") {
    window.AppStorage.saveClassifications(next);
    return classifications;
  }
  if (typeof appUtils.saveList === "function") {
    appUtils.saveList(STORAGE_KEY_CLASSIFICATIONS, classifications);
    return classifications;
  }
  try {
    localStorage.setItem(STORAGE_KEY_CLASSIFICATIONS, JSON.stringify(classifications));
  } catch {}
  return classifications;
}

function refreshProductsFromUnified() {
  const unified = Array.isArray(unifiedProducts) ? unifiedProducts : [];
  unifiedProducts = normalizeExtrasHave(unified.filter(Boolean));
  products = unifiedProducts.filter((p) => p.scope === "almacen");
  extraProducts = unifiedProducts.filter((p) => p.scope === "otros");
}

function getPantryProducts() {
  refreshProductsFromUnified();
  return products;
}

function getOtherProducts() {
  refreshProductsFromUnified();
  return extraProducts;
}

function recomputeUnifiedFromDerived() {
  const baseProducts = getPantryProducts();
  const baseExtras = getOtherProducts();
  return [
    ...baseProducts.map((p) => ({ ...p, scope: "almacen" })),
    ...baseExtras.map((p) => ({ ...p, scope: "otros" })),
  ];
}

function getUnifiedList() {
  return Array.isArray(unifiedProducts) ? unifiedProducts.filter(Boolean) : [];
}

function normalizeExtrasHave(list = []) {
  return list.map((p) => {
    if (!p) return p;
    const id = p.id !== undefined && p.id !== null ? String(p.id) : p.id;
    if (p.scope !== "otros") return { ...p, id };
    const buy = !!p.buy;
    return { ...p, id, buy, have: !buy };
  });
}

function setUnifiedList(next) {
  const cleaned = Array.isArray(next) ? next.filter(Boolean) : [];
  unifiedProducts = normalizeExtrasHave(cleaned);
  memoProductsDatalistKey = "";
  refreshProductsFromUnified();
  if (stateAdapter && typeof stateAdapter.setEntity === "function") {
    stateAdapter.setEntity("unifiedProducts", unifiedProducts);
  }
  if (
    window.AppStore &&
    window.AppStore.actions &&
    typeof window.AppStore.actions.setUnifiedProducts === "function"
  ) {
    window.AppStore.actions.setUnifiedProducts(unifiedProducts);
  }
  let persisted = false;
  if (window.AppStorage && typeof window.AppStorage.saveUnifiedProducts === "function") {
    try {
      window.AppStorage.saveUnifiedProducts(unifiedProducts);
      persisted = true;
    } catch {
      persisted = false;
    }
  }
  if (!persisted) {
    try {
      localStorage.setItem("productosCocinaUnificados", JSON.stringify(unifiedProducts));
      persisted = true;
    } catch {
      persisted = false;
    }
  }
  if (!persisted && typeof appUtils.saveList === "function") {
    try {
      appUtils.saveList("productosCocinaUnificados", unifiedProducts);
    } catch {}
  }

  // Persistencia redundante en claves legacy para asegurar carga en navegadores que bloquean la clave unificada
  const legacyProducts = unifiedProducts
    .filter((p) => p.scope === "almacen")
    .map((p) => {
      const { scope, ...rest } = p;
      return rest;
    });
  const legacyExtras = unifiedProducts
    .filter((p) => p.scope === "otros")
    .map((p) => {
      const { scope, ...rest } = p;
      return rest;
    });
  try {
    localStorage.setItem("inventarioCocinaAlmacen", JSON.stringify(legacyProducts));
    localStorage.setItem("otrosProductosCompra", JSON.stringify(legacyExtras));
  } catch {
    if (typeof appUtils.saveList === "function") {
      try {
        appUtils.saveList("inventarioCocinaAlmacen", legacyProducts);
        appUtils.saveList("otrosProductosCompra", legacyExtras);
      } catch {}
    }
  }
  return unifiedProducts;
}

function getUnifiedForWrite() {
  if (Array.isArray(unifiedProducts) && unifiedProducts.length) {
    return normalizeExtrasHave(unifiedProducts).slice();
  }
  const state = getStateSnapshot();
  if (Array.isArray(state.unifiedProducts) && state.unifiedProducts.length) {
    return normalizeExtrasHave(state.unifiedProducts).slice();
  }
  return normalizeExtrasHave(recomputeUnifiedFromDerived());
}

function updateExtraBuyFlag(id, checked) {
  const targetId = id !== undefined && id !== null ? String(id) : "";
  if (!targetId) return;
  const unified = getUnifiedForWrite();
  const nowIsoVal = nowIsoString();
  let touched = false;
  const updatedUnified = unified.map((p) => {
    if (!p || String(p.id) !== targetId) return p;
    if (!!p.buy === !!checked) return p;
    touched = true;
    return { ...p, buy: !!checked, have: !checked, updatedAt: nowIsoVal };
  });
  if (!touched) return;

  // Feedback inmediato en tabla rápida mientras renderizan controladores
  const quickRow = extraListTableBody?.querySelector(`tr[data-id="${id}"]`);
  if (quickRow) {
    quickRow.dataset.buy = checked ? "1" : "0";
    const chk = quickRow.querySelector('input[data-field="buy"]');
    if (chk) chk.checked = !!checked;
  }

  // Ajuste opcional en tabla de edición si está visible
  const editRow = extraTableBody?.querySelector(`tr[data-id="${id}"]`);
  if (editRow) {
    editRow.dataset.buy = checked ? "1" : "0";
    const chk = editRow.querySelector('input[data-field="buy"]');
    if (chk) chk.checked = !!checked;
  }

  const persistLegacy = () => {
    const legacyExtras = updatedUnified
      .filter((p) => p && p.scope === "otros")
      .map((p) => {
        const { scope, ...rest } = p;
        return rest;
      });
    try {
      localStorage.setItem("otrosProductosCompra", JSON.stringify(legacyExtras));
    } catch {
      if (typeof appUtils.saveList === "function") {
        try {
          appUtils.saveList("otrosProductosCompra", legacyExtras);
        } catch {}
      }
    }
  };

  // Si hay store activo, delegamos en él para evitar doble render pesado
  if (isStoreActive()) {
    if (window.AppStore && window.AppStore.actions && typeof window.AppStore.actions.setUnifiedProducts === "function") {
      try {
        window.AppStore.actions.setUnifiedProducts(updatedUnified);
        setTimeout(persistLegacy, 0);
        return;
      } catch {}
    }
    if (window.DataService && typeof window.DataService.setUnifiedProducts === "function") {
      try {
        window.DataService.setUnifiedProducts(updatedUnified);
        setTimeout(persistLegacy, 0);
        return;
      } catch {}
    }
  }

  // Modo sin store: persistimos local y renderizamos
  setUnifiedList(updatedUnified);
  saveExtraProducts();
  persistLegacy();

  requestAnimationFrame(() => {
    renderExtraQuickTable();
    renderExtraEditTable();
    renderShoppingList();
  });
}

function updateUnifiedWithProducts(list) {
  const extras = getOtherProducts();
  const scoped = [
    ...list.map((p) => ({ ...p, scope: "almacen" })),
    ...extras.map((p) => ({ ...p, scope: "otros" })),
  ];
  return setUnifiedList(scoped);
}

function updateUnifiedWithExtras(list) {
  const prods = getPantryProducts();
  const scoped = [
    ...prods.map((p) => ({ ...p, scope: "almacen" })),
    ...list.map((p) => ({ ...p, scope: "otros" })),
  ];
  return setUnifiedList(scoped);
}

function handleGlobalExtraBuyToggle(e) {
  const target = e.target;
  if (!target || target.type !== "checkbox" || target.dataset.field !== "buy") return;
  const row = target.closest("tr");
  const id = target.dataset.id || row?.dataset.id;
  if (!id) return;
  const inExtrasTable =
    (extraListTableBody && extraListTableBody.contains(row)) ||
    (extraTableBody && extraTableBody.contains(row));
  if (!inExtrasTable) return;
  updateExtraBuyFlag(id, target.checked);
}

function isStoreActive() {
  return !!(
    (stateAdapter && typeof stateAdapter.subscribe === "function") ||
    (window.AppStore && typeof window.AppStore.subscribe === "function")
  );
}


function hasSnapshotData(snap) {
  if (!snap || typeof snap !== "object") return false;
  const arrays = [
    snap.unifiedProducts,
    snap.products,
    snap.extraProducts,
    snap.suppliers,
    snap.producers,
    snap.productInstances,
    snap.classifications,
  ].filter(Array.isArray);
  return arrays.some((arr) => arr.length > 0);
}

function applyStateSnapshot(snapshot = {}) {
  const nextProducts = snapshot.products || products || [];
  const nextExtras = snapshot.extraProducts || extraProducts || [];
  const unified = Array.isArray(snapshot.unifiedProducts) && snapshot.unifiedProducts.length > 0
    ? snapshot.unifiedProducts
    : [
        ...nextProducts.map((p) => ({ ...p, scope: "almacen" })),
        ...nextExtras.map((p) => ({ ...p, scope: "otros" })),
      ];

  unifiedProducts = unified;
  suppliers = snapshot.suppliers || suppliers || [];
  producers = snapshot.producers || producers || [];
  classifications = snapshot.classifications || classifications || [];
  productInstances = snapshot.productInstances || productInstances || [];

  refreshProductsFromUnified();
}

function syncFromAppStore() {
  const snapshot =
    (stateAdapter && typeof stateAdapter.getState === "function" && stateAdapter.getState()) ||
    (window.AppStore && typeof window.AppStore.getState === "function" && window.AppStore.getState());
  if (snapshot) applyStateSnapshot(snapshot);
}

function persistUnified(list) {
  setUnifiedList(Array.isArray(list) ? list : []);
}

// ==============================
//  REFERENCIAS DOM
// ==============================

let summaryInfo;

// Navegación principal
let mainAlmacenButton;
let mainOtrosButton;
let mainSelectionButton;
let mainClassificationButton;
let mainProducersButton;
let mainStoresButton;
let almacenSection;
let otrosSection;
let classificationSection;
let proveedoresSection;

// Modo edición
let almacenEditModeButton;
let otrosEditModeButton;

// Paneles
let almacenInventoryPanel;
let almacenEditPanel;
let otrosListPanel;
let otrosEditPanel;

// Almacén (vista principal)
let filterSearchInput;
let filterShelfSelect;
let filterBlockSelect;
let filterTypeSelect;
let filterStoreSelect;
let filterStatusSelect;
let productTableBody;

// Almacén (editar)
let gridTableBody;
let saveGridButton;
let addGridRowButton;
let editFilterSearchInput;
let editFilterFamilySelect;
let editFilterTypeSelect;
let editFilterShelfSelect;
let editFilterStoreSelect;

// Otros (vista principal)
let extraListTableBody;
let extraFilterSearchInput;
let extraFilterFamilySelect;
let extraFilterTypeSelect;
let extraFilterStoreSelect;
let extraFilterBuySelect;

// Otros (editar)
let extraTableBody;
let addExtraRowButton;
let saveExtraButton;
let extraEditFilterSearchInput;
let extraEditFilterFamilySelect;
let extraEditFilterTypeSelect;
let extraEditFilterStoreSelect;
let extraQuickRowTemplate;
let inventoryRowTemplate;

// Productores
let producersSearchInput;
let producersLocationFilterSelect;
let producersTableBody;
let addProducerButton;
let saveProducersButton;

// Tiendas
let storesSearchInput;
let storesTypeFilterSelect;
let storesLocationFilterSelect;
let storesTableBody;
let addStoreButton;
let saveStoresButton;

// Selección de productos (instancias)
let instancesSearchInput;
let instancesFamilyFilterSelect;
let instancesProducerFilterSelect;
let instancesStoreFilterSelect;
let instancesTableBody;
let addInstanceButton;
let saveInstancesButton;
let productsDatalist;
let addQuickProductButton;
let addQuickExtraButton;
let classificationTableBody;
let addClassificationButton;
let saveClassificationsButton;
let classificationViewContext;
let producersViewContext;
let storesViewContext;
let instancesViewContext;
let inventoryEditViewContext;
let extraEditViewContext;
let extrasViewContext;
let inventoryController;
let inventoryEditRowTemplate;
let extraEditRowTemplate;
let classificationRowTemplate;
let producersRowTemplate;
let storesRowTemplate;
let instancesRowTemplate;
let extraController;
let instancesController;
let classificationController;
let producersController;
let storesController;
const getExtrasActions = () =>
  window.ExtrasFeature && typeof window.ExtrasFeature.getActions === "function"
    ? window.ExtrasFeature.getActions()
    : null;
// Snapshot helper para export/import en modo store o standalone
function getLatestStateSnapshot() {
  const snapshot = getStateSnapshot();
  const unifiedList = getUnifiedList();
  return {
    ...snapshot,
    products: getPantryProducts(),
    extraProducts: getOtherProducts(),
    unifiedProducts: unifiedList.length ? unifiedList : recomputeUnifiedFromDerived(),
    suppliers: getSuppliersList(),
    producers: getProducersList(),
    classifications: getClassificationsList(),
    productInstances: getInstancesList(),
  };
}

function initNavAccessibility() {
  const tabsMain = document.querySelector(".tabs-main");
  if (tabsMain) {
    tabsMain.setAttribute("role", "tablist");
    tabsMain.querySelectorAll(".tab-button").forEach((btn) => {
      btn.setAttribute("role", "tab");
    });
  }
  const proveedoresTabs = document.querySelector(".tabs-proveedores");
  if (proveedoresTabs) {
    proveedoresTabs.setAttribute("role", "tablist");
    proveedoresTabs.querySelectorAll("button").forEach((btn) => {
      btn.setAttribute("role", "tab");
    });
  }
}

function initFiltersAccessibility() {
  document.querySelectorAll(".filters").forEach((filter) => {
    filter.setAttribute("role", "search");
    if (!filter.getAttribute("aria-label")) {
      const title = filter.closest("section")?.querySelector("h2");
      if (title) {
        filter.setAttribute(
          "aria-label",
          `Filtros para ${title.textContent.trim()}`
        );
      }
    }
  });
}

// Tabs tiendas/productores
let producersPanel;
let storesPanel;
let instancesPanel;

// Lista compra
let shoppingListContainer;
let shoppingSummary;
let copyListButton;
let shoppingStoreTemplate;
let shoppingItemTemplate;

// Backup y Excel
let exportBackupButton;
let importBackupButton;
let backupFileInput;
let exportAlmacenCsvButton;
let exportOtrosCsvButton;

// Toggle lista compra
let toggleShoppingPanelButton;

// Popup selección
let selectionPopupOverlay;
let selectionPopup;
let selectionPopupTitle;
let selectionPopupList;
let selectionPopupClose;
let selectionPopupHeader;
let selectionPopupBody;
let lastSelectionTrigger = null;
let instancesTableWrapper;
let inlineProducerSelect;
let inlineBrandInput;
let inlineStoresSelect;

// Memos para evitar recalcular opciones cuando no cambian
let memoShelves = [];
let memoBlocks = [];
let memoTypes = [];
let memoStores = [];
let memoProducerLocations = [];
let memoStoreLocations = [];
let memoInstanceFamilies = [];
let memoProducerFilterOptions = "";
let memoProductsDatalistKey = "";
let saveShortcutBound = false;

let filtersDefaultsApplied = false;
let selectionDragCleanup = null;
let selectionPopupInitialized = false;

function showToast(message, timeout = 1800) {
  if (window.UIHelpers && typeof window.UIHelpers.showToast === "function") {
    window.UIHelpers.showToast(message, timeout);
    return;
  }
  if (!message) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), timeout + 400);
}

const renderProductsDebounced = debounce(() => {
  if (window.InventoryFeature && typeof window.InventoryFeature.render === "function") {
    window.InventoryFeature.render();
  } else {
    renderProducts();
  }
}, 80);

function ensureSaveShortcutBinding() {
  if (saveShortcutBound) return;
  saveShortcutBound = true;
  const options = { capture: true, passive: false };
  // Escucha keydown en captura sobre window/document/body para cortar Ctrl/Cmd+S
  const handler = handleGlobalSaveShortcut;
  window.addEventListener("keydown", handler, options);
  document.addEventListener("keydown", handler, options);
  if (document.body) document.body.addEventListener("keydown", handler, options);
}

function getInventoryContext() {
  return {
    refs: {
      productTableBody,
      filterSearchInput,
      filterShelfSelect,
      filterBlockSelect,
      filterTypeSelect,
      filterStoreSelect,
      filterStatusSelect,
      summaryInfo,
      inventoryRowTemplate,
    },
    state: {
      products: getPantryProducts(),
      productDrafts,
    },
    helpers: {
      createTableInput,
      createTableTextarea,
      createFamilySelect,
      createTypeSelect,
      linkFamilyTypeSelects,
      buildFamilyStripeMap,
      compareShelfBlockTypeName,
      productMatchesStore,
      getSelectionLabelForProduct,
      getSelectionStoresForProduct,
      createSelectionButton,
      handleInventoryTableClick,
    },
  };
}

// ==============================
//  INICIALIZACIÓN
// ==============================

document.addEventListener("DOMContentLoaded", () => {
  ensureSaveShortcutBinding();
  const refs =
    window.AppBootstrap && typeof window.AppBootstrap.collectRefs === "function"
      ? window.AppBootstrap.collectRefs()
      : {};

  ({
    summaryInfo,
    mainAlmacenButton,
    mainOtrosButton,
    mainSelectionButton,
    mainClassificationButton,
    mainProducersButton,
    mainStoresButton,
    almacenSection,
    otrosSection,
    classificationSection,
    proveedoresSection,
    almacenEditModeButton,
    otrosEditModeButton,
    almacenInventoryPanel,
    almacenEditPanel,
    otrosListPanel,
    otrosEditPanel,
    filterSearchInput,
    filterShelfSelect,
    filterBlockSelect,
    filterTypeSelect,
    filterStoreSelect,
    filterStatusSelect,
    productTableBody,
    inventoryRowTemplate,
    inventoryEditRowTemplate,
    classificationRowTemplate,
    producersRowTemplate,
    storesRowTemplate,
    instancesRowTemplate,
    gridTableBody,
    saveGridButton,
    addGridRowButton,
    editFilterSearchInput,
    editFilterFamilySelect,
    editFilterTypeSelect,
    editFilterShelfSelect,
    editFilterStoreSelect,
    extraListTableBody,
    extraFilterSearchInput,
    extraFilterFamilySelect,
    extraFilterTypeSelect,
    extraFilterStoreSelect,
    extraFilterBuySelect,
    extraTableBody,
    addExtraRowButton,
    saveExtraButton,
    extraEditFilterSearchInput,
    extraEditFilterFamilySelect,
    extraEditFilterTypeSelect,
    extraEditFilterStoreSelect,
    extraQuickRowTemplate,
    extraEditRowTemplate,
    producersSearchInput,
    producersLocationFilterSelect,
    producersTableBody,
    addProducerButton,
    saveProducersButton,
    storesSearchInput,
    storesTypeFilterSelect,
    storesLocationFilterSelect,
    storesTableBody,
    addStoreButton,
    saveStoresButton,
    instancesSearchInput,
    instancesFamilyFilterSelect,
    instancesProducerFilterSelect,
    instancesStoreFilterSelect,
    instancesTableBody,
    addInstanceButton,
    saveInstancesButton,
    productsDatalist,
    addQuickProductButton,
    addQuickExtraButton,
    classificationTableBody,
    addClassificationButton,
    saveClassificationsButton,
    producersPanel,
    storesPanel,
    instancesPanel,
    shoppingListContainer,
    shoppingSummary,
    copyListButton,
    instancesTableWrapper,
    shoppingStoreTemplate,
    shoppingItemTemplate,
    exportBackupButton,
    importBackupButton,
    backupFileInput,
    exportAlmacenCsvButton,
    exportOtrosCsvButton,
    toggleShoppingPanelButton,
    selectionPopupOverlay,
    selectionPopup,
    selectionPopupTitle,
    selectionPopupList,
    selectionPopupClose,
    selectionPopupHeader,
    selectionPopupBody,
  } = { ...refs });

  if (shoppingSummary && !shoppingSummary.getAttribute("aria-live")) {
    shoppingSummary.setAttribute("aria-live", "polite");
    shoppingSummary.setAttribute("role", "status");
  }
  if (summaryInfo && !summaryInfo.getAttribute("aria-live")) {
    summaryInfo.setAttribute("aria-live", "polite");
    summaryInfo.setAttribute("role", "status");
  }

  const renderInstancesDebounced = debounce(renderInstancesTable, 80);

  ensureSelectionPopupInit();
  document.addEventListener("change", handleGlobalExtraBuyToggle, { capture: true });

  if (window.ProductAutocomplete && typeof window.ProductAutocomplete.init === "function") {
    window.ProductAutocomplete.init({
      tableBody: instancesTableBody,
      getSuggestions: getProductAutocompleteSuggestions,
    });
  }

  if (window.AppBootstrap) {
    window.AppBootstrap.initMainNav(refs, {
      setMainSection,
      toggleAlmacenEditMode,
      toggleOtrosEditMode,
    });

    window.AppBootstrap.initFilters(refs, {
      renderInstancesTable: renderInstancesDebounced,
      handleAddQuickProduct,
      handleAddQuickExtra,
      handleShoppingListClick,
      handleCopyList,
      handleExportBackup,
      handleBackupFileChange,
      handleExportAlmacenCsv,
      handleExportOtrosCsv,
      handleToggleShoppingPanel,
      triggerImportBackup: () => backupFileInput && backupFileInput.click(),
    });

    window.AppBootstrap.initPopups(refs, {
      closeSelectionPopup,
      handleSelectionPopupResize,
      handleSelectionPopupKeydown,
      initHorizontalTableScroll,
    });

    if (toggleShoppingPanelButton) {
      toggleShoppingPanelButton.title = "Mostrar lista de la compra";
    }

    const linkedPairs = [
      [filterBlockSelect, filterTypeSelect],
      [editFilterFamilySelect, editFilterTypeSelect],
      [extraFilterFamilySelect, extraFilterTypeSelect],
      [extraEditFilterFamilySelect, extraEditFilterTypeSelect],
    ];
    linkedPairs.forEach(([fam, type]) => {
      const sync = () =>
        syncFamilyTypeFilterPair(fam, type, { familyAllLabel: "Todas", typeAllLabel: "Todos" });
      if (fam) fam.addEventListener("change", sync);
      if (type) type.addEventListener("change", sync);
    });
  }

  ensureSaveShortcutBinding();

  // Carga datos y renderizado inicial
  loadAllData();

  const syncFromState = (next) => {
    isSyncingFromStore = true;
    applyStateSnapshot(next || {});
    ensureInstanceFamilies({ persist: false });
    isSyncingFromStore = false;
    renderShelfOptions();
    renderBlockOptions();
    renderTypeOptions();
    renderStoreOptions();
    updateProducerFilterOptions();
    updateStoreFilterOptions();
    updateInstanceFilterOptions();
    renderProductsDatalist();

    if (inventoryController) {
      inventoryController.setDrafts(productDrafts);
      inventoryController.render();
    } else if (window.InventoryFeature && typeof window.InventoryFeature.render === "function") {
      window.InventoryFeature.render();
    } else {
      renderProducts();
    }
    if (!isStoreActive()) {
      renderGridRows();
      renderExtraQuickTable();
      renderExtraEditTable();
    }
    if (window.ProducersFeature && typeof window.ProducersFeature.render === "function") {
      window.ProducersFeature.render();
    } else if (window.ProducersView && typeof window.ProducersView.render === "function") {
      window.ProducersView.render(producersViewContext);
    }
    if (window.StoresFeature && typeof window.StoresFeature.render === "function") {
      window.StoresFeature.render();
    } else if (window.StoresView && typeof window.StoresView.render === "function") {
      window.StoresView.render(storesViewContext);
    }
    renderClassificationTable();
    if (instancesController) {
      instancesController.render();
    } else {
      renderInstancesTable();
    }
    renderShoppingList();
    initResizableTables();

    if (!filtersDefaultsApplied) {
      filtersDefaultsApplied = true;
      if (window.UIHelpers && typeof window.UIHelpers.resetFilters === "function") {
        window.UIHelpers.resetFilters({
          filterSearchInput,
          filterShelfSelect,
          filterBlockSelect,
          filterTypeSelect,
          filterStoreSelect,
          filterStatusSelect,
          editFilterSearchInput,
          editFilterFamilySelect,
          editFilterTypeSelect,
          editFilterShelfSelect,
          editFilterStoreSelect,
          extraFilterSearchInput,
          extraFilterFamilySelect,
          extraFilterTypeSelect,
          extraFilterStoreSelect,
          extraFilterBuySelect,
          extraEditFilterSearchInput,
          extraEditFilterFamilySelect,
          extraEditFilterTypeSelect,
          extraEditFilterStoreSelect,
          instancesSearchInput,
          instancesFamilyFilterSelect,
          instancesProducerFilterSelect,
          instancesStoreFilterSelect,
        });
      }
      renderProducts();
      renderGridRows();
      renderExtraQuickTable();
      renderExtraEditTable();
      renderInstancesTable();
    }
  };

  if (window.AppStore && window.ViewControllers && typeof window.ViewControllers.create === "function") {
    window.ViewControllers.create(window.AppStore, { onState: syncFromState });
  } else if (window.AppState && typeof window.AppState.subscribe === "function") {
    syncFromState(window.AppState.getState());
    window.AppState.subscribe(syncFromState);
  }

  extrasViewContext = {
    refs: {
      tableBody: extraListTableBody,
      searchInput: extraFilterSearchInput,
      familyFilter: extraFilterFamilySelect,
      typeFilter: extraFilterTypeSelect,
      storeFilter: extraFilterStoreSelect,
      buyFilter: extraFilterBuySelect,
      rowTemplate: extraQuickRowTemplate,
    },
    getExtras: () => getOtherProducts(),
    getDrafts: () => extraDrafts,
    buildFamilyStripeMap,
    helpers: {
      createTableInput,
      createTableTextarea,
      createFamilySelect,
      createTypeSelect,
      linkFamilyTypeSelects,
      createSelectionButton,
      getSelectionLabelForProduct,
      getSelectionStoresForProduct,
    },
    getSelectionInstanceForProduct,
    getStoreNames,
    persistUnified,
    getPantryProducts,
    onToggleBuy: updateExtraBuyFlag,
    onChange: () => {
      renderProducts();
      renderExtraQuickTable();
      renderExtraEditTable();
      renderShoppingList();
      renderShelfOptions();
      renderBlockOptions();
      renderTypeOptions();
      renderProductsDatalist();
    },
    onSelectSelection: (id) => openSelectionPopupForProduct(id),
    onMoveToAlmacen: (id) => {
      const acts = getExtrasActions();
      if (acts && typeof acts.moveToAlmacen === "function") {
        acts.moveToAlmacen(id);
      }
    },
    onDelete: (id) => {
      const acts = getExtrasActions();
      if (acts && typeof acts.delete === "function") {
        acts.delete(id);
      }
    },
    onCancelDraft: (id) => {
      if (!id) return;
      extraDrafts = extraDrafts.filter((d) => d.id !== id);
      renderExtraQuickTable();
    },
  };

  if (window.ExtrasView && typeof window.ExtrasView.init === "function") {
    window.ExtrasView.init(extrasViewContext);
  }

  extraEditViewContext = {
    refs: {
      tableBody: extraTableBody,
      addButton: addExtraRowButton,
      saveButton: saveExtraButton,
      searchInput: extraEditFilterSearchInput,
      familyFilter: extraEditFilterFamilySelect,
      typeFilter: extraEditFilterTypeSelect,
      storeFilter: extraEditFilterStoreSelect,
      rowTemplate: extraEditRowTemplate,
    },
    getProducts: () => getOtherProducts(),
    findById: (id) => getOtherProducts().find((p) => p.id === id),
    buildFamilyStripeMap,
    sorter: (a, b) =>
      (a.block || "").localeCompare(b.block || "", "es", { sensitivity: "base" }) ||
      (a.type || "").localeCompare(b.type || "", "es", { sensitivity: "base" }) ||
      (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" }),
    matchesStore: (id, storeId) => {
      if (!storeId) return true;
      const product = getOtherProducts().find((p) => p.id === id);
      if (!product) return true;
      const inst = getSelectionInstanceForProduct(product);
      return !!(inst && Array.isArray(inst.storeIds) && inst.storeIds.includes(storeId));
    },
    helpers: {
      createTableInput,
      createTableTextarea,
      createFamilySelect,
      createTypeSelect,
      linkFamilyTypeSelects,
      createSelectionButton,
      getSelectionLabelForProduct,
      getSelectionStoresForProduct,
    },
    persist: (list) => {
      const nextList = Array.isArray(list) ? list : [];
      const prods = getPantryProducts();
      const unified = [
        ...prods.map((p) => ({ ...p, scope: "almacen" })),
        ...nextList.map((p) => ({ ...p, scope: "otros" })),
      ];
      setUnifiedList(unified);
    },
    onAfterSave: () => {
      renderBlockOptions();
      renderTypeOptions();
      updateInstanceFilterOptions();
      renderProductsDatalist();
      renderExtraQuickTable();
      renderShoppingList();
      setOtrosMode(false);
      showToast("Otros productos guardados");
    },
    onSelectSelection: (id) => openSelectionPopupForProduct(id),
    onMoveToAlmacen: (id) => {
      const acts = getExtrasActions();
      if (acts && typeof acts.moveToAlmacen === "function") {
        acts.moveToAlmacen(id);
      }
    },
    onDelete: (id) => {
      const acts = getExtrasActions();
      if (acts && typeof acts.delete === "function") {
        acts.delete(id);
      }
    },
    nowIsoString,
  };

  if (window.ExtraEditView && typeof window.ExtraEditView.init === "function") {
    window.ExtraEditView.init(extraEditViewContext);
  }

  inventoryEditViewContext = {
    refs: {
      tableBody: gridTableBody,
      addButton: addGridRowButton,
      saveButton: saveGridButton,
      searchInput: editFilterSearchInput,
      familyFilter: editFilterFamilySelect,
      typeFilter: editFilterTypeSelect,
      shelfFilter: editFilterShelfSelect,
      storeFilter: editFilterStoreSelect,
      rowTemplate: inventoryEditRowTemplate,
    },
    getProducts: () => getPantryProducts(),
    findById: (id) => getPantryProducts().find((p) => p.id === id),
    buildFamilyStripeMap,
    sorter: compareShelfBlockTypeName,
    matchesStore: (id, storeId) => {
      if (!storeId) return true;
      const product = getPantryProducts().find((p) => p.id === id);
      if (!product) return true;
      const inst = getSelectionInstanceForProduct(product);
      return !!(inst && Array.isArray(inst.storeIds) && inst.storeIds.includes(storeId));
    },
    helpers: {
      createTableInput,
      createTableTextarea,
      createFamilySelect,
      createTypeSelect,
      linkFamilyTypeSelects,
      createSelectionButton,
      getSelectionLabelForProduct,
      getSelectionStoresForProduct,
    },
    persist: (list) => {
      const nextList = Array.isArray(list) ? list : [];
      const extras = getOtherProducts();
      const unified = [
        ...nextList.map((p) => ({ ...p, scope: "almacen" })),
        ...extras.map((p) => ({ ...p, scope: "otros" })),
      ];
      setUnifiedList(unified);
      saveProducts();
    },
    onAfterSave: () => {
      renderShelfOptions();
      renderBlockOptions();
      renderTypeOptions();
      updateInstanceFilterOptions();
      renderProductsDatalist();
      renderProducts();
      renderShoppingList();
      setAlmacenMode(false);
      showToast("Inventario guardado");
    },
    onMoveToExtra: (id) => moveProductToExtra(id),
    onSelectSelection: (id) => openSelectionPopupForProduct(id),
    onDelete: (id) => removeProductById(id),
    nowIsoString,
  };

  if (window.InventoryEditView && typeof window.InventoryEditView.init === "function") {
    window.InventoryEditView.init(inventoryEditViewContext);
  }

  classificationViewContext = {
    refs: {
      tableBody: classificationTableBody,
      addButton: addClassificationButton,
      saveButton: saveClassificationsButton,
      rowTemplate: classificationRowTemplate,
    },
    getClassifications: () => getClassificationsList(),
    persist: (list) => {
      setClassificationsList(Array.isArray(list) ? list : []);
    },
    onAfterSave: handleClassificationDependencies,
    nowIsoString,
  };

  if (window.ClassificationView && typeof window.ClassificationView.init === "function") {
    window.ClassificationView.init(classificationViewContext);
  }

  producersViewContext = {
    refs: {
      tableBody: producersTableBody,
      addButton: addProducerButton,
      saveButton: saveProducersButton,
      searchInput: producersSearchInput,
      locationFilter: producersLocationFilterSelect,
      rowTemplate: producersRowTemplate,
    },
    getProducers: () => getProducersList(),
    persist: (list) => {
      setProducersList(Array.isArray(list) ? list : []);
    },
    onAfterSave: handleProducersDependencies,
    nowIsoString,
  };

  if (window.ProducersView && typeof window.ProducersView.init === "function") {
    window.ProducersView.init(producersViewContext);
  }
  if (window.ProducersFeature && typeof window.ProducersFeature.init === "function") {
    window.ProducersFeature.init({
      context: producersViewContext,
      refs: producersViewContext.refs,
      actions: {
        save: () => window.ProducersView && window.ProducersView.save && window.ProducersView.save(producersViewContext),
      },
    });
  }

  storesViewContext = {
    refs: {
      tableBody: storesTableBody,
      addButton: addStoreButton,
      saveButton: saveStoresButton,
      searchInput: storesSearchInput,
      typeFilter: storesTypeFilterSelect,
      locationFilter: storesLocationFilterSelect,
      rowTemplate: storesRowTemplate,
    },
    getStores: () => getSuppliersList(),
    persist: (list) => {
      setSuppliersList(Array.isArray(list) ? list : []);
    },
    onAfterSave: handleStoresDependencies,
    nowIsoString,
  };

  if (window.StoresView && typeof window.StoresView.init === "function") {
    window.StoresView.init(storesViewContext);
  }
  if (window.StoresFeature && typeof window.StoresFeature.init === "function") {
    window.StoresFeature.init({
      context: storesViewContext,
      refs: storesViewContext.refs,
      actions: {
        save: () => window.StoresView && window.StoresView.save && window.StoresView.save(storesViewContext),
      },
    });
  }

  instancesViewContext = {
    refs: {
      tableBody: instancesTableBody,
      addButton: addInstanceButton,
      saveButton: saveInstancesButton,
      searchInput: instancesSearchInput,
      familyFilter: instancesFamilyFilterSelect,
      producerFilter: instancesProducerFilterSelect,
      storeFilter: instancesStoreFilterSelect,
      rowTemplate: instancesRowTemplate,
    },
    data: {
      instances: getInstancesList(),
      producers: getProducersList(),
      stores: getSuppliersList(),
    },
    getAllProducts: () => getAllProductsForAssociationList(),
    getFamilyForInstance,
    getProducerName,
    getStoreNames,
    buildFamilyStripeMap,
    attachMultiSelectToggle,
    persist: persistInstances,
    onCreateProduct: openInlineProductCreator,
    onAfterSave: handleInstancesDependencies,
    nowIsoString,
  };

  if (window.InstancesView && typeof window.InstancesView.init === "function") {
    window.InstancesView.init(instancesViewContext);
  }

  inventoryController =
    window.InventoryController && window.InventoryController.create
      ? window.InventoryController.create({
          store: window.AppStore || window.AppState,
          view: window.InventoryView,
          helpers: {
            createTableInput,
            createTableTextarea,
            createFamilySelect,
            createTypeSelect,
            linkFamilyTypeSelects,
            buildFamilyStripeMap,
            compareShelfBlockTypeName,
            productMatchesStore,
            getSelectionLabelForProduct,
            getSelectionStoresForProduct,
            createSelectionButton,
            handleInventoryTableClick,
          },
        })
      : null;

  if (inventoryController) {
    inventoryController.setRefs({
      productTableBody,
      filterSearchInput,
      filterShelfSelect,
      filterBlockSelect,
      filterTypeSelect,
      filterStoreSelect,
      filterStatusSelect,
      summaryInfo,
    });
    inventoryController.setDrafts(productDrafts);
    inventoryController.render();
  } else if (window.InventoryFeature && typeof window.InventoryFeature.init === "function") {
    window.InventoryFeature.init({
      refs: {
        tableBody: productTableBody,
      },
      getProducts: () => getPantryProducts(),
      getDrafts: () => productDrafts,
      getInventoryContext,
      actions: {
        toggleHave: (id, checked) => {
          const nowDate = todayDateString();
          const nowIsoVal = nowIsoString();
          const unified = getUnifiedForWrite();
          let touched = false;
          const updatedUnified = unified.map((p) => {
            if (p.id !== id) return p;
            touched = true;
            const wasHave = !!p.have;
            const nextAcq = !wasHave && checked ? nowDate : p.acquisitionDate;
            return { ...p, have: !!checked, acquisitionDate: nextAcq, updatedAt: nowIsoVal };
          });
          if (!touched) return;

          unifiedProducts = updatedUnified;
          refreshProductsFromUnified();
          try {
            if (window.AppStorage?.saveUnifiedProducts) {
              window.AppStorage.saveUnifiedProducts(updatedUnified);
            } else if (typeof appUtils.saveList === "function") {
              appUtils.saveList("productosCocinaUnificados", updatedUnified);
            } else {
              localStorage.setItem("productosCocinaUnificados", JSON.stringify(updatedUnified));
            }
          } catch {}

          // Ajuste rápido en UI para feedback inmediato
          const row = productTableBody?.querySelector(`tr[data-id="${id}"]`);
          if (row) {
            row.dataset.have = checked ? "1" : "0";
            const chk = row.querySelector('input[data-field="have"]');
            if (chk) chk.checked = !!checked;
          }
          if (summaryInfo && productTableBody) {
            const visible = Array.from(productTableBody.querySelectorAll("tr[data-id]")).filter(
              (tr) => tr.style.display !== "none"
            );
            const haveCount = visible.filter((tr) => tr.dataset.have === "1").length;
            const total = visible.length;
            summaryInfo.textContent = `Total: ${total} · Tengo: ${haveCount} · Faltan: ${Math.max(
              total - haveCount,
              0
            )}`;
          }
          requestAnimationFrame(() => renderShoppingList());
        },
        moveToExtra: moveProductToExtra,
        selectSelection: openSelectionPopupForProduct,
        cancelDraft: (id) => {
          productDrafts = productDrafts.filter((d) => d.id !== id);
          renderProducts();
        },
        saveDraft: (id) => commitDraftProducts(id ? [id] : null),
        startEdit: (id) => startEditProduct(id),
        deleteProduct: (id) => deleteProduct(id),
      },
    });
    window.InventoryFeature.render();
  }

  extraController =
    window.ExtraController && window.ExtraController.create
      ? window.ExtraController.create({
          store: window.AppStore || window.AppState,
          onRender: () => {
            renderExtraQuickTable();
            renderExtraEditTable();
            renderShoppingList();
          },
        })
      : null;
  if (window.ExtrasFeature && typeof window.ExtrasFeature.init === "function") {
    window.ExtrasFeature.init({
      refs: { tableBody: extraListTableBody },
      getExtras: () => getOtherProducts(),
      getDrafts: () => extraDrafts,
      buildFamilyStripeMap,
      helpers: {
        createTableInput,
        createTableTextarea,
        createFamilySelect,
        createTypeSelect,
        linkFamilyTypeSelects,
        createSelectionButton,
        getSelectionLabelForProduct,
        getSelectionStoresForProduct,
      },
      getSelectionInstanceForProduct,
      getStoreNames,
      persistUnified,
      getPantryProducts,
      onChange: () => {
        renderExtraQuickTable();
        renderExtraEditTable();
        renderShoppingList();
        renderProducts();
        renderProductsDatalist();
      },
      actions: {
        toggleBuy: (id, checked) => {
          updateExtraBuyFlag(id, checked);
        },
        selectSelection: (id) => openSelectionPopupForProduct(id),
        cancelDraft: (id) => {
          if (!id) return;
          extraDrafts = extraDrafts.filter((d) => d.id !== id);
          renderExtraQuickTable();
        },
      },
      getContext: () => extrasViewContext,
    });
  }
  if (extraController && typeof extraController.render === "function") {
    extraController.render();
  } else if (window.ExtrasFeature && typeof window.ExtrasFeature.render === "function") {
    window.ExtrasFeature.render();
  }

  instancesController =
    window.InstancesController && window.InstancesController.create
      ? window.InstancesController.create({
          store: window.AppStore || window.AppState,
          view: window.InstancesView,
          feature: window.InstancesFeature,
          context: instancesViewContext,
        })
      : null;
  if (window.InstancesFeature && typeof window.InstancesFeature.init === "function") {
    window.InstancesFeature.init({
      refs: {
        tableBody: instancesTableBody,
        addButton: addInstanceButton,
        saveButton: saveInstancesButton,
      },
      getContext: () => {
        if (instancesViewContext && instancesViewContext.data) {
          instancesViewContext.data.instances = getInstancesList();
          instancesViewContext.data.producers = getProducersList();
          instancesViewContext.data.stores = getSuppliersList();
        }
        return instancesViewContext;
      },
      getInstances: () => getInstancesList(),
      actions: {
        delete: (id) => removeInstanceById(id),
        updateField: (id, field, value) => {
          const list = getInstancesList().map((inst) =>
            inst.id === id ? { ...inst, [field]: value, updatedAt: nowIsoString() } : inst
          );
          setInstancesList(list);
        },
        add: () => handleAddInstanceRow(),
        save: () => handleSaveInstances(),
      },
    });
  }

  if (instancesController && typeof instancesController.render === "function") {
    instancesController.render();
  } else if (window.InstancesFeature && typeof window.InstancesFeature.render === "function") {
    window.InstancesFeature.render();
  }

  if (window.InventoryView && typeof window.InventoryView.init === "function") {
    window.InventoryView.init(getInventoryContext());
  }

  classificationController =
    window.ClassificationController && window.ClassificationController.create
      ? window.ClassificationController.create({
          store: window.AppStore || window.AppState,
          onRender: renderClassificationTable,
        })
      : null;

  producersController =
    window.ProducersController && window.ProducersController.create
      ? window.ProducersController.create({
          store: window.AppStore || window.AppState,
          onRender: () => {
            if (window.ProducersFeature && typeof window.ProducersFeature.render === "function") {
              window.ProducersFeature.render();
            } else if (window.ProducersView && typeof window.ProducersView.render === "function") {
              window.ProducersView.render(producersViewContext);
            }
            updateProducerFilterOptions();
          },
        })
      : null;

  storesController =
    window.StoresController && window.StoresController.create
      ? window.StoresController.create({
          store: window.AppStore || window.AppState,
          onRender: () => {
            if (window.StoresFeature && typeof window.StoresFeature.render === "function") {
              window.StoresFeature.render();
            } else if (window.StoresView && typeof window.StoresView.render === "function") {
              window.StoresView.render(storesViewContext);
            }
            updateStoreFilterOptions();
            renderStoreOptions();
            renderShoppingList();
          },
        })
      : null;

  const currentState =
    (window.AppStore && typeof window.AppStore.getState === "function"
      ? window.AppStore.getState()
      : window.AppState && typeof window.AppState.getState === "function"
      ? window.AppState.getState()
      : {});
  syncFromState(currentState);
  document.addEventListener("keydown", handleGlobalSaveShortcut, { capture: true, passive: false });
  window.addEventListener("keydown", handleGlobalSaveShortcut, { capture: true, passive: false });
  document.addEventListener("keypress", handleGlobalSaveShortcut, { capture: true, passive: false });
  window.addEventListener("keypress", handleGlobalSaveShortcut, { capture: true, passive: false });
  if (document.body) {
    document.body.addEventListener("keydown", handleGlobalSaveShortcut, {
      capture: true,
      passive: false,
    });
    document.body.addEventListener("keypress", handleGlobalSaveShortcut, {
      capture: true,
      passive: false,
    });
  }
  document.addEventListener("keydown", handleGlobalEscape);

  initNavAccessibility();
  initFiltersAccessibility();
  setMainSection("almacen");
  setAlmacenMode(false);
  setOtrosMode(false);
  setProveedoresTab("instances"); // pestaña por defecto: Selección de productos
});

// ==============================
//  NAVEGACIÓN Y MODOS
// ==============================

function setMainSection(section) {
  const isAlmacen = section === "almacen";
  const isOtros = section === "otros";
  const isSelection = section === "selection";
  const isClassification = section === "classification";
  const isProd = section === "producers";
  const isStores = section === "stores";
  const isProveedores = isSelection || isProd || isStores;

  const setAriaCurrent = (btn, active) => {
    if (!btn) return;
    if (active) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  };

  mainAlmacenButton.classList.toggle("active", isAlmacen);
  mainOtrosButton.classList.toggle("active", isOtros);
  setAriaCurrent(mainAlmacenButton, isAlmacen);
  setAriaCurrent(mainOtrosButton, isOtros);
  if (mainSelectionButton)
    mainSelectionButton.classList.toggle("active", isSelection);
  if (mainClassificationButton)
    mainClassificationButton.classList.toggle("active", isClassification);
  if (mainProducersButton)
    mainProducersButton.classList.toggle("active", isProd);
  if (mainStoresButton) mainStoresButton.classList.toggle("active", isStores);
  setAriaCurrent(mainSelectionButton, isSelection);
  setAriaCurrent(mainClassificationButton, isClassification);
  setAriaCurrent(mainProducersButton, isProd);
  setAriaCurrent(mainStoresButton, isStores);

  almacenSection.classList.toggle("active", isAlmacen);
  otrosSection.classList.toggle("active", isOtros);
  if (classificationSection)
    classificationSection.classList.toggle("active", isClassification);
  proveedoresSection.classList.toggle("active", isProveedores);

  if (isSelection) setProveedoresTab("instances");
  if (isProd) setProveedoresTab("producers");
  if (isStores) setProveedoresTab("stores");
}

function setAlmacenMode(editMode) {
  if (editMode) {
    renderGridRows();
  }
  almacenInventoryPanel.classList.toggle("active", !editMode);
  almacenEditPanel.classList.toggle("active", editMode);
  almacenEditModeButton.textContent = editMode
    ? "Volver a inventario"
    : "Editar inventario";
  const header = almacenSection.querySelector(".section-mode-header");
  if (header) {
    header.style.display = editMode ? "none" : "flex";
  }
}

function toggleAlmacenEditMode() {
  const editMode = !almacenEditPanel.classList.contains("active");
  setAlmacenMode(editMode);
}

function setOtrosMode(editMode) {
  if (editMode) {
    renderExtraEditTable();
  }
  otrosListPanel.classList.toggle("active", !editMode);
  otrosEditPanel.classList.toggle("active", editMode);
  otrosEditModeButton.textContent = editMode
    ? "Volver a lista"
    : "Editar lista";
  const header = otrosSection.querySelector(".section-mode-header");
  if (header) {
    header.style.display = editMode ? "none" : "flex";
  }
}

function toggleOtrosEditMode() {
  const editMode = !otrosEditPanel.classList.contains("active");
  setOtrosMode(editMode);
}

function setProveedoresTab(tab) {
  const isProd = tab === "producers";
  const isStores = tab === "stores";
  const isInstances = tab === "instances";

  producersPanel.classList.toggle("active", isProd);
  storesPanel.classList.toggle("active", isStores);
  instancesPanel.classList.toggle("active", isInstances);

  if (isProd) {
    if (window.ProducersFeature && typeof window.ProducersFeature.render === "function") {
      window.ProducersFeature.render();
    } else if (window.ProducersView && typeof window.ProducersView.render === "function") {
      window.ProducersView.render(producersViewContext);
    }
  }
  if (isStores) {
    if (window.StoresFeature && typeof window.StoresFeature.render === "function") {
      window.StoresFeature.render();
    } else if (window.StoresView && typeof window.StoresView.render === "function") {
      window.StoresView.render(storesViewContext);
    }
  }
  if (isInstances && !isStoreActive()) renderInstancesTable();
}

function handleToggleShoppingPanel() {
  const main = document.querySelector(".app-main");
  if (!main) return;
  const hidden = main.classList.toggle("shopping-hidden");
  toggleShoppingPanelButton.textContent = "🛒";
  toggleShoppingPanelButton.title = hidden
    ? "Mostrar lista de la compra"
    : "Ocultar lista de la compra";
}

function saveProducts() {
  const list = getPantryProducts();
  if (stateAdapter && typeof stateAdapter.setEntity === "function") {
    stateAdapter.setEntity("products", list);
    syncFromAppStore();
    return;
  }
  if (
    window.AppStore &&
    window.AppStore.actions &&
    typeof window.AppStore.actions.setProducts === "function"
  ) {
    window.AppStore.actions.setProducts(list);
    syncFromAppStore();
    return;
  }
  if (window.DataService && typeof window.DataService.setProducts === "function") {
    window.DataService.setProducts(list);
    return;
  }
  persistUnified(recomputeUnifiedFromDerived());
}
function saveExtraProducts() {
  const list = getOtherProducts();
  if (stateAdapter && typeof stateAdapter.setEntity === "function") {
    stateAdapter.setEntity("extraProducts", list);
    syncFromAppStore();
    return;
  }
  if (
    window.AppStore &&
    window.AppStore.actions &&
    typeof window.AppStore.actions.setExtraProducts === "function"
  ) {
    window.AppStore.actions.setExtraProducts(list);
    syncFromAppStore();
    return;
  }
  if (
    window.DataService &&
    typeof window.DataService.setExtraProducts === "function"
  ) {
    window.DataService.setExtraProducts(list);
    return;
  }
  persistUnified(recomputeUnifiedFromDerived());
}
function saveSuppliers() {
  setSuppliersList(getSuppliersList());
}
function saveProducers() {
  setProducersList(getProducersList());
}
function saveProductInstances() {
  setInstancesList(getInstancesList());
}
function saveClassifications() {
  setClassificationsList(getClassificationsList());
}

function loadAllData() {
  const loaders = [
    () => stateAdapter && typeof stateAdapter.bootstrap === "function" && stateAdapter.bootstrap(),
    () => window.AppStore && typeof window.AppStore.bootstrap === "function" && window.AppStore.bootstrap(),
    () =>
      window.DataService &&
      typeof window.DataService.hydrateFromStorage === "function" &&
      window.DataService.hydrateFromStorage(),
    () => window.AppStorage && typeof window.AppStorage.loadAllData === "function" && window.AppStorage.loadAllData(),
  ];

  for (const load of loaders) {
    let snapshot = null;
    try {
      snapshot = typeof load === "function" ? load() : null;
    } catch {
      snapshot = null;
    }
    if (hasSnapshotData(snapshot)) {
      applyStateSnapshot(snapshot);
      ensureInstanceFamilies({ persist: false });
      return;
    }
  }

  unifiedProducts = [];
  refreshProductsFromUnified();
}

// ==============================
//  UTILIDADES
// ==============================

function todayDateString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function cloneTemplateContent(tpl) {
  if (!tpl || !tpl.content) return null;
  return tpl.content.cloneNode(true);
}

function nowIsoString() {
  if (window.AppUtils && typeof window.AppUtils.nowIsoString === "function") {
    return window.AppUtils.nowIsoString();
  }
  return new Date().toISOString();
}

// Orden: FAMILIA -> TIPO -> PRODUCTO
function compareShelfBlockTypeName(a, b) {
  const blockA = a.block || "";
  const blockB = b.block || "";
  let cmp = blockA.localeCompare(blockB, "es", { sensitivity: "base" });
  if (cmp !== 0) return cmp;

  const typeA = a.type || "";
  const typeB = b.type || "";
  cmp = typeA.localeCompare(typeB, "es", { sensitivity: "base" });
  if (cmp !== 0) return cmp;

  const nameA = a.name || "";
  const nameB = b.name || "";
  return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
}

function findProductById(id) {
  if (!id) return null;
  const pantry = getPantryProducts().find((x) => x.id === id);
  if (pantry) return pantry;
  const extra = getOtherProducts().find((x) => x.id === id);
  return extra || null;
}

function getAllProductsForAssociationList() {
  const pantry = getPantryProducts();
  const extras = getOtherProducts();
  const list = [];
  for (const p of pantry) {
    if (!p.name) continue;
    list.push({
      id: p.id,
      name: p.name,
      kind: "almacén",
      block: p.block || "",
      type: p.type || "",
    });
  }
  for (const p of extras) {
    if (!p.name) continue;
    list.push({
      id: p.id,
      name: p.name,
      kind: "otros",
      block: p.block || "",
      type: p.type || "",
    });
  }
  list.sort((a, b) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base" })
  );
  return list;
}

function isKnownProduct(name, id) {
  const lower = (name || "").trim().toLowerCase();
  return getAllProductsForAssociationList().some(
    (p) =>
      (id && p.id === id) ||
      (lower && (p.name || "").trim().toLowerCase() === lower)
  );
}

// ======= Selecciones (instancias de producto) =======

function getProducerName(id) {
  const p = getProducersList().find((x) => x.id === id);
  return p ? p.name || "" : "";
}

function getStoreName(id) {
  const s = getSuppliersList().find((x) => x.id === id);
  return s ? s.name || "" : "";
}

function getStoreNames(storeIds) {
  if (!Array.isArray(storeIds)) return "";
  const names = storeIds
    .map((id) => getStoreName(id))
    .filter((n) => n && n.trim().length > 0);
  return names.join(", ");
}

function getClassificationFamilies() {
  if (
    window.DataService &&
    window.DataService.selectors &&
    typeof window.DataService.selectors.families === "function"
  ) {
    return window.DataService.selectors.families({
      products: getPantryProducts(),
      extraProducts: getOtherProducts(),
      classifications: getClassificationsList(),
    });
  }

  const cls = getClassificationsList();
  if (cls.length === 0) {
    return Array.from(
      new Set(
        [...getPantryProducts(), ...getOtherProducts()]
          .map((p) => (p.block || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }
  return Array.from(
    new Set(
      cls
        .map((c) => (c.block || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

function syncFamilyTypeFilterPair(familySel, typeSel, { familyAllLabel = "Todas", typeAllLabel = "Todos" } = {}) {
  if (!familySel && !typeSel) return;
  const families = getClassificationFamilies();
  const familyTypes = new Map();
  families.forEach((fam) => familyTypes.set(fam, getClassificationTypes(fam)));
  const allTypes = Array.from(
    new Set(families.flatMap((fam) => familyTypes.get(fam) || []))
  ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

  const currentFamily = familySel?.value || "";
  const currentType = typeSel?.value || "";

  if (familySel) {
    const allowedFamilies =
      currentType && currentType.trim().length
        ? families.filter((fam) => (familyTypes.get(fam) || []).includes(currentType))
        : families;
    const prev = currentFamily;
    familySel.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = familyAllLabel;
    familySel.appendChild(optAll);
    allowedFamilies.forEach((fam) => {
      const o = document.createElement("option");
      o.value = fam;
      o.textContent = fam;
      familySel.appendChild(o);
    });
    if (allowedFamilies.includes(prev)) familySel.value = prev;
  }

  if (typeSel) {
    const allowedTypes =
      currentFamily && currentFamily.trim().length
        ? familyTypes.get(currentFamily) || []
        : allTypes;
    const prev = currentType;
    typeSel.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = typeAllLabel;
    typeSel.appendChild(optAll);
    allowedTypes.forEach((t) => {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      typeSel.appendChild(o);
    });
    if (allowedTypes.includes(prev)) typeSel.value = prev;
  }
}

function syncAllFamilyTypeFilters() {
  syncFamilyTypeFilterPair(filterBlockSelect, filterTypeSelect, {
    familyAllLabel: "Todas",
    typeAllLabel: "Todos",
  });
  syncFamilyTypeFilterPair(editFilterFamilySelect, editFilterTypeSelect, {
    familyAllLabel: "Todas",
    typeAllLabel: "Todos",
  });
  syncFamilyTypeFilterPair(extraFilterFamilySelect, extraFilterTypeSelect, {
    familyAllLabel: "Todas",
    typeAllLabel: "Todos",
  });
  syncFamilyTypeFilterPair(extraEditFilterFamilySelect, extraEditFilterTypeSelect, {
    familyAllLabel: "Todas",
    typeAllLabel: "Todos",
  });
}

function getClassificationTypes(family = "") {
  if (
    window.DataService &&
    window.DataService.selectors &&
    typeof window.DataService.selectors.types === "function"
  ) {
    return window.DataService.selectors.types(
      { products: getPantryProducts(), extraProducts: getOtherProducts(), classifications: getClassificationsList() },
      family
    );
  }

  const fam = (family || "").trim();
  const cls = getClassificationsList();
  const source =
    cls.length === 0
      ? [...getPantryProducts(), ...getOtherProducts()].map((p) => ({
          block: p.block || "",
          type: p.type || "",
        }))
      : cls;

  const types = source
    .filter((c) => !fam || (c.block || "").trim() === fam)
    .map((c) => (c.type || "").trim())
    .filter(Boolean);

  return Array.from(new Set(types)).sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" })
  );
}

function createFamilySelect(selected = "") {
  const sel = document.createElement("select");
  sel.className = "table-input";
  sel.dataset.field = "block";
  const families = getClassificationFamilies();
  const optEmpty = document.createElement("option");
  optEmpty.value = "";
  optEmpty.textContent = "—";
  sel.appendChild(optEmpty);
  families.forEach((f) => {
    const o = document.createElement("option");
    o.value = f;
    o.textContent = f;
    sel.appendChild(o);
  });
  sel.value = selected && families.includes(selected) ? selected : "";
  return sel;
}

function createTypeSelect(family = "", selected = "") {
  const sel = document.createElement("select");
  sel.className = "table-input";
  sel.dataset.field = "type";
  const types = getClassificationTypes(family);
  const optEmpty = document.createElement("option");
  optEmpty.value = "";
  optEmpty.textContent = "—";
  sel.appendChild(optEmpty);
  types.forEach((t) => {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = t;
    sel.appendChild(o);
  });
  sel.value = selected && types.includes(selected) ? selected : "";
  return sel;
}

function linkFamilyTypeSelects(familySel, typeSel) {
  if (!familySel || !typeSel) return;
  familySel.addEventListener("change", () => {
    const fam = familySel.value || "";
    const current = typeSel.value;
    const types = getClassificationTypes(fam);
    typeSel.innerHTML = "";
    const optEmpty = document.createElement("option");
    optEmpty.value = "";
    optEmpty.textContent = "—";
    typeSel.appendChild(optEmpty);
    types.forEach((t) => {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      typeSel.appendChild(o);
    });
    if (types.includes(current)) typeSel.value = current;
    else typeSel.value = "";
  });
}

function getFamilyByProductName(name) {
  const lower = (name || "").trim().toLowerCase();
  if (!lower) return "";
  const fromProducts =
    getPantryProducts().find((p) => (p.name || "").toLowerCase() === lower) ||
    getOtherProducts().find((p) => (p.name || "").toLowerCase() === lower);
  return fromProducts ? fromProducts.block || "" : "";
}

function resolveInstanceFamily(inst) {
  if (!inst) return "";
  if (inst.block) return inst.block;

  // 1) Por id de producto
  if (inst.productId) {
    const prod = findProductById(inst.productId);
    if (prod && prod.block) return prod.block;
  }

  const name = (inst.productName || "").trim().toLowerCase();
  if (!name) return "";

  // 2) Coincidencia exacta por nombre
  const all = getUnifiedList();
  const list = all.length ? all : recomputeUnifiedFromDerived();
  const exact = list.find(
    (p) => (p.name || "").trim().toLowerCase() === name
  );
  if (exact && exact.block) return exact.block;

  // 3) Coincidencia parcial (incluye)
  const partial = list.find((p) => {
    const pname = (p.name || "").trim().toLowerCase();
    return pname && (pname.includes(name) || name.includes(pname));
  });
  if (partial && partial.block) return partial.block;

  return "";
}

function getFamilyForInstance(inst) {
  return resolveInstanceFamily(inst);
}

function ensureInstanceFamilies({ persist = false } = {}) {
  const instances = getInstancesList();
  if (!Array.isArray(instances) || instances.length === 0) return;
  const updated = [];
  let changed = false;
  instances.forEach((inst) => {
    const block = resolveInstanceFamily(inst) || inst.block || "";
    if (block && inst.block !== block) {
      changed = true;
      updated.push({ ...inst, block });
    } else {
      updated.push(inst);
    }
  });
  if (changed) {
    setInstancesList(updated);
    if (persist && !isSyncingFromStore) {
      try {
        saveProductInstances();
      } catch {}
    }
  }
}

function ensureSelectionPopupInit() {
  if (selectionPopupInitialized || !window.SelectionPopup) return;
  const refs = {
    overlay: selectionPopupOverlay,
    popup: selectionPopup,
    closeBtn: selectionPopupClose,
    title: selectionPopupTitle,
    list: selectionPopupList,
  };
  window.SelectionPopup.init({
    refs,
    onClose: () => {
      if (lastSelectionTrigger && typeof lastSelectionTrigger.focus === "function") {
        try {
          lastSelectionTrigger.focus();
        } catch {}
      }
    },
    initDrag: () => {
      if (
        window.UIHelpers &&
        typeof window.UIHelpers.makeDraggable === "function" &&
        selectionPopup
      ) {
        selectionDragCleanup = window.UIHelpers.makeDraggable(
          selectionPopup,
          selectionPopupHeader || selectionPopup,
          {}
        );
      }
    },
    initResize: () => {
      window.addEventListener("resize", handleSelectionPopupResize);
    },
    initKeydown: () => {
      document.addEventListener("keydown", handleSelectionPopupKeydown);
    },
  });
  if (selectionPopup) {
    selectionPopup.setAttribute("role", "dialog");
    selectionPopup.setAttribute("aria-modal", "true");
  }
  if (selectionPopupOverlay) {
    selectionPopupOverlay.setAttribute("role", "presentation");
  }
  selectionPopupInitialized = true;
}

function createTableInput(field, value = "", type = "text") {
  if (window.AppUtils && typeof window.AppUtils.createTableInput === "function") {
    return window.AppUtils.createTableInput(field, value, type);
  }
  const input = document.createElement("input");
  input.type = type;
  input.value = value || "";
  input.className = "table-input";
  if (field) input.dataset.field = field;
  return input;
}

function createTableTextarea(field, value = "") {
  if (
    window.AppUtils &&
    typeof window.AppUtils.createTableTextarea === "function"
  ) {
    return window.AppUtils.createTableTextarea(field, value);
  }
  const area = document.createElement("textarea");
  area.className = "table-input";
  if (field) area.dataset.field = field;
  area.value = value || "";
  return area;
}

function getSelectionInstanceForProduct(product) {
  if (!product || !product.selectionId) return null;
  const instances = getInstancesList();
  return instances.find((inst) => inst.id === product.selectionId) || null;
}

function getSelectionLabelForProduct(product) {
  const inst = getSelectionInstanceForProduct(product);
  if (!inst) return "";
  const parts = [];
  const producerName = getProducerName(inst.producerId);
  const nameParts = [];
  if (producerName) nameParts.push(producerName);
  if (inst.brand) nameParts.push(inst.brand);
  if (nameParts.length) parts.push(nameParts.join(" "));
  return parts.join(" · ");
}

function getSelectionStoresForProduct(product) {
  const inst = getSelectionInstanceForProduct(product);
  if (!inst) return "";
  return getStoreNames(inst.storeIds);
}

function productMatchesStore(product, storeId) {
  if (!storeId) return true;
  const inst = getSelectionInstanceForProduct(product);
  if (inst && Array.isArray(inst.storeIds) && inst.storeIds.includes(storeId)) {
    return true;
  }
  // Buscar en cualquier instancia asociada al producto
  const nameLower = (product.name || "").trim().toLowerCase();
  const instances = getInstancesList();
  return instances.some((pi) => {
    const sameId = pi.productId && pi.productId === product.id;
    const sameName =
      nameLower && (pi.productName || "").trim().toLowerCase() === nameLower;
    return (
      (sameId || sameName) &&
      Array.isArray(pi.storeIds) &&
      pi.storeIds.includes(storeId)
    );
  });
}

function createSelectionButton(selectionId, id) {
  const btn = document.createElement("button");
  btn.className = "btn btn-small btn-icon";
  btn.dataset.action = "select-selection";
  btn.dataset.id = id;
  const hasSel = !!getSelectionInstanceForProduct({ selectionId, id });
  btn.textContent = hasSel ? "⟳" : "+";
  btn.title = hasSel ? "Cambiar selección" : "Añadir selección";
  btn.classList.toggle("btn-selection-empty", !hasSel);
  btn.classList.toggle("btn-selection-update", hasSel);
  return btn;
}

function createEmptySelectionInstance(product, producerId, brand, storeIds) {
  if (!product) return null;
  const now = nowIsoString();
  const id =
    (crypto.randomUUID ? crypto.randomUUID() : "inst-" + Date.now()) +
    "-" +
    Math.random().toString(36).slice(2);
  const inst = {
    id,
    productId: product.id || "",
    productName: product.name || "",
    producerId: producerId || "",
    brand: brand || "",
    storeIds: Array.isArray(storeIds) ? storeIds : [],
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
  setInstancesList([...getInstancesList(), inst]);
  return inst;
}

function addQuickProducer(data, selectEl) {
  const trimmed = (data && data.name ? data.name : "").trim();
  if (!trimmed) return null;
  const now = nowIsoString();
  const id =
    (crypto.randomUUID ? crypto.randomUUID() : "prod-" + Date.now()) +
    "-" +
    Math.random().toString(36).slice(2);
  const producer = {
    id,
    name: trimmed,
    location: (data && data.location) || "",
    notes: (data && data.notes) || "",
    createdAt: now,
    updatedAt: now,
  };
  setProducersList([...getProducersList(), producer]);
  memoProducerLocations = []; // forzar recálculo de filtros de localización
  memoProducerFilterOptions = "";
  if (window.ProducersFeature && typeof window.ProducersFeature.render === "function") {
    window.ProducersFeature.render();
  } else if (window.ProducersView && typeof window.ProducersView.render === "function") {
    window.ProducersView.render(producersViewContext);
  }
  updateProducerFilterOptions();
  if (!isStoreActive()) renderInstancesTable();
  if (selectEl) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = trimmed;
    selectEl.appendChild(opt);
    selectEl.value = id;
  }
  return producer;
}

function addQuickStore(data, selectEl, chipsContainer) {
  const normalizedData =
    typeof data === "string" ? { name: data } : data || { name: "" };
  const trimmed = (normalizedData.name || "").trim();
  if (!trimmed) return null;
  const now = nowIsoString();
  const id =
    (crypto.randomUUID ? crypto.randomUUID() : "store-" + Date.now()) +
    "-" +
    Math.random().toString(36).slice(2);
  const store = {
    id,
    name: trimmed,
    type: normalizedData.type || "",
    location: normalizedData.location || "",
    website: normalizedData.website || "",
    notes: normalizedData.notes || "",
    createdAt: now,
    updatedAt: now,
  };
  setSuppliersList([...getSuppliersList(), store]);
  if (window.StoresFeature && typeof window.StoresFeature.render === "function") {
    window.StoresFeature.render();
  } else if (window.StoresView && typeof window.StoresView.render === "function") {
    window.StoresView.render(storesViewContext);
  }
  memoStores = []; // invalidar memo para recalcular en el próximo render
  memoStoreLocations = []; // invalidar memo de ubicaciones
  renderStoreOptions();
  updateStoreFilterOptions();
  if (!isStoreActive()) renderInstancesTable();
  if (selectEl) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = trimmed;
    opt.selected = true;
    selectEl.appendChild(opt);
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  }
  updateStoreChips(selectEl, chipsContainer);
  return store;
}

function attachMultiSelectToggle(selectEl) {
  if (!selectEl || !selectEl.multiple) return;
  selectEl.addEventListener("mousedown", (e) => {
    const opt = e.target;
    if (!opt || opt.tagName !== "OPTION") return;
    e.preventDefault();
    opt.selected = !opt.selected;
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    selectEl.focus();
  });
}

function updateStoreChips(selectEl, chipsContainer) {
  if (!chipsContainer || !selectEl) return;
  const selected = Array.from(selectEl.options)
    .filter((o) => o.selected && o.value)
    .map((o) => o.textContent || o.value);

  chipsContainer.innerHTML = "";
  if (selected.length === 0) {
    const none = document.createElement("span");
    none.className = "store-chip";
    none.textContent = "Sin tiendas";
    chipsContainer.appendChild(none);
    return;
  }

  selected.forEach((name) => {
    const chip = document.createElement("span");
    chip.className = "store-chip";
    chip.textContent = name;
    chipsContainer.appendChild(chip);
  });
}

function buildFamilyStripeMap(items) {
  const map = {};
  let idx = 0;
  items.forEach((item) => {
    const key = (item.block || "").trim() || "__none__";
    if (!(key in map)) {
      map[key] = idx % 2;
      idx += 1;
    }
  });
  return map;
}

function cleanupSelectionsWithInstances() {
  const validIds = new Set(getInstancesList().map((i) => i.id));
  let changed = false;
  const now = nowIsoString();

  const updatedUnified = getUnifiedList().map((p) => {
    if (p.selectionId && !validIds.has(p.selectionId)) {
      changed = true;
      return { ...p, selectionId: "", updatedAt: now };
    }
    return p;
  });

  if (changed) {
    persistUnified(updatedUnified);
  }
}

function highlightInstanceRow(instanceId) {
  if (!instancesTableBody || !instanceId) return;
  const row = instancesTableBody.querySelector(`tr[data-id="${instanceId}"]`);
  if (!row) return;
  row.classList.add("instances-highlight");
  setTimeout(() => row.classList.remove("instances-highlight"), 1600);
  row.scrollIntoView({ behavior: "smooth", block: "center" });
}

function consolidateInstances(list, now = nowIsoString()) {
  const map = new Map();
  const order = [];

  list.forEach((inst) => {
    const name = (inst.productName || "").trim();
    if (!name) {
      order.push(inst);
      return;
    }
    const brand = (inst.brand || "").trim();
    const producerId = inst.producerId || "";
    const key = `${name.toLowerCase()}|${brand.toLowerCase()}|${producerId}`;
    const storeIds = Array.isArray(inst.storeIds) ? inst.storeIds : [];

    if (!map.has(key)) {
      const copy = { ...inst, storeIds: Array.from(new Set(storeIds)) };
      map.set(key, copy);
      order.push(copy);
      return;
    }

    const existing = map.get(key);
    const mergedStores = new Set([
      ...(existing.storeIds || []),
      ...storeIds,
    ]);
    existing.storeIds = Array.from(mergedStores);
    if (!existing.brand && brand) existing.brand = brand;
    if (!existing.notes && inst.notes) existing.notes = inst.notes;
    const createdAt =
      existing.createdAt && inst.createdAt
        ? existing.createdAt < inst.createdAt
          ? existing.createdAt
          : inst.createdAt
        : existing.createdAt || inst.createdAt || now;
    existing.createdAt = createdAt;
    existing.updatedAt = now;
  });

  return order;
}

function getSelectionMainStoreName(product) {
  const inst = getSelectionInstanceForProduct(product);
  if (!inst || !Array.isArray(inst.storeIds) || !inst.storeIds.length) {
    return "Sin tienda seleccionada";
  }
  const firstId = inst.storeIds[0];
  return getStoreName(firstId) || "Sin tienda seleccionada";
}

// ==============================
//  POPUP SELECCIÓN
// ==============================

function openSelectionPopupForProduct(productId) {
  if (!selectionPopupOverlay || !selectionPopup || !selectionPopupList) return;
  ensureSelectionPopupInit();
  lastSelectionTrigger = document.activeElement;

  const product = findProductById(productId);
  if (!product) return;
  const currentSelectionId = product.selectionId || "";

  const isPantry = products.some((p) => p.id === productId);
  const sourceLabel = isPantry ? "Almacén" : "Otros productos";

  selectionPopupTitle.textContent = `Selección para: ${
    product.name || "(sin nombre)"
  } (${sourceLabel})`;

  selectionPopupList.innerHTML = "";
  if (selectionPopupBody) {
    const existingActions = selectionPopupBody.querySelector(
      ".selection-popup-actions"
    );
    if (existingActions) existingActions.remove();
    const existingInline = selectionPopupBody.querySelector(
      ".selection-inline-form"
    );
    if (existingInline) existingInline.remove();
    const existingSubforms = selectionPopupBody.querySelectorAll(
      ".selection-inline-subform"
    );
    existingSubforms.forEach((el) => el.remove());
  }

  // Opción "Sin selección"
  const liNone = document.createElement("li");
  liNone.className = "selection-popup-item";
  const noneContent = document.createElement("div");
  noneContent.className = "selection-popup-item-content";
  const spanMainNone = document.createElement("span");
  spanMainNone.className = "selection-popup-item-main selection-none-option";
  spanMainNone.textContent = "Sin selección prioritaria";
  if (!currentSelectionId) {
    liNone.classList.add("current-selection");
  }
  noneContent.appendChild(spanMainNone);
  liNone.appendChild(noneContent);
  liNone.addEventListener("click", () => {
    applySelectionToProduct(productId, "");
  });
  selectionPopupList.appendChild(liNone);

  const nameLower = (product.name || "").trim().toLowerCase();
  const instances = getInstancesList().filter((inst) => {
    if (inst.productId === productId) return true;
    const instName = (inst.productName || "").trim().toLowerCase();
    return nameLower && instName && instName === nameLower;
  });

  if (instances.length === 0) {
    const empty = document.createElement("p");
    empty.className = "selection-popup-empty";
    empty.textContent =
      "No hay selecciones definidas para este producto. Ve a 'Tiendas / Productores' → 'Selección de productos' para crear una.";
    selectionPopupList.appendChild(empty);
  } else {
    instances
      .slice()
      .sort((a, b) =>
        (a.brand || "").localeCompare(b.brand || "", "es", {
          sensitivity: "base",
        })
      )
      .forEach((inst, idx) => {
        const li = document.createElement("li");
        li.className = "selection-popup-item";

        const idxSpan = document.createElement("span");
        idxSpan.className = "selection-item-index";
        idxSpan.textContent = `${idx + 1}.`;

        const content = document.createElement("div");
        content.className = "selection-popup-item-content";

        const main = document.createElement("span");
        main.className = "selection-popup-item-main";
        const producerName = getProducerName(inst.producerId);
        const storeNames = getStoreNames(inst.storeIds);
        const mainParts = [];
        if (producerName) mainParts.push(producerName);
        if (inst.brand) mainParts.push(inst.brand);
        if (mainParts.length === 0) {
          const noProd = document.createElement("em");
          noProd.textContent = "Productor no definido";
          noProd.className = "selection-no-producer";
          main.appendChild(noProd);
        } else {
          main.textContent = mainParts.join(" · ");
        }
        if (inst.id === currentSelectionId) {
          li.classList.add("current-selection");
        }

        const meta = document.createElement("span");
        meta.className = "selection-popup-item-meta";
        const metaParts = [];
        if (storeNames) metaParts.push("Tiendas: " + storeNames);
        if (inst.notes) metaParts.push(inst.notes);
        meta.textContent = metaParts.join(" · ");
        content.appendChild(main);
        content.appendChild(meta);

        li.appendChild(idxSpan);
        li.appendChild(content);

        li.addEventListener("click", () => {
          applySelectionToProduct(productId, inst.id);
        });

        selectionPopupList.appendChild(li);
      });
  }

  // Botón para crear nueva selección desde el popup
  if (selectionPopupBody) {
    const buildCollapsibleSubform = (title) => {
      const wrapper = document.createElement("div");
      wrapper.className = "selection-inline-subform collapsed";

      const header = document.createElement("div");
      header.className = "selection-subform-header";

      const heading = document.createElement("h4");
      heading.textContent = title;

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "selection-subform-toggle";
      toggleBtn.textContent = "+";
      toggleBtn.setAttribute(
        "aria-label",
        `${title} (mostrar / ocultar formulario)`
      );
      toggleBtn.setAttribute("aria-expanded", "false");

      const toggle = () => {
        const collapsed = wrapper.classList.toggle("collapsed");
        toggleBtn.textContent = collapsed ? "+" : "-";
        toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      };

      toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggle();
      });

      header.addEventListener("click", (e) => {
        if (e.target === toggleBtn) return;
        toggle();
      });

      header.appendChild(heading);
      header.appendChild(toggleBtn);
      wrapper.appendChild(header);

      const content = document.createElement("div");
      content.className = "selection-subform-content";
      wrapper.appendChild(content);

      return { wrapper, content };
    };

    const inline = document.createElement("div");
    inline.className = "selection-inline-form";
    inline.id = "inlineSelectionForm";

    const producerWrap = document.createElement("div");
    const producerLabel = document.createElement("label");
    producerLabel.textContent = "Productor";
    const producerSel = document.createElement("select");
    producerSel.id = "inlineProducerSelect";
    const optNone = document.createElement("option");
    optNone.value = "";
    optNone.textContent = "Sin productor";
    producerSel.appendChild(optNone);
    getProducersList()
      .slice()
      .sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "es", {
          sensitivity: "base",
        })
      )
      .forEach((p) => {
        const o = document.createElement("option");
        o.value = p.id;
        o.textContent = p.name || "(sin nombre)";
        producerSel.appendChild(o);
      });
    producerWrap.appendChild(producerLabel);
    producerWrap.appendChild(producerSel);

    const brandWrap = document.createElement("div");
    const brandLabel = document.createElement("label");
    brandLabel.textContent = "Marca (opcional)";
    const brandInput = document.createElement("input");
    brandInput.type = "text";
    brandInput.id = "inlineBrandInput";
    brandInput.placeholder = "Marca...";
    brandWrap.appendChild(brandLabel);
    brandWrap.appendChild(brandInput);

    const storesWrap = document.createElement("div");
    const storesLabel = document.createElement("label");
    storesLabel.textContent = "Tiendas";
    const storesSel = document.createElement("select");
    storesSel.id = "inlineStoresSelect";
    storesSel.multiple = true;
    storesSel.size = 6;
    storesSel.className = "inline-stores-select";
    getSuppliersList()
      .slice()
      .sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "es", {
          sensitivity: "base",
        })
      )
      .forEach((s) => {
        const o = document.createElement("option");
        o.value = s.id;
        o.textContent = s.name || "(sin nombre)";
        storesSel.appendChild(o);
      });
    storesWrap.appendChild(storesLabel);
    storesWrap.appendChild(storesSel);
    inlineProducerSelect = producerSel;
    inlineStoresSelect = storesSel;
    attachMultiSelectToggle(storesSel);

    const inlineActions = document.createElement("div");
    inlineActions.className = "selection-inline-actions";
    const createApply = document.createElement("button");
    createApply.className = "btn btn-primary btn-small";
    createApply.textContent = "Crear selección y aplicar";
    createApply.addEventListener("click", () => {
      createAndApplySelection(productId);
    });
    inlineActions.appendChild(createApply);

    inline.appendChild(producerWrap);
    inline.appendChild(brandWrap);
    inline.appendChild(storesWrap);
    inline.appendChild(inlineActions);

    selectionPopupBody.appendChild(inline);

    // Subform productor
    const producerSub = buildCollapsibleSubform("Crear productor");
    const prodName = document.createElement("div");
    prodName.className = "inline-form-group";
    prodName.innerHTML =
      '<label>Nombre</label><input type="text" id="inlineNewProducerName" />';
    const prodLoc = document.createElement("div");
    prodLoc.className = "inline-form-group";
    prodLoc.innerHTML =
      '<label>Localización</label><input type="text" id="inlineNewProducerLocation" />';
    const prodNotes = document.createElement("div");
    prodNotes.className = "inline-form-group";
    prodNotes.innerHTML =
      '<label>Notas</label><input type="text" id="inlineNewProducerNotes" />';
    const prodActions = document.createElement("div");
    prodActions.className = "selection-inline-actions";
    const prodSave = document.createElement("button");
    prodSave.className = "btn btn-primary btn-small";
    prodSave.textContent = "Añadir";
    prodSave.title = "Añadir y seleccionar";
    prodSave.setAttribute("aria-label", "Añadir y seleccionar");
    prodSave.addEventListener("click", () => {
      const data = {
        name: document.getElementById("inlineNewProducerName").value,
        location: document.getElementById("inlineNewProducerLocation").value,
        notes: document.getElementById("inlineNewProducerNotes").value,
      };
      addQuickProducer(data, inlineProducerSelect || producerSel);
    });
    prodActions.appendChild(prodSave);
    producerSub.content.appendChild(prodName);
    producerSub.content.appendChild(prodLoc);
    producerSub.content.appendChild(prodNotes);
    producerSub.content.appendChild(prodActions);
    selectionPopupBody.appendChild(producerSub.wrapper);

    // Subform tienda
    const storeSub = buildCollapsibleSubform("Crear tienda");
    const storeName = document.createElement("div");
    storeName.className = "inline-form-group";
    storeName.innerHTML =
      '<label>Nombre</label><input type="text" id="inlineNewStoreName" />';
    const storeType = document.createElement("div");
    storeType.className = "inline-form-group";
    storeType.innerHTML = `
      <label>Tipo</label>
      <select id="inlineNewStoreType">
        <option value=""></option>
        <option value="fisico">Físico</option>
        <option value="online">Online</option>
      </select>`;
    const storeLoc = document.createElement("div");
    storeLoc.className = "inline-form-group";
    storeLoc.innerHTML =
      '<label>Localización</label><input type="text" id="inlineNewStoreLocation" />';
    const storeWeb = document.createElement("div");
    storeWeb.className = "inline-form-group";
    storeWeb.innerHTML =
      '<label>Web / contacto</label><input type="text" id="inlineNewStoreWebsite" />';
    const storeNotes = document.createElement("div");
    storeNotes.className = "inline-form-group";
    storeNotes.innerHTML =
      '<label>Notas</label><input type="text" id="inlineNewStoreNotes" />';
    const storeActions = document.createElement("div");
    storeActions.className = "selection-inline-actions";
    const storeSave = document.createElement("button");
    storeSave.className = "btn btn-primary btn-small";
    storeSave.textContent = "Añadir";
    storeSave.title = "Añadir y seleccionar";
    storeSave.setAttribute("aria-label", "Añadir y seleccionar");
    storeSave.addEventListener("click", () => {
      const data = {
        name: document.getElementById("inlineNewStoreName").value,
        type: document.getElementById("inlineNewStoreType").value,
        location: document.getElementById("inlineNewStoreLocation").value,
        website: document.getElementById("inlineNewStoreWebsite").value,
        notes: document.getElementById("inlineNewStoreNotes").value,
      };
      addQuickStore(data, inlineStoresSelect || storesSel);
    });
    storeActions.appendChild(storeSave);
    storeSub.content.appendChild(storeName);
    storeSub.content.appendChild(storeType);
    storeSub.content.appendChild(storeLoc);
    storeSub.content.appendChild(storeWeb);
    storeSub.content.appendChild(storeNotes);
    storeSub.content.appendChild(storeActions);
    selectionPopupBody.appendChild(storeSub.wrapper);

    const actions = document.createElement("div");
    actions.className = "selection-popup-actions";
    const createTableBtn = document.createElement("button");
    createTableBtn.className = "btn btn-secondary btn-small";
    createTableBtn.textContent = "Abrir en tabla";
    createTableBtn.addEventListener("click", () => {
      startCreateSelectionForProduct(productId);
      closeSelectionPopup();
    });
    actions.appendChild(createTableBtn);
    selectionPopupList.insertAdjacentElement("afterend", actions);
  }

  // Mostrar overlay
  if (window.SelectionPopup && typeof window.SelectionPopup.open === "function") {
    window.SelectionPopup.open(selectionPopupTitle.textContent);
  } else {
    selectionPopupOverlay.classList.add("visible");
    centerSelectionPopup();
    requestAnimationFrame(centerSelectionPopup);
  }
}

function clampSelectionPopupPosition(left, top) {
  if (!selectionPopupOverlay || !selectionPopup) return;

  const overlayRect = selectionPopupOverlay.getBoundingClientRect();
  const padding = 20;

  const maxLeft =
    overlayRect.left +
    overlayRect.width -
    padding -
    selectionPopup.offsetWidth;
  const maxTop =
    overlayRect.top + overlayRect.height - padding - selectionPopup.offsetHeight;

  const clampedLeft = Math.max(
    overlayRect.left + padding,
    Math.min(left, maxLeft)
  );
  const clampedTop = Math.max(
    overlayRect.top + padding,
    Math.min(top, maxTop)
  );

  selectionPopup.style.left = clampedLeft + "px";
  selectionPopup.style.top = clampedTop + "px";
}

function centerSelectionPopup() {
  if (!selectionPopupOverlay || !selectionPopup) return;

  selectionPopup.classList.remove("dragging");
  selectionPopup.style.position = "fixed";
  selectionPopup.style.left = "50%";
  selectionPopup.style.top = "50%";
  selectionPopup.style.transform = "translate(-50%, -50%)";
  selectionPopup.style.transition = "";
}

function handleSelectionPopupResize() {
  if (!selectionPopupOverlay || !selectionPopup) return;
  if (!selectionPopupOverlay.classList.contains("visible")) return;
  if (
    selectionPopup.classList.contains("dragging") ||
    selectionPopup.style.transform === "none"
  ) {
    const rect = selectionPopup.getBoundingClientRect();
    clampSelectionPopupPosition(rect.left, rect.top);
    return;
  }
  centerSelectionPopup();
}

function closeSelectionPopup() {
  if (window.SelectionPopup && typeof window.SelectionPopup.close === "function") {
    window.SelectionPopup.close();
    return;
  }
  if (!selectionPopupOverlay) return;
  selectionPopupOverlay.classList.remove("visible");
  if (selectionPopup) {
    selectionPopup.classList.remove("dragging");
    selectionPopup.style.transition = "";
  }
  if (lastSelectionTrigger && typeof lastSelectionTrigger.focus === "function") {
    try {
      lastSelectionTrigger.focus();
    } catch {}
  }
}

function handleSelectionPopupKeydown(e) {
  const isVisible = selectionPopupOverlay && selectionPopupOverlay.classList.contains("visible");
  if (!isVisible) return;

  if (e.key === "Escape") {
    e.preventDefault();
    closeSelectionPopup();
    return;
  }

  if (e.key === "Tab") {
    const focusableSelectors = [
      "button",
      "input",
      "select",
      "textarea",
      "[href]",
      "[tabindex]:not([tabindex='-1'])",
    ];
    const focusables = selectionPopup
      ? Array.from(selectionPopup.querySelectorAll(focusableSelectors.join(","))).filter(
          (el) => !el.disabled && el.offsetParent !== null
        )
      : [];
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

function applySelectionToProduct(productId, selectionId) {
  const now = nowIsoString();
  let found = false;

  const updatedUnified = getUnifiedList().map((p) => {
    if (p.id !== productId) return p;
    found = true;
    return { ...p, selectionId, updatedAt: now };
  });

  if (found) {
    persistUnified(updatedUnified);
    renderProducts();
    renderGridRows();
    renderExtraQuickTable();
    renderExtraEditTable();
    renderShoppingList();
  }

  closeSelectionPopup();
}

function startCreateSelectionForProduct(productId) {
  const product = findProductById(productId);
  if (!product) return;

  setMainSection("selection");
  setProveedoresTab("instances");

  if (!instancesTableBody) return;

  handleAddInstanceRow();

  const newRow = instancesTableBody.firstElementChild;
  if (!newRow) return;

  const inputProd = newRow.querySelector('input[data-field="productName"]');
  if (inputProd) {
    inputProd.value = product.name || "";
    inputProd.focus();
    const len = inputProd.value.length;
    try {
      inputProd.setSelectionRange(len, len);
    } catch {}
  }

  newRow.classList.add("instances-highlight");
  setTimeout(() => newRow.classList.remove("instances-highlight"), 1600);
  newRow.scrollIntoView({ behavior: "smooth", block: "center" });
}

function createAndApplySelection(productId) {
  const product = findProductById(productId);
  if (!product) return;

  const form = document.getElementById("inlineSelectionForm");
  const producerSel = form?.querySelector("#inlineProducerSelect");
  const brandInput = form?.querySelector("#inlineBrandInput");
  const storesSel = form?.querySelector("#inlineStoresSelect");

  const producerId = producerSel ? producerSel.value : "";
  const brand = brandInput ? brandInput.value.trim() : "";
  const storeIds = storesSel
    ? Array.from(storesSel.selectedOptions)
        .map((o) => o.value)
        .filter(Boolean)
    : [];

  const inst = createEmptySelectionInstance(product, producerId, brand, storeIds);
  if (!inst) return;
  cleanupSelectionsWithInstances();
  applySelectionToProduct(productId, inst.id);
  renderInstancesTable();
  highlightInstanceRow(inst.id);
  closeSelectionPopup();
}

// ==============================
//  SCROLL HORIZONTAL TABLAS
// ==============================

function enableHorizontalWheelScroll(container) {
  if (!container) return;
  container.addEventListener(
    "wheel",
    (e) => {
      const el = e.currentTarget;
      if (!el || el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

      const prevLeft = el.scrollLeft;
      el.scrollLeft += e.deltaY;
      if (el.scrollLeft !== prevLeft) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
}

function initHorizontalTableScroll() {
  enableHorizontalWheelScroll(instancesTableWrapper);
}

// ==============================
//  OPCIONES DE FILTRO
// ==============================

function getProductAutocompleteSuggestions(query) {
  const list = getAllProductsForAssociationList();
  const lower = (query || "").toLowerCase();
  return lower
    ? list.filter((p) => (p.name || "").toLowerCase().includes(lower))
    : list;
}

function renderShelfOptions() {
  const shelves = Array.from(
    new Set(getPantryProducts().map((p) => (p.shelf || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  if (memoShelves.join("|||") === shelves.join("|||")) return;
  memoShelves = shelves.slice();

  const selects = [filterShelfSelect, editFilterShelfSelect];
  selects.forEach((sel) => {
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = sel === filterShelfSelect ? "Todas" : "Todas";
    sel.appendChild(optAll);
    shelves.forEach((s) => {
      const o = document.createElement("option");
      o.value = s;
      o.textContent = s;
      sel.appendChild(o);
    });
    if (shelves.includes(current)) {
      sel.value = current;
    }
  });
}

function renderBlockOptions() {
  refreshProductsFromUnified();
  const blocks = getClassificationFamilies();
  if (memoBlocks.join("|||") === blocks.join("|||")) return;
  memoBlocks = blocks.slice();

  const selects = [
    filterBlockSelect,
    editFilterFamilySelect,
    extraEditFilterFamilySelect,
    extraFilterFamilySelect,
  ];
  selects.forEach((sel) => {
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "Todas";
    sel.appendChild(optAll);
    blocks.forEach((b) => {
      const o = document.createElement("option");
      o.value = b;
      o.textContent = b;
      sel.appendChild(o);
    });
    if (blocks.includes(current)) {
      sel.value = current;
    }
  });

  syncAllFamilyTypeFilters();
}

function renderTypeOptions() {
  const types = getClassificationTypes();
  if (memoTypes.join("|||") === types.join("|||")) return;
  memoTypes = types.slice();

  const selects = [
    filterTypeSelect,
    editFilterTypeSelect,
    extraEditFilterTypeSelect,
    extraFilterTypeSelect,
  ];
  selects.forEach((sel) => {
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "Todos";
    sel.appendChild(optAll);
    types.forEach((t) => {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      sel.appendChild(o);
    });
    if (types.includes(current)) {
      sel.value = current;
    }
  });

  syncAllFamilyTypeFilters();
}

function renderStoreOptions() {
  const storeList = getSuppliersList()
    .slice()
    .sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" })
    );
  const memoKey = storeList.map((s) => `${s.id}::${s.name || ""}`).join("|||");
  if (memoStores.join("|||") === memoKey && memoStores.length) return;
  memoStores = memoKey ? memoKey.split("|||") : [];

  const selects = [
    filterStoreSelect,
    editFilterStoreSelect,
    extraEditFilterStoreSelect,
    instancesStoreFilterSelect,
    extraFilterStoreSelect,
  ];
  selects.forEach((sel) => {
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "Todas";
    sel.appendChild(optAll);
    storeList.forEach((s) => {
      const o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.name || "(sin nombre)";
      sel.appendChild(o);
    });
    if (current && storeList.some((s) => s.id === current)) {
      sel.value = current;
    }
  });
}

function updateProducerFilterOptions() {
  const state = getStateSnapshot();
  const producersList = getProducersList();
  const locations =
    (window.DataService &&
      window.DataService.selectors &&
      typeof window.DataService.selectors.producerLocations === "function" &&
      window.DataService.selectors.producerLocations(state)) ||
    Array.from(
      new Set(
        producersList
          .map((p) => (p.location || "").trim())
          .filter((l) => l.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  if (memoProducerLocations.join("|||") === locations.join("|||")) return;
  memoProducerLocations = locations.slice();

  if (producersLocationFilterSelect) {
    const current = producersLocationFilterSelect.value;
    producersLocationFilterSelect.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "Todas";
    producersLocationFilterSelect.appendChild(optAll);
    locations.forEach((loc) => {
      const o = document.createElement("option");
      o.value = loc;
      o.textContent = loc;
      producersLocationFilterSelect.appendChild(o);
    });
    if (locations.includes(current)) {
      producersLocationFilterSelect.value = current;
    }
  }

  if (instancesProducerFilterSelect) {
    const current = instancesProducerFilterSelect.value;
    const key = producersList
      .slice()
      .sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" })
      )
      .map((p) => `${p.id}::${p.name || ""}`)
      .join("|||");
    const alreadyHydrated =
      memoProducerFilterOptions === key &&
      instancesProducerFilterSelect.options.length > 0;
    if (!alreadyHydrated) {
      instancesProducerFilterSelect.innerHTML = "";
      const optAll = document.createElement("option");
      optAll.value = "";
      optAll.textContent = "Todos";
      instancesProducerFilterSelect.appendChild(optAll);
      producersList
        .slice()
        .sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" })
        )
        .forEach((p) => {
          const o = document.createElement("option");
          o.value = p.id;
          o.textContent = p.name || "(sin nombre)";
          instancesProducerFilterSelect.appendChild(o);
        });
      memoProducerFilterOptions = key;
    }
    if (current && producersList.some((p) => p.id === current)) {
      instancesProducerFilterSelect.value = current;
    }
  }
}

function updateStoreFilterOptions() {
  const state = getStateSnapshot();
  const stores = getSuppliersList();
  const locations =
    (window.DataService &&
      window.DataService.selectors &&
      typeof window.DataService.selectors.storeLocations === "function" &&
      window.DataService.selectors.storeLocations(state)) ||
    Array.from(
      new Set(
        stores
          .map((s) => (s.location || "").trim())
          .filter((l) => l.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  if (memoStoreLocations.join("|||") === locations.join("|||")) return;
  memoStoreLocations = locations.slice();

  if (storesLocationFilterSelect) {
    const current = storesLocationFilterSelect.value;
    storesLocationFilterSelect.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "Todas";
    storesLocationFilterSelect.appendChild(optAll);
    locations.forEach((loc) => {
      const o = document.createElement("option");
      o.value = loc;
      o.textContent = loc;
      storesLocationFilterSelect.appendChild(o);
    });
    if (locations.includes(current)) {
      storesLocationFilterSelect.value = current;
    }
  }
}

function updateInstanceFilterOptions() {
  if (!instancesFamilyFilterSelect) return;
  const current = instancesFamilyFilterSelect.value || "";
  const families = Array.from(
    new Set(
      [...getPantryProducts(), ...getOtherProducts()]
        .map((p) => (p.block || "").trim())
        .filter((b) => b.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

  const memoKey = families.join("|||");
  if (
    memoInstanceFamilies.join("|||") === memoKey &&
    instancesFamilyFilterSelect.options.length > 0
  ) {
    return;
  }
  memoInstanceFamilies = families.slice();

  instancesFamilyFilterSelect.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "Todas";
  instancesFamilyFilterSelect.appendChild(optAll);
  families.forEach((fam) => {
    const o = document.createElement("option");
    o.value = fam;
    o.textContent = fam;
    instancesFamilyFilterSelect.appendChild(o);
  });

  if (families.includes(current)) {
    instancesFamilyFilterSelect.value = current;
  }
}

function renderProductsDatalist() {
  if (!productsDatalist) return;
  const list = getAllProductsForAssociationList();
  const key = list
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" }))
    .map((p) => `${p.name}::${p.kind}`)
    .join("|||");
  if (memoProductsDatalistKey === key && productsDatalist.options.length === list.length) {
    return;
  }
  memoProductsDatalistKey = key;
  productsDatalist.innerHTML = "";
  list.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.name;
    opt.label = p.kind === "almacén" ? `${p.name} (almacén)` : `${p.name} (otros)`;
    productsDatalist.appendChild(opt);
  });
}

// ==============================
//  RENDER: ALMACÉN (inventario principal)
// ==============================

function renderProducts() {
  refreshProductsFromUnified();
  if (!productTableBody) return;
  // InventoryView se encarga del render (usa plantilla cuando está disponible)
  if (window.InventoryView) {
    InventoryView.render(getInventoryContext());
    return;
  }
}

function handleInventoryTableClick(e) {
  refreshProductsFromUnified();
  const target = e.target.closest("button,[data-action],[data-role]") || e.target;
  const roleActionMap = {
    "selection-btn": "select-selection",
    move: "move-to-extra",
    delete: "delete",
  };
  let action = target.dataset.action || roleActionMap[target.dataset.role];
  if (!action && target.closest("button")) {
    const text = target.closest("button").textContent.trim();
    if (text === "✕") action = "delete";
    if (text === "→") action = "move-to-extra";
  }

  if (action === "cancel-draft-product") {
    const id = target.dataset.id;
    productDrafts = productDrafts.filter((d) => d.id !== id);
    renderProducts();
    return;
  }
  if (action === "save-draft-product") {
    const id = target.dataset.id;
    commitDraftProducts(id ? [id] : null);
    return;
  }

  if (target.matches('input[type="checkbox"][data-field="have"]')) {
    const id = target.dataset.id;
    const product = products.find((p) => p.id === id);
    if (!product) return;
    const wasHave = !!product.have;
    product.have = target.checked;
    if (!wasHave && product.have) {
      product.acquisitionDate = todayDateString();
    }
    saveProducts();
    renderProducts();
    renderShoppingList();
    return;
  }

  if (!action) return;

  const id = target.dataset.id || target.closest("tr")?.dataset.id;

  if (action === "move-to-extra") {
    moveProductToExtra(id);
  } else if (action === "select-selection") {
    openSelectionPopupForProduct(id);
  } else if (action === "delete-product") {
    deleteProduct(id);
  } else if (action === "edit-product") {
    startEditProduct(id);
  }
}

function moveProductToExtra(id) {
  const unified = getUnifiedList();
  const item = unified.find((p) => p.id === id);
  if (!item) return;
  const ok = confirm("¿Mover este producto a 'Otros productos'? Se mantendrá la información.");
  if (!ok) return;
  const nextBuy = !item.have;
  const updated = unified.map((p) =>
    p.id === id ? { ...p, scope: "otros", buy: nextBuy, have: !nextBuy } : p
  );
  setUnifiedList(updated);
  saveExtraProducts();

  // Limpia borradores asociados al producto movido
  productDrafts = productDrafts.filter((d) => d.originalId !== id && d.id !== id);

  renderProducts();
  if (!isStoreActive()) {
    if (!isStoreActive()) {
      renderExtraQuickTable();
      renderExtraEditTable();
    }
  }
  renderShelfOptions();
  renderBlockOptions();
  renderTypeOptions();
  renderProductsDatalist();
  renderShoppingList();
}

function handleAddQuickExtra() {
  const id =
    (crypto.randomUUID ? crypto.randomUUID() : "draft-extra-" + Date.now()) +
    "-" +
    Math.random().toString(36).slice(2);
  const defBlock = extraFilterFamilySelect?.value || "";
  const defType = extraFilterTypeSelect?.value || "";
  const defBuy =
    extraFilterBuySelect && extraFilterBuySelect.value === "yes" ? true : false;
  extraDrafts.unshift({
    id,
    name: "",
    block: defBlock,
    type: defType,
    quantity: "",
    notes: "",
    buy: defBuy,
  });
  renderExtraQuickTable();
  highlightTopRow(extraListTableBody);
}

function handleAddQuickProduct() {
  const id =
    (crypto.randomUUID ? crypto.randomUUID() : "draft-prod-" + Date.now()) +
    "-" +
    Math.random().toString(36).slice(2);
  const defBlock = filterBlockSelect?.value || "";
  const defType = filterTypeSelect?.value || "";
  const defShelf = filterShelfSelect?.value || "";
  const status = filterStatusSelect?.value || "all";
  const defHave = status === "have" ? true : status === "missing" ? false : false;
  productDrafts.unshift({
    id,
    name: "",
    block: defBlock,
    type: defType,
    shelf: defShelf,
    quantity: "",
    have: defHave,
    acquisitionDate: "",
    expiryText: "",
    notes: "",
  });
  renderProducts();
  highlightTopRow(productTableBody);
}

function startEditProduct(id) {
  if (!id) return;
  const list = getPantryProducts();
  const prod = list.find((p) => p.id === id);
  if (!prod) return;
  productDrafts = productDrafts.filter((d) => d.originalId !== id);
  const draftId =
    (crypto.randomUUID ? crypto.randomUUID() : "draft-edit-" + Date.now()) +
    "-" +
    Math.random().toString(36).slice(2);
  productDrafts.unshift({
    id: draftId,
    originalId: id,
    name: prod.name || "",
    block: prod.block || "",
    type: prod.type || "",
    shelf: prod.shelf || "",
    quantity: prod.quantity || "",
    have: !!prod.have,
    acquisitionDate: prod.acquisitionDate || "",
    expiryText: prod.expiryText || "",
    notes: prod.notes || "",
  });
  renderProducts();
  highlightTopRow(productTableBody);
}

function deleteProduct(id) {
  if (!id) return;
  const ok = confirm("¿Eliminar este producto del almacén?");
  if (!ok) return;
  productDrafts = productDrafts.filter((d) => d.originalId !== id && d.id !== id);
  removeProductById(id);
}

function highlightTopRow(tbody) {
  if (!tbody || !tbody.firstElementChild) return;
  const row = tbody.firstElementChild;
  row.classList.add("instances-highlight");
  setTimeout(() => row.classList.remove("instances-highlight"), 1200);
  const scrollContainer = row.closest(".table-scroll");
  if (scrollContainer) {
    const offsetTop = row.offsetTop;
    const header = scrollContainer.querySelector("thead");
    const headerH = header ? header.offsetHeight : 0;
    scrollContainer.scrollTo({
      top: Math.max(offsetTop - headerH - 12, 0),
      behavior: "smooth",
    });
  } else {
    row.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function commitDraftProducts(ids) {
  if (!window.AppUtils || typeof window.AppUtils.commitDraftProducts !== "function") return;
  const res = window.AppUtils.commitDraftProducts({
    tableBody: productTableBody,
    drafts: productDrafts,
    getPantryProducts,
    getOtherProducts,
    persistUnified,
    allowedIds: Array.isArray(ids) ? ids : null,
    nowIsoString,
  });
  if (!res || !res.unified) return;
  productDrafts = res.drafts || [];
  renderProducts();
  if (!isStoreActive()) renderGridRows();
  renderShelfOptions();
  renderBlockOptions();
  renderTypeOptions();
  renderProductsDatalist();
  renderShoppingList();
}

function commitDraftExtras(ids) {
  if (!window.AppUtils || typeof window.AppUtils.commitDraftExtras !== "function") return;
  const res = window.AppUtils.commitDraftExtras({
    tableBody: extraListTableBody,
    drafts: extraDrafts,
    getPantryProducts,
    getOtherProducts,
    persistUnified,
    allowedIds: Array.isArray(ids) ? ids : null,
    nowIsoString,
  });
  if (!res || !res.unified) return;
  extraDrafts = res.drafts || [];
  renderExtraQuickTable();
  if (!isStoreActive()) renderExtraEditTable();
  renderBlockOptions();
  renderTypeOptions();
  renderProductsDatalist();
  renderShoppingList();
}

// ==============================
//  ALMACÉN: EDICIÓN
// ==============================

function renderGridRows() {
  if (
    window.InventoryEditView &&
    typeof window.InventoryEditView.render === "function"
  ) {
    window.InventoryEditView.render(inventoryEditViewContext);
  }
}

function handleSaveGrid() {
  if (window.InventoryEditView && typeof window.InventoryEditView.save === "function") {
    window.InventoryEditView.save(inventoryEditViewContext);
  }
}

// ==============================
//  OTROS PRODUCTOS: VISTA
// ==============================

function renderExtraQuickTable() {
  if (window.ExtrasFeature && typeof window.ExtrasFeature.render === "function") {
    window.ExtrasFeature.render();
    return;
  }
  if (window.ExtrasView && typeof window.ExtrasView.render === "function") {
    window.ExtrasView.render(extrasViewContext);
  }
}

function removeProductById(id) {
  if (!id) return;
  const unified = getUnifiedList();
  const filtered = unified.filter((p) => p.id !== id);
  if (filtered.length === unified.length) return;
  setUnifiedList(filtered);
  renderGridRows();
  renderProducts();
  renderExtraQuickTable();
  renderExtraEditTable();
  renderShoppingList();
}

// ==============================
//  OTROS PRODUCTOS: EDICIÓN
// ==============================

function renderExtraEditTable() {
  if (window.ExtraEditView && typeof window.ExtraEditView.render === "function") {
    window.ExtraEditView.render(extraEditViewContext);
  }
}

// ==============================
//  CLASIFICACIÓN (FAMILIA / TIPO)
// ==============================

function renderClassificationTable() {
  if (
    window.ClassificationView &&
    typeof window.ClassificationView.render === "function"
  ) {
    window.ClassificationView.render(classificationViewContext);
  }
}

function handleAddClassificationRow() {
  if (
    window.ClassificationView &&
    typeof window.ClassificationView.addRow === "function"
  ) {
    window.ClassificationView.addRow(classificationViewContext);
  }
}

function handleClassificationTableClick(e) {
  // Gestionado desde ClassificationView
}

function handleSaveClassifications() {
  if (
    window.ClassificationView &&
    typeof window.ClassificationView.save === "function"
  ) {
    window.ClassificationView.save(classificationViewContext);
  }
}

function handleClassificationDependencies() {
  if (isStoreActive()) return;
  renderBlockOptions();
  renderTypeOptions();
  renderProductsDatalist();
  renderProducts();
  if (!isStoreActive()) {
    renderExtraQuickTable();
    renderExtraEditTable();
  }
  renderGridRows();
}

function handleProducersDependencies() {
  if (isStoreActive()) return;
  updateProducerFilterOptions();
  renderInstancesTable();
}

function handleStoresDependencies() {
  if (isStoreActive()) return;
  updateStoreFilterOptions();
  renderStoreOptions();
  updateInstanceFilterOptions();
  renderInstancesTable();
  renderProducts();
  renderExtraQuickTable();
  renderExtraEditTable();
  renderShoppingList();
}

function persistInstances(list, options = {}) {
  const current = getInstancesList();
  if (!Array.isArray(list)) return current;
  const allowClear = options.allowClear === true;
  if (!allowClear && list.length === 0 && current.length > 0) {
    return current;
  }
  const now = nowIsoString();
  const allProducts = getAllProductsForAssociationList();
  const updates = new Map();
  const existingInstances = getInstancesList();

  (list || []).forEach((inst) => {
    const id =
      inst.id ||
      (crypto.randomUUID ? crypto.randomUUID() : "inst-" + Date.now()) +
        "-" +
        Math.random().toString(36).slice(2);
    const productName = (inst.productName || "").trim();
    const lower = productName.toLowerCase();
    const match =
      lower &&
      allProducts.find((p) => (p.name || "").trim().toLowerCase() === lower);
    const productId = match ? match.id : inst.productId || "";
    const productById = productId ? findProductById(productId) : null;
    const resolvedBlock = resolveInstanceFamily({
      ...inst,
      productId,
      productName,
      block: inst.block || (match && match.block) || (productById && productById.block) || "",
    });
    const existing = existingInstances.find((i) => i.id === id) || {};
    const createdAt = existing.createdAt || inst.createdAt || now;
    updates.set(id, {
      ...inst,
      id,
      productId,
      productName,
      block: resolvedBlock,
      storeIds: Array.isArray(inst.storeIds) ? inst.storeIds.filter(Boolean) : [],
      createdAt,
      updatedAt: now,
    });
  });

  const next = Array.from(updates.values());
  const consolidated = consolidateInstances(next, now);
  setInstancesList(consolidated);
  cleanupSelectionsWithInstances();
}

function removeInstanceById(id) {
  const list = getInstancesList();
  const filtered = list.filter((i) => i.id !== id);
  if (filtered.length === list.length) return;
  setInstancesList(filtered);
  cleanupSelectionsWithInstances();
  renderInstancesTable();
  renderProducts();
  renderExtraQuickTable();
  renderExtraEditTable();
}

function handleInstancesDependencies() {
  renderInstancesTable();
  renderProducts();
  renderExtraQuickTable();
  renderExtraEditTable();
  renderShoppingList();
}

function isSaveShortcut(e) {
  const keyRaw = (e.key || "").toLowerCase();
  const keyCode = e.keyCode || e.which;
  const isS = keyRaw === "s" || keyCode === 83;
  if (!isS) return false;
  return !!(e.metaKey || e.ctrlKey);
}

function blockNativeSave(e) {
  if (!isSaveShortcut(e)) return;
  try {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();
    e.cancelBubble = true;
    e.returnValue = false;
  } catch {}
  e.__saveHandled = true;
  return false;
}

function handleGlobalSaveShortcut(e) {
  if (!isSaveShortcut(e)) return;
  if (e && e.__saveHandled) return false;
  if (e && e.cancelable === false) return false;
  try {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();
    e.cancelBubble = true;
    e.returnValue = false;
    e.__saveHandled = true;
  } catch {}

  commitDraftProducts();
  commitDraftExtras();
  if (almacenEditPanel && almacenEditPanel.classList.contains("active")) {
    handleSaveGrid();
    setAlmacenMode(false);
    return false;
  }
  if (otrosEditPanel && otrosEditPanel.classList.contains("active")) {
    if (window.ExtraEditView && typeof window.ExtraEditView.save === "function") {
      window.ExtraEditView.save(extraEditViewContext);
    }
    setOtrosMode(false);
    return false;
  }
  if (instancesPanel && instancesPanel.classList.contains("active")) {
    handleSaveInstances();
    return false;
  }
  if (producersPanel && producersPanel.classList.contains("active")) {
    handleSaveProducers();
    return false;
  }
  if (storesPanel && storesPanel.classList.contains("active")) {
    handleSaveStores();
    return false;
  }
  if (classificationSection && classificationSection.classList.contains("active")) {
    handleSaveClassifications();
    return false;
  }
  return false;
}

function handleGlobalEscape(e) {
  if (e.key !== "Escape") return;
  // No cerrar si popup selección visible
  if (selectionPopupOverlay && selectionPopupOverlay.classList.contains("visible")) return;
  if (productDrafts.length > 0) {
    productDrafts = [];
    renderProducts();
    return;
  }
  if (extraDrafts.length > 0) {
    extraDrafts = [];
    renderExtraQuickTable();
    return;
  }
  if (almacenEditPanel && almacenEditPanel.classList.contains("active")) {
    e.preventDefault();
    setAlmacenMode(false);
    return;
  }
  if (otrosEditPanel && otrosEditPanel.classList.contains("active")) {
    e.preventDefault();
    setOtrosMode(false);
    return;
  }
}

function handleAddStoreRow() {
  if (window.StoresView && typeof window.StoresView.addRow === "function") {
    window.StoresView.addRow(storesViewContext);
  }
}

function handleStoresTableClick(e) {
  // Gestionado por StoresView
}

function handleSaveStores() {
  if (window.StoresView && typeof window.StoresView.save === "function") {
    window.StoresView.save(storesViewContext);
  }
}

// ==============================
//  RESIZE COLUMNAS TABLAS
// ==============================

function initResizableTables() {
  const tables = document.querySelectorAll("table.product-table");
  tables.forEach((table) => {
    const thead = table.querySelector("thead");
    if (!thead) return;
    const headers = Array.from(thead.querySelectorAll("th"));
    headers.forEach((th, idx) => {
      if (th.querySelector(".col-resize-handle")) return;
      const handle = document.createElement("span");
      handle.className = "col-resize-handle";
      th.appendChild(handle);

      let startX = 0;
      let startWidth = 0;

      const onMouseMove = (e) => {
        const delta = e.clientX - startX;
        const newWidth = Math.max(startWidth + delta, 40);
        setColumnWidth(table, idx, newWidth);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        startX = e.clientX;
        startWidth = th.offsetWidth;
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });
    });
  });
}

function setColumnWidth(table, colIndex, widthPx) {
  const ths = table.querySelectorAll(`thead th:nth-child(${colIndex + 1})`);
  ths.forEach((th) => {
    th.style.width = widthPx + "px";
    th.style.minWidth = widthPx + "px";
  });
  const rows = table.querySelectorAll("tbody tr");
  rows.forEach((tr) => {
    const td = tr.children[colIndex];
    if (td) {
      td.style.width = widthPx + "px";
      td.style.minWidth = widthPx + "px";
    }
  });
}

// ==============================
//  SELECCIÓN DE PRODUCTOS (INSTANCIAS)
// ==============================

function renderInstancesTable() {
  if (isStoreActive()) return;
  hideProductAutocomplete();
  if (window.InstancesFeature && typeof window.InstancesFeature.render === "function") {
    window.InstancesFeature.render();
    return;
  }
  if (window.InstancesView && typeof window.InstancesView.render === "function") {
    if (instancesViewContext && instancesViewContext.data) {
      instancesViewContext.data.instances = getInstancesList();
      instancesViewContext.data.producers = getProducersList();
      instancesViewContext.data.stores = getSuppliersList();
    }
    window.InstancesView.render(instancesViewContext);
  }
}

function handleAddInstanceRow() {
  if (window.InstancesView && typeof window.InstancesView.addRow === "function") {
    window.InstancesView.addRow(instancesViewContext);
  }
}

function handleSaveInstances() {
  if (window.InstancesView && typeof window.InstancesView.save === "function") {
    window.InstancesView.save(instancesViewContext);
    showToast("Selección de productos guardada");
  }
}

function handleAddProductFromSelection() {
  if (!instancesTableBody) return;
  // Si no hay filas, crea una y abre el creador inline
  if (!instancesTableBody.firstElementChild) {
    handleAddInstanceRow();
  }
  const targetRow = instancesTableBody.firstElementChild;
  if (targetRow) {
    openInlineProductCreator(targetRow);
  }
}

function openInlineProductCreator(row) {
  if (!instancesTableBody) return;

  // Cerrar cualquier creador abierto
  const existing = instancesTableBody.querySelector(
    ".inline-product-creator-row"
  );
  if (existing) existing.remove();

  const nameInput = row.querySelector('input[data-field="productName"]');
  const prefill = nameInput ? nameInput.value : "";

  const families = getClassificationFamilies();
  if (!families.length) {
    alert(
      "No hay familias definidas. Crea primero combinaciones en 'Clasificación de productos'."
    );
    return;
  }

  const tr = document.createElement("tr");
  tr.className = "inline-product-creator-row";
  const td = document.createElement("td");
  td.colSpan = 7;

  const form = document.createElement("div");
  form.className = "inline-product-creator";

  const fgName = document.createElement("div");
  fgName.className = "form-group";
  const lblName = document.createElement("label");
  lblName.textContent = "Nombre producto";
  const inpName = document.createElement("input");
  inpName.type = "text";
  inpName.value = prefill || "";
  fgName.appendChild(lblName);
  fgName.appendChild(inpName);

  const fgFam = document.createElement("div");
  fgFam.className = "form-group";
  const lblFam = document.createElement("label");
  lblFam.textContent = "Familia";
  const selFam = createFamilySelect();
  if (instancesFamilyFilterSelect && instancesFamilyFilterSelect.value) {
    selFam.value = instancesFamilyFilterSelect.value;
  }
  fgFam.appendChild(lblFam);
  fgFam.appendChild(selFam);

  const fgType = document.createElement("div");
  fgType.className = "form-group";
  const lblType = document.createElement("label");
  lblType.textContent = "Tipo";
  const selType = createTypeSelect();
  fgType.appendChild(lblType);
  fgType.appendChild(selType);
  linkFamilyTypeSelects(selFam, selType);

  const fgQty = document.createElement("div");
  fgQty.className = "form-group";
  const lblQty = document.createElement("label");
  lblQty.textContent = "Cantidad";
  const inpQty = document.createElement("input");
  inpQty.type = "text";
  fgQty.appendChild(lblQty);
  fgQty.appendChild(inpQty);

  const fgNotes = document.createElement("div");
  fgNotes.className = "form-group";
  const lblNotes = document.createElement("label");
  lblNotes.textContent = "Notas";
  const inpNotes = document.createElement("input");
  inpNotes.type = "text";
  fgNotes.appendChild(lblNotes);
  fgNotes.appendChild(inpNotes);

  const actions = document.createElement("div");
  actions.className = "inline-product-creator-actions";
  const btnSave = document.createElement("button");
  btnSave.type = "button";
  btnSave.className = "btn btn-primary btn-small";
  btnSave.textContent = "Crear";
  btnSave.addEventListener("click", () => {
    const nameVal = (inpName.value || "").trim();
    if (!nameVal) {
      alert("Introduce un nombre de producto.");
      return;
    }
    const fam = selFam.value || "";
    const typ = selType.value || "";
    if (!fam || !typ) {
      alert("Selecciona una familia y un tipo.");
      return;
    }
    const exists = getUnifiedList().some(
      (p) => (p.name || "").toLowerCase() === nameVal.toLowerCase()
    );
    if (exists) {
      alert("Ya existe un producto con ese nombre en el inventario.");
      return;
    }
    const now = nowIsoString();
    const id =
      (crypto.randomUUID ? crypto.randomUUID() : "extra-" + Date.now()) +
      "-" +
      Math.random().toString(36).slice(2);
    const newProduct = {
      id,
      name: nameVal,
      block: fam,
      type: typ,
      quantity: (inpQty.value || "").trim(),
      notes: (inpNotes.value || "").trim(),
      buy: false,
      have: true,
      selectionId: "",
      createdAt: now,
      updatedAt: now,
      scope: "otros",
    };
    const unified = [
      ...getUnifiedList(),
      newProduct,
    ];
    setUnifiedList(unified);
    renderBlockOptions();
    renderTypeOptions();
    renderProductsDatalist();
    renderExtraQuickTable();
    renderExtraEditTable();
    renderShoppingList();
    if (nameInput) {
      nameInput.value = nameVal;
      nameInput.dispatchEvent(new Event("input", { bubbles: true }));
      nameInput.focus();
    }
    tr.remove();
  });

  const btnCancel = document.createElement("button");
  btnCancel.type = "button";
  btnCancel.className = "btn btn-secondary btn-small";
  btnCancel.textContent = "Cancelar";
  btnCancel.addEventListener("click", () => tr.remove());

  actions.appendChild(btnCancel);
  actions.appendChild(btnSave);

  form.appendChild(fgName);
  form.appendChild(fgFam);
  form.appendChild(fgType);
  form.appendChild(fgQty);
  form.appendChild(fgNotes);

  td.appendChild(form);
  td.appendChild(actions);
  tr.appendChild(td);

  row.insertAdjacentElement("afterend", tr);
}

function promptFromList(list, label, allowEmpty = false) {
  if (!list.length) {
    alert(`No hay opciones de ${label} disponibles todavía.`);
    return allowEmpty ? "" : null;
  }
  const text = `${label} disponibles:\n${list.join(", ")}\n\nEscribe exactamente una opción.`;
  const val = prompt(text) || "";
  const trimmed = val.trim();
  if (!trimmed && allowEmpty) return "";
  const match = list.find(
    (item) => item.toLowerCase() === trimmed.toLowerCase()
  );
  if (!match) {
    alert(`Debe elegir una de las opciones de ${label}.`);
    return null;
  }
  return match;
}

function createExtraProductFromPrompt(initialName = "") {
  const trimmedName =
    (initialName || "").trim() ||
    (prompt("Nombre del producto", initialName || "") || "").trim();
  if (!trimmedName) return null;

  const exists = [...products, ...extraProducts].some(
    (p) => (p.name || "").toLowerCase() === trimmedName.toLowerCase()
  );
  if (exists) {
    alert("Ya existe un producto con ese nombre en el inventario.");
    return null;
  }

  const famList = getClassificationFamilies();
  const block = promptFromList(famList, "Familia / categoría", false);
  if (block === null) return null;
  const typeList = getClassificationTypes(block);
  const type = promptFromList(
    typeList.length ? typeList : getClassificationTypes(),
    "Tipo",
    false
  );
  if (type === null) return null;
  const quantity = prompt("Cantidad") || "";
  const notes = prompt("Notas") || "";

  const now = nowIsoString();
  const id =
    (crypto.randomUUID ? crypto.randomUUID() : "extra-" + Date.now()) +
    "-" +
    Math.random().toString(36).slice(2);

  const newProduct = {
    id,
    name: trimmedName,
    block: (block || "").trim(),
    type: (type || "").trim(),
    quantity: (quantity || "").trim(),
    notes: (notes || "").trim(),
    buy: false,
    have: true,
    selectionId: "",
    createdAt: now,
    updatedAt: now,
  };

  extraProducts.push(newProduct);
  saveExtraProducts();
  renderBlockOptions();
  renderTypeOptions();
  renderProductsDatalist();
  renderExtraQuickTable();
  renderExtraEditTable();
  renderShoppingList();
  return newProduct;
}

// ==============================
//  LISTA DE LA COMPRA
// ==============================

function renderShoppingList() {
  if (!shoppingListContainer || !shoppingSummary) return;
  shoppingListContainer.innerHTML = "";

  const summary =
    (window.AppStore &&
      window.AppStore.selectors &&
      window.AppStore.selectors.shoppingSummary &&
      window.AppStore.selectors.shoppingSummary({ products, extraProducts })) || {
      stores: [],
      totalItems: 0,
      totalStores: 0,
    };

  if (summary.stores.length === 0) {
    shoppingSummary.textContent = "0 producto(s) · 0 tienda(s)";
    const empty = document.createElement("div");
    empty.className = "shopping-empty";
    empty.textContent = "No hay productos pendientes.";
    shoppingListContainer.appendChild(empty);
    return;
  }

  const createStoreBlock = (store, items) => {
    const frag = cloneTemplateContent(shoppingStoreTemplate);
    if (!frag) return null;
    const block = frag.querySelector(".shopping-store-block");
    const title = frag.querySelector(".shopping-store-title");
    const count = frag.querySelector(".shopping-store-count");
    const list = frag.querySelector(".shopping-store-items");
    if (!block || !title || !count || !list) return null;
    block.dataset.store = store;
    title.textContent = store;
    count.textContent = `${items.length} producto(s)`;

    items.forEach(({ product, source }) => {
      const itemFrag = cloneTemplateContent(shoppingItemTemplate);
      const li = itemFrag ? itemFrag.querySelector("li") : document.createElement("li");
      const main = li.querySelector(".shopping-item-main") || document.createElement("div");
      const meta = li.querySelector(".shopping-item-meta") || document.createElement("div");

      main.className = "shopping-item-main";
      meta.className = "shopping-item-meta";
      main.textContent = product.quantity
        ? `${product.name || ""} — ${product.quantity}`
        : product.name || "";

      const parts = [];
      if (source === "almacén") parts.push("Almacén");
      else if (source === "otros") parts.push("Otros productos");
      if (product.notes) parts.push(product.notes);
      meta.textContent = parts.join(" · ");
      if (!meta.textContent) {
        meta.style.display = "none";
      }

      if (!li.contains(main)) li.appendChild(main);
      if (!li.contains(meta)) li.appendChild(meta);

      list.appendChild(li);
    });

    return frag;
  };

  summary.stores
    .slice()
    .sort((a, b) => a.store.localeCompare(b.store, "es", { sensitivity: "base" }))
    .forEach(({ store, items }) => {
      const block = createStoreBlock(store, items);
      if (block) {
        shoppingListContainer.appendChild(block);
      }
    });

  shoppingSummary.textContent = `${summary.totalItems} producto(s) · ${summary.totalStores} tienda(s)`;
}

function handleShoppingListClick(e) {
  const header = e.target.closest(".shopping-store-header");
  if (!header) return;
  const block = header.closest(".shopping-store-block");
  if (!block) return;
  block.classList.toggle("collapsed");
}

async function handleCopyList() {
  const groups = {};

  function addItem(storeName, text) {
    if (!groups[storeName]) groups[storeName] = [];
    groups[storeName].push(text);
  }

  products.forEach((p) => {
    if (p.have) return;
    const storeName = getSelectionMainStoreName(p);
    const line = p.quantity ? `${p.name} — ${p.quantity}` : p.name;
    addItem(storeName, line);
  });

  extraProducts.forEach((p) => {
    if (!p.buy) return;
    const storeName = getSelectionMainStoreName(p);
    const line = p.quantity ? `${p.name} — ${p.quantity}` : p.name;
    addItem(storeName, line);
  });

  const storeNames = Object.keys(groups).sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" })
  );

  const lines = [];
  storeNames.forEach((storeName, idx) => {
    if (idx > 0) lines.push("");
    lines.push(storeName.toUpperCase());
    groups[storeName].forEach((t) => lines.push("- " + t));
  });

  const text = lines.join("\n");
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      alert("Lista de la compra copiada al portapapeles.");
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("Lista de la compra copiada al portapapeles.");
    }
  } catch {
    alert("No se pudo copiar la lista. Puedes copiarla manualmente:\n\n" + text);
  }
}

// ==============================
//  BACKUP / EXCEL
// ==============================

function handleExportBackup() {
  const snap = getLatestStateSnapshot();
  const unified =
    snap.unifiedProducts && snap.unifiedProducts.length
      ? snap.unifiedProducts
      : recomputeUnifiedFromDerived();
  if (window.BackupUtils && typeof window.BackupUtils.exportBackup === "function") {
    window.BackupUtils.exportBackup({
      snapshot: {
        ...snap,
        unifiedProducts: unified,
      },
    });
  }
}

function handleBackupFileChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const cleanupInput = () => {
    if (backupFileInput) backupFileInput.value = "";
    if (e && e.target && e.target.type === "file") e.target.value = "";
  };

  if (window.BackupUtils && typeof window.BackupUtils.importBackup === "function") {
    window.BackupUtils.importBackup({
      file,
      onSnapshot: (snapshot) => {
        const applySnapshot = (snap) => {
          unifiedProducts = snap.unifiedProducts;
          suppliers = snap.suppliers;
          producers = snap.producers;
          productInstances = snap.productInstances;
          classifications = snap.classifications;
          persistUnified(unifiedProducts);
          saveSuppliers();
          saveProducers();
          saveProductInstances();
          saveClassifications();
          refreshProductsFromUnified();
          renderShelfOptions();
          renderBlockOptions();
          renderTypeOptions();
          renderStoreOptions();
          updateProducerFilterOptions();
          updateStoreFilterOptions();
          updateInstanceFilterOptions();
          renderProductsDatalist();
          renderProducts();
          renderGridRows();
          renderExtraQuickTable();
          renderExtraEditTable();
          if (window.ProducersFeature && typeof window.ProducersFeature.render === "function") {
            window.ProducersFeature.render();
          } else if (window.ProducersView && typeof window.ProducersView.render === "function") {
            window.ProducersView.render(producersViewContext);
          }
          if (window.StoresFeature && typeof window.StoresFeature.render === "function") {
            window.StoresFeature.render();
          } else if (window.StoresView && typeof window.StoresView.render === "function") {
            window.StoresView.render(storesViewContext);
          }
          renderClassificationTable();
          renderInstancesTable();
          renderShoppingList();
        };

        if (window.AppStore && typeof window.AppStore.setState === "function") {
          window.AppStore.setState(snapshot);
          syncFromAppStore();
        } else {
          applySnapshot(snapshot);
        }
        cleanupInput();
      },
    });
    return;
  }

  // Fallback si BackupUtils no está disponible
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const text = ev.target?.result || "";
      const data = JSON.parse(text);
      const snapshot = {
        unifiedProducts: Array.isArray(data.unifiedProducts)
          ? data.unifiedProducts
          : [
              ...(Array.isArray(data.products) ? data.products : []).map((p) => ({
                ...p,
                scope: "almacen",
              })),
              ...(Array.isArray(data.extraProducts) ? data.extraProducts : []).map((p) => ({
                ...p,
                scope: "otros",
              })),
            ],
        suppliers: Array.isArray(data.suppliers) ? data.suppliers : [],
        producers: Array.isArray(data.producers) ? data.producers : [],
        productInstances: Array.isArray(data.productInstances) ? data.productInstances : [],
        classifications: Array.isArray(data.classifications) ? data.classifications : [],
      };
      const applySnapshot = (snap) => {
        unifiedProducts = snap.unifiedProducts;
        suppliers = snap.suppliers;
        producers = snap.producers;
        productInstances = snap.productInstances;
        classifications = snap.classifications;
        persistUnified(unifiedProducts);
        saveSuppliers();
        saveProducers();
        saveProductInstances();
        saveClassifications();
        refreshProductsFromUnified();
        renderShelfOptions();
        renderBlockOptions();
        renderTypeOptions();
        renderStoreOptions();
        updateProducerFilterOptions();
        updateStoreFilterOptions();
        updateInstanceFilterOptions();
        renderProductsDatalist();
        renderProducts();
        renderGridRows();
        renderExtraQuickTable();
        renderExtraEditTable();
        if (window.ProducersFeature && typeof window.ProducersFeature.render === "function") {
          window.ProducersFeature.render();
        } else if (window.ProducersView && typeof window.ProducersView.render === "function") {
          window.ProducersView.render(producersViewContext);
        }
        if (window.StoresFeature && typeof window.StoresFeature.render === "function") {
          window.StoresFeature.render();
        } else if (window.StoresView && typeof window.StoresView.render === "function") {
          window.StoresView.render(storesViewContext);
        }
        renderClassificationTable();
        renderInstancesTable();
        renderShoppingList();
      };

      if (window.AppStore && typeof window.AppStore.setState === "function") {
        window.AppStore.setState(snapshot);
        syncFromAppStore();
      } else {
        applySnapshot(snapshot);
      }
      alert("Copia de seguridad restaurada correctamente.");
    } catch (err) {
      console.error(err);
      alert("No se pudo leer el archivo de copia de seguridad. Asegúrate de que es un JSON válido.");
    } finally {
      cleanupInput();
    }
  };
  reader.readAsText(file);
}

function handleExportAlmacenCsv() {
  if (window.BackupUtils && typeof window.BackupUtils.exportUnifiedCsv === "function") {
    window.BackupUtils.exportUnifiedCsv({
      scope: "almacen",
      filename: "almacen.xlsx",
      sheetName: "Almacén",
      getSnapshot: getLatestStateSnapshot,
      getSelectionLabel: getSelectionLabelForProduct,
      getSelectionStores: getSelectionStoresForProduct,
      comparer: compareShelfBlockTypeName,
    });
  }
}

function handleExportOtrosCsv() {
  if (window.BackupUtils && typeof window.BackupUtils.exportUnifiedCsv === "function") {
    window.BackupUtils.exportUnifiedCsv({
      scope: "otros",
      filename: "otros_productos.xlsx",
      sheetName: "Otros productos",
      getSnapshot: getLatestStateSnapshot,
      getSelectionLabel: getSelectionLabelForProduct,
      getSelectionStores: getSelectionStoresForProduct,
      comparer: compareShelfBlockTypeName,
    });
  }
}
