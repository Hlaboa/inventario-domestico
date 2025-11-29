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

let products = []; // almacén
let extraProducts = []; // otros productos
let unifiedProducts = []; // listado unificado con scope
let suppliers = []; // tiendas
let producers = []; // productores
let productInstances = []; // selección producto+productor+marca+tiendas
let classifications = []; // combinaciones familia/tipo
let productDrafts = [];
let extraDrafts = [];

function refreshProductsFromUnified() {
  products = (unifiedProducts || []).filter((p) => p.scope === "almacen");
  extraProducts = (unifiedProducts || []).filter((p) => p.scope === "otros");
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
  return [
    ...products.map((p) => ({ ...p, scope: "almacen" })),
    ...extraProducts.map((p) => ({ ...p, scope: "otros" })),
  ];
}

function isStoreActive() {
  return !!(window.AppStore && typeof window.AppStore.subscribe === "function");
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
  if (window.AppStore && typeof window.AppStore.getState === "function") {
    applyStateSnapshot(window.AppStore.getState());
  }
}

function persistUnified(list) {
  unifiedProducts = Array.isArray(list) ? list : [];
  refreshProductsFromUnified();
  if (
    window.AppStore &&
    window.AppStore.actions &&
    typeof window.AppStore.actions.setUnifiedProducts === "function"
  ) {
    window.AppStore.actions.setUnifiedProducts(unifiedProducts);
    syncFromAppStore();
    return;
  }
  if (window.DataService && typeof window.DataService.setUnifiedProducts === "function") {
    unifiedProducts = window.DataService.setUnifiedProducts(unifiedProducts);
    refreshProductsFromUnified();
    return;
  }
  if (window.AppStorage && typeof window.AppStorage.saveUnifiedProducts === "function") {
    window.AppStorage.saveUnifiedProducts(unifiedProducts);
    return;
  }
  try {
    localStorage.setItem("productosCocinaUnificados", JSON.stringify(unifiedProducts));
  } catch {}
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
// Snapshot helper para export/import en modo store o standalone
function getLatestStateSnapshot() {
  if (window.AppStore && typeof window.AppStore.getState === "function") {
    return window.AppStore.getState() || {};
  }
  if (window.AppState && typeof window.AppState.getState === "function") {
    return window.AppState.getState() || {};
  }
  return {
    products: products || [],
    extraProducts: extraProducts || [],
    unifiedProducts: unifiedProducts || recomputeUnifiedFromDerived(),
    suppliers: suppliers || [],
    producers: producers || [],
    classifications: classifications || [],
    productInstances: productInstances || [],
  };
}

function resetFiltersToDefaults() {
  const setValue = (el, val = "") => {
    if (!el) return;
    el.value = val;
  };

  setValue(filterSearchInput, "");
  setValue(filterShelfSelect, "");
  setValue(filterBlockSelect, "");
  setValue(filterTypeSelect, "");
  setValue(filterStoreSelect, "");
  setValue(filterStatusSelect, "all");

  setValue(editFilterSearchInput, "");
  setValue(editFilterFamilySelect, "");
  setValue(editFilterTypeSelect, "");
  setValue(editFilterShelfSelect, "");
  setValue(editFilterStoreSelect, "");

  setValue(extraFilterSearchInput, "");
  setValue(extraFilterFamilySelect, "");
  setValue(extraFilterTypeSelect, "");
  setValue(extraFilterStoreSelect, "");
  setValue(extraFilterBuySelect, "all");

  setValue(extraEditFilterSearchInput, "");
  setValue(extraEditFilterFamilySelect, "");
  setValue(extraEditFilterTypeSelect, "");
  setValue(extraEditFilterStoreSelect, "");

  setValue(instancesSearchInput, "");
  setValue(instancesFamilyFilterSelect, "");
  setValue(instancesProducerFilterSelect, "");
  setValue(instancesStoreFilterSelect, "");
}

// Toast sencillo
let toastContainer = null;
function showToast(message, timeout = 1800) {
  if (!message) return;
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, timeout);
}

function initNavAccessibility() {
  const tabsMain = document.querySelector(".tabs-main");
  if (tabsMain) {
    tabsMain.setAttribute("role", "tablist");
    tabsMain.querySelectorAll(".tab-button").forEach((btn) => {
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
let productAutocompleteDropdown;
let currentProductInput = null;
let lastSelectionTrigger = null;
let instancesTableWrapper;
let inlineProducerSelect;
let inlineBrandInput;
let inlineStoresSelect;

let isDraggingSelectionPopup = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let filtersDefaultsApplied = false;

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
      products: products,
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
  summaryInfo = document.getElementById("summaryInfo");

  // Navegación principal
  mainAlmacenButton = document.getElementById("mainAlmacenButton");
  mainOtrosButton = document.getElementById("mainOtrosButton");
  mainSelectionButton = document.getElementById("mainSelectionButton");
  mainClassificationButton = document.getElementById(
    "mainClassificationButton"
  );
  mainProducersButton = document.getElementById("mainProducersButton");
  mainStoresButton = document.getElementById("mainStoresButton");
  almacenSection = document.getElementById("almacenSection");
  otrosSection = document.getElementById("otrosSection");
  classificationSection = document.getElementById("classificationSection");
  proveedoresSection = document.getElementById("proveedoresSection");

  // Modo edición
  almacenEditModeButton = document.getElementById("almacenEditModeButton");
  otrosEditModeButton = document.getElementById("otrosEditModeButton");

  // Paneles
  almacenInventoryPanel = document.getElementById("almacenInventoryPanel");
  almacenEditPanel = document.getElementById("almacenEditPanel");
  otrosListPanel = document.getElementById("otrosListPanel");
  otrosEditPanel = document.getElementById("otrosEditPanel");

  // Almacén (vista)
  filterSearchInput = document.getElementById("filterSearch");
  filterShelfSelect = document.getElementById("filterShelf");
  filterBlockSelect = document.getElementById("filterBlock");
  filterTypeSelect = document.getElementById("filterType");
  filterStoreSelect = document.getElementById("filterStore");
  filterStatusSelect = document.getElementById("filterStatus");
  productTableBody = document.getElementById("productTableBody");
  inventoryRowTemplate = document.getElementById("inventoryRowTemplate");
  inventoryEditRowTemplate = document.getElementById("inventoryEditRowTemplate");
  classificationRowTemplate = document.getElementById("classificationRowTemplate");
  producersRowTemplate = document.getElementById("producersRowTemplate");
  storesRowTemplate = document.getElementById("storesRowTemplate");
  instancesRowTemplate = document.getElementById("instancesRowTemplate");

  // Almacén (editar)
  gridTableBody = document.getElementById("gridTableBody");
  saveGridButton = document.getElementById("saveGridButton");
  addGridRowButton = document.getElementById("addGridRowButton");
  editFilterSearchInput = document.getElementById("editFilterSearch");
  editFilterFamilySelect = document.getElementById("editFilterFamily");
  editFilterTypeSelect = document.getElementById("editFilterType");
  editFilterShelfSelect = document.getElementById("editFilterShelf");
  editFilterStoreSelect = document.getElementById("editFilterStore");

  // Otros (vista)
  extraListTableBody = document.getElementById("extraListTableBody");
  extraFilterSearchInput = document.getElementById("extraFilterSearch");
  extraFilterFamilySelect = document.getElementById("extraFilterFamily");
  extraFilterTypeSelect = document.getElementById("extraFilterType");
  extraFilterStoreSelect = document.getElementById("extraFilterStore");
  extraFilterBuySelect = document.getElementById("extraFilterBuy");

  // Otros (editar)
  extraTableBody = document.getElementById("extraTableBody");
  addExtraRowButton = document.getElementById("addExtraRowButton");
  saveExtraButton = document.getElementById("saveExtraButton");
  extraEditFilterSearchInput = document.getElementById("extraEditFilterSearch");
  extraEditFilterFamilySelect = document.getElementById(
    "extraEditFilterFamily"
  );
  extraEditFilterTypeSelect = document.getElementById("extraEditFilterType");
  extraEditFilterStoreSelect = document.getElementById("extraEditFilterStore");
  extraQuickRowTemplate = document.getElementById("extraQuickRowTemplate");
  extraEditRowTemplate = document.getElementById("extraEditRowTemplate");

  // Productores
  producersSearchInput = document.getElementById("producersSearch");
  producersLocationFilterSelect = document.getElementById(
    "producersLocationFilter"
  );
  producersTableBody = document.getElementById("producersTableBody");
  addProducerButton = document.getElementById("addProducerButton");
  saveProducersButton = document.getElementById("saveProducersButton");

  // Tiendas
  storesSearchInput = document.getElementById("storesSearch");
  storesTypeFilterSelect = document.getElementById("storesTypeFilter");
  storesLocationFilterSelect = document.getElementById("storesLocationFilter");
  storesTableBody = document.getElementById("storesTableBody");
  addStoreButton = document.getElementById("addStoreButton");
  saveStoresButton = document.getElementById("saveStoresButton");

  // Selección de productos
  instancesSearchInput = document.getElementById("instancesSearch");
  instancesFamilyFilterSelect = document.getElementById("instancesFamilyFilter");
  instancesProducerFilterSelect = document.getElementById(
    "instancesProducerFilter"
  );
  instancesStoreFilterSelect = document.getElementById("instancesStoreFilter");
  instancesTableBody = document.getElementById("instancesTableBody");
  addInstanceButton = document.getElementById("addInstanceButton");
  saveInstancesButton = document.getElementById("saveInstancesButton");
  productsDatalist = document.getElementById("productsDatalist");
  addQuickProductButton = document.getElementById("addQuickProductButton");
  addQuickExtraButton = document.getElementById("addQuickExtraButton");
  classificationTableBody = document.getElementById("classificationTableBody");
  addClassificationButton = document.getElementById("addClassificationButton");
  saveClassificationsButton = document.getElementById("saveClassificationsButton");

  // Tabs Tiendas/Prod/Selección
  producersPanel = document.getElementById("producersPanel");
  storesPanel = document.getElementById("storesPanel");
  instancesPanel = document.getElementById("instancesPanel");

  // Lista compra
  shoppingListContainer = document.getElementById("shoppingListContainer");
  shoppingSummary = document.getElementById("shoppingSummary");
  copyListButton = document.getElementById("copyListButton");
  instancesTableWrapper = document.getElementById("instancesTableWrapper");
  shoppingStoreTemplate = document.getElementById("shoppingStoreTemplate");
  shoppingItemTemplate = document.getElementById("shoppingItemTemplate");

  // Backup y Excel
  exportBackupButton = document.getElementById("exportBackupButton");
  importBackupButton = document.getElementById("importBackupButton");
  backupFileInput = document.getElementById("backupFileInput");
  exportAlmacenCsvButton = document.getElementById("exportAlmacenCsvButton");
  exportOtrosCsvButton = document.getElementById("exportOtrosCsvButton");

  // Toggle lista compra
  toggleShoppingPanelButton = document.getElementById(
    "toggleShoppingPanelButton"
  );
  if (toggleShoppingPanelButton) {
    toggleShoppingPanelButton.title = "Mostrar lista de la compra";
  }

  // Popup selección
  selectionPopupOverlay = document.getElementById("selectionPopupOverlay");
  selectionPopup = document.getElementById("selectionPopup");
  selectionPopupTitle = document.getElementById("selectionPopupTitle");
  selectionPopupList = document.getElementById("selectionPopupList");
  selectionPopupClose = document.getElementById("selectionPopupClose");
  selectionPopupHeader = document.querySelector(".selection-popup-header");
  selectionPopupBody = document.querySelector(".selection-popup-body");
  productAutocompleteDropdown = createProductAutocompleteDropdown();

  // Navegación principal
  mainAlmacenButton.addEventListener("click", () => setMainSection("almacen"));
  mainOtrosButton.addEventListener("click", () => setMainSection("otros"));
  mainSelectionButton.addEventListener("click", () =>
    setMainSection("selection")
  );
  mainClassificationButton.addEventListener("click", () =>
    setMainSection("classification")
  );
  mainProducersButton.addEventListener("click", () =>
    setMainSection("producers")
  );
  mainStoresButton.addEventListener("click", () => setMainSection("stores"));

  // Modo edición
  almacenEditModeButton.addEventListener("click", toggleAlmacenEditMode);
  otrosEditModeButton.addEventListener("click", toggleOtrosEditMode);

  // Edición almacén
  saveGridButton.addEventListener("click", handleSaveGrid);
  addGridRowButton.addEventListener("click", handleAddGridRow);
  gridTableBody.addEventListener("click", handleGridClick);

  editFilterSearchInput.addEventListener("input", filterGridRows);
  editFilterFamilySelect.addEventListener("change", filterGridRows);
  editFilterTypeSelect.addEventListener("change", filterGridRows);
  editFilterShelfSelect.addEventListener("change", filterGridRows);
  editFilterStoreSelect.addEventListener("change", filterGridRows);

  // Otros productos
  extraListTableBody.addEventListener("click", handleExtraListClick);

  const debouncedRenderExtras =
    (window.AppUtils && window.AppUtils.debounce
      ? window.AppUtils.debounce(renderExtraQuickTable, 150)
      : renderExtraQuickTable);
  const debouncedRenderInventory =
    (window.AppUtils && window.AppUtils.debounce
      ? window.AppUtils.debounce(() => renderProducts(), 150)
      : () => renderProducts());
  const debouncedRenderInstances =
    (window.AppUtils && window.AppUtils.debounce
      ? window.AppUtils.debounce(() => {
          if (instancesController && typeof instancesController.render === "function") {
            instancesController.render();
          } else {
            renderInstancesTable();
          }
        }, 150)
      : () => {
          if (instancesController && typeof instancesController.render === "function") {
            instancesController.render();
          } else {
            renderInstancesTable();
          }
        });

  if (extraFilterSearchInput)
    extraFilterSearchInput.addEventListener("input", debouncedRenderExtras);
  if (extraFilterFamilySelect)
    extraFilterFamilySelect.addEventListener("change", debouncedRenderExtras);
  if (extraFilterTypeSelect)
    extraFilterTypeSelect.addEventListener("change", debouncedRenderExtras);
  if (extraFilterStoreSelect)
    extraFilterStoreSelect.addEventListener("change", debouncedRenderExtras);
  if (extraFilterBuySelect)
    extraFilterBuySelect.addEventListener("change", debouncedRenderExtras);

  addExtraRowButton.addEventListener("click", handleAddExtraRow);
  saveExtraButton.addEventListener("click", handleSaveExtra);
  extraTableBody.addEventListener("click", handleExtraEditClick);

  extraEditFilterSearchInput.addEventListener("input", filterExtraEditRows);
  extraEditFilterFamilySelect.addEventListener("change", filterExtraEditRows);
  extraEditFilterTypeSelect.addEventListener("change", filterExtraEditRows);
  extraEditFilterStoreSelect.addEventListener("change", filterExtraEditRows);

  // Productores
  // Selección de productos
  instancesSearchInput.addEventListener("input", renderInstancesTable);
  instancesFamilyFilterSelect.addEventListener("change", renderInstancesTable);
  instancesProducerFilterSelect.addEventListener(
    "change",
    renderInstancesTable
  );
  instancesStoreFilterSelect.addEventListener("change", renderInstancesTable);
  addInstanceButton.addEventListener("click", handleAddInstanceRow);
  saveInstancesButton.addEventListener("click", handleSaveInstances);
  if (addQuickProductButton)
    addQuickProductButton.addEventListener("click", handleAddQuickProduct);
  if (addQuickExtraButton)
    addQuickExtraButton.addEventListener("click", handleAddQuickExtra);

  // Lista compra
  shoppingListContainer.addEventListener("click", handleShoppingListClick);
  copyListButton.addEventListener("click", handleCopyList);

  // Backup y Excel
  exportBackupButton.addEventListener("click", handleExportBackup);
  importBackupButton.addEventListener("click", () => backupFileInput.click());
  backupFileInput.addEventListener("change", handleBackupFileChange);
  exportAlmacenCsvButton.addEventListener("click", handleExportAlmacenCsv);
  exportOtrosCsvButton.addEventListener("click", handleExportOtrosCsv);

  // Toggle lista compra
  toggleShoppingPanelButton.addEventListener(
    "click",
    handleToggleShoppingPanel
  );

  // Popup selección
  if (selectionPopupClose) {
    selectionPopupClose.addEventListener("click", closeSelectionPopup);
  }
  if (selectionPopupOverlay) {
    selectionPopupOverlay.addEventListener("click", (e) => {
      if (e.target === selectionPopupOverlay) {
        closeSelectionPopup();
      }
    });
  }
  initSelectionPopupDrag();
  window.addEventListener("resize", handleSelectionPopupResize);
  initProductAutocompleteEvents();
  document.addEventListener("keydown", handleSelectionPopupKeydown);
  initHorizontalTableScroll();

  // Carga datos y renderizado inicial
  loadAllData();

  const syncFromState = (next) => {
    applyStateSnapshot(next || {});
    ensureInstanceFamilies({ persist: false });
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
    } else {
      renderProducts();
    }
    if (!isStoreActive()) {
      renderGridRows();
      renderExtraQuickTable();
      renderExtraEditTable();
    }
    renderProducersTable();
    renderStoresTable();
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
      resetFiltersToDefaults();
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

  classificationViewContext = {
    refs: {
      tableBody: classificationTableBody,
      addButton: addClassificationButton,
      saveButton: saveClassificationsButton,
      rowTemplate: classificationRowTemplate,
    },
    getClassifications: () => classifications,
    persist: (list) => {
      classifications = list;
      saveClassifications();
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
    getProducers: () => producers,
    persist: (list) => {
      producers = list;
      saveProducers();
    },
    onAfterSave: handleProducersDependencies,
    nowIsoString,
  };

  if (window.ProducersView && typeof window.ProducersView.init === "function") {
    window.ProducersView.init(producersViewContext);
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
    getStores: () => suppliers,
    persist: (list) => {
      suppliers = list;
      saveSuppliers();
    },
    onAfterSave: handleStoresDependencies,
    nowIsoString,
  };

  if (window.StoresView && typeof window.StoresView.init === "function") {
    window.StoresView.init(storesViewContext);
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
      instances: productInstances,
      producers,
      stores: suppliers,
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
  if (extraController && typeof extraController.render === "function") {
    extraController.render();
  }

  instancesController =
    window.InstancesController && window.InstancesController.create
      ? window.InstancesController.create({
          store: window.AppStore || window.AppState,
          view: window.InstancesView,
          context: instancesViewContext,
        })
      : null;
  if (instancesController && typeof instancesController.render === "function") {
    instancesController.render();
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
            renderProducersTable();
            updateProducerFilterOptions();
          },
        })
      : null;

  storesController =
    window.StoresController && window.StoresController.create
      ? window.StoresController.create({
          store: window.AppStore || window.AppState,
          onRender: () => {
            renderStoresTable();
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
  document.addEventListener("keydown", handleGlobalSaveShortcut);
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

  if (isProd) renderProducersTable();
  if (isStores) renderStoresTable();
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

// ==============================
//  CARGA / GUARDADO
// ==============================

function normalizeMultiFields(obj) {
  const copy = { ...obj };
  delete copy.store;
  delete copy.brand;
  delete copy.supplier;
  delete copy.producer;
  return copy;
}

function normalizeProduct(p) {
  let res = { ...p };
  if (!res.expiryText && (res.shelfLifeDays || res.shelfLifeDays === 0)) {
    res.expiryText = String(res.shelfLifeDays);
  }
  res = normalizeMultiFields(res);
  res.selectionId = res.selectionId || "";
  res.have = !!res.have;
  res.quantity = res.quantity || "";
  res.block = res.block || "";
  res.type = res.type || "";
  res.shelf = res.shelf || "";
  res.notes = res.notes || "";
  res.createdAt = res.createdAt || nowIsoString();
  res.updatedAt = res.updatedAt || res.createdAt;
  return res;
}

function normalizeExtraProduct(p) {
  const res = normalizeMultiFields(p);
  res.selectionId = res.selectionId || "";
  res.buy = !!res.buy;
  res.quantity = res.quantity || "";
  res.block = res.block || "";
  res.type = res.type || "";
  res.notes = res.notes || "";
  res.createdAt = res.createdAt || nowIsoString();
  res.updatedAt = res.updatedAt || res.createdAt;
  return res;
}

function normalizeSupplier(s) {
  const now = nowIsoString();
  return {
    id:
      s.id ||
      (crypto.randomUUID
        ? crypto.randomUUID()
        : "store-" + Math.random().toString(36).slice(2)),
    name: s.name || "",
    type: s.type || "",
    location: s.location || s.storesText || "",
    website: s.website || "",
    notes: s.notes || "",
    createdAt: s.createdAt || now,
    updatedAt: s.updatedAt || now,
  };
}

function normalizeProducer(p) {
  const now = nowIsoString();
  return {
    id:
      p.id ||
      (crypto.randomUUID
        ? crypto.randomUUID()
        : "prod-" + Math.random().toString(36).slice(2)),
    name: p.name || "",
    location: p.location || p.storesText || "",
    website: p.website || "",
    notes: p.notes || "",
    createdAt: p.createdAt || now,
    updatedAt: p.updatedAt || now,
  };
}

function normalizeInstance(i) {
  const now = nowIsoString();
  return {
    id:
      i.id ||
      (crypto.randomUUID
        ? crypto.randomUUID()
        : "inst-" + Math.random().toString(36).slice(2)),
    productId: i.productId || "",
    productName: i.productName || "",
    producerId: i.producerId || "",
    brand: i.brand || "",
    storeIds: Array.isArray(i.storeIds) ? i.storeIds : [],
    notes: i.notes || "",
    createdAt: i.createdAt || now,
    updatedAt: i.updatedAt || now,
  };
}

function normalizeClassification(c) {
  const now = nowIsoString();
  return {
    id:
      c.id ||
      (crypto.randomUUID
        ? crypto.randomUUID()
        : "cls-" + Math.random().toString(36).slice(2)),
    block: (c.block || "").trim(),
    type: (c.type || "").trim(),
    notes: c.notes || "",
    createdAt: c.createdAt || now,
    updatedAt: c.updatedAt || now,
  };
}

function loadSuppliers() {
  suppliers = safeLoadList(STORAGE_KEY_SUPPLIERS, normalizeSupplier);
}

function loadProducers() {
  producers = safeLoadList(STORAGE_KEY_PRODUCERS, normalizeProducer);
}

function loadClassifications() {
  classifications = safeLoadList(STORAGE_KEY_CLASSIFICATIONS, normalizeClassification);

  // Asegurar combinaciones existentes de productos
  const combos = new Set(
    classifications.map((c) => `${c.block}|||${c.type}`)
  );
  const now = nowIsoString();
  [...products, ...extraProducts].forEach((p) => {
    const block = (p.block || "").trim();
    const type = (p.type || "").trim();
    if (!block && !type) return;
    const key = `${block}|||${type}`;
    if (!combos.has(key)) {
      combos.add(key);
      classifications.push({
        id:
          (crypto.randomUUID
            ? crypto.randomUUID()
            : "cls-" + Math.random().toString(36).slice(2)),
        block,
        type,
        notes: "",
        createdAt: now,
        updatedAt: now,
      });
    }
  });
  saveClassifications();
}

function loadProductInstances() {
  productInstances = safeLoadList(STORAGE_KEY_INSTANCES, normalizeInstance);
}

function saveProducts() {
  if (
    window.AppStore &&
    window.AppStore.actions &&
    typeof window.AppStore.actions.setProducts === "function"
  ) {
    window.AppStore.actions.setProducts(products);
    syncFromAppStore();
    return;
  }
  persistUnified(recomputeUnifiedFromDerived());
}
function saveExtraProducts() {
  if (
    window.AppStore &&
    window.AppStore.actions &&
    typeof window.AppStore.actions.setExtraProducts === "function"
  ) {
    window.AppStore.actions.setExtraProducts(extraProducts);
    syncFromAppStore();
    return;
  }
  persistUnified(recomputeUnifiedFromDerived());
}
function saveSuppliers() {
  if (
    window.AppStore &&
    window.AppStore.actions &&
    typeof window.AppStore.actions.setSuppliers === "function"
  ) {
    window.AppStore.actions.setSuppliers(suppliers);
    syncFromAppStore();
    return;
  }
  if (window.DataService && typeof window.DataService.setSuppliers === "function") {
    suppliers = window.DataService.setSuppliers(suppliers);
    return;
  }
  if (window.AppStorage && typeof window.AppStorage.saveSuppliers === "function") {
    window.AppStorage.saveSuppliers(suppliers);
    return;
  }
  saveList(STORAGE_KEY_SUPPLIERS, suppliers);
}
function saveProducers() {
  if (
    window.AppStore &&
    window.AppStore.actions &&
    typeof window.AppStore.actions.setProducers === "function"
  ) {
    window.AppStore.actions.setProducers(producers);
    syncFromAppStore();
    return;
  }
  if (window.DataService && typeof window.DataService.setProducers === "function") {
    producers = window.DataService.setProducers(producers);
    return;
  }
  if (window.AppStorage && typeof window.AppStorage.saveProducers === "function") {
    window.AppStorage.saveProducers(producers);
    return;
  }
  saveList(STORAGE_KEY_PRODUCERS, producers);
}
function saveProductInstances() {
  if (
    window.AppStore &&
    window.AppStore.actions &&
    typeof window.AppStore.actions.setProductInstances === "function"
  ) {
    window.AppStore.actions.setProductInstances(productInstances);
    syncFromAppStore();
    return;
  }
  if (
    window.DataService &&
    typeof window.DataService.setProductInstances === "function"
  ) {
    productInstances = window.DataService.setProductInstances(productInstances);
    return;
  }
  if (window.AppStorage && typeof window.AppStorage.saveProductInstances === "function") {
    window.AppStorage.saveProductInstances(productInstances);
    return;
  }
  saveList(STORAGE_KEY_INSTANCES, productInstances);
}
function saveClassifications() {
  if (
    window.AppStore &&
    window.AppStore.actions &&
    typeof window.AppStore.actions.setClassifications === "function"
  ) {
    window.AppStore.actions.setClassifications(classifications);
    syncFromAppStore();
    return;
  }
  if (
    window.DataService &&
    typeof window.DataService.setClassifications === "function"
  ) {
    classifications = window.DataService.setClassifications(classifications);
    return;
  }
  if (window.AppStorage && typeof window.AppStorage.saveClassifications === "function") {
    window.AppStorage.saveClassifications(classifications);
    return;
  }
  saveList(STORAGE_KEY_CLASSIFICATIONS, classifications);
}

function loadAllData() {
  if (window.AppStore && typeof window.AppStore.bootstrap === "function") {
    const snapshot = window.AppStore.bootstrap();
    applyStateSnapshot(snapshot);
    ensureInstanceFamilies({ persist: false });
    return;
  }

  if (
    window.DataService &&
    typeof window.DataService.hydrateFromStorage === "function"
  ) {
    const data = window.DataService.hydrateFromStorage();
    applyStateSnapshot(data);
    ensureInstanceFamilies({ persist: false });
    return;
  }

  if (window.AppStorage && typeof window.AppStorage.loadAllData === "function") {
    const data = window.AppStorage.loadAllData();
    applyStateSnapshot(data);
    ensureInstanceFamilies({ persist: false });
    return;
  }

  unifiedProducts = [];
  refreshProductsFromUnified();
  loadSuppliers();
  loadProducers();
  loadClassifications();
  loadProductInstances();
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

function safeLoadList(storageKey, normalizeItem) {
  if (window.AppUtils && typeof window.AppUtils.safeLoadList === "function") {
    return window.AppUtils.safeLoadList(storageKey, normalizeItem);
  }
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    if (typeof normalizeItem === "function") {
      return parsed.map((item) => normalizeItem(item));
    }
    return parsed;
  } catch {
    return [];
  }
}

function saveList(storageKey, list) {
  if (window.AppUtils && typeof window.AppUtils.saveList === "function") {
    return window.AppUtils.saveList(storageKey, list);
  }
  const data = Array.isArray(list) ? list : [];
  localStorage.setItem(storageKey, JSON.stringify(data));
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
  let p = products.find((x) => x.id === id);
  if (p) return p;
  p = extraProducts.find((x) => x.id === id);
  return p || null;
}

function getAllProductsForAssociationList() {
  const list = [];
  for (const p of products) {
    if (!p.name) continue;
    list.push({
      id: p.id,
      name: p.name,
      kind: "almacén",
      block: p.block || "",
      type: p.type || "",
    });
  }
  for (const p of extraProducts) {
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
  const p = producers.find((x) => x.id === id);
  return p ? p.name || "" : "";
}

function getStoreName(id) {
  const s = suppliers.find((x) => x.id === id);
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
      products,
      extraProducts,
      classifications,
    });
  }

  if (classifications.length === 0) {
    return Array.from(
      new Set(
        [...products, ...extraProducts]
          .map((p) => (p.block || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }
  return Array.from(
    new Set(
      classifications
        .map((c) => (c.block || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

function getClassificationTypes(family = "") {
  if (
    window.DataService &&
    window.DataService.selectors &&
    typeof window.DataService.selectors.types === "function"
  ) {
    return window.DataService.selectors.types(
      { products, extraProducts, classifications },
      family
    );
  }

  const fam = (family || "").trim();
  const source =
    classifications.length === 0
      ? [...products, ...extraProducts].map((p) => ({
          block: p.block || "",
          type: p.type || "",
        }))
      : classifications;

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
    products.find((p) => (p.name || "").toLowerCase() === lower) ||
    extraProducts.find((p) => (p.name || "").toLowerCase() === lower);
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
  const all = unifiedProducts && unifiedProducts.length ? unifiedProducts : recomputeUnifiedFromDerived();
  const exact = all.find(
    (p) => (p.name || "").trim().toLowerCase() === name
  );
  if (exact && exact.block) return exact.block;

  // 3) Coincidencia parcial (incluye)
  const partial = all.find((p) => {
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
  if (!Array.isArray(productInstances) || productInstances.length === 0) return;
  const updated = [];
  let changed = false;
  productInstances.forEach((inst) => {
    const block = resolveInstanceFamily(inst) || inst.block || "";
    if (block && inst.block !== block) {
      changed = true;
      updated.push({ ...inst, block });
    } else {
      updated.push(inst);
    }
  });
  if (changed) {
    productInstances = updated;
    if (persist) {
      try {
        saveProductInstances();
      } catch {}
    }
  }
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
  return productInstances.find((inst) => inst.id === product.selectionId) || null;
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
  return productInstances.some((pi) => {
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
  productInstances.push(inst);
  saveProductInstances();
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
  producers.push(producer);
  saveProducers();
  renderProducersTable();
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
  suppliers.push(store);
  saveSuppliers();
  renderStoresTable();
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
  const validIds = new Set(productInstances.map((i) => i.id));
  let changed = false;
  const now = nowIsoString();

  products.forEach((p) => {
    if (p.selectionId && !validIds.has(p.selectionId)) {
      p.selectionId = "";
      p.updatedAt = now;
      changed = true;
    }
  });

  extraProducts.forEach((p) => {
    if (p.selectionId && !validIds.has(p.selectionId)) {
      p.selectionId = "";
      p.updatedAt = now;
      changed = true;
    }
  });

  if (changed) {
    saveProducts();
    saveExtraProducts();
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
  const instances = productInstances.filter((inst) => {
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
    producers
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
    suppliers
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
  selectionPopupOverlay.classList.add("visible");
  centerSelectionPopup();
  requestAnimationFrame(centerSelectionPopup);
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
  if (!selectionPopupOverlay) return;
  stopSelectionPopupDrag();
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
  if (e.key !== "Escape") return;
  if (selectionPopupOverlay && selectionPopupOverlay.classList.contains("visible")) {
    e.preventDefault();
    closeSelectionPopup();
  }
}

function applySelectionToProduct(productId, selectionId) {
  refreshProductsFromUnified();
  const now = nowIsoString();
  let found = false;

  unifiedProducts = (unifiedProducts || []).map((p) => {
    if (p.id === productId) {
      found = true;
      return { ...p, selectionId, updatedAt: now };
    }
    return p;
  });
  refreshProductsFromUnified();

  if (found) {
    persistUnified(unifiedProducts);
    saveProducts();
    saveExtraProducts();
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

function initSelectionPopupDrag() {
  const handle = selectionPopupHeader || selectionPopup;
  if (!handle || !selectionPopup) return;

  const startDrag = (clientX, clientY) => {
    isDraggingSelectionPopup = true;
    selectionPopup.classList.add("dragging");

    const rect = selectionPopup.getBoundingClientRect();

    dragOffsetX = clientX - rect.left;
    dragOffsetY = clientY - rect.top;

    selectionPopup.style.position = "fixed";
    selectionPopup.style.transition = "none";
    selectionPopup.style.transform = "none";
    selectionPopup.style.left = rect.left + "px";
    selectionPopup.style.top = rect.top + "px";
    clampSelectionPopupPosition(rect.left, rect.top);

    document.addEventListener("mousemove", handleSelectionPopupDrag);
    document.addEventListener("mouseup", stopSelectionPopupDrag);
    document.addEventListener("touchmove", handleSelectionPopupDrag, {
      passive: false,
    });
    document.addEventListener("touchend", stopSelectionPopupDrag);
    document.addEventListener("touchcancel", stopSelectionPopupDrag);
  };

  const shouldBlockDrag = (target) =>
    target.closest("button") ||
    target.closest("input") ||
    target.closest("select") ||
    target.closest("textarea");

  handle.addEventListener("mousedown", (e) => {
    if (shouldBlockDrag(e.target)) return;
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  });

  handle.addEventListener("touchstart", (e) => {
    if (shouldBlockDrag(e.target)) return;
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    e.preventDefault();
    startDrag(touch.clientX, touch.clientY);
  });
}

function handleSelectionPopupDrag(e) {
  if (!isDraggingSelectionPopup || !selectionPopup || !selectionPopupOverlay) return;

  const point = e.touches ? e.touches[0] : e;
  if (!point) return;

  e.preventDefault();

  const left = point.clientX - dragOffsetX;
  const top = point.clientY - dragOffsetY;

  clampSelectionPopupPosition(left, top);
}

function stopSelectionPopupDrag() {
  if (!isDraggingSelectionPopup) return;
  isDraggingSelectionPopup = false;
  if (selectionPopup) {
    selectionPopup.classList.remove("dragging");
    selectionPopup.style.transition = "";
  }
  document.removeEventListener("mousemove", handleSelectionPopupDrag);
  document.removeEventListener("mouseup", stopSelectionPopupDrag);
  document.removeEventListener("touchmove", handleSelectionPopupDrag);
  document.removeEventListener("touchend", stopSelectionPopupDrag);
  document.removeEventListener("touchcancel", stopSelectionPopupDrag);
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
//  AUTOCOMPLETE PRODUCTOS (INSTANCIAS)
// ==============================

function createProductAutocompleteDropdown() {
  const div = document.createElement("div");
  div.id = "productAutocompleteDropdown";
  div.className = "product-autocomplete-dropdown";
  div.style.display = "none";
  document.body.appendChild(div);

  div.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".product-autocomplete-item");
    if (!item) return;
    e.preventDefault();
    const name = item.dataset.name || "";
    applyProductAutocompleteSelection(name);
  });

  const handleWheel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") {
      e.stopImmediatePropagation();
    }
    const maxScroll = Math.max(div.scrollHeight - div.clientHeight, 0);
    const next = Math.min(Math.max(div.scrollTop + e.deltaY, 0), maxScroll);
    div.scrollTop = next;
  };

  div.addEventListener("wheel", handleWheel, { passive: false });
  div.addEventListener("wheel", handleWheel, { passive: false, capture: true });

  return div;
}

function isAutocompleteOpen() {
  return (
    productAutocompleteDropdown &&
    productAutocompleteDropdown.style.display !== "none"
  );
}

function handleGlobalAutocompleteWheel(e) {
  if (!isAutocompleteOpen()) return;

  const dropdown = productAutocompleteDropdown;
  const maxScroll = Math.max(dropdown.scrollHeight - dropdown.clientHeight, 0);
  if (maxScroll <= 0) {
    e.preventDefault();
    return;
  }

  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === "function") {
    e.stopImmediatePropagation();
  }

  const next = Math.min(
    Math.max(dropdown.scrollTop + e.deltaY, 0),
    maxScroll
  );
  dropdown.scrollTop = next;
}

function initProductAutocompleteEvents() {
  if (!instancesTableBody || !productAutocompleteDropdown) return;

  instancesTableBody.addEventListener("focusin", handleProductInputFocus);
  instancesTableBody.addEventListener("input", handleProductInputInput);
  instancesTableBody.addEventListener("keydown", handleProductInputKeydown);

  document.addEventListener("mousedown", handleDocumentClickAutocomplete);
  window.addEventListener("scroll", handleGlobalScrollAutocomplete, true);
  window.addEventListener("resize", hideProductAutocomplete);
  window.addEventListener("wheel", handleGlobalAutocompleteWheel, {
    passive: false,
    capture: true,
  });
}

function isProductAutocompleteInput(target) {
  return target && target.dataset && target.dataset.field === "productName";
}

function handleProductInputFocus(e) {
  const input = e.target;
  if (!isProductAutocompleteInput(input)) return;
  showProductAutocomplete(input);
}

function handleProductInputInput(e) {
  const input = e.target;
  if (!isProductAutocompleteInput(input)) return;
  showProductAutocomplete(input);
}

function handleProductInputKeydown(e) {
  if (e.key === "Escape") {
    hideProductAutocomplete();
  }
}

function handleDocumentClickAutocomplete(e) {
  if (!productAutocompleteDropdown) return;
  if (productAutocompleteDropdown.style.display === "none") return;
  if (productAutocompleteDropdown.contains(e.target)) return;
  if (currentProductInput && e.target === currentProductInput) return;
  hideProductAutocomplete();
}

function handleGlobalScrollAutocomplete(e) {
  if (!isAutocompleteOpen()) return;
  const overDropdown =
    productAutocompleteDropdown &&
    productAutocompleteDropdown.contains(e.target);
  const overInput =
    currentProductInput && currentProductInput.contains(e.target);
  if (overDropdown || overInput) return;
  hideProductAutocomplete();
}

function getProductAutocompleteSuggestions(query) {
  const list = getAllProductsForAssociationList();
  const lower = (query || "").toLowerCase();
  const filtered = lower
    ? list.filter((p) => p.name.toLowerCase().includes(lower))
    : list;
  return filtered;
}

function showProductAutocomplete(input) {
  if (!productAutocompleteDropdown) return;

  currentProductInput = input;
  const suggestions = getProductAutocompleteSuggestions(input.value || "");

  const escape = (str) =>
    (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  if (suggestions.length === 0) {
    productAutocompleteDropdown.innerHTML =
      '<div class="product-autocomplete-empty">Sin coincidencias en tu inventario.</div>';
  } else {
    productAutocompleteDropdown.innerHTML = suggestions
      .map(
        (p) => `
        <div class="product-autocomplete-item" data-name="${escape(p.name)}">
          <span class="product-autocomplete-name">${escape(p.name)}</span>
          <span class="product-autocomplete-meta">${[
            p.block || "",
            p.type || "",
            p.kind || "",
          ]
            .filter(Boolean)
            .map(escape)
            .join(" · ")}</span>
        </div>`
      )
      .join("");
  }

  const rect = input.getBoundingClientRect();
  const left = rect.left + window.scrollX;
  const top = rect.bottom + window.scrollY + 4;
  const width = Math.max(rect.width, 240);

  productAutocompleteDropdown.style.minWidth = width + "px";
  productAutocompleteDropdown.style.left = left + "px";
  productAutocompleteDropdown.style.top = top + "px";
  productAutocompleteDropdown.style.display = "block";
  document.body.classList.add("lock-scroll");
}

function hideProductAutocomplete() {
  if (!productAutocompleteDropdown) return;
  productAutocompleteDropdown.style.display = "none";
  productAutocompleteDropdown.innerHTML = "";
  currentProductInput = null;
  document.body.classList.remove("lock-scroll");
}

function applyProductAutocompleteSelection(name) {
  if (!currentProductInput) return;
  currentProductInput.value = name;
  currentProductInput.focus();
  currentProductInput.dispatchEvent(new Event("input", { bubbles: true }));
  hideProductAutocomplete();
}

// ==============================
//  OPCIONES DE FILTRO
// ==============================

function renderShelfOptions() {
  refreshProductsFromUnified();
  const shelves = Array.from(
    new Set(products.map((p) => (p.shelf || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

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
}

function renderTypeOptions() {
  refreshProductsFromUnified();
  const types = getClassificationTypes();

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
}

function renderStoreOptions() {
  const storeList = suppliers
    .slice()
    .sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" })
    );

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
  const locations =
    (window.DataService &&
      window.DataService.selectors &&
      typeof window.DataService.selectors.producerLocations === "function" &&
      window.DataService.selectors.producerLocations({
        producers,
      })) ||
    Array.from(
      new Set(
        producers
          .map((p) => (p.location || "").trim())
          .filter((l) => l.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

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
    instancesProducerFilterSelect.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "Todos";
    instancesProducerFilterSelect.appendChild(optAll);
    producers
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
    if (current && producers.some((p) => p.id === current)) {
      instancesProducerFilterSelect.value = current;
    }
  }
}

function updateStoreFilterOptions() {
  const locations =
    (window.DataService &&
      window.DataService.selectors &&
      typeof window.DataService.selectors.storeLocations === "function" &&
      window.DataService.selectors.storeLocations({
        suppliers,
      })) ||
    Array.from(
      new Set(
        suppliers
          .map((s) => (s.location || "").trim())
          .filter((l) => l.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

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
      [...products, ...extraProducts]
        .map((p) => (p.block || "").trim())
        .filter((b) => b.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

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
  productsDatalist.innerHTML = "";
  const list = getAllProductsForAssociationList();
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
  products = getPantryProducts();
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
  }
}

function moveProductToExtra(id) {
  const item =
    unifiedProducts.find((p) => p.id === id) ||
    products.find((p) => p.id === id);
  if (!item) return;
  const ok = confirm("¿Mover este producto a 'Otros productos'? Se mantendrá la información.");
  if (!ok) return;
  const updated = unifiedProducts.map((p) =>
    p.id === id ? { ...p, scope: "otros" } : p
  );
  persistUnified(updated);
  saveExtraProducts();

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
  extraDrafts.unshift({
    id,
    name: "",
    block: "",
    type: "",
    quantity: "",
    notes: "",
    buy: false,
  });
  renderExtraQuickTable();
  highlightTopRow(extraListTableBody);
}

function handleAddQuickProduct() {
  const id =
    (crypto.randomUUID ? crypto.randomUUID() : "draft-prod-" + Date.now()) +
    "-" +
    Math.random().toString(36).slice(2);
  productDrafts.unshift({
    id,
    name: "",
    block: "",
    type: "",
    shelf: "",
    quantity: "",
    have: false,
    acquisitionDate: "",
    expiryText: "",
    notes: "",
  });
  renderProducts();
  highlightTopRow(productTableBody);
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

function commitDraftProducts() {
  if (!productTableBody || productDrafts.length === 0) return;
  const rows = Array.from(
    productTableBody.querySelectorAll(".product-draft-row")
  );
  let added = false;
  rows.forEach((tr) => {
    const id = tr.dataset.draftId;
    const getField = (field) => {
      const el = tr.querySelector(`[data-field="${field}"]`);
      if (!el) return "";
      if (el.type === "checkbox") return el.checked;
      return el.value.trim();
    };
    const name = getField("name");
    if (!name) return;
    const block = getField("block");
    const type = getField("type");
    const shelf = getField("shelf");
    const quantity = getField("quantity");
    const have = !!getField("have");
    const acquisitionDate = getField("acquisitionDate");
    const expiryText = getField("expiryText");
    const notes = (tr.querySelector('textarea[data-field="notes"]') || {})
      .value;
    const now = nowIsoString();
    const newProd = {
      id:
        (crypto.randomUUID ? crypto.randomUUID() : "prod-" + Date.now()) +
        "-" +
        Math.random().toString(36).slice(2),
      name,
      block,
      type,
      shelf,
      quantity,
      have,
      acquisitionDate,
      expiryText,
      notes,
      scope: "almacen",
      selectionId: "",
      createdAt: now,
      updatedAt: now,
    };
    unifiedProducts.unshift(newProd);
    refreshProductsFromUnified();
    productDrafts = productDrafts.filter((d) => d.id !== id);
    added = true;
  });
  if (added) {
    persistUnified(unifiedProducts);
    saveProducts();
    renderProducts();
    if (!isStoreActive()) renderGridRows();
    renderShelfOptions();
    renderBlockOptions();
    renderTypeOptions();
    renderProductsDatalist();
    renderShoppingList();
  }
}

function commitDraftExtras() {
  if (!extraListTableBody || extraDrafts.length === 0) return;
  const rows = Array.from(
    extraListTableBody.querySelectorAll(".extra-draft-row")
  );
  let added = false;
  rows.forEach((tr) => {
    const id = tr.dataset.draftId;
    const getField = (field) => {
      const el = tr.querySelector(`[data-field="${field}"]`);
      if (!el) return "";
      if (el.type === "checkbox") return el.checked;
      return el.value.trim();
    };
    const name = getField("name");
    if (!name) return;
    const block = getField("block");
    const type = getField("type");
    const quantity = getField("quantity");
    const buy = !!getField("buy");
    const notes = (tr.querySelector('textarea[data-field="notes"]') || {})
      .value;
    const now = nowIsoString();
    const newExtra = {
      id:
        (crypto.randomUUID ? crypto.randomUUID() : "extra-" + Date.now()) +
        "-" +
        Math.random().toString(36).slice(2),
      name,
      block,
      type,
      quantity,
      notes,
      buy,
      scope: "otros",
      selectionId: "",
      createdAt: now,
      updatedAt: now,
    };
    unifiedProducts.unshift(newExtra);
    refreshProductsFromUnified();
    extraDrafts = extraDrafts.filter((d) => d.id !== id);
    added = true;
  });
  if (added) {
    persistUnified(unifiedProducts);
    saveExtraProducts();
    renderExtraQuickTable();
    if (!isStoreActive()) renderExtraEditTable();
    renderBlockOptions();
    renderTypeOptions();
    renderProductsDatalist();
    renderShoppingList();
  }
}

// ==============================
//  ALMACÉN: EDICIÓN
// ==============================

function createInventoryEditRow(p, stripe = 0) {
  const components = window.AppComponents || {};
  const hasTemplate =
    inventoryEditRowTemplate &&
    typeof components.cloneRowFromTemplate === "function" &&
    typeof components.hydrateRow === "function";

  const famSel = createFamilySelect(p.block || "");
  const typeSel = createTypeSelect(p.block || "", p.type || "");
  linkFamilyTypeSelects(famSel, typeSel);

  const selectionBtn = createSelectionButton(p.selectionId, p.id);
  const haveCheckbox = document.createElement("input");
  haveCheckbox.type = "checkbox";
  haveCheckbox.dataset.field = "have";
  haveCheckbox.checked = !!p.have;

  const adqInput = document.createElement("input");
  adqInput.type = "date";
  adqInput.className = "table-input";
  adqInput.dataset.field = "acquisitionDate";
  adqInput.value = p.acquisitionDate || "";

  if (hasTemplate) {
    const row = components.cloneRowFromTemplate(inventoryEditRowTemplate);
    if (!row) return null;
    components.hydrateRow(row, {
      dataset: { id: p.id },
      classes: [`family-stripe-${stripe}`],
      text: {
        "[data-field='selectionText']": getSelectionLabelForProduct(p),
        "[data-field='stores']": getSelectionStoresForProduct(p),
      },
      actions: {
        "[data-role='selection-btn']": { action: "select-selection", id: p.id },
        "[data-role='move']": { action: "move-to-extra", id: p.id },
        "[data-role='delete']": { action: "delete", id: p.id },
      },
      replacements: {
        "[data-slot='name']": createTableInput("name", p.name),
        "[data-slot='block']": famSel,
        "[data-slot='type']": typeSel,
        "[data-slot='shelf']": createTableInput("shelf", p.shelf),
        "[data-slot='quantity']": createTableInput("quantity", p.quantity),
        "[data-slot='have']": haveCheckbox,
        "[data-slot='acquisitionDate']": adqInput,
        "[data-slot='expiryText']": createTableInput("expiryText", p.expiryText),
        "[data-slot='notes']": createTableTextarea("notes", p.notes || ""),
        "[data-role='selection-btn']": selectionBtn,
      },
    });
    return row;
  }

  const tr = document.createElement("tr");
  tr.dataset.id = p.id;
  tr.classList.add(`family-stripe-${stripe}`);
  tr.classList.add(`family-stripe-${stripe}`);

  let td;

  td = document.createElement("td");
  td.appendChild(createTableInput("name", p.name));
  tr.appendChild(td);

  td = document.createElement("td");
  td.appendChild(famSel);
  tr.appendChild(td);

  td = document.createElement("td");
  td.appendChild(typeSel);
  tr.appendChild(td);

  td = document.createElement("td");
  td.appendChild(createTableInput("shelf", p.shelf));
  tr.appendChild(td);

  td = document.createElement("td");
  td.appendChild(createTableInput("quantity", p.quantity));
  tr.appendChild(td);

  td = document.createElement("td");
  td.className = "selection-td";
  const selCell = document.createElement("div");
  selCell.className = "selection-cell";
  const spanSel = document.createElement("span");
  spanSel.className = "selection-text";
  spanSel.textContent = getSelectionLabelForProduct(p);
  selCell.appendChild(spanSel);
  selCell.appendChild(selectionBtn);
  td.appendChild(selCell);
  tr.appendChild(td);

  td = document.createElement("td");
  const spanStores = document.createElement("span");
  spanStores.textContent = getSelectionStoresForProduct(p);
  td.appendChild(spanStores);
  tr.appendChild(td);

  td = document.createElement("td");
  td.appendChild(haveCheckbox);
  tr.appendChild(td);

  td = document.createElement("td");
  td.appendChild(adqInput);
  tr.appendChild(td);

  td = document.createElement("td");
  td.appendChild(createTableInput("expiryText", p.expiryText));
  tr.appendChild(td);

  td = document.createElement("td");
  td.appendChild(createTableTextarea("notes", p.notes || ""));
  tr.appendChild(td);

  td = document.createElement("td");
  const moveBtn = document.createElement("button");
  moveBtn.className = "btn btn-small btn-icon";
  moveBtn.textContent = "→";
  moveBtn.dataset.action = "move-to-extra";
  moveBtn.dataset.id = p.id;
  td.appendChild(moveBtn);

  const delBtn = document.createElement("button");
  delBtn.className = "btn btn-small btn-danger";
  delBtn.textContent = "✕";
  delBtn.dataset.action = "delete";
  delBtn.dataset.id = p.id;
  td.appendChild(delBtn);

  tr.appendChild(td);
  return tr;
}

function renderGridRows() {
  refreshProductsFromUnified();
  if (!gridTableBody) return;
  gridTableBody.innerHTML = "";

  const items = getPantryProducts().slice().sort(compareShelfBlockTypeName);
  const stripeMap = buildFamilyStripeMap(items);
  const components = window.AppComponents || {};
  const hasTemplate =
    inventoryEditRowTemplate &&
    typeof components.cloneRowFromTemplate === "function" &&
    typeof components.hydrateRow === "function";

  if (items.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 12;
    td.textContent =
      "No hay productos todavía. Usa 'Añadir producto' para crear uno nuevo.";
    tr.appendChild(td);
    gridTableBody.appendChild(tr);
    return;
  }

  if (hasTemplate && typeof components.renderTable === "function") {
    components.renderTable(gridTableBody, items, {
      template: inventoryEditRowTemplate,
      emptyMessage:
        "No hay productos todavía. Usa 'Añadir producto' para crear uno nuevo.",
      emptyColSpan: 12,
      createRow: (item) => {
        const stripe = stripeMap[(item.block || "").trim() || "__none__"] || 0;
        return createInventoryEditRow(item, stripe);
      },
    });
  } else {
    const frag = document.createDocumentFragment();
    items.forEach((p) => {
      const stripe = stripeMap[(p.block || "").trim() || "__none__"] || 0;
      const row = createInventoryEditRow(p, stripe);
      if (row) frag.appendChild(row);
    });
    gridTableBody.appendChild(frag);
  }

  filterGridRows();
}

function handleAddGridRow() {
  if (!gridTableBody) return;

  if (
    gridTableBody.children.length === 1 &&
    !gridTableBody.children[0].dataset.id
  ) {
    gridTableBody.innerHTML = "";
  }

  const id =
    (crypto.randomUUID ? crypto.randomUUID() : "prod-" + Date.now()) +
    "-" +
    Math.random().toString(36).slice(2);

  const defBlock = editFilterFamilySelect.value || "";
  const defType = editFilterTypeSelect.value || "";
  const defShelf = editFilterShelfSelect.value || "";

  const product = {
    id,
    name: "",
    block: defBlock,
    type: defType,
    shelf: defShelf,
    quantity: "",
    have: false,
    acquisitionDate: "",
    expiryText: "",
    notes: "",
    selectionId: "",
  };

  const row = createInventoryEditRow(product, 0);
  if (row) gridTableBody.prepend(row);
}

function handleGridClick(e) {
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
  if (!action) return;

  if (action === "delete") {
    const tr = target.closest("tr");
    const id = tr?.dataset.id || target.dataset.id;
    if (id) {
      removeProductById(id);
    } else if (tr) {
      tr.remove();
    }
  } else if (action === "move-to-extra") {
    const tr = target.closest("tr");
    if (!tr) return;
    const id = tr.dataset.id || target.dataset.id;
    moveProductToExtra(id);
  } else if (action === "select-selection") {
    const tr = target.closest("tr");
    if (!tr) return;
    const id = tr.dataset.id || target.dataset.id;
    if (!id) return;
    const product = products.find((p) => p.id === id);
    if (!product) return;
    openSelectionPopupForProduct(id);
  }
}

function handleSaveGrid() {
  if (!gridTableBody) return;
  const rows = Array.from(gridTableBody.querySelectorAll("tr"));
  const newProducts = [];

  const now = nowIsoString();

  for (const tr of rows) {
    const id = tr.dataset.id;
    if (!id) continue;

    const getField = (field) => {
      const el = tr.querySelector(`[data-field="${field}"]`);
      if (!el) return "";
      if (el.type === "checkbox") return el.checked;
      return el.value.trim();
    };

    const name = getField("name");
    if (!name) continue;

    const block = getField("block");
    const type = getField("type");
    const shelf = getField("shelf");
    const quantity = getField("quantity");
    const acquisitionDate = getField("acquisitionDate");
    const expiryText = getField("expiryText");
    const notes = (tr.querySelector('textarea[data-field="notes"]') || {})
      .value;

    const have = !!getField("have");

    const existing = products.find((p) => p.id === id) || {};
    const createdAt = existing.createdAt || now;
    const selectionId = existing.selectionId || "";

    newProducts.push({
      id,
      name,
      block,
      type,
      shelf,
      quantity,
      have,
      acquisitionDate,
      expiryText,
      notes,
      selectionId,
      createdAt,
      updatedAt: now,
    });
  }

  newProducts.sort(compareShelfBlockTypeName);
  products = newProducts;
  const hasStore = isStoreActive() && window.AppStore && window.AppStore.actions && typeof window.AppStore.actions.setProducts === "function";
  saveProducts();
  renderShelfOptions();
  renderBlockOptions();
  renderTypeOptions();
  updateInstanceFilterOptions();
  renderProductsDatalist();
  renderProducts();
  renderShoppingList();
  // Sal de modo edición aunque haya store activo
  setAlmacenMode(false);
  showToast("Inventario guardado");
}

function filterGridRows() {
  refreshProductsFromUnified();
  if (!gridTableBody) return;
  const search = (editFilterSearchInput.value || "").toLowerCase();
  const filterBlock = editFilterFamilySelect.value || "";
  const filterType = editFilterTypeSelect.value || "";
  const filterShelf = editFilterShelfSelect.value || "";
  const filterStoreId = editFilterStoreSelect.value || "";

  const rows = Array.from(gridTableBody.querySelectorAll("tr"));
  rows.forEach((tr) => {
    const id = tr.dataset.id;
    if (!id) {
      tr.style.display = "";
      return;
    }
    const nameEl = tr.querySelector('input[data-field="name"]');
    const blockEl = tr.querySelector('[data-field="block"]');
    const typeEl = tr.querySelector('[data-field="type"]');
    const shelfEl = tr.querySelector('input[data-field="shelf"]');
    const notesEl = tr.querySelector('textarea[data-field="notes"]');

    const name = (nameEl && nameEl.value) || "";
    const block = (blockEl && blockEl.value) || "";
    const type = (typeEl && typeEl.value) || "";
    const shelf = (shelfEl && shelfEl.value) || "";
    const notes = (notesEl && notesEl.value) || "";

    if (filterBlock && block !== filterBlock) {
      tr.style.display = "none";
      return;
    }
    if (filterType && type !== filterType) {
      tr.style.display = "none";
      return;
    }
    if (filterShelf && shelf !== filterShelf) {
      tr.style.display = "none";
      return;
    }

    if (filterStoreId) {
      const product = products.find((p) => p.id === id);
      if (product) {
        const inst = getSelectionInstanceForProduct(product);
        if (!inst || !inst.storeIds || !inst.storeIds.includes(filterStoreId)) {
          tr.style.display = "none";
          return;
        }
      }
    }

    if (search) {
      const haystack = `${name} ${block} ${type} ${shelf} ${notes}`.toLowerCase();
      if (!haystack.includes(search)) {
        tr.style.display = "none";
        return;
      }
    }

    tr.style.display = "";
  });
}

// ==============================
//  OTROS PRODUCTOS: VISTA
// ==============================

function renderExtraQuickTable() {
  refreshProductsFromUnified();
  const extras = getOtherProducts();
  if (!extraListTableBody) return;
  extraListTableBody.innerHTML = "";

  const search = (extraFilterSearchInput?.value || "").toLowerCase();
  const filterFamily = extraFilterFamilySelect?.value || "";
  const filterType = extraFilterTypeSelect?.value || "";
  const filterStore = extraFilterStoreSelect?.value || "";
  const filterBuy = extraFilterBuySelect?.value || "all";

  const items = extras
    .slice()
    .filter((p) => {
      if (filterFamily && (p.block || "") !== filterFamily) return false;
      if (filterType && (p.type || "") !== filterType) return false;
      if (filterStore) {
        const inst = getSelectionInstanceForProduct(p);
        const hasStore =
          inst &&
          Array.isArray(inst.storeIds) &&
          inst.storeIds.includes(filterStore);
        if (!hasStore) return false;
      }
      if (filterBuy !== "all") {
        const buyVal = filterBuy === "yes";
        if (!!p.buy !== buyVal) return false;
      }
      if (search) {
        const inst = getSelectionInstanceForProduct(p);
        const stores = inst ? getStoreNames(inst.storeIds) : "";
        const haystack = `${p.name || ""} ${p.block || ""} ${p.type || ""} ${
          p.notes || ""
        } ${stores || ""}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    })
    .sort((a, b) =>
      (a.block || "").localeCompare(b.block || "", "es", {
        sensitivity: "base",
      }) || (a.type || "").localeCompare(b.type || "", "es", {
        sensitivity: "base",
      }) || (a.name || "").localeCompare(b.name || "", "es", {
        sensitivity: "base",
      })
    );
  const stripeMap = buildFamilyStripeMap(items);

  // Drafts
  extraDrafts.forEach((d) => {
    const tr = document.createElement("tr");
    tr.className = "extra-draft-row";
    tr.dataset.draftId = d.id;

    let td = document.createElement("td");
    td.appendChild(createTableInput("name", d.name || ""));
    tr.appendChild(td);

    td = document.createElement("td");
    const famSel = createFamilySelect(d.block || "");
    famSel.dataset.field = "block";
    td.appendChild(famSel);
    tr.appendChild(td);

    td = document.createElement("td");
    const typeSel = createTypeSelect(d.block || "", d.type || "");
    typeSel.dataset.field = "type";
    linkFamilyTypeSelects(famSel, typeSel);
    td.appendChild(typeSel);
    tr.appendChild(td);

    td = document.createElement("td");
    td.appendChild(createTableInput("quantity", d.quantity || ""));
    tr.appendChild(td);

    td = document.createElement("td");
    td.textContent = "—";
    tr.appendChild(td);

    td = document.createElement("td");
    td.textContent = "—";
    tr.appendChild(td);

    td = document.createElement("td");
    const buyChk = createTableInput("buy", d.buy ? "on" : "", "checkbox");
    buyChk.checked = !!d.buy;
    td.appendChild(buyChk);
    tr.appendChild(td);

    td = document.createElement("td");
    td.appendChild(createTableTextarea("notes", d.notes || ""));
    tr.appendChild(td);

    td = document.createElement("td");
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-small btn-danger";
    cancelBtn.dataset.action = "cancel-draft-extra";
    cancelBtn.dataset.id = d.id;
    cancelBtn.textContent = "✕";
    td.appendChild(cancelBtn);
    tr.appendChild(td);

    extraListTableBody.appendChild(tr);
  });

  if (items.length === 0 && extraDrafts.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 9;
    td.textContent =
      "No hay otros productos. Usa 'Editar lista' para añadir algunos.";
    tr.appendChild(td);
    extraListTableBody.appendChild(tr);
    return;
  }

  const frag = document.createDocumentFragment();
  items.forEach((p) => {
    const stripe = stripeMap[(p.block || "").trim() || "__none__"] || 0;
    const row = cloneExtraQuickRow(p, stripe);
    if (row) frag.appendChild(row);
  });
  extraListTableBody.appendChild(frag);
}

// Fila para tabla de "Otros" usando template o fallback imperativo
function cloneExtraQuickRow(product, stripe = 0) {
  let tr = null;
  const components = window.AppComponents || {};
  const canUseTemplate =
    extraQuickRowTemplate &&
    typeof components.cloneRowFromTemplate === "function" &&
    typeof components.hydrateRow === "function";

  if (canUseTemplate) {
    tr = components.cloneRowFromTemplate(extraQuickRowTemplate);
    if (tr) {
      const selectionBtn = createSelectionButton(product.selectionId, product.id);
      components.hydrateRow(tr, {
        dataset: { id: product.id },
        classes: [`family-stripe-${stripe}`],
        text: {
          "[data-field='name']": product.name,
          "[data-field='block']": product.block,
          "[data-field='type']": product.type,
          "[data-field='quantity']": product.quantity,
          "[data-field='notes']": product.notes,
          "[data-field='stores']": getSelectionStoresForProduct(product),
          "[data-field='selectionText']": getSelectionLabelForProduct(product),
        },
        checkboxes: {
          'input[data-field="buy"]': !!product.buy,
        },
        attributes: {
          'input[data-field="buy"]': { dataset: { id: product.id } },
        },
        actions: {
          "[data-role='move']": { action: "move-to-almacen", id: product.id },
        },
        replacements: {
          "[data-role='selection-btn']": selectionBtn,
        },
      });
      return tr;
    }
  }

  // Fallback imperativo
  tr = document.createElement("tr");
  tr.dataset.id = product.id;
  tr.classList.add(`family-stripe-${stripe}`);

  const addCellText = (t) => {
    const td = document.createElement("td");
    td.textContent = t || "";
    tr.appendChild(td);
  };

  addCellText(product.name || "");
  addCellText(product.block || "");
  addCellText(product.type || "");
  addCellText(product.quantity || "");
  const selTd = document.createElement("td");
  selTd.className = "selection-td";
  const selCell = document.createElement("div");
  selCell.className = "selection-cell";
  const selBtn = createSelectionButton(product.selectionId, product.id);
  selCell.appendChild(selBtn);
  const selText = document.createElement("div");
  selText.className = "selection-text";
  selText.textContent = getSelectionLabelForProduct(product);
  selCell.appendChild(selText);
  selTd.appendChild(selCell);
  tr.appendChild(selTd);
  addCellText(getSelectionStoresForProduct(product));

  let td = document.createElement("td");
  const chk = document.createElement("input");
  chk.type = "checkbox";
  chk.checked = !!product.buy;
  chk.dataset.field = "buy";
  chk.dataset.id = product.id;
  td.appendChild(chk);
  tr.appendChild(td);

  addCellText(product.notes || "");

  td = document.createElement("td");
  const moveBtn = document.createElement("button");
  moveBtn.className = "btn btn-small btn-icon";
  moveBtn.textContent = "→";
  moveBtn.dataset.action = "move-to-almacen";
  moveBtn.dataset.id = product.id;
  td.appendChild(moveBtn);

  tr.appendChild(td);
  return tr;
}

function handleExtraListClick(e) {
  const target = e.target.closest("button,[data-action],[data-role]") || e.target;
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

  if (target.dataset.action === "cancel-draft-extra") {
    const id = target.dataset.id;
    extraDrafts = extraDrafts.filter((d) => d.id !== id);
    renderExtraQuickTable();
    return;
  }

  if (target.matches('input[type="checkbox"][data-field="buy"]')) {
    const id = target.dataset.id;
    const p = extraProducts.find((x) => x.id === id);
    if (!p) return;
    p.buy = target.checked;
    saveExtraProducts();
    renderShoppingList();
    return;
  }

  if (!action) return;
  const id = target.dataset.id || target.closest("tr")?.dataset.id;

  if (action === "move-to-almacen") {
    moveExtraToAlmacen(id);
  } else if (action === "select-selection") {
    openSelectionPopupForProduct(id);
  }
}

function moveExtraToAlmacen(id) {
  const item =
    unifiedProducts.find((p) => p.id === id) ||
    extraProducts.find((p) => p.id === id);
  if (!item) return;
  const ok = confirm("¿Mover este producto a 'Almacén'? Se mantendrá la información.");
  if (!ok) return;
  const now = nowIsoString();
  const updated = unifiedProducts.map((p) =>
    p.id === id
      ? { ...p, scope: "almacen", updatedAt: now, have: !!p.have, buy: !!p.buy }
      : p
  );
  persistUnified(updated);
  saveProducts();

  renderProducts();
  if (!isStoreActive()) {
    renderExtraQuickTable();
    renderExtraEditTable();
  }
  renderShelfOptions();
  renderBlockOptions();
  renderTypeOptions();
  renderProductsDatalist();
  renderShoppingList();
}

function removeExtraById(id) {
  if (!id) return;
  const before = extraProducts.length;
  extraProducts = extraProducts.filter((p) => p.id !== id);
  unifiedProducts = unifiedProducts.filter((p) => p.id !== id);
  if (extraProducts.length === before) return;
  persistUnified(unifiedProducts);
  saveExtraProducts();
  renderExtraEditTable();
  renderExtraQuickTable();
  renderShoppingList();
}

function removeProductById(id) {
  if (!id) return;
  const before = products.length;
  products = products.filter((p) => p.id !== id);
  unifiedProducts = unifiedProducts.filter((p) => p.id !== id);
  if (products.length === before) return;
  persistUnified(unifiedProducts);
  saveProducts();
  renderGridRows();
  renderProducts();
  renderExtraQuickTable();
  renderExtraEditTable();
  renderShoppingList();
}

// ==============================
//  OTROS PRODUCTOS: EDICIÓN
// ==============================

function createExtraEditRow(p, stripe = 0) {
  const components = window.AppComponents || {};
  const hasTemplate =
    extraEditRowTemplate &&
    typeof components.cloneRowFromTemplate === "function" &&
    typeof components.hydrateRow === "function";

  const famSel = createFamilySelect(p.block || "");
  const typeSel = createTypeSelect(p.block || "", p.type || "");
  linkFamilyTypeSelects(famSel, typeSel);
  const selectionBtn = createSelectionButton(p.selectionId, p.id);
  const buyCheckbox = document.createElement("input");
  buyCheckbox.type = "checkbox";
  buyCheckbox.dataset.field = "buy";
  buyCheckbox.checked = !!p.buy;

  if (hasTemplate) {
    const row = components.cloneRowFromTemplate(extraEditRowTemplate);
    if (!row) return null;
    components.hydrateRow(row, {
      dataset: { id: p.id },
      classes: [`family-stripe-${stripe}`],
      text: {
        "[data-field='selectionText']": getSelectionLabelForProduct(p),
        "[data-field='stores']": getSelectionStoresForProduct(p),
      },
      actions: {
        "[data-role='selection-btn']": { action: "select-selection", id: p.id },
        "[data-role='move']": { action: "move-to-almacen", id: p.id },
        "[data-role='delete']": { action: "delete", id: p.id },
      },
      replacements: {
        "[data-slot='name']": createTableInput("name", p.name),
        "[data-slot='block']": famSel,
        "[data-slot='type']": typeSel,
        "[data-slot='quantity']": createTableInput("quantity", p.quantity),
        "[data-slot='buy']": buyCheckbox,
        "[data-slot='notes']": createTableTextarea("notes", p.notes || ""),
        "[data-role='selection-btn']": selectionBtn,
      },
    });
    return row;
  }

  const tr = document.createElement("tr");
  tr.dataset.id = p.id;

  let td;

  td = document.createElement("td");
  td.appendChild(createTableInput("name", p.name));
  tr.appendChild(td);

  td = document.createElement("td");
  td.appendChild(famSel);
  tr.appendChild(td);

  td = document.createElement("td");
  td.appendChild(typeSel);
  tr.appendChild(td);

  td = document.createElement("td");
  td.appendChild(createTableInput("quantity", p.quantity));
  tr.appendChild(td);

  td = document.createElement("td");
  td.className = "selection-td";
  const selCell = document.createElement("div");
  selCell.className = "selection-cell";
  const spanSel = document.createElement("span");
  spanSel.className = "selection-text";
  spanSel.textContent = getSelectionLabelForProduct(p);
  selCell.appendChild(spanSel);
  selCell.appendChild(selectionBtn);
  td.appendChild(selCell);
  tr.appendChild(td);

  td = document.createElement("td");
  const spanStores = document.createElement("span");
  spanStores.textContent = getSelectionStoresForProduct(p);
  td.appendChild(spanStores);
  tr.appendChild(td);

  td = document.createElement("td");
  td.appendChild(buyCheckbox);
  tr.appendChild(td);

  td = document.createElement("td");
  td.appendChild(createTableTextarea("notes", p.notes || ""));
  tr.appendChild(td);

  td = document.createElement("td");
  const moveBtn = document.createElement("button");
  moveBtn.className = "btn btn-small btn-icon";
  moveBtn.textContent = "→";
  moveBtn.dataset.action = "move-to-almacen";
  moveBtn.dataset.id = p.id;
  td.appendChild(moveBtn);

  const delBtn = document.createElement("button");
  delBtn.className = "btn btn-small btn-danger";
  delBtn.textContent = "✕";
  delBtn.dataset.action = "delete";
  delBtn.dataset.id = p.id;
  td.appendChild(delBtn);
  tr.appendChild(td);

  return tr;
}

function renderExtraEditTable() {
  refreshProductsFromUnified();
  const extras = getOtherProducts();
  if (!extraTableBody) return;
  extraTableBody.innerHTML = "";

  const items = extras
    .slice()
    .sort((a, b) =>
      (a.block || "").localeCompare(b.block || "", "es", {
        sensitivity: "base",
      }) || (a.type || "").localeCompare(b.type || "", "es", {
        sensitivity: "base",
      }) || (a.name || "").localeCompare(b.name || "", "es", {
        sensitivity: "base",
      })
    );
  const stripeMap = buildFamilyStripeMap(items);

  if (
    extraEditRowTemplate &&
    window.AppComponents &&
    typeof window.AppComponents.renderTable === "function"
  ) {
    window.AppComponents.renderTable(extraTableBody, items, {
      template: extraEditRowTemplate,
      emptyMessage:
        "No hay otros productos todavía. Usa 'Añadir producto' para crear uno.",
      emptyColSpan: 9,
      createRow: (item) => {
        const stripe = stripeMap[(item.block || "").trim() || "__none__"] || 0;
        return createExtraEditRow(item, stripe);
      },
    });
  } else {
    if (items.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 9;
      td.textContent =
        "No hay otros productos todavía. Usa 'Añadir producto' para crear uno.";
      tr.appendChild(td);
      extraTableBody.appendChild(tr);
      return;
    }

    const frag = document.createDocumentFragment();
    items.forEach((p) => {
      const stripe = stripeMap[(p.block || "").trim() || "__none__"] || 0;
      const row = createExtraEditRow(p, stripe);
      if (row) frag.appendChild(row);
    });
    extraTableBody.appendChild(frag);
  }

  filterExtraEditRows();
}

function handleAddExtraRow() {
  refreshProductsFromUnified();
  if (!extraTableBody) return;

  if (
    extraTableBody.children.length === 1 &&
    !extraTableBody.children[0].dataset.id
  ) {
    extraTableBody.innerHTML = "";
  }

  const id =
    (crypto.randomUUID ? crypto.randomUUID() : "extra-" + Date.now()) +
    "-" +
    Math.random().toString(36).slice(2);

  const defBlock = extraEditFilterFamilySelect.value || "";
  const defType = extraEditFilterTypeSelect.value || "";

  const product = {
    id,
    name: "",
    block: defBlock,
    type: defType,
    quantity: "",
    notes: "",
    buy: false,
    selectionId: "",
  };

  const row = createExtraEditRow(product, 0);
  if (row) extraTableBody.prepend(row);
}

function handleExtraEditClick(e) {
  const target = e.target.closest("button,[data-action],[data-role]") || e.target;
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
  if (!action) return;

  if (action === "delete") {
    const tr = target.closest("tr");
    const id = tr?.dataset.id || target.dataset.id;
    if (id) {
      removeExtraById(id);
    } else if (tr) {
      tr.remove();
    }
  } else if (action === "move-to-almacen") {
    const tr = target.closest("tr");
    if (!tr) return;
    const id = tr.dataset.id || target.dataset.id;
    moveExtraToAlmacen(id);
  } else if (action === "select-selection") {
    const tr = target.closest("tr");
    if (!tr) return;
    const id = tr.dataset.id || target.dataset.id;
    if (!id) return;
    const product = extraProducts.find((p) => p.id === id);
    if (!product) return;
    openSelectionPopupForProduct(id);
  }
}

function handleSaveExtra() {
  if (!extraTableBody) return;
  const rows = Array.from(extraTableBody.querySelectorAll("tr"));
  const newExtra = [];
  const now = nowIsoString();

  for (const tr of rows) {
    const id = tr.dataset.id;
    if (!id) continue;

    const getField = (field) => {
      const el = tr.querySelector(`[data-field="${field}"]`);
      if (!el) return "";
      if (el.type === "checkbox") return el.checked;
      return el.value.trim();
    };

    const name = getField("name");
    if (!name) continue;

    const block = getField("block");
    const type = getField("type");
    const quantity = getField("quantity");
    const notes = (tr.querySelector('textarea[data-field="notes"]') || {})
      .value;

    const buy = !!getField("buy");

    const existing = extraProducts.find((p) => p.id === id) || {};
    const createdAt = existing.createdAt || now;
    const selectionId = existing.selectionId || "";

    newExtra.push({
      id,
      name,
      block,
      type,
      quantity,
      notes,
      buy,
      selectionId,
      createdAt,
      updatedAt: now,
    });
  }

  newExtra.sort((a, b) =>
    (a.block || "").localeCompare(b.block || "", "es", {
      sensitivity: "base",
    }) || (a.type || "").localeCompare(b.type || "", "es", {
      sensitivity: "base",
    }) || (a.name || "").localeCompare(b.name || "", "es", {
      sensitivity: "base",
    })
  );

  extraProducts = newExtra;
  saveExtraProducts();
  renderBlockOptions();
  renderTypeOptions();
  updateInstanceFilterOptions();
  renderProductsDatalist();
  renderExtraQuickTable();
  renderShoppingList();
  setOtrosMode(false);
  showToast("Otros productos guardados");
}

function filterExtraEditRows() {
  if (!extraTableBody) return;
  const search = (extraEditFilterSearchInput.value || "").toLowerCase();
  const filterBlock = extraEditFilterFamilySelect.value || "";
  const filterType = extraEditFilterTypeSelect.value || "";
  const filterStoreId = extraEditFilterStoreSelect.value || "";

  const rows = Array.from(extraTableBody.querySelectorAll("tr"));
  rows.forEach((tr) => {
    const id = tr.dataset.id;
    if (!id) {
      tr.style.display = "";
      return;
    }
    const nameEl = tr.querySelector('input[data-field="name"]');
    const blockEl = tr.querySelector('[data-field="block"]');
    const typeEl = tr.querySelector('[data-field="type"]');
    const notesEl = tr.querySelector('textarea[data-field="notes"]');

    const name = (nameEl && nameEl.value) || "";
    const block = (blockEl && blockEl.value) || "";
    const type = (typeEl && typeEl.value) || "";
    const notes = (notesEl && notesEl.value) || "";

    if (filterBlock && block !== filterBlock) {
      tr.style.display = "none";
      return;
    }
    if (filterType && type !== filterType) {
      tr.style.display = "none";
      return;
    }

    if (filterStoreId) {
      const product = extraProducts.find((p) => p.id === id);
      if (product) {
        const inst = getSelectionInstanceForProduct(product);
        if (!inst || !inst.storeIds || !inst.storeIds.includes(filterStoreId)) {
          tr.style.display = "none";
          return;
        }
      }
    }

    if (search) {
      const haystack = `${name} ${block} ${type} ${notes}`.toLowerCase();
      if (!haystack.includes(search)) {
        tr.style.display = "none";
        return;
      }
    }

    tr.style.display = "";
  });
}

// ==============================
//  PRODUCTORES
// ==============================

function renderProducersTable() {
  if (
    window.ProducersView &&
    typeof window.ProducersView.render === "function"
  ) {
    window.ProducersView.render(producersViewContext);
  }
}

function handleAddProducerRow() {
  if (window.ProducersView && typeof window.ProducersView.addRow === "function") {
    window.ProducersView.addRow(producersViewContext);
  }
}

function handleProducersTableClick(e) {
  // Gestionado por ProducersView
}

function handleSaveProducers() {
  if (window.ProducersView && typeof window.ProducersView.save === "function") {
    window.ProducersView.save(producersViewContext);
  }
}

function filterProducersRows() {
  if (
    window.ProducersView &&
    typeof window.ProducersView.filterRows === "function"
  ) {
    window.ProducersView.filterRows(producersViewContext);
  }
}

// ==============================
//  TIENDAS
// ==============================

function renderStoresTable() {
  if (window.StoresView && typeof window.StoresView.render === "function") {
    window.StoresView.render(storesViewContext);
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
  if (!Array.isArray(list)) return productInstances;
  const allowClear = options.allowClear === true;
  if (!allowClear && list.length === 0 && productInstances.length > 0) {
    return productInstances;
  }
  const now = nowIsoString();
  const allProducts = getAllProductsForAssociationList();
  const updates = new Map();

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
    const existing = productInstances.find((i) => i.id === id) || {};
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
  productInstances = consolidateInstances(next, now);
  saveProductInstances();
  cleanupSelectionsWithInstances();
}

function handleInstancesDependencies() {
  renderInstancesTable();
  renderProducts();
  renderExtraQuickTable();
  renderExtraEditTable();
  renderShoppingList();
}

function handleGlobalSaveShortcut(e) {
  const isSaveKey = e.key && e.key.toLowerCase() === "s";
  if (!isSaveKey || (!e.metaKey && !e.ctrlKey)) return;
  e.preventDefault();
  commitDraftProducts();
  commitDraftExtras();
  if (almacenEditPanel && almacenEditPanel.classList.contains("active")) {
    handleSaveGrid();
    return;
  }
  if (otrosEditPanel && otrosEditPanel.classList.contains("active")) {
    handleSaveExtra();
    return;
  }
  if (instancesPanel && instancesPanel.classList.contains("active")) {
    handleSaveInstances();
    return;
  }
  if (producersPanel && producersPanel.classList.contains("active")) {
    handleSaveProducers();
    return;
  }
  if (storesPanel && storesPanel.classList.contains("active")) {
    handleSaveStores();
    return;
  }
  if (classificationSection && classificationSection.classList.contains("active")) {
    handleSaveClassifications();
    return;
  }
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

function filterStoresRows() {
  if (window.StoresView && typeof window.StoresView.filterRows === "function") {
    window.StoresView.filterRows(storesViewContext);
  }
}

// ==============================
//  SELECCIÓN DE PRODUCTOS (INSTANCIAS)
// ==============================

function renderInstancesTable() {
  if (isStoreActive()) return;
  hideProductAutocomplete();
  if (window.InstancesView && typeof window.InstancesView.render === "function") {
    if (instancesViewContext && instancesViewContext.data) {
      instancesViewContext.data.instances = productInstances;
      instancesViewContext.data.producers = producers;
      instancesViewContext.data.stores = suppliers;
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
    const exists = [...products, ...extraProducts].some(
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
  const data = {
    products: snap.products || products,
    extraProducts: snap.extraProducts || extraProducts,
    unifiedProducts:
      snap.unifiedProducts && snap.unifiedProducts.length
        ? snap.unifiedProducts
        : [
            ...((snap.products || products || []).map((p) => ({
              ...p,
              scope: p.scope || "almacen",
            })) || []),
            ...((snap.extraProducts || extraProducts || []).map((p) => ({
              ...p,
              scope: p.scope || "otros",
            })) || []),
          ],
    suppliers: snap.suppliers || suppliers,
    producers: snap.producers || producers,
    productInstances: snap.productInstances || productInstances,
    classifications: snap.classifications || classifications,
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  const ts = new Date();
  const yyyy = ts.getFullYear();
  const mm = String(ts.getMonth() + 1).padStart(2, "0");
  const dd = String(ts.getDate()).padStart(2, "0");
  const hh = String(ts.getHours()).padStart(2, "0");
  const mi = String(ts.getMinutes()).padStart(2, "0");
  a.href = url;
  a.download = `backup-almacen-${yyyy}${mm}${dd}-${hh}${mi}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

function handleBackupFileChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const text = ev.target.result;
      const data = JSON.parse(text);

      const snapshot = {
        unifiedProducts: Array.isArray(data.unifiedProducts)
          ? data.unifiedProducts
          : [
              ...(Array.isArray(data.products) ? data.products : []).map((p) => ({
                ...p,
                scope: "almacen",
              })),
              ...(Array.isArray(data.extraProducts) ? data.extraProducts : []).map(
                (p) => ({ ...p, scope: "otros" })
              ),
            ],
        suppliers: Array.isArray(data.suppliers) ? data.suppliers : [],
        producers: Array.isArray(data.producers) ? data.producers : [],
        productInstances: Array.isArray(data.productInstances)
          ? data.productInstances
          : [],
        classifications: Array.isArray(data.classifications)
          ? data.classifications
          : [],
      };

      if (window.AppStore && typeof window.AppStore.setState === "function") {
        window.AppStore.setState(snapshot);
        syncFromAppStore();
      } else {
        unifiedProducts = snapshot.unifiedProducts;
        suppliers = snapshot.suppliers;
        producers = snapshot.producers;
        productInstances = snapshot.productInstances;
        classifications = snapshot.classifications;
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
        renderProducersTable();
        renderStoresTable();
        renderClassificationTable();
        renderInstancesTable();
        renderShoppingList();
      }

      alert("Copia de seguridad restaurada correctamente.");
    } catch (err) {
      console.error(err);
      alert(
        "No se pudo leer el archivo de copia de seguridad. Asegúrate de que es un JSON válido."
      );
    } finally {
      backupFileInput.value = "";
    }
  };
  reader.readAsText(file);
}

function handleExportAlmacenCsv() {
  if (typeof XLSX === "undefined") {
    alert("La librería XLSX no está disponible.");
    return;
  }
  exportUnifiedCsv("almacen", "almacen.xlsx", "Almacén");
}

function handleExportOtrosCsv() {
  if (typeof XLSX === "undefined") {
    alert("La librería XLSX no está disponible.");
    return;
  }
  exportUnifiedCsv("otros", "otros_productos.xlsx", "Otros productos");
}

function exportUnifiedCsv(scope, filename, sheetName) {
  const snap = getLatestStateSnapshot();
  const list =
    (snap && Array.isArray(snap.unifiedProducts) && snap.unifiedProducts.length
      ? snap.unifiedProducts
      : [
          ...((snap && snap.products) || products || []),
          ...(((snap && snap.extraProducts) || extraProducts || []).map((p) => ({
            ...p,
            scope: p.scope || "otros",
          })) || []),
        ]) || [];
  const rows = list
    .filter((p) => (scope ? p.scope === scope : true))
    .sort(compareShelfBlockTypeName)
    .map((p) => ({
      Producto: p.name || "",
      Familia: p.block || "",
      Tipo: p.type || "",
      Ubicación: p.shelf || "",
      Cantidad: p.quantity || "",
      Selección: getSelectionLabelForProduct(p),
      Tiendas: getSelectionStoresForProduct(p),
      Comprar: p.buy ? "Sí" : "No",
      Tengo: p.have ? "Sí" : "No",
      "F. adquisición": p.acquisitionDate || "",
      Caducidad: p.expiryText || "",
      Notas: p.notes || "",
      Scope: p.scope || "",
    }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName || "Productos");
  XLSX.writeFile(wb, filename || "productos.xlsx");
}
