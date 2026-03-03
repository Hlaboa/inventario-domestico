// ==============================
//  CLAVES LOCALSTORAGE
// ==============================

const STORAGE_KEY_SUPPLIERS = "proveedoresCocina"; // Tiendas
const STORAGE_KEY_PRODUCERS = "productoresCocina"; // Productores
const STORAGE_KEY_INSTANCES = "instanciasProductosCocina"; // Selección de productos
const STORAGE_KEY_CLASSIFICATIONS = "clasificacionesProductosCocina"; // Familias/Tipos
const STORAGE_KEY_ORDERS = "pedidosCocina"; // Pedidos por tienda

// ==============================
//  ESTADO
// ==============================

let products = []; // almacén (cache derivada)
let extraProducts = []; // otros productos (cache derivada)
let unifiedProducts = []; // listado unificado con scope (cache)
let unifiedDirty = true;
let suppliers = []; // tiendas (cache)
let producers = []; // productores (cache)
let productInstances = []; // selección producto+productor+marca+tiendas (cache)
let classifications = []; // combinaciones familia/tipo (cache)
let orders = []; // pedidos por tienda (cache)
let productDrafts = [];
let extraDrafts = [];
let pendingInstancesList = null;
let instancesInitDone = false;
let instancesViewInitDone = false;
let classificationInitDone = false;
let instancesUpdateTimer = null;
const INSTANCE_UPDATE_DEBOUNCE = 200;
let extraRerenderTimer = null;
const EXTRA_RENDER_DEBOUNCE = 140;
let pendingExtrasUnified = null;
let extrasUpdateTimer = null;
const EXTRA_UPDATE_DEBOUNCE = 180;
let extrasIdleHandle = null;
let skipExtraControllerUntil = 0;
let skipInventoryControllerUntil = 0;
let pendingInventoryUnified = null;
let inventoryUpdateTimer = null;
let inventoryIdleHandle = null;
const INVENTORY_UPDATE_DEBOUNCE = 600;
let inventorySummaryTimer = null;
const INVENTORY_SUMMARY_DEBOUNCE = 200;
let suppressStoreSync = false;
let suppressStoreSyncTimer = null;
let shoppingIdleHandle = null;
let shoppingRenderTimer = null;
const SHOPPING_RENDER_DEBOUNCE = 160;
let persistUnifiedIdleHandle = null;
let persistUnifiedTimer = null;
const UNIFIED_PERSIST_DEBOUNCE = 140;
let extrasPersistCleanupTimer = null;
let gridRenderHandle = null;
let extraEditRenderHandle = null;
let classificationRenderHandle = null;
let instancesRenderHandle = null;
const DEFERRED_RENDER_TIMEOUT = 240;
const PERF_LOG_THRESHOLD = 0; // log todo para diagnóstico
const perfLog = (label, duration, extra = "") => {
  if (duration < PERF_LOG_THRESHOLD) return;
  const suffix = extra ? ` ${extra}` : "";
  console.log(`[perf] ${label}: ${duration.toFixed(1)}ms${suffix}`);
};
const runMeasured = (label, fn) => {
  const t0 = performance.now();
  const res = typeof fn === "function" ? fn() : null;
  perfLog(label, performance.now() - t0);
  return res;
};
let instancesNeedsRender = true;
let extrasNeedsRender = true;
let producersNeedsRender = true;
let storesNeedsRender = true;
let shoppingNeedsRender = true;
let ordersNeedsRender = true;
let firstSyncDone = false;
let scheduledInitialSync = null;
let scheduledInitialSyncHandle = null;
let deferredIdleTasksHandle = null;
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
    orders,
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

function getOrdersList() {
  const state = getStateSnapshot();
  const list = Array.isArray(state.orders) && state.orders.length ? state.orders : orders;
  orders = Array.isArray(list) ? list : [];
  return orders;
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

function flushInstancesUpdates() {
  if (!pendingInstancesList) return;
  const toSave = pendingInstancesList;
  pendingInstancesList = null;
  if (instancesViewContext) {
    instancesViewContext.__skipNextRender = true;
  }
  setInstancesList(toSave);
}

function getRemovedEntityIds(previousList, nextList) {
  const prevIds = new Set(
    (Array.isArray(previousList) ? previousList : [])
      .map((item) => String(item?.id || "").trim())
      .filter(Boolean)
  );
  const nextIds = new Set(
    (Array.isArray(nextList) ? nextList : [])
      .map((item) => String(item?.id || "").trim())
      .filter(Boolean)
  );
  const removed = [];
  prevIds.forEach((id) => {
    if (!nextIds.has(id)) removed.push(id);
  });
  return removed;
}

function pruneInstancesWithoutProducerAndStore(list) {
  if (!Array.isArray(list) || list.length === 0) return { list: [], removed: 0 };
  const validProducerIds = new Set(
    getProducersList()
      .map((p) => String(p?.id || "").trim())
      .filter(Boolean)
  );
  const validStoreIds = new Set(
    getSuppliersList()
      .map((s) => String(s?.id || "").trim())
      .filter(Boolean)
  );
  const filtered = [];
  let removed = 0;
  list.forEach((inst) => {
    if (!inst) {
      removed += 1;
      return;
    }
    const rawProducerId = String(inst.producerId || "").trim();
    const producerId = rawProducerId && validProducerIds.has(rawProducerId) ? rawProducerId : "";
    const storeIds = Array.isArray(inst.storeIds)
      ? inst.storeIds
          .map((id) => String(id || "").trim())
          .filter((id) => id && validStoreIds.has(id))
      : [];
    if (!producerId && storeIds.length === 0) {
      removed += 1;
      return;
    }
    filtered.push({
      ...inst,
      producerId,
      storeIds,
    });
  });
  return { list: filtered, removed };
}

function cleanupInstancesReferences({
  removedStoreIds = [],
  removedProducerIds = [],
} = {}) {
  const removedStores = new Set(
    (Array.isArray(removedStoreIds) ? removedStoreIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  );
  const removedProducers = new Set(
    (Array.isArray(removedProducerIds) ? removedProducerIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  );
  if (!removedStores.size && !removedProducers.size) return false;

  const currentInstances = getInstancesList();
  if (!Array.isArray(currentInstances) || currentInstances.length === 0) return false;

  let changed = false;
  const cleaned = currentInstances.map((inst) => {
    if (!inst) return inst;
    const currentStoreIds = Array.isArray(inst.storeIds) ? inst.storeIds : [];
    const nextStoreIds = currentStoreIds.filter((id) => !removedStores.has(String(id || "").trim()));
    const currentProducerId = String(inst.producerId || "").trim();
    const nextProducerId = removedProducers.has(currentProducerId) ? "" : currentProducerId;
    const sameStores =
      nextStoreIds.length === currentStoreIds.length &&
      nextStoreIds.every((id, idx) => id === currentStoreIds[idx]);
    const sameProducer = nextProducerId === currentProducerId;
    if (sameStores && sameProducer) return inst;
    changed = true;
    return {
      ...inst,
      producerId: nextProducerId,
      storeIds: nextStoreIds,
      updatedAt: nowIsoString(),
    };
  });

  if (!changed) return false;
  const { list: pruned } = pruneInstancesWithoutProducerAndStore(cleaned);
  setInstancesList(pruned);
  instancesNeedsRender = true;
  return true;
}

function setSuppliersList(list) {
  const previous = Array.isArray(suppliers) ? suppliers : [];
  const next = Array.isArray(list) ? list : [];
  const removedStoreIds = getRemovedEntityIds(previous, next);
  suppliers = next;
  memoStores = [];
  memoStoreLocations = [];
  cleanupInstancesReferences({ removedStoreIds });
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
  const previous = Array.isArray(producers) ? producers : [];
  const next = Array.isArray(list) ? list : [];
  const removedProducerIds = getRemovedEntityIds(previous, next);
  producers = next;
  memoProducerFilterOptions = "";
  memoProducerLocations = [];
  cleanupInstancesReferences({ removedProducerIds });
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

function setOrdersList(list) {
  const next = Array.isArray(list) ? list : [];
  orders = next;
  if (isSyncingFromStore) return orders;
  if (stateAdapter && typeof stateAdapter.setEntity === "function") {
    stateAdapter.setEntity("orders", next);
    syncFromAppStore();
    renderProductsDebounced();
    renderExtraQuickTable();
    renderExtraEditTable();
    return getOrdersList();
  }
  if (
    window.AppStore &&
    window.AppStore.actions &&
    typeof window.AppStore.actions.setOrders === "function"
  ) {
    window.AppStore.actions.setOrders(next);
    syncFromAppStore();
    renderProductsDebounced();
    renderExtraQuickTable();
    renderExtraEditTable();
    return getOrdersList();
  }
  if (window.DataService && typeof window.DataService.setOrders === "function") {
    orders = window.DataService.setOrders(next);
    renderProductsDebounced();
    renderExtraQuickTable();
    renderExtraEditTable();
    return orders;
  }
  if (window.AppStorage && typeof window.AppStorage.saveOrders === "function") {
    window.AppStorage.saveOrders(next);
    renderProductsDebounced();
    renderExtraQuickTable();
    renderExtraEditTable();
    return orders;
  }
  if (typeof appUtils.saveList === "function") {
    appUtils.saveList(STORAGE_KEY_ORDERS, orders);
    renderProductsDebounced();
    renderExtraQuickTable();
    renderExtraEditTable();
    return orders;
  }
  try {
    localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
  } catch {}
  renderProductsDebounced();
  renderExtraQuickTable();
  renderExtraEditTable();
  return orders;
}

function refreshProductsFromUnified(force = false) {
  if (!force && !unifiedDirty) return;
  const t0 = performance.now();
  const unified = Array.isArray(unifiedProducts) ? unifiedProducts : [];
  unifiedProducts = normalizeExtrasHave(unified.filter(Boolean));
  products = unifiedProducts.filter((p) => p.scope === "almacen");
  extraProducts = unifiedProducts.filter((p) => p.scope === "otros");
  unifiedDirty = false;
  const duration = performance.now() - t0;
  perfLog("refreshProductsFromUnified", duration, `items=${unifiedProducts.length}`);
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
    const buy = p.buy !== undefined ? !!p.buy : false;
    const have = p.have !== undefined ? !!p.have : p.buy !== undefined ? !buy : false;
    return { ...p, id, buy, have };
  });
}

function setUnifiedList(next) {
  const t0 = performance.now();
  const cleaned = Array.isArray(next) ? next.filter(Boolean) : [];
  unifiedProducts = normalizeExtrasHave(cleaned);
  unifiedDirty = true;
  memoProductsDatalistKey = "";
  refreshProductsFromUnified(true);
  const duration = performance.now() - t0;
  perfLog("setUnifiedList", duration, `items=${unifiedProducts.length}`);
  const storeActive = isStoreActive();
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
  // Guarda siempre una copia local para no perder campos (caducidad, notas, etc.)
  persistUnifiedLocal(unifiedProducts);
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
  const unified = pendingExtrasUnified || getUnifiedForWrite();
  const nowIsoVal = nowIsoString();
  let touched = false;
  const updatedUnified = unified.map((p) => {
    if (!p || String(p.id) !== targetId) return p;
    if (!!p.buy === !!checked) return p;
    touched = true;
    return { ...p, buy: !!checked, updatedAt: nowIsoVal };
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

  pendingExtrasUnified = updatedUnified;
  if (extrasViewContext) extrasViewContext.__skipNextRender = true;
  if (extraEditViewContext) extraEditViewContext.__skipNextRender = true;
  if (window.ExtrasFeature && typeof window.ExtrasFeature.skipNextRender === "function") {
    try {
      window.ExtrasFeature.skipNextRender();
    } catch {}
  }
  skipExtraControllerUntil = Date.now() + 350;

  const flushExtrasUpdates = () => {
    const t0 = performance.now();
    const payload = pendingExtrasUnified;
    pendingExtrasUnified = null;
    unifiedProducts = payload;
    unifiedDirty = true;
    refreshProductsFromUnified();
    suppressStoreSync = true;
    if (suppressStoreSyncTimer) clearTimeout(suppressStoreSyncTimer);
    suppressStoreSyncTimer = setTimeout(() => {
      suppressStoreSync = false;
    }, EXTRA_UPDATE_DEBOUNCE * 2);

    // Si hay store activo, delegamos en él para evitar doble render pesado
    if (isStoreActive()) {
      if (window.AppStore && window.AppStore.actions && typeof window.AppStore.actions.setUnifiedProducts === "function") {
        try {
          window.AppStore.actions.setUnifiedProducts(payload);
          setTimeout(persistLegacy, 0);
          return;
        } catch {}
      }
      if (window.DataService && typeof window.DataService.setUnifiedProducts === "function") {
        try {
          window.DataService.setUnifiedProducts(payload);
          setTimeout(persistLegacy, 0);
          return;
        } catch {}
      }
    }

    // Modo sin store: persistimos local y renderizamos
    setUnifiedList(payload);
    saveExtraProducts();
    persistLegacy();
    if (extraSummaryInfo) {
      renderExtraSummary();
    }
    const duration = performance.now() - t0;
    perfLog("flushExtrasUpdates", duration, `items=${(payload || []).length}`);
  };

  if (extraSummaryInfo) {
    renderExtraSummary();
  }
  flushPendingExtrasImmediate();
}

function updateExtraHaveFlag(id, checked) {
  const targetId = id !== undefined && id !== null ? String(id) : "";
  if (!targetId) return;
  const unified = pendingExtrasUnified || getUnifiedForWrite();
  const nowIsoVal = nowIsoString();
  let touched = false;
  const updatedUnified = unified.map((p) => {
    if (!p || String(p.id) !== targetId) return p;
    if (!!p.have === !!checked) return p;
    touched = true;
    return { ...p, have: !!checked, updatedAt: nowIsoVal };
  });
  if (!touched) return;

  const quickRow = extraListTableBody?.querySelector(`tr[data-id="${id}"]`);
  if (quickRow) {
    quickRow.dataset.have = checked ? "1" : "0";
    const chk = quickRow.querySelector('input[data-field="have"]');
    if (chk) chk.checked = !!checked;
  }

  const editRow = extraTableBody?.querySelector(`tr[data-id="${id}"]`);
  if (editRow) {
    editRow.dataset.have = checked ? "1" : "0";
    const chk = editRow.querySelector('input[data-field="have"]');
    if (chk) chk.checked = !!checked;
  }

  pendingExtrasUnified = updatedUnified;
  if (extrasViewContext) extrasViewContext.__skipNextRender = true;
  if (extraEditViewContext) extraEditViewContext.__skipNextRender = true;
  if (window.ExtrasFeature && typeof window.ExtrasFeature.skipNextRender === "function") {
    try {
      window.ExtrasFeature.skipNextRender();
    } catch {}
  }
  skipExtraControllerUntil = Date.now() + 350;

  if (extraSummaryInfo) {
    renderExtraSummary();
  }
  flushPendingExtrasImmediate();
}

function flushPendingExtrasImmediate() {
  if (!pendingExtrasUnified) return;
  if (extrasUpdateTimer) {
    clearTimeout(extrasUpdateTimer);
    extrasUpdateTimer = null;
  }
  if (extrasIdleHandle && typeof cancelIdleCallback === "function") {
    try {
      cancelIdleCallback(extrasIdleHandle);
    } catch {}
    extrasIdleHandle = null;
  }
  if (extrasPersistCleanupTimer) {
    clearTimeout(extrasPersistCleanupTimer);
    extrasPersistCleanupTimer = null;
  }
  const payload = pendingExtrasUnified;
  pendingExtrasUnified = null;
  const now = performance.now();
  unifiedProducts = payload;
  unifiedDirty = true;
  refreshProductsFromUnified();
  suppressStoreSync = true;
  if (suppressStoreSyncTimer) clearTimeout(suppressStoreSyncTimer);
  suppressStoreSyncTimer = setTimeout(() => {
    suppressStoreSync = false;
  }, EXTRA_UPDATE_DEBOUNCE * 2);

  const persistLegacy = () => {
    const legacyExtras = payload
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

  if (isStoreActive()) {
    if (window.AppStore?.actions?.setUnifiedProducts) {
      try {
        window.AppStore.actions.setUnifiedProducts(payload);
      } catch {}
    }
    if (window.DataService?.setUnifiedProducts) {
      try {
        window.DataService.setUnifiedProducts(payload);
      } catch {}
    }
  }

  setUnifiedList(payload);
  saveExtraProducts();
  persistLegacy();
  if (extraSummaryInfo) renderExtraSummary();
  scheduleShoppingListRender();
  perfLog("flushPendingExtrasImmediate", performance.now() - now, `items=${(payload || []).length}`);
}

function flushInventoryUpdates() {
  if (!pendingInventoryUnified) return;
  const t0 = performance.now();
  const payload = pendingInventoryUnified;
  pendingInventoryUnified = null;
  unifiedProducts = payload;
  unifiedDirty = true;
  refreshProductsFromUnified();
  suppressStoreSync = true;
  if (suppressStoreSyncTimer) clearTimeout(suppressStoreSyncTimer);
  suppressStoreSyncTimer = setTimeout(() => {
    suppressStoreSync = false;
  }, INVENTORY_UPDATE_DEBOUNCE * 2);
  // Persistimos siempre vía setUnifiedList para unificar rutas y asegurar almacenamiento local
  setUnifiedList(payload);
  saveProducts();
  persistUnifiedLocal(payload);
  const duration = performance.now() - t0;
  perfLog("flushInventoryUpdates", duration, `items=${(payload || []).length}`);
}

function scheduleInventoryFlush() {
  if (typeof cancelIdleCallback === "function" && inventoryIdleHandle) {
    cancelIdleCallback(inventoryIdleHandle);
    inventoryIdleHandle = null;
  }
  clearTimeout(inventoryUpdateTimer);
  const run = () => {
    if (!selectionPopupOverlay || !selectionPopup || !selectionPopupList) return;
    inventoryIdleHandle = null;
    flushInventoryUpdates();
  };
  inventoryUpdateTimer = setTimeout(run, INVENTORY_UPDATE_DEBOUNCE);
}

function scheduleExtrasFlush(flushFn) {
  if (typeof cancelIdleCallback === "function" && extrasIdleHandle) {
    cancelIdleCallback(extrasIdleHandle);
    extrasIdleHandle = null;
  }
  clearTimeout(extrasUpdateTimer);
  const run = () => {
    extrasIdleHandle = null;
    flushFn();
  };
  extrasUpdateTimer = setTimeout(run, EXTRA_UPDATE_DEBOUNCE);
}

// Asegurar persistencia de cambios en extras antes de cerrar/navegar
window.addEventListener("beforeunload", flushPendingExtrasImmediate);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flushPendingExtrasImmediate();
  }
});

function scheduleShoppingListRender() {
  if (typeof cancelIdleCallback === "function" && shoppingIdleHandle) {
    cancelIdleCallback(shoppingIdleHandle);
    shoppingIdleHandle = null;
  }
  clearTimeout(shoppingRenderTimer);
  const run = () => {
    shoppingIdleHandle = null;
    renderShoppingList();
  };
  shoppingRenderTimer = setTimeout(run, SHOPPING_RENDER_DEBOUNCE);
}

function queueInventorySummaryUpdate(baseUnified) {
  if (!summaryInfo || !productTableBody) return;
  clearTimeout(inventorySummaryTimer);
  inventorySummaryTimer = setTimeout(() => {
    const unifiedList =
      Array.isArray(baseUnified) && baseUnified.length
        ? baseUnified
        : pendingInventoryUnified || getUnifiedForWrite();
    const baseProducts = (unifiedList || []).filter((p) => p && p.scope === "almacen");
    const totalAll = baseProducts.length;
    const visible = Array.from(productTableBody.querySelectorAll("tr[data-id]")).filter(
      (tr) => tr.style.display !== "none"
    );
    const missingVisible = visible.filter((tr) => tr.dataset.have !== "1").length;
    const filtered = areInventoryFiltersActive() || visible.length !== totalAll;
    if (filtered) {
      summaryInfo.textContent = `Total: ${totalAll} · Visibles: ${visible.length} · Faltan: ${missingVisible}`;
    } else {
      summaryInfo.textContent = `Total: ${totalAll} · Faltan: ${missingVisible}`;
    }
  }, INVENTORY_SUMMARY_DEBOUNCE);
}

function applyInventoryFiltersToRow(row, product) {
  if (!row || !product) return;
  const search = (filterSearchInput?.value || "").toLowerCase();
  const filterBlock = filterBlockSelect?.value || "";
  const filterType = filterTypeSelect?.value || "";
  const filterShelf = filterShelfSelect?.value || "";
  const filterStoreId = filterStoreSelect?.value || "";
  const filterProducerId = filterProducerSelect?.value || "";
  const status = filterStatusSelect?.value || "all";
  const futureMap =
    typeof window.buildFutureOrderMap === "function" ? window.buildFutureOrderMap() : null;
  const future = !!getFutureOrderLabel(product, futureMap);
  const have = !!product.have;

  let visible = true;
  if (filterBlock && (product.block || "") !== filterBlock) visible = false;
  if (visible && filterType && (product.type || "") !== filterType) visible = false;
  if (visible && filterShelf && (product.shelf || "") !== filterShelf) visible = false;
  if (visible && filterStoreId && !productMatchesStore(product, filterStoreId)) visible = false;
  if (visible && filterProducerId && !productMatchesProducer(product, filterProducerId)) visible = false;
  if (visible && status === "have" && !have) visible = false;
  if (visible && status === "missing" && have) visible = false;
  if (visible && status === "future" && !future) visible = false;
  if (visible && status === "have_future" && !(have && future)) visible = false;
  if (visible && status === "missing_future" && !(!have && future)) visible = false;
  if (visible && status === "have_no_future" && !(have && !future)) visible = false;
  if (visible && status === "missing_no_future" && !(!have && !future)) visible = false;
  if (visible && search) {
    const haystack = `${product.name || ""} ${product.block || ""} ${product.type || ""} ${product.shelf || ""} ${product.quantity || ""} ${product.notes || ""} ${getSelectionLabelForProduct(product)} ${getSelectionStoresForProduct(product)}`.toLowerCase();
    if (!haystack.includes(search)) visible = false;
  }
  row.style.display = visible ? "" : "none";
}

function updateInventoryHaveFlag(id, checked) {
  const targetId = id !== undefined && id !== null ? String(id) : "";
  if (!targetId) return;
  const nowDate = todayDateString();
  const nowIsoVal = nowIsoString();
  const unified = pendingInventoryUnified || getUnifiedForWrite();
  let touched = false;
  let updatedProduct = null;
  const updatedUnified = unified.map((p) => {
    if (!p || String(p.id) !== targetId) return p;
    touched = true;
    const wasHave = !!p.have;
    const nextAcq = !wasHave && checked ? nowDate : p.acquisitionDate;
    const next = { ...p, have: !!checked, acquisitionDate: nextAcq, updatedAt: nowIsoVal };
    updatedProduct = next;
    return next;
  });
  if (!touched) return;

  pendingInventoryUnified = updatedUnified;

  const row = productTableBody?.querySelector(`tr[data-id="${targetId}"]`);
  if (row) {
    row.dataset.have = checked ? "1" : "0";
    const chk = row.querySelector('input[data-field="have"]');
    if (chk) chk.checked = !!checked;
    if (updatedProduct) {
      const acqCell = row.querySelector("[data-field='acquisitionDate']");
      if (acqCell) acqCell.textContent = updatedProduct.acquisitionDate || "";
    }
    applyInventoryFiltersToRow(row, updatedProduct);
  }

  queueInventorySummaryUpdate(updatedUnified);

  skipInventoryControllerUntil = Date.now() + INVENTORY_UPDATE_DEBOUNCE + 400;
  if (inventoryViewContext && inventoryViewContext.refs) {
    inventoryViewContext.refs.__skipNextRender = true;
  }
  if (window.InventoryFeature && typeof window.InventoryFeature.skipNextRender === "function") {
    try {
      window.InventoryFeature.skipNextRender();
    } catch {}
  }

  clearTimeout(extraRerenderTimer);
  scheduleShoppingListRender();

  scheduleInventoryFlush();
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
  if (!target || target.type !== "checkbox") return;
  const field = target.dataset.field;
  if (field !== "buy" && field !== "have") return;
  const row = target.closest("tr");
  const id = target.dataset.id || row?.dataset.id;
  if (!id) return;
  const inExtrasTable =
    (extraListTableBody && extraListTableBody.contains(row)) ||
    (extraTableBody && extraTableBody.contains(row));
  if (!inExtrasTable) return;
  if (field === "buy") {
    updateExtraBuyFlag(id, target.checked);
  } else {
    updateExtraHaveFlag(id, target.checked);
  }
}

function isStoreActive() {
  return !!(
    (stateAdapter && typeof stateAdapter.subscribe === "function") ||
    (window.AppStore && typeof window.AppStore.subscribe === "function")
  );
}

function areInventoryFiltersActive() {
  const search = (filterSearchInput?.value || "").trim();
  const block = filterBlockSelect?.value || "";
  const type = filterTypeSelect?.value || "";
  const shelf = filterShelfSelect?.value || "";
  const store = filterStoreSelect?.value || "";
  const producer = filterProducerSelect?.value || "";
  const status = filterStatusSelect?.value || "all";
  return search || block || type || shelf || store || producer || status !== "all";
}

function areExtraFiltersActive() {
  const search = (extraFilterSearchInput?.value || "").trim();
  const family = extraFilterFamilySelect?.value || "";
  const type = extraFilterTypeSelect?.value || "";
  const store = extraFilterStoreSelect?.value || "";
  const producer = extraFilterProducerSelect?.value || "";
  const have = extraFilterHaveSelect?.value || "all";
  const buy = extraFilterBuySelect?.value || "all";
  return search || family || type || store || producer || buy !== "all" || have !== "all";
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
    snap.orders,
  ].filter(Array.isArray);
  return arrays.some((arr) => arr.length > 0);
}

function applyStateSnapshot(snapshot = {}) {
  const nextProducts = snapshot.products || products || [];
  const nextExtras = snapshot.extraProducts || extraProducts || [];
  const mergeExpiryFromLocal = (list = []) => {
    let local = [];
    try {
      if (window.AppStorage && typeof window.AppStorage.loadUnifiedProducts === "function") {
        local = window.AppStorage.loadUnifiedProducts() || [];
      } else {
        const raw = localStorage.getItem("productosCocinaUnificados");
        local = raw ? JSON.parse(raw) : [];
      }
    } catch {
      local = [];
    }
    const map = new Map(
      (Array.isArray(local) ? local : []).map((p) => [String(p.id || ""), p]).filter(([k]) => k)
    );
    const hasOwn = (obj, key) => !!obj && Object.prototype.hasOwnProperty.call(obj, key);
    const trimmed = (val) => (val === undefined || val === null ? "" : String(val).trim());
    return (Array.isArray(list) ? list : []).map((item) => {
      const key = String(item?.id || "");
      if (!key || map.size === 0) return item;
      const localItem = map.get(key);
      if (!localItem) return item;
      const expiry = (() => {
        if (hasOwn(item, "expiryText")) return trimmed(item.expiryText);
        if (hasOwn(item, "shelfLifeDays")) return trimmed(item.shelfLifeDays);
        if (hasOwn(localItem, "expiryText")) return trimmed(localItem.expiryText);
        if (hasOwn(localItem, "shelfLifeDays")) return trimmed(localItem.shelfLifeDays);
        return "";
      })();
      const acquisition = hasOwn(item, "acquisitionDate")
        ? trimmed(item.acquisitionDate)
        : hasOwn(localItem, "acquisitionDate")
          ? trimmed(localItem.acquisitionDate)
          : "";
      return {
        ...item,
        expiryText: expiry,
        shelfLifeDays: expiry,
        acquisitionDate: acquisition,
      };
    });
  };

  const unifiedRaw = Array.isArray(snapshot.unifiedProducts) && snapshot.unifiedProducts.length > 0
    ? snapshot.unifiedProducts
    : [
        ...nextProducts.map((p) => ({ ...p, scope: "almacen" })),
        ...nextExtras.map((p) => ({ ...p, scope: "otros" })),
      ];
  const unified = mergeExpiryFromLocal(unifiedRaw);

  unifiedProducts = unified;
  unifiedDirty = true;
  suppliers = snapshot.suppliers || suppliers || [];
  producers = snapshot.producers || producers || [];
  classifications = snapshot.classifications || classifications || [];
  productInstances = snapshot.productInstances || productInstances || [];
  orders = snapshot.orders || orders || [];

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

function persistUnifiedLocal(list) {
  const run = () => {
    const t0 = performance.now();
    const data = Array.isArray(list) ? list : [];
    let persisted = false;
    if (window.AppStorage && typeof window.AppStorage.saveUnifiedProducts === "function") {
      try {
        window.AppStorage.saveUnifiedProducts(data);
        persisted = true;
      } catch {
        persisted = false;
      }
    }
    if (!persisted) {
      try {
        localStorage.setItem("productosCocinaUnificados", JSON.stringify(data));
        persisted = true;
      } catch {
        persisted = false;
      }
    }
    if (!persisted && typeof appUtils.saveList === "function") {
      try {
        appUtils.saveList("productosCocinaUnificados", data);
        persisted = true;
      } catch {}
    }
    const duration = performance.now() - t0;
    perfLog("persistUnifiedLocal", duration, `items=${data.length}`);
  };

  if (typeof cancelIdleCallback === "function" && persistUnifiedIdleHandle) {
    cancelIdleCallback(persistUnifiedIdleHandle);
    persistUnifiedIdleHandle = null;
  }
  clearTimeout(persistUnifiedTimer);
  persistUnifiedTimer = setTimeout(run, UNIFIED_PERSIST_DEBOUNCE);
}

// ==============================
//  REFERENCIAS DOM
// ==============================

let summaryInfo;
let extraSummaryInfo;
let producersSummaryInfo;
let storesSummaryInfo;
let instancesSummaryInfo;
let classificationSummaryInfo;
let classificationSearchInput;
let classificationFamilyFilterSelect;
let classificationTypeFilterSelect;
let ordersSummaryInfo;
let ordersPlannerSummary;

// Navegación principal
let mainAlmacenButton;
let mainOtrosButton;
let mainSelectionButton;
let mainClassificationButton;
let mainProducersButton;
let mainStoresButton;
let mainOrdersButton;
let mainBackupButton;
let mainShoppingButton;
let almacenSection;
let otrosSection;
let classificationSection;
let backupSection;
let shoppingSection;
let activeSidePanel = "";
let proveedoresSection;
let ordersSection;

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
let filterProducerSelect;
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
let editFilterProducerSelect;

// Otros (vista principal)
let extraListTableBody;
let extraFilterSearchInput;
let extraFilterFamilySelect;
let extraFilterTypeSelect;
let extraFilterStoreSelect;
let extraFilterProducerSelect;
let extraFilterHaveSelect;
let extraFilterBuySelect;

// Otros (editar)
let extraTableBody;
let addExtraRowButton;
let saveExtraButton;
let extraEditFilterSearchInput;
let extraEditFilterFamilySelect;
let extraEditFilterTypeSelect;
let extraEditFilterStoreSelect;
let extraEditFilterProducerSelect;
let extraEditFilterHaveSelect;
let extraQuickRowTemplate;
let inventoryRowTemplate;

// Productores
let producersSearchInput;
let producersLocationFilterSelect;
let producersUsageFilterSelect;
let producersTableBody;
let addProducerButton;
let saveProducersButton;

// Tiendas
let storesSearchInput;
let storesTypeFilterSelect;
let storesLocationFilterSelect;
let storesUsageFilterSelect;
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
let inventoryViewContext;
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
let ordersStoreSelect;
let ordersPlannedDate;
let ordersPriceInput;
let ordersNameInput;
let addOrderQuickButton;
let addOrderItemButton;
let newOrderButton;
let toggleOrdersBatchButton;
let closeOrdersBatchButton;
let ordersBatchPanel;
let addOrderBatchButton;
let replaceOrderBatchButton;
let duplicateOrderButton;
let completeOrderButton;
let ordersBatchSelect;
let saveOrdersButton;
let deleteOrderButton;
let clearOrderButton;
let ordersTableBody;
let ordersRowTemplate;
let ordersProductsDatalist;
let ordersSavedList;
let ordersHistoryPanel;
let ordersHistorySummary;
let ordersHistoryList;
let ordersHistoryPreview;
let ordersHistoryNameInput;
let ordersHistoryDateInput;
let ordersHistoryPriceInput;
let ordersHistoryPreviewSummary;
let ordersHistoryPreviewTableBody;
let ordersPlannerList;
let ordersKpis;
let ordersViewOperativeButton;
let ordersViewCalendarButton;
let ordersViewHistoryButton;
let ordersOperativeView;
let ordersCalendarView;
let ordersHistoryView;
let ordersCalendarSummary;
let ordersCalendarList;
let ordersFamilyFilterSelect;
let ordersTypeFilterSelect;
let ordersScopeFilterSelect;
let ordersDateFilterSelect;
let ordersSavedSearchInput;
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
    orders: getOrdersList(),
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
  const ordersTabs = document.querySelector(".tabs-orders");
  if (ordersTabs) {
    ordersTabs.setAttribute("role", "tablist");
    ordersTabs.querySelectorAll("button").forEach((btn) => {
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
let pruneSelectionsButton;
let backupFileInput;
let exportAlmacenCsvButton;
let exportOtrosCsvButton;
let exportStoresCsvButton;

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
let instancesMissingFilterButton;
let lastSelectionTrigger = null;
let instancesTableWrapper;
let inlineProducerSelect;
let inlineBrandInput;
let inlineStoresSelect;
let instancesRefreshTimer = null;
const INSTANCES_REFRESH_DELAY = 80;

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
let currentOrderStoreId = "";
let currentOrderId = "";
let orderProductOptionMap = new Map();
let ordersPlannerStoreMap = new Map();
let ordersReadOnly = false;
let currentOrdersSubview = "operative";
let saveShortcutBound = false;
let lastDuplicateToast = { name: "", ts: 0 };
let selectionButtonsVisible = true;
let instancesMissingFilterActive = true;

let filtersDefaultsApplied = false;
let selectionDragCleanup = null;
let selectionPopupInitialized = false;
let instancesWarmupHandle = null;
let instancesWarmupHandleType = "";
let instancesWarmupDone = false;
const INSTANCES_WARMUP_IDLE_TIMEOUT = 180;

function syncInventoryDrafts() {
  if (inventoryController && typeof inventoryController.setDrafts === "function") {
    inventoryController.setDrafts(productDrafts);
  }
}

function setProductDrafts(next) {
  productDrafts = Array.isArray(next) ? next : [];
  syncInventoryDrafts();
}

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

function shouldShowDuplicateToast(name) {
  const now = Date.now();
  const key = (name || "").trim().toLowerCase();
  if (key && lastDuplicateToast.name === key && now - lastDuplicateToast.ts < 800) {
    return false;
  }
  lastDuplicateToast = { name: key, ts: now };
  return true;
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
      filterProducerSelect,
      filterStatusSelect,
      summaryInfo,
      inventoryRowTemplate,
      __skipNextRender: false,
    },
    state: {
      getProducts: () => getPantryProducts(),
      getDrafts: () => productDrafts,
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
      productMatchesProducer,
      getSelectionLabelForProduct,
      getSelectionStoresForProduct,
      createSelectionButton,
      getFutureOrderLabel,
      handleInventoryTableClick,
    },
  };
}

// ==============================
//  INICIALIZACIÓN
// ==============================

function initAfterDom(tStart = performance.now()) {
  console.log("[perf] DOMContentLoaded start");
  ensureSaveShortcutBinding();
  const refs =
    window.AppBootstrap && typeof window.AppBootstrap.collectRefs === "function"
      ? window.AppBootstrap.collectRefs()
      : {};

  ({
    summaryInfo,
    extraSummaryInfo,
    classificationSummaryInfo,
    producersSummaryInfo,
    storesSummaryInfo,
    instancesSummaryInfo,
    ordersSummaryInfo,
    ordersPlannerSummary,
    classificationSearchInput,
    classificationFamilyFilterSelect,
    classificationTypeFilterSelect,
    mainAlmacenButton,
    mainOtrosButton,
    mainSelectionButton,
  mainClassificationButton,
  mainProducersButton,
  mainStoresButton,
  mainOrdersButton,
  mainBackupButton,
  mainShoppingButton,
    almacenSection,
    otrosSection,
    classificationSection,
    backupSection,
    shoppingSection,
    proveedoresSection,
    ordersSection,
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
    filterProducerSelect,
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
    editFilterProducerSelect,
    extraListTableBody,
    extraFilterSearchInput,
    extraFilterFamilySelect,
    extraFilterTypeSelect,
    extraFilterStoreSelect,
    extraFilterProducerSelect,
    extraFilterHaveSelect,
    extraFilterBuySelect,
    extraTableBody,
    addExtraRowButton,
    saveExtraButton,
    extraEditFilterSearchInput,
    extraEditFilterFamilySelect,
    extraEditFilterTypeSelect,
    extraEditFilterStoreSelect,
    extraEditFilterProducerSelect,
    extraEditFilterHaveSelect,
    extraQuickRowTemplate,
    extraEditRowTemplate,
    producersSearchInput,
    producersLocationFilterSelect,
    producersUsageFilterSelect,
    producersTableBody,
    addProducerButton,
    saveProducersButton,
    storesSearchInput,
    storesTypeFilterSelect,
    storesLocationFilterSelect,
    storesUsageFilterSelect,
    storesTableBody,
    addStoreButton,
    saveStoresButton,
    instancesSearchInput,
    instancesFamilyFilterSelect,
    instancesProducerFilterSelect,
    instancesStoreFilterSelect,
    instancesMissingFilterButton,
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
    ordersStoreSelect,
    ordersPlannedDate,
    ordersPriceInput,
    ordersNameInput,
    addOrderQuickButton,
    toggleOrdersBatchButton,
    closeOrdersBatchButton,
    ordersBatchPanel,
    addOrderBatchButton,
    replaceOrderBatchButton,
    duplicateOrderButton,
    completeOrderButton,
    addOrderItemButton,
    newOrderButton,
    saveOrdersButton,
    deleteOrderButton,
    clearOrderButton,
    ordersTableBody,
    ordersRowTemplate,
    ordersSummaryInfo,
    ordersProductsDatalist,
    ordersSavedList,
    ordersHistoryPanel,
    ordersHistorySummary,
    ordersHistoryList,
    ordersHistoryPreview,
    ordersHistoryNameInput,
    ordersHistoryDateInput,
    ordersHistoryPriceInput,
    ordersHistoryPreviewSummary,
    ordersHistoryPreviewTableBody,
    ordersPlannerList,
    ordersKpis,
    ordersViewOperativeButton,
    ordersViewCalendarButton,
    ordersViewHistoryButton,
    ordersOperativeView,
    ordersCalendarView,
    ordersHistoryView,
    ordersCalendarSummary,
    ordersCalendarList,
    ordersFamilyFilterSelect,
    ordersTypeFilterSelect,
    ordersScopeFilterSelect,
    ordersDateFilterSelect,
    ordersSavedSearchInput,
    ordersBatchSelect,
    exportBackupButton,
    importBackupButton,
    pruneSelectionsButton,
    backupFileInput,
    exportAlmacenCsvButton,
    exportOtrosCsvButton,
    exportStoresCsvButton,
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
  if (extraSummaryInfo && !extraSummaryInfo.getAttribute("aria-live")) {
    extraSummaryInfo.setAttribute("aria-live", "polite");
    extraSummaryInfo.setAttribute("role", "status");
  }
  if (summaryInfo && !summaryInfo.getAttribute("aria-live")) {
    summaryInfo.setAttribute("aria-live", "polite");
    summaryInfo.setAttribute("role", "status");
  }
  if (ordersSummaryInfo && !ordersSummaryInfo.getAttribute("aria-live")) {
    ordersSummaryInfo.setAttribute("aria-live", "polite");
    ordersSummaryInfo.setAttribute("role", "status");
  }

  if (ordersPlannedDate && !ordersPlannedDate.value) {
    ordersPlannedDate.value = todayDateString();
  }

  const renderInstancesDebounced = debounce(renderInstancesTable, 80);

  ensureSelectionPopupInit();
  document.addEventListener("change", handleGlobalExtraBuyToggle, { capture: true });
  document.addEventListener("keydown", handleOrdersBatchKeydown, { capture: true });
  if (ordersTableBody) {
    ordersTableBody.addEventListener("input", handleOrdersInputChange);
    ordersTableBody.addEventListener("keydown", handleOrdersTableKeydown);
  }
  if (ordersBatchSelect) {
    ordersBatchSelect.addEventListener("change", updateOrdersBatchToggleLabel);
  }
  setSelectionButtonsVisibility(true);

  if (instancesMissingFilterButton) {
    instancesMissingFilterButton.classList.add("active");
    instancesMissingFilterButton.setAttribute("aria-pressed", "true");
    instancesMissingFilterButton.disabled = true;
  }

  if (window.ProductAutocomplete && typeof window.ProductAutocomplete.init === "function") {
    window.ProductAutocomplete.init({
      tableBody: instancesTableBody,
      getSuggestions: getProductAutocompleteSuggestions,
    });
  }

  const kickoffInit = () => runMainInit(tStart, renderInstancesDebounced, refs);
  setTimeout(kickoffInit, 0);
  return;
}

function runMainInit(tStart, renderInstancesDebounced, refsObj) {
  const bootRefs = refsObj || {};
  if (window.AppBootstrap) {
    window.AppBootstrap.initMainNav(bootRefs, {
      setMainSection,
      toggleAlmacenEditMode,
      toggleOtrosEditMode,
    });

    window.AppBootstrap.initFilters(bootRefs, {
      renderInstancesTable: renderInstancesDebounced,
      handleAddQuickProduct,
      handleAddQuickExtra,
      handleShoppingListClick,
      handleCopyList,
      handleExportBackup,
      handleBackupFileChange,
      handlePruneSelections,
      handleExportAlmacenCsv,
      handleExportOtrosCsv,
      handleExportStoresCsv,
      handleToggleShoppingPanel,
      triggerImportBackup: () => backupFileInput && backupFileInput.click(),
      handleOrdersStoreChange,
      handleAddOrderItem,
      handleAddOrderBatch,
      handleReplaceOrderBatch,
      handleNewOrder,
      handleDuplicateOrder,
      handleCompleteOrder,
      handleOrderMetaChange,
      handleOrdersFilterChange,
      handleOrdersDateFilterChange,
      handleOrdersSavedSearchInput,
      handleToggleOrdersBatchPanel,
      handleCloseOrdersBatchPanel,
      handleSaveOrders,
      handleClearOrder,
      handleDeleteOrder,
      handleOrdersTableClick,
      handleOrdersSavedClick,
      handleOrdersHistoryClick,
      handleOrdersPlannerClick,
      handleOrdersViewOperativeClick,
      handleOrdersViewCalendarClick,
      handleOrdersViewHistoryClick,
      handleOrdersCalendarClick,
      handleOrdersHistoryMetaChange,
    });

    window.AppBootstrap.initPopups(bootRefs, {
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
      [ordersFamilyFilterSelect, ordersTypeFilterSelect],
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

  const scheduleInitialSync = (state) => {
    scheduledInitialSync = state;
    if (scheduledInitialSyncHandle) return;
    const run = () => {
      scheduledInitialSyncHandle = null;
      const snap = scheduledInitialSync;
      scheduledInitialSync = null;
      syncFromState(snap, { force: true });
    };
    scheduledInitialSyncHandle = setTimeout(run, 0);
  };

  const syncFromState = (next, { force = false } = {}) => {
    if (!firstSyncDone && !force) {
      scheduleInitialSync(next);
      return;
    }
    if (suppressStoreSync) {
      suppressStoreSync = false;
      return;
    }
    isSyncingFromStore = true;
    applyStateSnapshot(next || {});
    ensureInstanceFamilies({ persist: false });
    isSyncingFromStore = false;
    runMeasured("renderShelfOptions", renderShelfOptions);
    runMeasured("renderBlockOptions", renderBlockOptions);
    runMeasured("renderTypeOptions", renderTypeOptions);
    runMeasured("renderStoreOptions", renderStoreOptions);
    runMeasured("updateProducerFilterOptions", updateProducerFilterOptions);
    runMeasured("updateStoreFilterOptions", updateStoreFilterOptions);
    runMeasured("updateInstanceFilterOptions", updateInstanceFilterOptions);
    runMeasured("renderProductsDatalist", renderProductsDatalist);

    if (inventoryController) {
      inventoryController.setDrafts(productDrafts);
      runMeasured("inventoryController.render", () => inventoryController.render());
    } else if (window.InventoryFeature && typeof window.InventoryFeature.render === "function") {
      runMeasured("InventoryFeature.render", () => window.InventoryFeature.render());
    } else {
      runMeasured("renderProducts", renderProducts);
    }
    // Render no críticos (otros tabs) se difieren a idle
    if (!isStoreActive()) {
      deferNonCriticalRenders();
    }
    renderProducers();
    renderStores();
    if (ordersSection) {
      const ordersActive = isActiveSection(ordersSection);
      if (ordersActive) {
        renderOrdersSection(true);
        ordersNeedsRender = false;
      } else {
        ordersNeedsRender = true;
      }
    }
    // deferir otros renders si no son críticos
    if (classificationSection?.classList?.contains("active")) {
      runMeasured("renderClassificationTable", renderClassificationTable);
    } else {
      deferNonCriticalRenders();
    }
    const instancesActive =
      isActiveSection(proveedoresSection) && instancesPanel?.classList?.contains("active");
    if (instancesActive) {
      renderInstancesTable(true);
      instancesNeedsRender = false;
    } else {
      instancesNeedsRender = true;
    }
    runMeasured("renderShoppingList", renderShoppingList);
    runMeasured("initResizableTables", initResizableTables);

    if (!filtersDefaultsApplied) {
      filtersDefaultsApplied = true;
      if (window.UIHelpers && typeof window.UIHelpers.resetFilters === "function") {
        runMeasured("resetFilters", () =>
          window.UIHelpers.resetFilters({
            filterSearchInput,
            filterShelfSelect,
            filterBlockSelect,
            filterTypeSelect,
            filterStoreSelect,
            filterProducerSelect,
            filterStatusSelect,
            editFilterSearchInput,
            editFilterFamilySelect,
            editFilterTypeSelect,
            editFilterShelfSelect,
            editFilterStoreSelect,
            editFilterProducerSelect,
            extraFilterSearchInput,
            extraFilterFamilySelect,
            extraFilterTypeSelect,
            extraFilterStoreSelect,
            extraFilterProducerSelect,
            extraFilterHaveSelect,
            extraFilterBuySelect,
            extraEditFilterSearchInput,
            extraEditFilterFamilySelect,
            extraEditFilterTypeSelect,
            extraEditFilterStoreSelect,
            extraEditFilterProducerSelect,
            extraEditFilterHaveSelect,
            instancesSearchInput,
            instancesFamilyFilterSelect,
            instancesProducerFilterSelect,
            instancesStoreFilterSelect,
            storesSearchInput,
            storesTypeFilterSelect,
            storesLocationFilterSelect,
            storesUsageFilterSelect,
            producersSearchInput,
            producersLocationFilterSelect,
            producersUsageFilterSelect,
            classificationSearchInput,
            classificationFamilyFilterSelect,
            classificationTypeFilterSelect,
          })
        );
      }
      // Render no críticos en idle
      deferNonCriticalRenders();
    }
    if (!firstSyncDone) {
      firstSyncDone = true;
      perfLog("DOMContentLoaded:end", performance.now() - tStart);
    }
  };

  if (window.AppStore && window.ViewControllers && typeof window.ViewControllers.create === "function") {
    window.ViewControllers.create(window.AppStore, { onState: syncFromState });
  } else if (window.AppState && typeof window.AppState.subscribe === "function") {
    scheduleInitialSync(window.AppState.getState());
    window.AppState.subscribe(syncFromState);
  }

  const deferNonCriticalRenders = () => {
    if (deferredIdleTasksHandle) return;
    deferredIdleTasksHandle = true;
    const tasks = [];
    if (!isStoreActive()) {
      tasks.push(() => runMeasured("renderGridRows", renderGridRows));
      tasks.push(() => runMeasured("renderExtraQuickTable", renderExtraQuickTable));
      tasks.push(() => runMeasured("renderExtraEditTable", renderExtraEditTable));
    }
    if (classificationSection && classificationSection.classList.contains("active")) {
      tasks.push(() => runMeasured("renderClassificationTable", renderClassificationTable));
    }

    const scheduleNext = () => {
      if (!tasks.length) {
        deferredIdleTasksHandle = null;
        return;
      }
      const next = tasks.shift();
      const exec = () => {
        next();
        scheduleNext();
      };
      setTimeout(exec, 0);
    };

    scheduleNext();
  };

  const initViewsPhase = () => {
    const tasks = [];
    let pendingInventoryFeatureConfig = null;
    const shouldInitClassification = classificationSection && classificationSection.classList.contains("active");
    const enqueue = (labelOrFn, fnMaybe) => {
      const isFnOnly = typeof labelOrFn === "function";
      const label = isFnOnly ? `task-${tasks.length + 1}` : labelOrFn;
      const fn = isFnOnly ? labelOrFn : fnMaybe;
      tasks.push({ label, fn });
    };
    const runNext = () => {
      if (!tasks.length) return;
      const { label, fn } = tasks.shift();
      setTimeout(() => {
        const t0 = performance.now();
        try {
          fn();
        } catch (err) {
          console.error(err);
        }
        perfLog(`initViews:${label}`, performance.now() - t0);
        runNext();
      }, 0);
    };

    enqueue("extras-view", () => {
      extrasViewContext = {
        refs: {
          tableBody: extraListTableBody,
          searchInput: extraFilterSearchInput,
          familyFilter: extraFilterFamilySelect,
          typeFilter: extraFilterTypeSelect,
          storeFilter: extraFilterStoreSelect,
          producerFilter: extraFilterProducerSelect,
          haveFilter: extraFilterHaveSelect,
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
            getFutureOrderLabel,
          },
        getSelectionInstanceForProduct,
        getStoreIdsForProduct,
        getProducerIdsForProduct,
        getStoreNames,
        persistUnified,
        getPantryProducts,
        onToggleBuy: updateExtraBuyFlag,
        onToggleHave: updateExtraHaveFlag,
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
        onFilter: () => {
          if (extraSummaryInfo) {
            renderExtraSummary();
          }
        },
        onSelectSelection: (id) => openSelectionPopupForProduct(id),
        onEdit: (id) => startEditExtra(id),
        onSaveDraft: (id) => commitDraftExtras(id ? [id] : null),
        onMoveToAlmacen: (id) => {
          const acts = getExtrasActions();
          if (acts && typeof acts.moveToAlmacen === "function") {
            acts.moveToAlmacen(id);
          }
          extraDrafts = extraDrafts.filter((d) => d.originalId !== id && d.id !== id);
          renderExtraQuickTable();
          renderExtraEditTable();
          renderProducts();
          renderGridRows();
          renderShoppingList();
        },
        onDelete: (id) => {
          const acts = getExtrasActions();
          if (acts && typeof acts.delete === "function") {
            acts.delete(id);
          }
          extraDrafts = extraDrafts.filter((d) => d.originalId !== id && d.id !== id);
          renderExtraQuickTable();
          renderExtraEditTable();
          renderProducts();
          renderGridRows();
          renderShoppingList();
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
    });

    enqueue("extra-edit-view", () => {
      extraEditViewContext = {
        refs: {
          tableBody: extraTableBody,
          addButton: addExtraRowButton,
          saveButton: saveExtraButton,
          searchInput: extraEditFilterSearchInput,
          familyFilter: extraEditFilterFamilySelect,
          typeFilter: extraEditFilterTypeSelect,
          storeFilter: extraEditFilterStoreSelect,
          producerFilter: extraEditFilterProducerSelect,
          haveFilter: extraEditFilterHaveSelect,
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
          const product = getOtherProducts().find((p) => p.id === id);
          if (!product) return true;
          return productMatchesStore(product, storeId);
        },
        matchesProducer: (id, producerId) => {
          const product = getOtherProducts().find((p) => p.id === id);
          if (!product) return true;
          return productMatchesProducer(product, producerId);
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
          getFutureOrderLabel,
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
          extraDrafts = extraDrafts.filter((d) => d.originalId !== id && d.id !== id);
          renderExtraQuickTable();
          renderExtraEditTable();
          renderProducts();
          renderGridRows();
          renderShoppingList();
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
    });

    enqueue("inventory-edit-view", () => {
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
          producerFilter: editFilterProducerSelect,
          rowTemplate: inventoryEditRowTemplate,
        },
        getProducts: () => getPantryProducts(),
        findById: (id) => getPantryProducts().find((p) => p.id === id),
        buildFamilyStripeMap,
        sorter: compareShelfBlockTypeName,
        matchesStore: (id, storeId) => {
          const product = getPantryProducts().find((p) => p.id === id);
          if (!product) return true;
          return productMatchesStore(product, storeId);
        },
        matchesProducer: (id, producerId) => {
          const product = getPantryProducts().find((p) => p.id === id);
          if (!product) return true;
          return productMatchesProducer(product, producerId);
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
          getFutureOrderLabel,
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
    });

    enqueue("classification-view", () => {
      if (shouldInitClassification) {
        classificationViewContext = {
          refs: {
            tableBody: classificationTableBody,
            addButton: addClassificationButton,
            saveButton: saveClassificationsButton,
            rowTemplate: classificationRowTemplate,
            summary: classificationSummaryInfo,
            searchInput: classificationSearchInput,
            familyFilter: classificationFamilyFilterSelect,
            typeFilter: classificationTypeFilterSelect,
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
        updateClassificationFilterOptions();
        classificationInitDone = true;
      }
    });

    enqueue("producers-view", () => {
      producersViewContext = {
        refs: {
          tableBody: producersTableBody,
          addButton: addProducerButton,
          saveButton: saveProducersButton,
          searchInput: producersSearchInput,
          locationFilter: producersLocationFilterSelect,
          usageFilter: producersUsageFilterSelect,
          rowTemplate: producersRowTemplate,
          summary: producersSummaryInfo,
        },
        getProducers: () => getProducersList(),
        getUsedProducerIds: () => getUsedProducerIdsSet(),
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
    });

    enqueue("stores-view", () => {
      storesViewContext = {
        refs: {
          tableBody: storesTableBody,
          addButton: addStoreButton,
          saveButton: saveStoresButton,
          searchInput: storesSearchInput,
          typeFilter: storesTypeFilterSelect,
          locationFilter: storesLocationFilterSelect,
          usageFilter: storesUsageFilterSelect,
          rowTemplate: storesRowTemplate,
          summary: storesSummaryInfo,
        },
        getStores: () => getSuppliersList(),
        getUsedStoreIds: () => getUsedStoreIdsSet(),
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
    });

    enqueue("instances-view", () => {
      ensureInstancesViewContext();
      const activeSelection =
        isActiveSection(proveedoresSection) &&
        instancesPanel &&
        instancesPanel.classList.contains("active");
      if (activeSelection) {
        ensureInstancesViewInit({ renderAfterInit: false });
      } else {
        instancesViewInitDone = false;
      }
    });

    enqueue("inventory-controller", () => {
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
                productMatchesProducer,
                getSelectionLabelForProduct,
                getSelectionStoresForProduct,
                createSelectionButton,
                getFutureOrderLabel,
                handleInventoryTableClick,
              },
              shouldSkip: () =>
                Date.now() < skipInventoryControllerUntil || !!pendingInventoryUnified,
            })
          : null;

      if (inventoryController) {
        const inventoryRefs = {
          productTableBody,
          filterSearchInput,
          filterShelfSelect,
          filterBlockSelect,
          filterTypeSelect,
          filterStoreSelect,
          filterProducerSelect,
          filterStatusSelect,
          summaryInfo,
        };
        inventoryViewContext = { refs: inventoryRefs };
        inventoryController.setRefs(inventoryRefs);
        inventoryController.setDrafts(productDrafts);
        inventoryController.render();
      } else if (window.InventoryFeature && typeof window.InventoryFeature.init === "function") {
        pendingInventoryFeatureConfig = {
          refs: {
            tableBody: productTableBody,
          },
          getProducts: () => getPantryProducts(),
          getDrafts: () => productDrafts,
          getInventoryContext,
          actions: {
            toggleHave: (id, checked) => updateInventoryHaveFlag(id, checked),
            moveToExtra: moveProductToExtra,
            selectSelection: openSelectionPopupForProduct,
            cancelDraft: (id) => {
              setProductDrafts(productDrafts.filter((d) => d.id !== id));
              renderProducts();
            },
            saveDraft: (id) => commitDraftProducts(id ? [id] : null),
            startEdit: (id) => startEditProduct(id),
            deleteProduct: (id) => deleteProduct(id),
          },
        };
      }
    });

    enqueue("inventory-feature-fallback", () => {
      if (!inventoryController && pendingInventoryFeatureConfig) {
        window.InventoryFeature.init(pendingInventoryFeatureConfig);
        if (typeof window.InventoryFeature.render === "function") {
          window.InventoryFeature.render();
        }
        pendingInventoryFeatureConfig = null;
      }
    });

    enqueue("extras-controller", () => {
      extraController =
        window.ExtraController && window.ExtraController.create
          ? window.ExtraController.create({
              store: window.AppStore || window.AppState,
              shouldSkip: () =>
                Date.now() < skipExtraControllerUntil || !!pendingExtrasUnified,
              onRender: () => {
                if (Date.now() < skipExtraControllerUntil) return;
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
            getFutureOrderLabel,
          },
          getSelectionInstanceForProduct,
          getStoreNames,
          persistUnified,
          getPantryProducts,
          onChange: () => {
            renderExtraSummary();
            renderShoppingList();
          },
          actions: {
            toggleHave: (id, checked) => {
              updateExtraHaveFlag(id, checked);
            },
            toggleBuy: (id, checked) => {
              updateExtraBuyFlag(id, checked);
            },
            selectSelection: (id) => openSelectionPopupForProduct(id),
            startEdit: (id) => startEditExtra(id),
            saveDraft: (id) => commitDraftExtras(id ? [id] : null),
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
    });

    enqueue("instances-controller", () => {
      instancesController =
        window.InstancesController && window.InstancesController.create
          ? window.InstancesController.create({
              store: window.AppStore || window.AppState,
              view: window.InstancesView,
              feature: window.InstancesFeature,
              context: {
                ...(instancesViewContext || {}),
                shouldRender: () =>
                  isActiveSection(proveedoresSection) &&
                  instancesPanel &&
                  instancesPanel.classList.contains("active"),
              },
            })
          : null;

      const activeSelection =
        proveedoresSection &&
        proveedoresSection.classList.contains("active") &&
        instancesPanel &&
        instancesPanel.classList.contains("active");
      if (activeSelection) {
        ensureInstancesViewInit();
        ensureInstancesFeatureInit();
      }

      instancesNeedsRender = true;
    });

    enqueue("controllers", () => {
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
                renderProducers();
                updateProducerFilterOptions();
              },
            })
          : null;

      storesController =
        window.StoresController && window.StoresController.create
          ? window.StoresController.create({
              store: window.AppStore || window.AppState,
              onRender: () => {
                renderStores();
                updateStoreFilterOptions();
                renderStoreOptions();
                renderShoppingList();
              },
            })
          : null;
    });

    enqueue("bootstrap", () => {
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

    runNext();
  };

  setTimeout(initViewsPhase, 0);
}
document.addEventListener("DOMContentLoaded", () => {
  const start = performance.now();
  const runInit = () => initAfterDom(start);
  setTimeout(runInit, 0);
});

// ==============================
//  NAVEGACIÓN Y MODOS
// ==============================

const isActiveSection = (el) => !!(el && el.classList && el.classList.contains("active"));

function setMainSection(section) {
  const isAlmacen = section === "almacen";
  const isOtros = section === "otros";
  const isSelection = section === "selection";
  const isClassification = section === "classification";
  const isProd = section === "producers";
  const isStores = section === "stores";
  const isOrders = section === "orders";
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
  if (mainOrdersButton) mainOrdersButton.classList.toggle("active", isOrders);
  setAriaCurrent(mainSelectionButton, isSelection);
  setAriaCurrent(mainClassificationButton, isClassification);
  setAriaCurrent(mainProducersButton, isProd);
  setAriaCurrent(mainStoresButton, isStores);
  setAriaCurrent(mainOrdersButton, isOrders);

  almacenSection.classList.toggle("active", isAlmacen);
  otrosSection.classList.toggle("active", isOtros);
  if (classificationSection)
    classificationSection.classList.toggle("active", isClassification);
  proveedoresSection.classList.toggle("active", isProveedores);
  if (ordersSection) ordersSection.classList.toggle("active", isOrders);
  if (backupSection && activeSidePanel === "backup") {
    backupSection.classList.add("active");
  }
  if (shoppingSection && activeSidePanel === "shopping") {
    shoppingSection.classList.add("active");
  }

  if (isSelection) setProveedoresTab("instances");
  if (isProd) setProveedoresTab("producers");
  if (isStores) setProveedoresTab("stores");
  if (isClassification && !classificationInitDone) {
    initClassificationOnDemand();
  }
  if (isOrders && ordersNeedsRender) {
    renderOrdersSection(true);
  }
  if (isOtros) {
    if (otrosEditPanel && otrosEditPanel.classList.contains("active")) {
      renderExtraEditTable();
    } else {
      renderExtraQuickTable(true);
    }
  }
}

function initClassificationOnDemand() {
  if (classificationInitDone) return;
  classificationViewContext = {
    refs: {
      tableBody: classificationTableBody,
      addButton: addClassificationButton,
      saveButton: saveClassificationsButton,
      rowTemplate: classificationRowTemplate,
      summary: classificationSummaryInfo,
      searchInput: classificationSearchInput,
      familyFilter: classificationFamilyFilterSelect,
      typeFilter: classificationTypeFilterSelect,
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
  updateClassificationFilterOptions();
  classificationInitDone = true;
}

function ensureInstancesViewContext() {
  if (!instancesViewContext) {
    instancesViewContext = {
      refs: {
        tableBody: instancesTableBody,
        addButton: addInstanceButton,
        saveButton: saveInstancesButton,
        searchInput: instancesSearchInput,
        familyFilter: instancesFamilyFilterSelect,
        producerFilter: instancesProducerFilterSelect,
        storeFilter: instancesStoreFilterSelect,
        missingFilterButton: instancesMissingFilterButton,
        rowTemplate: instancesRowTemplate,
        summary: instancesSummaryInfo,
      },
      attachButtonHandlers:
        !(window.InstancesFeature && typeof window.InstancesFeature.init === "function"),
      data: {
        instances: [],
        producers: [],
        stores: [],
      },
      getAllProducts: () => getAllProductsForAssociationList(),
      getFamilyForInstance,
      getProducerName,
      getStoreNames,
      isKnownProduct,
      getFamilyByProductName,
      buildFamilyStripeMap,
      attachMultiSelectToggle,
      persist: persistInstances,
      onCreateProduct: openInlineProductCreator,
      onAfterSave: handleInstancesDependencies,
      nowIsoString,
      onlyMissingMode: true,
      getMissingFilterActive: () => instancesMissingFilterActive,
    };
  }
  if (instancesViewContext.data) {
    instancesViewContext.data.instances = getInstancesList();
    instancesViewContext.data.producers = getProducersList();
    instancesViewContext.data.stores = getSuppliersList();
  }
  return instancesViewContext;
}

function ensureInstancesFeatureInit({ renderAfterInit = false } = {}) {
  if (instancesInitDone) {
    if (renderAfterInit && window.InstancesFeature && typeof window.InstancesFeature.render === "function") {
      window.InstancesFeature.render();
    }
    return;
  }
  if (!window.InstancesFeature || typeof window.InstancesFeature.init !== "function") {
    instancesInitDone = true;
    return;
  }
  ensureInstancesViewContext();
  window.InstancesFeature.init({
    refs: {
      tableBody: instancesTableBody,
      addButton: addInstanceButton,
      saveButton: saveInstancesButton,
    },
    getContext: () => {
      const ctx = ensureInstancesViewContext();
      if (ctx && ctx.data) {
        ctx.data.instances = getInstancesList();
        ctx.data.producers = getProducersList();
        ctx.data.stores = getSuppliersList();
      }
      return ctx;
    },
    getInstances: () => getInstancesList(),
    actions: {
      delete: (id) => removeInstanceById(id),
      updateField: (id, field, value) => {
        const ctx = ensureInstancesViewContext();
        if (ctx) {
          ctx.__skipNextRender = true;
        }
        const now = nowIsoString();
        const baseList = pendingInstancesList || getInstancesList();
        const idx = baseList.findIndex((inst) => inst.id === id);
        const normalizedValue = field === "storeIds" && Array.isArray(value) ? value.slice() : value;
        if (idx === -1) {
          const newInst = {
            id,
            productId: "",
            productName: "",
            producerId: "",
            brand: "",
            storeIds: [],
            notes: "",
            block: "",
            createdAt: now,
            updatedAt: now,
            __isNew: true,
          };
          if (field === "storeIds" && Array.isArray(normalizedValue)) {
            newInst.storeIds = normalizedValue;
          } else {
            newInst[field] = normalizedValue;
          }
          pendingInstancesList = [newInst, ...baseList];
        } else {
          const current = baseList[idx];
          const currentValue =
            field === "storeIds" && Array.isArray(current.storeIds) ? current.storeIds : current[field];
          const sameArray =
            field === "storeIds" &&
            Array.isArray(normalizedValue) &&
            Array.isArray(currentValue) &&
            normalizedValue.length === currentValue.length &&
            normalizedValue.every((v, i) => v === currentValue[i]);
          const sameValue = field === "storeIds" ? sameArray : normalizedValue === currentValue;
          if (sameValue) return;

          if (pendingInstancesList) {
            const target = pendingInstancesList[idx];
            if (field === "storeIds" && Array.isArray(normalizedValue)) {
              target.storeIds = normalizedValue;
            } else {
              target[field] = normalizedValue;
            }
            target.updatedAt = now;
          } else {
            const clone = baseList.slice();
            clone[idx] = {
              ...current,
              [field]: field === "storeIds" && Array.isArray(normalizedValue) ? normalizedValue : normalizedValue,
              updatedAt: now,
            };
            pendingInstancesList = clone;
          }
        }
        clearTimeout(instancesUpdateTimer);
        instancesUpdateTimer = setTimeout(() => {
          flushInstancesUpdates();
        }, INSTANCE_UPDATE_DEBOUNCE);
      },
      add: () => handleAddInstanceRow(),
      save: () => handleSaveInstances(),
    },
  });
  instancesInitDone = true;
  if (renderAfterInit && typeof window.InstancesFeature.render === "function") {
    window.InstancesFeature.render();
  }
}

function ensureInstancesViewInit({ renderAfterInit = false } = {}) {
  if (instancesViewInitDone) {
    if (renderAfterInit && window.InstancesView && typeof window.InstancesView.render === "function") {
      window.InstancesView.render(ensureInstancesViewContext());
    }
    return;
  }
  ensureInstancesViewContext();
  if (window.InstancesView && typeof window.InstancesView.init === "function") {
    window.InstancesView.init(instancesViewContext);
    instancesViewInitDone = true;
    if (renderAfterInit && typeof window.InstancesView.render === "function") {
      window.InstancesView.render(instancesViewContext);
    }
  }
}


function setSidePanel(panel) {
  const normalized = panel === activeSidePanel ? "" : panel;
  activeSidePanel = normalized;
  const backupActive = normalized === "backup";
  const shoppingActive = normalized === "shopping";

  if (backupSection) backupSection.classList.toggle("active", backupActive);
  if (shoppingSection) shoppingSection.classList.toggle("active", shoppingActive);
  if (shoppingActive && shoppingNeedsRender) {
    renderShoppingList(true);
  }

  if (mainBackupButton) {
    mainBackupButton.classList.toggle("active", backupActive);
    if (backupActive) mainBackupButton.setAttribute("aria-current", "page");
    else mainBackupButton.removeAttribute("aria-current");
  }
  if (mainShoppingButton) {
    mainShoppingButton.classList.toggle("active", shoppingActive);
    if (shoppingActive) mainShoppingButton.setAttribute("aria-current", "page");
    else mainShoppingButton.removeAttribute("aria-current");
  }
  const main = document.querySelector(".app-main");
  if (main) {
    if (backupActive || shoppingActive) {
      main.classList.add("side-panel-open");
    } else {
      main.classList.remove("side-panel-open");
    }
  }
}

window.setSidePanel = setSidePanel;

function setAlmacenMode(editMode) {
  if (editMode) {
    renderGridRows();
  }
  document.body.classList.toggle("almacen-edit-mode", !!editMode);
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
  otrosListPanel.classList.toggle("active", !editMode);
  otrosEditPanel.classList.toggle("active", editMode);
  const sectionVisible = isActiveSection(otrosSection);
  if (editMode && sectionVisible) {
    renderExtraEditTable();
  } else if (!editMode && sectionVisible) {
    renderExtraQuickTable(true);
  }
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

function clearInstancesWarmup() {
  if (!instancesWarmupHandle) return;
  if (instancesWarmupHandleType === "idle" && typeof cancelIdleCallback === "function") {
    cancelIdleCallback(instancesWarmupHandle);
  } else {
    clearTimeout(instancesWarmupHandle);
  }
  instancesWarmupHandle = null;
  instancesWarmupHandleType = "";
}

function scheduleInstancesRender({ force = false, immediate = false, replace = false, showLoading = true } = {}) {
  if (instancesWarmupHandle && !replace) return;
  if (replace) clearInstancesWarmup();
  const activeInstancesTab =
    isActiveSection(proveedoresSection) && instancesPanel && instancesPanel.classList.contains("active");
  const run = () => {
    clearInstancesWarmup();
    ensureInstancesViewContext();
    ensureInstancesViewInit({ renderAfterInit: false });
    ensureInstancesFeatureInit({ renderAfterInit: false });
    renderInstancesTable(force, { showLoading });
    instancesNeedsRender = false;
    instancesWarmupDone = true;
  };
  if (immediate || activeInstancesTab) {
    run();
    return;
  }
  if (typeof requestIdleCallback === "function") {
    instancesWarmupHandle = requestIdleCallback(run, { timeout: INSTANCES_WARMUP_IDLE_TIMEOUT });
    instancesWarmupHandleType = "idle";
  } else {
    instancesWarmupHandle = setTimeout(run, 0);
    instancesWarmupHandleType = "timeout";
  }
}

function markInstancesLoading() {
  if (instancesSummaryInfo) {
    instancesSummaryInfo.textContent = "Cargando selecciones...";
  }
}

function setProveedoresTab(tab) {
  const isProd = tab === "producers";
  const isStores = tab === "stores";
  const isInstances = tab === "instances";
  const proveedoresVisible = isActiveSection(proveedoresSection);

  producersPanel.classList.toggle("active", isProd);
  storesPanel.classList.toggle("active", isStores);
  instancesPanel.classList.toggle("active", isInstances);

  if (isProd && producersNeedsRender) {
    renderProducers(true);
  }
  if (isStores && storesNeedsRender) {
    renderStores(true);
  }
  if (isInstances && proveedoresVisible) {
    if (instancesNeedsRender || !instancesWarmupDone) {
      markInstancesLoading();
      scheduleInstancesRender({ force: true, replace: true, immediate: true, showLoading: true });
    }
  } else if (isInstances) {
    instancesNeedsRender = true;
  }
}

function handleToggleShoppingPanel() {
  const main = document.querySelector(".app-main");
  if (!main) return;
  const hidden = main.classList.toggle("shopping-hidden");
  toggleShoppingPanelButton.textContent = "🛒";
  toggleShoppingPanelButton.title = hidden
    ? "Mostrar lista de la compra"
    : "Ocultar lista de la compra";
  if (!hidden && shoppingNeedsRender) {
    renderShoppingList(true);
  }
}

function resetInstancesFilters() {
  if (instancesSearchInput) instancesSearchInput.value = "";
  if (instancesFamilyFilterSelect) instancesFamilyFilterSelect.value = "";
  if (instancesProducerFilterSelect) instancesProducerFilterSelect.value = "";
  if (instancesStoreFilterSelect) instancesStoreFilterSelect.value = "";
  instancesMissingFilterActive = true;
  if (instancesMissingFilterButton) {
    instancesMissingFilterButton.classList.add("active");
    instancesMissingFilterButton.setAttribute("aria-pressed", "true");
    instancesMissingFilterButton.disabled = true;
  }
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
  const t0 = performance.now();
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
    const tLoad = performance.now();
    let snapshot = null;
    try {
      snapshot = typeof load === "function" ? load() : null;
    } catch {
      snapshot = null;
    }
    perfLog("loadAllData:loader", performance.now() - tLoad);
    if (hasSnapshotData(snapshot)) {
      applyStateSnapshot(snapshot);
      ensureInstanceFamilies({ persist: false });
      perfLog("loadAllData:applied", performance.now() - t0);
      return;
    }
  }

  unifiedProducts = [];
  unifiedDirty = true;
  refreshProductsFromUnified();
  perfLog("loadAllData:emptyState", performance.now() - t0);
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

function dateValue(str = "") {
  const s = (str || "").trim();
  if (!s) return NaN;
  const parts = s.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts.map((p) => parseInt(p, 10));
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return new Date(y, m - 1, d).getTime();
    }
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : NaN;
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

function findProductByName(name = "") {
  const lower = name.trim().toLowerCase();
  if (!lower) return null;
  const all = getUnifiedList();
  return all.find((p) => (p.name || "").trim().toLowerCase() === lower) || null;
}

function findProductByNameWithScope(name = "", scopeHint = "") {
  const lower = name.trim().toLowerCase();
  if (!lower) return null;
  const all = getUnifiedList();
  if (scopeHint) {
    const scoped = all.find(
      (p) => (p.name || "").trim().toLowerCase() === lower && p.scope === scopeHint
    );
    if (scoped) return scoped;
  }
  return all.find((p) => (p.name || "").trim().toLowerCase() === lower) || null;
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
  const normalized = String(id || "");
  const p = getProducersList().find((x) => String(x.id || "") === normalized);
  return p ? p.name || "" : "";
}

function getStoreName(id) {
  const normalized = String(id || "");
  const s = getSuppliersList().find((x) => String(x.id || "") === normalized);
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

function updateClassificationFilterOptions() {
  if (!classificationFamilyFilterSelect || !classificationTypeFilterSelect) return;
  const families = getClassificationFamilies();
  const currentFamily = classificationFamilyFilterSelect.value;
  classificationFamilyFilterSelect.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "Todas";
  classificationFamilyFilterSelect.appendChild(optAll);
  families.forEach((fam) => {
    const o = document.createElement("option");
    o.value = fam;
    o.textContent = fam;
    classificationFamilyFilterSelect.appendChild(o);
  });
  if (families.includes(currentFamily)) {
    classificationFamilyFilterSelect.value = currentFamily;
  }

  const selectedFamily = classificationFamilyFilterSelect.value;
  const types = selectedFamily
    ? getClassificationTypes(selectedFamily)
    : getClassificationTypes();
  const currentType = classificationTypeFilterSelect.value;
  classificationTypeFilterSelect.innerHTML = "";
  const optAllType = document.createElement("option");
  optAllType.value = "";
  optAllType.textContent = "Todos";
  classificationTypeFilterSelect.appendChild(optAllType);
  types.forEach((t) => {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = t;
    classificationTypeFilterSelect.appendChild(o);
  });
  if (types.includes(currentType)) {
    classificationTypeFilterSelect.value = currentType;
  }
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

function resolveInstanceType(inst) {
  if (!inst) return "";
  if (inst.type) return inst.type;

  if (inst.productId) {
    const prod = findProductById(inst.productId);
    if (prod && prod.type) return prod.type;
  }

  const name = (inst.productName || "").trim().toLowerCase();
  if (!name) return "";

  const all = getUnifiedList();
  const list = all.length ? all : recomputeUnifiedFromDerived();
  const exact = list.find((p) => (p.name || "").trim().toLowerCase() === name);
  if (exact && exact.type) return exact.type;

  const partial = list.find((p) => {
    const pname = (p.name || "").trim().toLowerCase();
    return pname && (pname.includes(name) || name.includes(pname));
  });
  if (partial && partial.type) return partial.type;
  return "";
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

function getInstancesForProduct(product) {
  if (!product) return [];
  const nameLower = (product.name || "").trim().toLowerCase();
  return getInstancesList().filter((inst) => {
    if (inst.productId && inst.productId === product.id) return true;
    const instName = (inst.productName || "").trim().toLowerCase();
    return nameLower && instName && instName === nameLower;
  });
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

function getStoreIdsForProduct(product) {
  if (!product) return [];
  const ids = new Set();
  const addIds = (list) => {
    if (!Array.isArray(list)) return;
    list.forEach((id) => {
      const normalized = String(id || "").trim();
      if (normalized) ids.add(normalized);
    });
  };

  const inst = getSelectionInstanceForProduct(product);
  addIds(inst?.storeIds);

  // Buscar en cualquier instancia asociada al producto (misma id o mismo nombre)
  const nameLower = (product.name || "").trim().toLowerCase();
  const instances = getInstancesList();
  instances.forEach((pi) => {
    const sameId = pi.productId && pi.productId === product.id;
    const sameName =
      nameLower && (pi.productName || "").trim().toLowerCase() === nameLower;
    if ((sameId || sameName) && Array.isArray(pi.storeIds)) {
      addIds(pi.storeIds);
    }
  });

  return Array.from(ids);
}

function getProducerIdsForProduct(product) {
  if (!product) return [];
  const ids = new Set();
  const addId = (id) => {
    const normalized = String(id || "").trim();
    if (normalized) ids.add(normalized);
  };

  const inst = getSelectionInstanceForProduct(product);
  addId(inst?.producerId);

  const nameLower = (product.name || "").trim().toLowerCase();
  const productId = String(product.id || "").trim();
  const instances = getInstancesList();
  instances.forEach((pi) => {
    const sameId = productId && String(pi.productId || "").trim() === productId;
    const sameName =
      nameLower && (pi.productName || "").trim().toLowerCase() === nameLower;
    if (sameId || sameName) {
      addId(pi.producerId);
    }
  });

  return Array.from(ids);
}

function productMatchesStore(product, storeId) {
  const target = String(storeId || "").trim();
  if (!target) return true;
  const storeIds = getStoreIdsForProduct(product);
  return storeIds.includes(target);
}

function productMatchesProducer(product, producerId) {
  const target = String(producerId || "").trim();
  if (!target) return true;
  const producerIds = getProducerIdsForProduct(product);
  return producerIds.includes(target);
}

function getUsedProducerIdsSet() {
  const used = new Set();
  const allProducts = [...getPantryProducts(), ...getOtherProducts()];
  allProducts.forEach((product) => {
    getProducerIdsForProduct(product).forEach((id) => {
      const normalized = String(id || "").trim();
      if (normalized) used.add(normalized);
    });
  });
  return used;
}

function getUsedStoreIdsSet() {
  const used = new Set();
  const allProducts = [...getPantryProducts(), ...getOtherProducts()];
  allProducts.forEach((product) => {
    getStoreIdsForProduct(product).forEach((id) => {
      const normalized = String(id || "").trim();
      if (normalized) used.add(normalized);
    });
  });
  return used;
}

function createSelectionButton(selectionId, id) {
  const btn = document.createElement("button");
  btn.className = "btn btn-small btn-icon";
  btn.dataset.action = "select-selection";
  btn.dataset.id = id;
  btn.dataset.selectionBtn = "1";
  const hasSel = !!getSelectionInstanceForProduct({ selectionId, id });
  btn.textContent = hasSel ? "⟳" : "+";
  btn.title = hasSel ? "Cambiar selección" : "Añadir selección";
  btn.classList.toggle("btn-selection-empty", !hasSel);
  btn.classList.toggle("btn-selection-update", hasSel);
  applySelectionButtonVisibility(btn);
  return btn;
}

function applySelectionButtonVisibility(btn) {
  if (!btn) return;
  if (selectionButtonsVisible) {
    btn.style.visibility = "";
    btn.style.pointerEvents = "";
    btn.classList.remove("selection-btn-hidden");
  } else {
    btn.style.visibility = "hidden";
    btn.style.pointerEvents = "none";
    btn.classList.add("selection-btn-hidden");
  }
}

function setSelectionButtonsVisibility(visible) {
  selectionButtonsVisible = !!visible;
  document
    .querySelectorAll('[data-selection-btn="1"]')
    .forEach((btn) => applySelectionButtonVisibility(btn));
}

function getNextInstancePriority(product) {
  const list = getInstancesForProduct(product);
  if (!Array.isArray(list) || list.length === 0) return 0;
  const priorities = list
    .map((inst) => Number(inst && inst.priority))
    .map((n) => (Number.isFinite(n) ? n : 0));
  return Math.max(...priorities, 0) + 1;
}

function createEmptySelectionInstance(product, producerId, brand, storeIds) {
  if (!product) return null;
  const nextPriority = getNextInstancePriority(product);
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
    priority: nextPriority,
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
  renderProducers();
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
    ordersFavorite: false,
    createdAt: now,
    updatedAt: now,
  };
  setSuppliersList([...getSuppliersList(), store]);
  renderStores();
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
    const priorityVal = Number(inst.priority);
    const instPriority = Number.isFinite(priorityVal) ? priorityVal : 0;

    if (!map.has(key)) {
      const copy = {
        ...inst,
        storeIds: Array.from(new Set(storeIds)),
        priority: instPriority,
      };
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
    const existingPriority = Number.isFinite(existing.priority) ? existing.priority : null;
    existing.priority =
      existingPriority === null ? instPriority : Math.min(existingPriority, instPriority);
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

  if (selectionPopupTitle) {
    selectionPopupTitle.textContent = "Cargando selección...";
  }
  if (selectionPopupList) {
    selectionPopupList.innerHTML = "";
    const loading = document.createElement("li");
    loading.className = "selection-popup-item selection-popup-loading";
    loading.textContent = "Cargando...";
    selectionPopupList.appendChild(loading);
  }

  const run = () => {
    if (!selectionPopupOverlay || !selectionPopup || !selectionPopupList) return;
    const showError = (msg) => {
      selectionPopupList.innerHTML = "";
      const li = document.createElement("li");
      li.className = "selection-popup-item";
      li.textContent = msg || "No se pudieron cargar las selecciones.";
      selectionPopupList.appendChild(li);
    };

    let inlineSelectionEditId = "";
    let inlineSelectionSaveBtn = null;
    let inlineSelectionCancelBtn = null;
    let inlineSelectionBrandInput = null;
    let inlineSelectionProducerSel = null;
  let inlineSelectionStoresSel = null;

  const setInlineStoresSelection = (storeIds) => {
    if (!inlineSelectionStoresSel) return;
    const ids = Array.isArray(storeIds) ? storeIds : [];
    ids.forEach((id) => {
      const exists = Array.from(inlineSelectionStoresSel.options).some(
        (o) => o.value === id
      );
      if (!exists && id) {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = getStoreName(id) || "(tienda no disponible)";
        inlineSelectionStoresSel.appendChild(opt);
      }
    });
    Array.from(inlineSelectionStoresSel.options).forEach((opt) => {
      opt.selected = ids.includes(opt.value);
    });
    inlineSelectionStoresSel.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const updateInlineSelectionUi = (inst) => {
    const editing = !!inlineSelectionEditId;
    if (inlineSelectionSaveBtn) {
      inlineSelectionSaveBtn.title = editing
        ? "Guardar cambios"
        : "Crear selección y aplicar";
      inlineSelectionSaveBtn.setAttribute(
        "aria-label",
        editing ? "Guardar cambios" : "Crear selección y aplicar"
      );
    }
    if (inlineSelectionCancelBtn) {
      inlineSelectionCancelBtn.style.display = editing ? "inline-flex" : "none";
    }
  };

  const resetInlineSelectionForm = () => {
    inlineSelectionEditId = "";
    if (inlineSelectionProducerSel) inlineSelectionProducerSel.value = "";
    if (inlineSelectionBrandInput) inlineSelectionBrandInput.value = "";
    setInlineStoresSelection([]);
    updateInlineSelectionUi();
  };

  const startInlineSelectionEdit = (inst) => {
    if (!inst) return;
    inlineSelectionEditId = inst.id || "";
    if (inlineSelectionProducerSel) {
      const exists = Array.from(inlineSelectionProducerSel.options).some(
        (o) => o.value === inst.producerId
      );
      if (!exists && inst.producerId) {
        const opt = document.createElement("option");
        opt.value = inst.producerId;
        opt.textContent = getProducerName(inst.producerId) || "(productor no disponible)";
        inlineSelectionProducerSel.appendChild(opt);
      }
      inlineSelectionProducerSel.value = inst.producerId || "";
    }
    if (inlineSelectionBrandInput) {
      inlineSelectionBrandInput.value = inst.brand || "";
    }
    setInlineStoresSelection(inst.storeIds);
    updateInlineSelectionUi(inst);
    if (inlineSelectionBrandInput) {
      inlineSelectionBrandInput.focus();
      const len = inlineSelectionBrandInput.value.length;
      try {
        inlineSelectionBrandInput.setSelectionRange(len, len);
      } catch {}
    }
    const form = document.getElementById("inlineSelectionForm");
    if (form) form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const saveInlineSelectionEdit = () => {
    if (!inlineSelectionEditId) {
      createAndApplySelection(productId);
      return;
    }
    const list = getInstancesList();
    const idx = list.findIndex((i) => i.id === inlineSelectionEditId);
    if (idx === -1) {
      showToast("No se encontró la selección a editar", "error");
      resetInlineSelectionForm();
      return;
    }
    const now = nowIsoString();
    const updated = {
      ...list[idx],
      producerId: inlineSelectionProducerSel ? inlineSelectionProducerSel.value : "",
      brand: inlineSelectionBrandInput ? inlineSelectionBrandInput.value.trim() : "",
      storeIds: inlineSelectionStoresSel
        ? Array.from(inlineSelectionStoresSel.selectedOptions)
            .map((o) => o.value)
            .filter(Boolean)
        : list[idx].storeIds || [],
      updatedAt: now,
    };
    persistInstances(list.map((i) => (i.id === inlineSelectionEditId ? updated : i)));
    refreshInstancesViews({ immediate: false });
    showToast("Selección actualizada", "success");
    resetInlineSelectionForm();
    openSelectionPopupForProduct(productId);
  };

  const product = findProductById(productId);
  if (!product) {
    showError("No se encontró el producto seleccionado.");
    if (selectionPopup) selectionPopupTitle.textContent = "Selección";
    return;
  }
  const currentSelectionId = product.selectionId || "";
  const nameLower = (product.name || "").trim().toLowerCase();
  const applyOrderChange = (orderedIds) => {
    const ids = Array.isArray(orderedIds) ? orderedIds : [];
    const list = getInstancesList();
    let nextPriority = ids.length;
    const updated = list.map((inst) => {
      const matches =
        inst.productId === productId ||
        (nameLower && (inst.productName || "").trim().toLowerCase() === nameLower);
      if (!matches) return inst;
      const pos = ids.indexOf(inst.id);
      const priority = pos === -1 ? nextPriority++ : pos;
      return { ...inst, priority };
    });
    persistInstances(updated, { allowClear: true });
  };

  const isPantry = products.some((p) => p.id === productId);
  const sourceLabel = isPantry ? "Almacén" : "Otros productos";

  const getCurrentItems = () =>
    selectionPopupList
      ? Array.from(selectionPopupList.querySelectorAll(".selection-popup-item[data-id]"))
      : [];

  const getCurrentOrder = () => getCurrentItems().map((li) => li.dataset.id).filter(Boolean);

  const updateIndicesAndButtons = () => {
    const items = getCurrentItems();
    items.forEach((li, idx) => {
      const badge = li.querySelector(".selection-item-index");
      if (badge) badge.textContent = `${idx + 1}.`;
      const up = li.querySelector("[data-role='move-up']");
      const down = li.querySelector("[data-role='move-down']");
      if (up) up.disabled = idx === 0;
      if (down) down.disabled = idx === items.length - 1;
    });
  };

  const moveItem = (li, delta) => {
    if (!selectionPopupList || !li || !delta) return;
    const items = getCurrentItems();
    const from = items.indexOf(li);
    if (from === -1) return;
    const to = from + delta;
    if (to < 0 || to >= items.length) return;
    const target = items[to];
    if (delta > 0) {
      selectionPopupList.insertBefore(li, target.nextSibling);
    } else {
      selectionPopupList.insertBefore(li, target);
    }
    const orderedIds = getCurrentOrder();
    applyOrderChange(orderedIds);
    updateIndicesAndButtons();
  };

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

  const instances = getInstancesForProduct(product);
  const normalizePriority = (inst) => {
    const val = Number(inst && inst.priority);
    return Number.isFinite(val) ? val : Number.MAX_SAFE_INTEGER;
  };
  const sortedInstances = instances
    .slice()
    .sort((a, b) => {
      const pa = normalizePriority(a);
      const pb = normalizePriority(b);
      if (pa !== pb) return pa - pb;
      return (a.brand || "").localeCompare(b.brand || "", "es", {
        sensitivity: "base",
      });
    });

  if (sortedInstances.length === 0) {
    const empty = document.createElement("p");
    empty.className = "selection-popup-empty";
    empty.textContent =
      "No hay selecciones definidas para este producto. Ve a 'Tiendas / Productores' → 'Selección de productos' para crear una.";
    selectionPopupList.appendChild(empty);
  } else {
    sortedInstances.forEach((inst, idx) => {
        const li = document.createElement("li");
        li.className = "selection-popup-item";
        li.dataset.id = inst.id || "";

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
        const actions = document.createElement("div");
        actions.className = "selection-item-actions";
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "btn btn-icon btn-ghost selection-edit-btn";
        editBtn.title = "Editar esta selección";
        editBtn.textContent = "✎";
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          startInlineSelectionEdit(inst);
        });
        actions.appendChild(editBtn);
        const moveUpBtn = document.createElement("button");
        moveUpBtn.type = "button";
        moveUpBtn.className = "btn btn-icon btn-ghost selection-move-btn";
        moveUpBtn.title = "Subir prioridad";
        moveUpBtn.dataset.role = "move-up";
        moveUpBtn.textContent = "↑";
        moveUpBtn.disabled = idx === 0;
        moveUpBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const li = e.currentTarget.closest(".selection-popup-item");
          moveItem(li, -1);
        });
        actions.appendChild(moveUpBtn);
        const moveDownBtn = document.createElement("button");
        moveDownBtn.type = "button";
        moveDownBtn.className = "btn btn-icon btn-ghost selection-move-btn";
        moveDownBtn.title = "Bajar prioridad";
        moveDownBtn.dataset.role = "move-down";
        moveDownBtn.textContent = "↓";
        moveDownBtn.disabled = idx === sortedInstances.length - 1;
        moveDownBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const li = e.currentTarget.closest(".selection-popup-item");
          moveItem(li, 1);
        });
        actions.appendChild(moveDownBtn);
        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn btn-icon btn-danger btn-trash selection-delete-btn";
        deleteBtn.title = "Eliminar esta selección";
        deleteBtn.textContent = "🗑";
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const prodLabel = product.name || "";
          const instLabel =
            [getProducerName(inst.producerId), inst.brand].filter(Boolean).join(" · ") ||
            "esta selección";
          const ok = window.confirm(
            `¿Eliminar ${instLabel} para "${prodLabel}"? Esta acción no se puede deshacer.`
          );
          if (!ok) return;
          removeInstanceById(inst.id, { deferRefresh: true });
          openSelectionPopupForProduct(productId);
        });
        actions.appendChild(deleteBtn);
        li.appendChild(actions);

        li.addEventListener("click", () => {
          applySelectionToProduct(productId, inst.id);
        });

        selectionPopupList.appendChild(li);
      });
    updateIndicesAndButtons();
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
    storesWrap.className = "inline-stores-block";
    const storesLabel = document.createElement("label");
    storesLabel.textContent = "Tiendas";
    const storesSel = document.createElement("select");
    storesSel.id = "inlineStoresSelect";
    storesSel.multiple = true;
    storesSel.size = 12;
    storesSel.className = "inline-stores-select visually-hidden";
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
    inlineSelectionBrandInput = brandInput;
    inlineSelectionProducerSel = producerSel;
    inlineSelectionStoresSel = storesSel;
    attachMultiSelectToggle(storesSel);
    const storeChips = document.createElement("div");
    storeChips.className = "inline-store-chips";
    const renderStoreChips = () => {
      const selectedIds = new Set(
        Array.from(storesSel.selectedOptions).map((o) => o.value)
      );
      storeChips.innerHTML = "";
      getSuppliersList()
        .slice()
        .sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" })
        )
        .forEach((s) => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "store-chip-toggle";
          chip.textContent = s.name || "(sin nombre)";
          chip.dataset.id = s.id;
          const isSelected = selectedIds.has(s.id);
          chip.classList.toggle("selected", isSelected);
          chip.addEventListener("click", () => {
            const opt = Array.from(storesSel.options).find((o) => o.value === s.id);
            if (opt) {
              opt.selected = !opt.selected;
              storesSel.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });
          storeChips.appendChild(chip);
        });
    };
    storesSel.addEventListener("change", renderStoreChips);
    renderStoreChips();
    storesWrap.appendChild(storeChips);

  const inlineActions = document.createElement("div");
  inlineActions.className = "selection-inline-actions";
    const createApply = document.createElement("button");
    createApply.className = "btn btn-small btn-success";
    createApply.textContent = "✓";
    createApply.title = "Guardar selección";
    createApply.setAttribute("aria-label", "Guardar selección");
    inlineSelectionSaveBtn = createApply;
    createApply.addEventListener("click", () => {
      if (inlineSelectionEditId) {
        saveInlineSelectionEdit();
      } else {
        createAndApplySelection(productId);
      }
    });
    inlineActions.appendChild(createApply);
    const cancelInlineEdit = document.createElement("button");
    cancelInlineEdit.className = "btn btn-small btn-danger";
    cancelInlineEdit.textContent = "✕";
    cancelInlineEdit.title = "Cancelar edición";
    cancelInlineEdit.setAttribute("aria-label", "Cancelar edición");
    cancelInlineEdit.style.display = "none";
    inlineSelectionCancelBtn = cancelInlineEdit;
    cancelInlineEdit.addEventListener("click", () => {
      resetInlineSelectionForm();
    });
    inlineActions.appendChild(cancelInlineEdit);

    inline.appendChild(producerWrap);
    inline.appendChild(brandWrap);
    inline.appendChild(inlineActions);
    inline.appendChild(storesWrap);
    resetInlineSelectionForm();

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
    prodActions.className = "selection-inline-actions actions-inline-header";
    const prodSave = document.createElement("button");
    prodSave.className = "btn btn-small btn-success";
    prodSave.textContent = "✓";
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
    if (producerSub.wrapper) {
      const toggle = producerSub.wrapper.querySelector(".selection-subform-toggle");
      if (toggle) prodActions.prepend(toggle);
    }
    const prodHeader = producerSub.wrapper.querySelector(".selection-subform-header");
    producerSub.content.appendChild(prodName);
    producerSub.content.appendChild(prodLoc);
    producerSub.content.appendChild(prodNotes);
    if (prodHeader) {
      prodActions.addEventListener("click", (e) => e.stopPropagation());
      prodHeader.appendChild(prodActions);
    } else {
      producerSub.content.appendChild(prodActions);
    }
    selectionPopupBody.appendChild(producerSub.wrapper);

    // Subform tienda
    const storeSub = buildCollapsibleSubform("Crear tienda");
    storeSub.content.classList.add("store-subform-content");
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
    storeActions.className = "selection-inline-actions actions-inline-header";
    const storeSave = document.createElement("button");
    storeSave.className = "btn btn-small btn-success";
    storeSave.textContent = "✓";
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
    if (storeSub.wrapper) {
      const toggle = storeSub.wrapper.querySelector(".selection-subform-toggle");
      if (toggle) storeActions.prepend(toggle);
    }
    const storeHeader = storeSub.wrapper.querySelector(".selection-subform-header");
    storeSub.content.appendChild(storeName);
    storeSub.content.appendChild(storeType);
    storeSub.content.appendChild(storeLoc);
    storeSub.content.appendChild(storeWeb);
    storeSub.content.appendChild(storeNotes);
    if (storeHeader) {
      storeActions.addEventListener("click", (e) => e.stopPropagation());
      storeHeader.appendChild(storeActions);
    } else {
      storeSub.content.appendChild(storeActions);
    }
    selectionPopupBody.appendChild(storeSub.wrapper);

  }

  // Mostrar overlay
  if (window.SelectionPopup && typeof window.SelectionPopup.open === "function") {
    window.SelectionPopup.open(selectionPopupTitle.textContent);
  } else {
    selectionPopupOverlay.classList.add("visible");
    centerSelectionPopup();
    requestAnimationFrame(centerSelectionPopup);
  }
  };

  try {
    run();
  } catch (err) {
    console.error("openSelectionPopupForProduct error", err);
    if (selectionPopupList) {
      selectionPopupList.innerHTML = "";
      const li = document.createElement("li");
      li.className = "selection-popup-item";
      li.textContent = "No se pudieron cargar las selecciones.";
      selectionPopupList.appendChild(li);
    }
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
    ordersFamilyFilterSelect,
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
    ordersTypeFilterSelect,
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
  const memoKey = storeList
    .map((s) => `${s.id}::${s.name || ""}::${s.ordersFavorite ? "1" : "0"}`)
    .join("|||");
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

  if (ordersStoreSelect) {
    const current = String(ordersStoreSelect.value || "");
    ordersStoreSelect.innerHTML = "";
    const optNone = document.createElement("option");
    optNone.value = "";
    optNone.textContent = "Todas las tiendas";
    ordersStoreSelect.appendChild(optNone);
    const favoriteStores = storeList.filter((s) => !!s.ordersFavorite);
    favoriteStores.forEach((s) => {
      const o = document.createElement("option");
      o.value = String(s.id || "");
      o.textContent = s.name || "(sin nombre)";
      ordersStoreSelect.appendChild(o);
    });
    if (current && Array.from(ordersStoreSelect.options).some((o) => String(o.value || "") === current)) {
      ordersStoreSelect.value = current;
    } else {
      ordersStoreSelect.value = "";
    }
  }
}

function sameStoreId(a = "", b = "") {
  return String(a || "") === String(b || "");
}

function getOrderStoreLabel({ storeId = "", fallback = "Sin tienda" } = {}) {
  if (!storeId) return fallback;
  const matchOrder = getOrdersList().find((o) => sameStoreId(o.storeId, storeId));
  if (matchOrder && matchOrder.storeName) return matchOrder.storeName;
  const name = getStoreName(storeId);
  return name || fallback;
}

function getOrderById(orderId = "") {
  if (!orderId) return null;
  const id = String(orderId);
  return getOrdersList().find((o) => String(o.id) === id) || null;
}

function resolveOrderPlannedDate(order) {
  if (!order) return "";
  if (order.plannedDate) return order.plannedDate;
  if (order.completedPlannedDate) return order.completedPlannedDate;
  const datedItem = Array.isArray(order.items) ? order.items.find((i) => i?.plannedDate) : null;
  return datedItem ? datedItem.plannedDate : "";
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayStartValue(date = new Date()) {
  if (!(date instanceof Date)) return NaN;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return d.getTime();
}

function monthBounds(dayTs) {
  if (!Number.isFinite(dayTs)) return { start: NaN, end: NaN };
  const d = new Date(dayTs);
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime();
  return { start, end };
}

function weekBounds(dayTs) {
  if (!Number.isFinite(dayTs)) return { start: NaN, end: NaN };
  const d = new Date(dayTs);
  const dayOfWeek = d.getDay();
  const mondayOffset = (dayOfWeek + 6) % 7;
  const start = dayTs - mondayOffset * DAY_MS;
  const end = start + 6 * DAY_MS;
  return { start, end };
}

function inDayRange(value, start, end) {
  if (!Number.isFinite(value) || !Number.isFinite(start) || !Number.isFinite(end)) return false;
  return value >= start && value <= end;
}

function getOrderFilterDate(order) {
  const planned = (resolveOrderPlannedDate(order) || "").trim();
  if (planned) return planned;
  const completed = (order?.completedAt || "").slice(0, 10).trim();
  if (completed) return completed;
  return "";
}

function orderMatchesDateFilter(order, filter = "") {
  const mode = (filter || "").trim();
  if (!mode) return true;
  if (!order) return false;
  const orderDate = getOrderFilterDate(order);
  const hasDate = !!orderDate;
  const orderDay = hasDate ? dateValue(orderDate) : NaN;
  const today = dayStartValue(new Date());
  if (!Number.isFinite(today)) return true;
  if (mode === "no_date") return !hasDate;
  if (!hasDate || !Number.isFinite(orderDay)) return false;
  const { start: weekStart, end: weekEnd } = weekBounds(today);
  const nextWeekStart = weekStart + 7 * DAY_MS;
  const nextWeekEnd = weekEnd + 7 * DAY_MS;
  const { start: monthStart, end: monthEnd } = monthBounds(today);
  const prevMonthRef = new Date(today);
  prevMonthRef.setMonth(prevMonthRef.getMonth() - 1);
  const { start: prevMonthStart, end: prevMonthEnd } = monthBounds(dayStartValue(prevMonthRef));
  if (mode === "today") return orderDay === today;
  if (mode === "this_week") return inDayRange(orderDay, weekStart, weekEnd);
  if (mode === "next_week") return inDayRange(orderDay, nextWeekStart, nextWeekEnd);
  if (mode === "this_month") return inDayRange(orderDay, monthStart, monthEnd);
  if (mode === "last_month") return inDayRange(orderDay, prevMonthStart, prevMonthEnd);
  if (mode === "next_7") return inDayRange(orderDay, today, today + 6 * DAY_MS);
  if (mode === "next_30") return inDayRange(orderDay, today, today + 29 * DAY_MS);
  if (mode === "overdue") return !order.completedAt && orderDay < today;
  if (mode === "future") return orderDay >= today;
  if (mode === "past") return orderDay < today;
  return true;
}

function getOrdersDateFilterLabel(filter = "") {
  const mode = (filter || "").trim();
  const labels = {
    today: "Hoy",
    this_week: "Esta semana",
    next_week: "Próxima semana",
    this_month: "Este mes",
    last_month: "Mes pasado",
    next_7: "Próximos 7 días",
    next_30: "Próximos 30 días",
    overdue: "Vencidos / atrasados",
    future: "Futuros",
    past: "Pasados",
    no_date: "Sin fecha",
  };
  return labels[mode] || "Todas";
}

function normalizeProductNameForMatch(name = "") {
  const clean = name.replace(/^[★☆]\s*[·\-–—]?\s*/u, "").trim();
  const parts = clean.split("·").map((p) => p.trim()).filter(Boolean);
  const base = parts[0] || clean;
  return { clean: clean.toLowerCase(), base: base.toLowerCase() };
}

function productMatchesOrderItem(product = {}, item = {}) {
  if (!product || !item) return false;
  const prodId = product.id !== undefined && product.id !== null ? String(product.id) : "";
  const selId = product.selectionId ? String(product.selectionId) : "";
  const itemProdId = item.productId ? String(item.productId) : "";
  const itemInstId = item.instanceId ? String(item.instanceId) : "";
  if (prodId && itemProdId && prodId === itemProdId) return true;
  if (selId && itemInstId && selId === itemInstId) return true;
  const prodNames = normalizeProductNameForMatch(product.name || "");
  const itemNames = normalizeProductNameForMatch(item.productName || "");
  if (prodNames.clean && itemNames.clean && prodNames.clean === itemNames.clean) return true;
  if (prodNames.base && itemNames.base && prodNames.base === itemNames.base) return true;
  if (prodNames.base && itemNames.clean && itemNames.clean.includes(prodNames.base)) return true;
  const prodNameNoSpaces = (product.name || "").replace(/\s+/g, "").toLowerCase();
  const itemNameNoSpaces = (item.productName || "").replace(/\s+/g, "").toLowerCase();
  if (prodNameNoSpaces && itemNameNoSpaces && prodNameNoSpaces === itemNameNoSpaces) return true;
  if (prodNameNoSpaces && itemNameNoSpaces.includes(prodNameNoSpaces)) return true;
  return false;
}

function updateInventoryComputedColumns() {
  if (!productTableBody) return;
  const rows = Array.from(productTableBody.querySelectorAll("tr[data-id]"));
  if (!rows.length) return;
  const map = buildFutureOrderMap();
  const productsMap = new Map(getPantryProducts().map((p) => [String(p.id), p]));
  rows.forEach((row) => {
    const id = row.dataset.id || "";
    const product = productsMap.get(id);
    if (!product) return;
    const futureCell = row.querySelector("[data-field='futureOrder']");
    if (futureCell) {
      const label = getFutureOrderLabel(product, map);
      futureCell.textContent = label || "";
      futureCell.title = label ? `Incluido en pedido: ${label}` : "";
      row.dataset.futureOrder = label ? "1" : "0";
    }
    const acqCell = row.querySelector("[data-field='acquisitionDate']");
    if (acqCell) {
      acqCell.textContent = product.acquisitionDate || "";
      acqCell.title = product.acquisitionDate ? `Adquirido: ${product.acquisitionDate}` : "";
    }
  });
}

function getFutureOrderLabel(product = {}, futureMap) {
  const map = futureMap || buildFutureOrderMap();
  const key = String(product.id || "");
  const selectionKey = String(product.selectionId || "");
  const nameKey = normalizeProductNameForMatch(product.name || "").clean;
  const nameNoSpaces = (product.name || "").replace(/\s+/g, "").toLowerCase();
  const payload =
    (key && map.get(`id:${key}`)) ||
    (selectionKey && map.get(`sel:${selectionKey}`)) ||
    (nameKey && map.get(`name:${nameKey}`)) ||
    (nameNoSpaces && map.get(`nospace:${nameNoSpaces}`)) ||
    null;
  if (!payload) return "";
  const suffix = payload.count > 1 ? ` (${payload.count})` : "";
  return payload.date ? `${payload.date}${suffix}` : suffix || "";
}

function buildFutureOrderMap() {
  const orders = getOrdersList().filter((o) => orderMatchesDateFilter(o, "future"));
  const map = new Map();
  const addEntry = (key, planned) => {
    if (!key) return;
    const existing = map.get(key);
    const plannedVal = dateValue(planned);
    if (!Number.isFinite(plannedVal)) {
      const todayVal = dateValue(todayDateString());
      if (!Number.isFinite(todayVal)) return;
      map.set(key, { date: planned, val: todayVal, count: 1 });
      return;
    }
    if (!existing) {
      map.set(key, { date: planned, val: plannedVal, count: 1 });
      return;
    }
    existing.count += 1;
    if (!existing.val || plannedVal < existing.val) {
      existing.val = plannedVal;
      existing.date = planned;
    }
  };

  orders.forEach((order) => {
    let planned = (resolveOrderPlannedDate(order) || "").trim();
    if (!planned) planned = todayDateString();
    if (!planned) return;
    const items = Array.isArray(order.items) ? order.items : [];
    items.forEach((item) => {
      const norm = normalizeProductNameForMatch(item.productName || "");
      const nospace = (item.productName || "").replace(/\s+/g, "").toLowerCase();
      addEntry(item.productId ? `id:${item.productId}` : "", planned);
      addEntry(item.instanceId ? `sel:${item.instanceId}` : "", planned);
      addEntry(norm.clean ? `name:${norm.clean}` : "", planned);
      addEntry(norm.base ? `name:${norm.base}` : "", planned);
      addEntry(nospace ? `nospace:${nospace}` : "", planned);
    });
  });
  return map;
}

function markOrderItemsAsHave(order) {
  if (!order) return;
  const planned = (resolveOrderPlannedDate(order) || todayDateString()).trim();
  const nowIsoVal = nowIsoString();
  const unified = getUnifiedForWrite();
  if (!Array.isArray(unified) || !unified.length) return;
  const instances = getInstancesList();
  const normalizeName = (name = "") => {
    const clean = name.replace(/^[★☆]\s*[·\-–—]?\s*/u, "").trim();
    const base = clean.split("·")[0].trim();
    return { clean: clean.toLowerCase(), base: base.toLowerCase() };
  };
  const findMatch = (item = {}) => {
    const itemId = item.productId ? String(item.productId) : "";
    const inst = item.instanceId
      ? instances.find((i) => String(i.id) === String(item.instanceId))
      : null;
    const instProductId = inst?.productId ? String(inst.productId) : "";
    const { clean: lowerName, base: lowerBase } = normalizeName(item.productName || "");
    return (prod) => {
      if (!prod) return false;
      const pid = prod.id !== undefined && prod.id !== null ? String(prod.id) : "";
      if (itemId && pid === itemId) return true;
      if (instProductId && pid === instProductId) return true;
      if (lowerName && (prod.name || "").trim().toLowerCase() === lowerName) return true;
      if (lowerBase && (prod.name || "").trim().toLowerCase() === lowerBase) return true;
      return false;
    };
  };

  let changed = false;
  let instancesChanged = false;
  const updated = unified.map((prod) => {
    const matchItem = (order.items || []).find((it) => findMatch(it)(prod));
    if (!matchItem) return prod;
    changed = true;
    const next = {
      ...prod,
      have: true,
      buy: prod.scope === "otros" ? false : prod.buy,
      acquisitionDate: planned || prod.acquisitionDate,
      updatedAt: nowIsoVal,
    };
    return next;
  });
  const updatedInstances = instances.map((inst) => {
    const matchItem = (order.items || []).find((it) => {
      const matcher = findMatch(it);
      const instAsProd = {
        id: inst.productId || "",
        name: inst.productName || "",
        scope: "almacen",
        have: inst.have,
        buy: inst.buy,
      };
      return matcher(instAsProd) || (it.instanceId && String(it.instanceId) === String(inst.id));
    });
    if (!matchItem) return inst;
    instancesChanged = true;
    return {
      ...inst,
      have: true,
      buy: false,
      updatedAt: nowIsoVal,
    };
  });

  if (changed) setUnifiedList(updated);
  if (instancesChanged) setInstancesList(updatedInstances);
  if (changed || instancesChanged) {
    if (inventoryController && typeof inventoryController.render === "function") {
      inventoryController.render();
    } else if (window.InventoryFeature && typeof window.InventoryFeature.render === "function") {
      window.InventoryFeature.render();
    } else {
      renderProducts();
    }
    queueInventorySummaryUpdate();
    scheduleShoppingListRender();
  }
}

function getCurrentOrderContext() {
  const list = getOrdersList();
  const dateFilter = ordersDateFilterSelect?.value || "";
  const selectedStore = ordersStoreSelect ? String(ordersStoreSelect.value || "") : "";
  let order = currentOrderId ? getOrderById(currentOrderId) : null;
  // Si estamos en un pedido nuevo (id no guardado), no sobrescribimos el contexto
  if (!order && currentOrderId) {
    return { order: null, storeId: selectedStore };
  }
  if (order) {
    const orderStoreId = order.storeId || "";
    if (!selectedStore || sameStoreId(orderStoreId, selectedStore)) {
      currentOrderStoreId = orderStoreId || "";
      if (ordersStoreSelect) {
        const filterValue = String(selectedStore || "");
        const hasOption = Array.from(ordersStoreSelect.options || []).some(
          (o) => String(o.value || "") === filterValue
        );
        ordersStoreSelect.value = hasOption ? filterValue : "";
      }
      return { order, storeId: orderStoreId || selectedStore };
    }
    // Si el usuario selecciona otra tienda, descartamos el pedido actual para respetar el filtro.
    order = null;
  }
  const filteredByStore = list.filter((o) =>
    selectedStore ? sameStoreId(o.storeId, selectedStore) : true
  );
  const activeFiltered = filteredByStore.filter(
    (o) => !o.completedAt && orderMatchesDateFilter(o, dateFilter)
  );
  const activeByStore = filteredByStore.filter((o) => !o.completedAt);
  const filtered = filteredByStore.filter((o) => orderMatchesDateFilter(o, dateFilter));
  const activeGlobal = list.filter((o) => !o.completedAt && orderMatchesDateFilter(o, dateFilter));
  if (selectedStore) {
    order = activeFiltered[0] || activeByStore[0] || filtered[0] || filteredByStore[0] || null;
  } else {
    order =
      activeFiltered[0] ||
      activeByStore[0] ||
      filtered[0] ||
      activeGlobal[0] ||
      list.find((o) => !o.completedAt) ||
      list[0] ||
      null;
  }
  const storeId = order?.storeId || selectedStore || "";
  if (ordersStoreSelect) {
    const filterValue = String(selectedStore || "");
    const hasOption = Array.from(ordersStoreSelect.options || []).some(
      (o) => String(o.value || "") === filterValue
    );
    ordersStoreSelect.value = hasOption ? filterValue : "";
  }
  currentOrderId = order?.id || currentOrderId || "";
  currentOrderStoreId = storeId;
  return { order, storeId };
}

function applyOrderMetaToInputs(order) {
  const planned = resolveOrderPlannedDate(order) || ordersPlannedDate?.value || todayDateString();
  if (ordersPriceInput) {
    ordersPriceInput.value = order?.price || "";
  }
  if (ordersNameInput) {
    ordersNameInput.value = order?.name || "";
  }
  if (ordersPlannedDate) {
    ordersPlannedDate.value = planned || "";
  }
}

function normalizeOrderProductKey(label = "") {
  return (label || "")
    .replace(/^[★☆]\s*[·\-–—]?\s*/u, "")
    .trim()
    .toLowerCase();
}

function pickExpiryText(...values) {
  return (
    values
      .map((val) => (val === undefined || val === null ? "" : String(val).trim()))
      .find((val) => val.length > 0) || ""
  );
}

function isFalsyHaveFlag(value) {
  return value === false || value === 0 || value === "0";
}

function isMissingByScope(entity = null, scopeHint = "") {
  if (!entity) return false;
  const scope = String(entity.scope || scopeHint || "").trim().toLowerCase();
  const buy = entity.buy === true;
  if (scope === "otros") {
    // En "Otros", faltante solo depende de "Comprar".
    return buy;
  }
  return isFalsyHaveFlag(entity.have) || entity.status === "missing" || buy;
}

function buildOrderProductOptions(storeId = "", order = null) {
  if (!ordersProductsDatalist) return;
  const normalized = storeId || "";
  const familyFilter = ordersFamilyFilterSelect?.value || "";
  const typeFilter = ordersTypeFilterSelect?.value || "";
  const scopeFilter = ordersScopeFilterSelect?.value || "";
  const dateFilter = ordersDateFilterSelect?.value || "";
  const instances = getInstancesList();
  const unified = getUnifiedList();
  const seen = new Set();
  orderProductOptionMap = new Map();
  const options = [];

  const normalizeName = (name = "") => {
    const clean = name.replace(/^[★☆]\s*[·\-–—]?\s*/u, "").trim();
    const base = clean.split("·")[0].trim();
    return { clean: clean.toLowerCase(), base: base.toLowerCase() };
  };

  const findUnifiedForInstance = (inst) => {
    if (!inst) return null;
    const { clean: instNameLower, base: instBaseLower } = normalizeName(inst.productName || "");
    const exactById = inst.productId
      ? unified.find((p) => String(p.id) === String(inst.productId))
      : null;
    if (exactById) return exactById;
    const exactByName =
      (scopeFilter &&
        unified.find(
          (p) =>
            ((p.name || "").trim().toLowerCase() === instNameLower ||
              (p.name || "").trim().toLowerCase() === instBaseLower) &&
            p.scope === scopeFilter
        )) ||
      unified.find(
        (p) =>
          (p.name || "").trim().toLowerCase() === instNameLower ||
          (p.name || "").trim().toLowerCase() === instBaseLower
      );
    if (exactByName) return exactByName;
    const includesBase =
      instBaseLower &&
      ((scopeFilter &&
        unified.find(
          (p) =>
            (p.name || "").trim().toLowerCase().includes(instBaseLower) &&
            p.scope === scopeFilter
        )) ||
        unified.find((p) => (p.name || "").trim().toLowerCase().includes(instBaseLower)));
    return includesBase || null;
  };

  instances
    .filter((inst) => {
      const ids = Array.isArray(inst.storeIds) ? inst.storeIds.filter(Boolean) : [];
      if (normalized) {
        // No mostrar “sin tienda” cuando hay tienda seleccionada
        if (!ids.length) return false;
        if (!ids.includes(normalized)) return false;
      }
      const family = resolveInstanceFamily(inst);
      const type = resolveInstanceType(inst);
      if (familyFilter && family !== familyFilter) return false;
      if (typeFilter && type !== typeFilter) return false;
      if (scopeFilter) {
        const productForScope =
          (inst.productId && findProductById(inst.productId)) ||
          findProductByNameWithScope(inst.productName, scopeFilter) ||
          findProductByName(inst.productName);
        const scope = productForScope?.scope || "";
        if (scope !== scopeFilter) return false;
      }
      return true; // Sin tienda: mostrar todas
    })
    .forEach((inst) => {
      const baseName = (inst.productName || "").trim();
      if (!baseName) return;
      const brand = (inst.brand || "").trim();
      const producer = getProducerName(inst.producerId) || "";
      const product =
        (inst.productId && findProductById(inst.productId)) ||
        findProductByNameWithScope(inst.productName, scopeFilter) ||
        findProductByName(inst.productName);
      const unifiedProduct = findUnifiedForInstance(inst);
      const isCurrentSelection =
        product && product.selectionId && product.selectionId === inst.id;
      const isPriority = Number(inst.priority) > 0;
      const marker = isCurrentSelection ? "★" : "☆";
      const resolvedScope =
        product?.scope ||
        unifiedProduct?.scope ||
        ((inst.productId && findProductById(inst.productId)?.scope) || "") ||
        scopeFilter ||
        "";
      const isMissing =
        !!(
          isMissingByScope(unifiedProduct, unifiedProduct?.scope || resolvedScope) ||
          isMissingByScope(product, product?.scope || resolvedScope) ||
          isMissingByScope(inst, resolvedScope)
        );
      const parts = [marker, baseName];
      const labelParts = [baseName];
      if (brand) {
        parts.push(brand);
        labelParts.push(brand);
      }
      if (producer) {
        parts.push(`(${producer})`);
        labelParts.push(`(${producer})`);
      }
      const label = parts.join(" · ");
      const displayLabel = labelParts.join(" · ");
      const expiryText = pickExpiryText(
        inst.expiryText,
        product?.expiryText,
        product?.shelfLifeDays,
        unifiedProduct?.expiryText,
        unifiedProduct?.shelfLifeDays
      );
      const key = normalizeOrderProductKey(displayLabel || label);
      if (seen.has(key)) return;
      seen.add(key);
      orderProductOptionMap.set(key, {
        instanceId: inst.id || "",
        productId: inst.productId || "",
        productName: inst.productName || displayLabel || label,
        displayLabel,
        markerLabel: label,
        missing: isMissing,
        expiryText,
      });
      options.push({ value: label, missing: isMissing, displayLabel, key });
    });

  if (order && Array.isArray(order.items)) {
    order.items.forEach((item) => {
      const label = (item.productName || "").trim();
      if (!label) return;
      const key = normalizeOrderProductKey(label);
      if (!seen.has(key)) {
        seen.add(key);
        orderProductOptionMap.set(key, {
          instanceId: item.instanceId || "",
          productId: item.productId || "",
          productName: label,
          markerLabel: label,
          expiryText: pickExpiryText(item.expiryText, item.shelfLifeDays),
        });
        options.push({ value: label, key });
      }
    });
  }

  ordersProductsDatalist.innerHTML = "";
  options
    .sort((a, b) => (a.value || "").localeCompare(b.value || "", "es", { sensitivity: "base" }))
    .forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.value || "";
      ordersProductsDatalist.appendChild(o);
    });
  renderOrderBatchSelect(options);
}

function renderOrderBatchSelect(options = []) {
  if (!ordersBatchSelect) return;
  const selectedKeys = new Set(
    Array.from(ordersBatchSelect.selectedOptions || []).map(
      (o) => o.dataset.key || o.value.toLowerCase()
    )
  );
  ordersBatchSelect.innerHTML = "";
  options
    .sort((a, b) => (a.value || "").localeCompare(b.value || "", "es", { sensitivity: "base" }))
    .forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.value || "";
      o.textContent = opt.value || "";
      if (opt.key) o.dataset.key = opt.key;
      const isMissing = !!opt.missing;
      if (isMissing) {
        o.classList.add("order-option-missing");
        o.dataset.missing = "true";
        o.style.color = "#d0741d";
        o.style.fontWeight = "600";
      }
      if (selectedKeys.has(opt.key || o.value.toLowerCase())) o.selected = true;
      ordersBatchSelect.appendChild(o);
    });
  updateOrdersBatchToggleLabel();
}

function updateOrdersBatchToggleLabel() {
  if (!toggleOrdersBatchButton || !ordersBatchSelect) return;
  const selectedCount = Array.from(ordersBatchSelect.selectedOptions || []).length;
  const iconMode = toggleOrdersBatchButton.dataset.iconMode === "true";
  if (iconMode) {
    toggleOrdersBatchButton.textContent = "☑";
    const label = selectedCount > 0 ? `Seleccionar varios (${selectedCount})` : "Seleccionar varios";
    if (selectedCount > 0) {
      toggleOrdersBatchButton.dataset.count = String(selectedCount);
    } else {
      delete toggleOrdersBatchButton.dataset.count;
    }
    toggleOrdersBatchButton.title = label;
    toggleOrdersBatchButton.setAttribute("aria-label", label);
    return;
  }
  toggleOrdersBatchButton.textContent =
    selectedCount > 0 ? `Seleccionar varios (${selectedCount})` : "Seleccionar varios";
}

function setOrdersSummaryChips(chips = []) {
  if (!ordersSummaryInfo) return;
  ordersSummaryInfo.innerHTML = "";
  if (!Array.isArray(chips) || !chips.length) {
    ordersSummaryInfo.textContent = "Sin pedidos para esta tienda";
    return;
  }
  const frag = document.createDocumentFragment();
  chips.forEach((chip) => {
    const label = (chip?.label || "").trim();
    if (!label) return;
    const tone = (chip?.tone || "").trim();
    const span = document.createElement("span");
    span.className = `orders-summary-chip${tone ? ` is-${tone}` : ""}`;
    span.textContent = label;
    frag.appendChild(span);
  });
  if (!frag.childNodes.length) {
    ordersSummaryInfo.textContent = "Sin pedidos para esta tienda";
    return;
  }
  ordersSummaryInfo.appendChild(frag);
}

function getRowFamilyType(row, scopeHint = "") {
  const productInput = row?.querySelector("input[data-field='product']");
  const name = (productInput?.value || "").trim().toLowerCase();
  const productId = row?.dataset.productId || "";
  const instanceId = row?.dataset.instanceId || "";
  let family = "";
  let type = "";
  let scope = "";
  if (instanceId) {
    const inst = getInstancesList().find((i) => i.id === instanceId);
    if (inst) {
      family = resolveInstanceFamily(inst) || family;
      type = resolveInstanceType(inst) || type;
      const prodForScope =
        (inst.productId && findProductById(inst.productId)) ||
        findProductByNameWithScope(inst.productName, scopeHint) ||
        findProductByName(inst.productName);
      scope = prodForScope?.scope || scope;
    }
  }
  if (!family || !type || !scope) {
    const prod =
      (productId && findProductById(productId)) ||
      (name ? findProductByNameWithScope(name, scopeHint) || findProductByName(name) : null);
    if (prod) {
      if (!family) family = prod.block || "";
      if (!type) type = prod.type || "";
      if (!scope) scope = prod.scope || "";
    }
  }
  return { family, type, scope };
}

function applyOrdersFilters() {
  if (!ordersTableBody) return;
  const familyFilter = ordersFamilyFilterSelect?.value || "";
  const typeFilter = ordersTypeFilterSelect?.value || "";
  const scopeFilter = ordersScopeFilterSelect?.value || "";
  const dateFilter = ordersDateFilterSelect?.value || "";
  const rows = Array.from(ordersTableBody.querySelectorAll("tr")).filter(
    (row) => row.dataset.empty !== "true"
  );
  rows.forEach((row) => {
    const { family, type, scope } = getRowFamilyType(row, scopeFilter);
    const matchFamily = !familyFilter || family === familyFilter;
    const matchType = !typeFilter || type === typeFilter;
    const matchScope = !scopeFilter || scope === scopeFilter;
    const visible = matchFamily && matchType && matchScope;
    row.style.display = visible ? "" : "none";
  });
  updateOrdersSummaryFromTable();
}

function resolveProductFromOrderItem(item = {}) {
  if (item.productId) {
    const prod = findProductById(item.productId);
    if (prod) return prod;
  }
  const rawName = item.productName || "";
  const { clean, base } = normalizeProductNameForMatch(rawName);
  const nospace = rawName.replace(/\s+/g, "").toLowerCase();
  const unified = getUnifiedList();
  const matches = unified.find((p) => {
    const pname = (p.name || "").trim().toLowerCase();
    const pnameNoSpaces = (p.name || "").replace(/\s+/g, "").toLowerCase();
    if (clean && pname === clean) return true;
    if (base && pname === base) return true;
    if (clean && pname.includes(clean)) return true;
    if (base && pname.includes(base)) return true;
    if (nospace && pnameNoSpaces === nospace) return true;
    return false;
  });
  if (matches) return matches;
  return null;
}

function isOrderItemMissing(item = {}) {
  const inst = item.instanceId
    ? getInstancesList().find((i) => i.id === item.instanceId)
    : null;
  const prod = resolveProductFromOrderItem(item);
  const resolvedScope =
    prod?.scope ||
    ((inst?.productId && findProductById(inst.productId)?.scope) || "") ||
    "";
  const isMissingInst = isMissingByScope(inst, resolvedScope);
  const isMissingProd = isMissingByScope(prod, prod?.scope || resolvedScope);
  return !!(isMissingInst || isMissingProd);
}

function getOrderItemExpiryText(item = {}) {
  const direct = pickExpiryText(item.expiryText, item.shelfLifeDays);
  if (direct) return direct;
  const key = normalizeOrderProductKey(item.productName || "");
  const option = key ? orderProductOptionMap.get(key) : null;
  const optionExpiry = pickExpiryText(option?.expiryText);
  if (optionExpiry) return optionExpiry;
  const product =
    (option?.productId && findProductById(option.productId)) ||
    resolveProductFromOrderItem(item);
  return pickExpiryText(product?.expiryText, product?.shelfLifeDays);
}

function getOrderRowPayload(row) {
  if (!row) return null;
  const productInput = row.querySelector("input[data-field='product']");
  const quantityInput = row.querySelector("input[data-field='quantity']");
  const productValue = (productInput?.value || "").trim();
  const quantity = (quantityInput?.value || "").trim();
  const key = normalizeOrderProductKey(productValue);
  const opt = key ? orderProductOptionMap.get(key) : null;

  return {
    id: row.dataset.id || "",
    productName: productValue || opt?.productName || "",
    quantity,
    instanceId: opt?.instanceId || row.dataset.instanceId || "",
    productId: opt?.productId || row.dataset.productId || "",
    expiryText: pickExpiryText(opt?.expiryText, row.dataset.expiryText),
  };
}

function createOrderRow(item = {}) {
  const productInput = document.createElement("input");
  productInput.type = "text";
  productInput.value = item.productName || "";
  productInput.placeholder = "Producto o selección";
  productInput.className = "table-input";
  productInput.dataset.field = "product";
  productInput.setAttribute("list", "ordersProductsDatalist");

  const quantityInput = document.createElement("input");
  quantityInput.type = "text";
  quantityInput.value = item.quantity || "";
  quantityInput.placeholder = "Cantidad";
  quantityInput.className = "table-input";
  quantityInput.dataset.field = "quantity";

  const expiryText = getOrderItemExpiryText(item);
  const expiryDisplay = document.createElement("span");
  expiryDisplay.className = "orders-expiry-value";
  expiryDisplay.textContent = expiryText;

  const actionsTd = document.createElement("td");
  actionsTd.className = "orders-actions-cell";
  const delBtn = document.createElement("button");
  delBtn.className = "btn btn-small btn-danger btn-trash";
  delBtn.textContent = "🗑";
  delBtn.dataset.role = "delete";
  delBtn.title = "Eliminar línea";
  delBtn.setAttribute("aria-label", "Eliminar línea");
  actionsTd.appendChild(delBtn);

  if (ordersRowTemplate && window.AppComponents && typeof window.AppComponents.buildRowWithTemplate === "function") {
    const row = window.AppComponents.buildRowWithTemplate({
      template: ordersRowTemplate,
      dataset: {
        id: item.id || "",
        instanceId: item.instanceId || "",
        productId: item.productId || "",
      },
      replacements: {
        "[data-slot='product']": productInput,
        "[data-slot='expiry']": expiryDisplay,
        "[data-slot='quantity']": quantityInput,
        "[data-slot='actions']": actionsTd,
      },
    });
    if (row) {
      const missing = item.missing ?? isOrderItemMissing(item);
      if (missing) {
        row.classList.add("order-row-missing");
        const productCellInput = row.querySelector("input[data-field='product']");
        if (productCellInput) productCellInput.classList.add("order-row-missing-input");
        row.dataset.missing = "1";
      }
      row.dataset.expiryText = expiryText || "";
      updateOrderRowExpiry(row);
      return row;
    }
  }

  const tr = document.createElement("tr");
  if (item.id) tr.dataset.id = item.id;
  if (item.instanceId) tr.dataset.instanceId = item.instanceId;
  if (item.productId) tr.dataset.productId = item.productId;
  const missing = item.missing ?? isOrderItemMissing(item);
  if (missing) {
    tr.classList.add("order-row-missing");
    tr.dataset.missing = "1";
  }

  let td = document.createElement("td");
  td.appendChild(productInput);
  tr.appendChild(td);

  td = document.createElement("td");
  td.appendChild(expiryDisplay);
  tr.appendChild(td);

  td = document.createElement("td");
  td.appendChild(quantityInput);
  tr.appendChild(td);

  td = document.createElement("td");
  tr.appendChild(actionsTd);
  if (missing) {
    productInput.classList.add("order-row-missing-input");
  }
  tr.dataset.expiryText = expiryText || "";
  updateOrderRowExpiry(tr);
  return tr;
}

function updateOrderRowExpiry(row) {
  if (!row) return;
  const payload = getOrderRowPayload(row);
  if (!payload) return;
  const expiryText = getOrderItemExpiryText(payload);
  const target = row.querySelector(".orders-expiry-value");
  if (target) target.textContent = expiryText;
  row.dataset.instanceId = payload.instanceId || "";
  row.dataset.productId = payload.productId || "";
  row.dataset.expiryText = expiryText || "";
}

function addOrdersPlaceholderRow() {
  if (!ordersTableBody) return;
  const tr = document.createElement("tr");
  tr.dataset.empty = "true";
  const td = document.createElement("td");
  td.colSpan = 4;
  td.textContent = "Añade productos con + producto.";
  tr.appendChild(td);
  ordersTableBody.appendChild(tr);
}

function removeOrdersPlaceholder() {
  if (!ordersTableBody) return;
  Array.from(ordersTableBody.querySelectorAll("tr[data-empty='true']")).forEach((row) => row.remove());
}

function renderOrdersSummary(order, storeId) {
  if (!ordersSummaryInfo) return;
  const count = Array.isArray(order?.items) ? order.items.length : 0;
  const isHistory = !!order?.completedAt;
  const completed = (order?.completedAt || "").slice(0, 10);
  const storeLabel =
    getStoreName(storeId || "") ||
    order?.storeName ||
    (storeId ? "Tienda seleccionada" : "Sin tienda");
  const name = (ordersNameInput?.value || order?.name || "").trim();
  const planned = (ordersPlannedDate?.value || order?.plannedDate || resolveOrderPlannedDate(order) || "").trim();
  const price = (ordersPriceInput?.value || order?.price || "").trim();
  const chips = [];
  if (isHistory) chips.push({ label: "Histórico", tone: "muted" });
  if (name) chips.push({ label: name, tone: "name" });
  chips.push({ label: `${count} producto(s)` });
  if (storeLabel) chips.push({ label: storeLabel, tone: storeId ? "" : "muted" });
  if (planned) chips.push({ label: planned });
  if (completed) chips.push({ label: `Realizado ${completed}`, tone: "success" });
  if (price) chips.push({ label: `€${price}` });
  setOrdersSummaryChips(chips);
}

function updateOrdersSummaryFromTable() {
  if (!ordersSummaryInfo) return;
  const order = currentOrderId ? getOrderById(currentOrderId) : null;
  const isHistory = !!order?.completedAt;
  const completed = (order?.completedAt || "").slice(0, 10);
  const rows = ordersTableBody
    ? Array.from(ordersTableBody.querySelectorAll("tr")).filter(
        (row) => row.dataset.empty !== "true" && row.style.display !== "none"
      )
    : [];
  const storeId = ordersStoreSelect ? ordersStoreSelect.value : "";
  const label =
    getStoreName(storeId || "") ||
    (storeId ? "Tienda seleccionada" : "Sin tienda");
  const name = (ordersNameInput?.value || "").trim();
  const planned = (ordersPlannedDate?.value || "").trim();
  const price = (ordersPriceInput?.value || "").trim();
  const chips = [];
  if (isHistory) chips.push({ label: "Histórico", tone: "muted" });
  if (name) chips.push({ label: name, tone: "name" });
  chips.push({ label: `${rows.length} producto(s)` });
  if (label) chips.push({ label, tone: storeId ? "" : "muted" });
  if (planned) chips.push({ label: planned });
  if (completed) chips.push({ label: `Realizado ${completed}`, tone: "success" });
  if (price) chips.push({ label: `€${price}` });
  setOrdersSummaryChips(chips);
}

function syncOrdersReadOnlyState(order) {
  const readOnly = !!order?.completedAt;
  ordersReadOnly = readOnly;
  if (ordersNameInput) ordersNameInput.disabled = readOnly;
  if (ordersPlannedDate) ordersPlannedDate.disabled = readOnly;
  if (ordersPriceInput) ordersPriceInput.disabled = readOnly;
  if (addOrderItemButton) addOrderItemButton.disabled = readOnly;
  if (toggleOrdersBatchButton) toggleOrdersBatchButton.disabled = readOnly;
  if (addOrderBatchButton) addOrderBatchButton.disabled = readOnly;
  if (replaceOrderBatchButton) replaceOrderBatchButton.disabled = readOnly;
  if (saveOrdersButton) saveOrdersButton.disabled = readOnly;
  if (clearOrderButton) clearOrderButton.disabled = readOnly;
  if (completeOrderButton) completeOrderButton.disabled = readOnly;
  if (duplicateOrderButton) {
    duplicateOrderButton.disabled = !order;
    duplicateOrderButton.textContent = readOnly ? "Copiar pedido" : "Duplicar pedido";
  }
  if (deleteOrderButton) deleteOrderButton.disabled = !order;
  if (ordersBatchPanel && readOnly) {
    ordersBatchPanel.hidden = true;
    ordersBatchPanel.classList.remove("open");
    if (toggleOrdersBatchButton) toggleOrdersBatchButton.setAttribute("aria-expanded", "false");
  }
  if (!ordersTableBody) return;
  Array.from(ordersTableBody.querySelectorAll("tr")).forEach((row) => {
    if (row.dataset.empty === "true") return;
    const productInput = row.querySelector("input[data-field='product']");
    const quantityInput = row.querySelector("input[data-field='quantity']");
    const deleteBtn = row.querySelector("[data-role='delete']");
    if (productInput) productInput.readOnly = readOnly;
    if (quantityInput) quantityInput.readOnly = readOnly;
    if (deleteBtn) deleteBtn.disabled = readOnly;
  });
}

function buildOrderItemMatchKeys(item = {}) {
  const keys = new Set();
  const productId = item.productId ? String(item.productId) : "";
  const instanceId = item.instanceId ? String(item.instanceId) : "";
  const name = item.productName || "";
  const normalized = normalizeProductNameForMatch(name);
  const noSpaces = name.replace(/\s+/g, "").toLowerCase();
  if (productId) keys.add(`id:${productId}`);
  if (instanceId) keys.add(`sel:${instanceId}`);
  if (normalized.clean) keys.add(`name:${normalized.clean}`);
  if (normalized.base) keys.add(`name:${normalized.base}`);
  if (noSpaces) keys.add(`nospace:${noSpaces}`);
  return keys;
}

function buildProductMatchKeys(product = {}) {
  const keys = new Set();
  const productId = product.id !== undefined && product.id !== null ? String(product.id) : "";
  const selectionId = product.selectionId ? String(product.selectionId) : "";
  const name = product.name || "";
  const normalized = normalizeProductNameForMatch(name);
  const noSpaces = name.replace(/\s+/g, "").toLowerCase();
  if (productId) keys.add(`id:${productId}`);
  if (selectionId) keys.add(`sel:${selectionId}`);
  if (normalized.clean) keys.add(`name:${normalized.clean}`);
  if (normalized.base) keys.add(`name:${normalized.base}`);
  if (noSpaces) keys.add(`nospace:${noSpaces}`);
  return keys;
}

function buildActiveOrderItemKeys() {
  const activeOrders = getOrdersList().filter((order) => !order.completedAt);
  const keySet = new Set();
  activeOrders.forEach((order) => {
    (order.items || []).forEach((item) => {
      buildOrderItemMatchKeys(item).forEach((key) => keySet.add(key));
    });
  });
  return keySet;
}

function buildOrdersPlannerModel() {
  const shoppingSummary = buildShoppingStoreSummary();
  const plannedKeys = buildActiveOrderItemKeys();
  const stores = shoppingSummary.stores.map((storeEntry) => {
    const storeKey = normalizeStoreGroupingKey(storeEntry.storeId || "", storeEntry.storeName || "");
    const items = storeEntry.items.map(({ product, source }) => {
      const productKeys = buildProductMatchKeys(product);
      const planned = Array.from(productKeys).some((key) => plannedKeys.has(key));
      return { product, source, planned };
    });
    const pendingCount = items.length;
    const plannedCount = items.filter((item) => item.planned).length;
    const newItems = items.filter((item) => !item.planned);
    const newCount = newItems.length;
    return {
      ...storeEntry,
      key: storeKey,
      pendingCount,
      plannedCount,
      newCount,
      items,
      newItems,
    };
  });
  stores.sort((a, b) => {
    if (b.newCount !== a.newCount) return b.newCount - a.newCount;
    if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
    return (a.storeName || "").localeCompare(b.storeName || "", "es", { sensitivity: "base" });
  });
  return {
    stores,
    totalStores: stores.length,
    totalPending: stores.reduce((acc, store) => acc + store.pendingCount, 0),
    totalPlanned: stores.reduce((acc, store) => acc + store.plannedCount, 0),
    totalNew: stores.reduce((acc, store) => acc + store.newCount, 0),
  };
}

function pickOrderForStore(storeId = "", storeName = "") {
  const normalizedStoreId = String(storeId || "");
  const normalizedStoreName = String(storeName || "").trim().toLowerCase();
  const byStore = getOrdersList().filter((order) => {
    if (normalizedStoreId) {
      return String(order.storeId || "") === normalizedStoreId;
    }
    if (!normalizedStoreName) {
      return String(order.storeId || "") === "";
    }
    const label = (
      order.storeName ||
      getOrderStoreLabel({ storeId: order.storeId || "", fallback: "" }) ||
      ""
    )
      .trim()
      .toLowerCase();
    return label === normalizedStoreName;
  });
  if (!byStore.length) return null;
  const openOrders = byStore.filter((order) => !order.completedAt);
  const futureOpen = openOrders.filter((order) => orderMatchesDateFilter(order, "future"));
  const pool = futureOpen.length ? futureOpen : openOrders.length ? openOrders : byStore;
  return (
    pool
      .slice()
      .sort((a, b) => {
        const aDate = dateValue(resolveOrderPlannedDate(a));
        const bDate = dateValue(resolveOrderPlannedDate(b));
        if (Number.isFinite(aDate) && Number.isFinite(bDate)) return aDate - bDate;
        if (Number.isFinite(aDate)) return -1;
        if (Number.isFinite(bDate)) return 1;
        return (b.updatedAt || "").localeCompare(a.updatedAt || "");
      })[0] || null
  );
}

function pickFutureOpenOrderForStore(storeId = "", storeName = "") {
  const normalizedStoreId = String(storeId || "");
  const normalizedStoreName = String(storeName || "").trim().toLowerCase();
  const byStore = getOrdersList().filter((order) => {
    if (normalizedStoreId) {
      return String(order.storeId || "") === normalizedStoreId;
    }
    if (!normalizedStoreName) {
      return String(order.storeId || "") === "";
    }
    const label = (
      order.storeName ||
      getOrderStoreLabel({ storeId: order.storeId || "", fallback: "" }) ||
      ""
    )
      .trim()
      .toLowerCase();
    return label === normalizedStoreName;
  });
  if (!byStore.length) return null;
  const futureOpen = byStore.filter(
    (order) => !order.completedAt && orderMatchesDateFilter(order, "future")
  );
  if (!futureOpen.length) return null;
  return (
    futureOpen
      .slice()
      .sort((a, b) => {
        const aDate = dateValue(resolveOrderPlannedDate(a));
        const bDate = dateValue(resolveOrderPlannedDate(b));
        if (Number.isFinite(aDate) && Number.isFinite(bDate)) return aDate - bDate;
        if (Number.isFinite(aDate)) return -1;
        if (Number.isFinite(bDate)) return 1;
        return (b.updatedAt || "").localeCompare(a.updatedAt || "");
      })[0] || null
  );
}

function setOrdersStoreValue(storeId = "") {
  if (!ordersStoreSelect) return "";
  const normalized = String(storeId || "");
  const hasOption = Array.from(ordersStoreSelect.options || []).some((opt) => opt.value === normalized);
  ordersStoreSelect.value = hasOption ? normalized : "";
  return ordersStoreSelect.value;
}

function openOrCreateOrderForStore(storeId = "", storeName = "") {
  const selectedStoreId = setOrdersStoreValue(storeId);
  const effectiveStoreId = selectedStoreId || String(storeId || "");
  currentOrderStoreId = effectiveStoreId;
  const existing = pickOrderForStore(effectiveStoreId, storeName);
  if (existing) {
    currentOrderId = existing.id || "";
    renderOrdersSection(true);
    return existing;
  }
  currentOrderId = "";
  handleNewOrder();
  const finalStoreId = setOrdersStoreValue(selectedStoreId) || effectiveStoreId;
  currentOrderStoreId = finalStoreId;
  if (ordersNameInput && !ordersNameInput.value.trim()) {
    const label = storeName || getOrderStoreLabel({ storeId: finalStoreId }) || "Pedido";
    const planned = ordersPlannedDate?.value || todayDateString();
    ordersNameInput.value = `${label} ${planned}`.trim();
  }
  updateOrdersSummaryFromTable();
  return null;
}

function resolveOrderLabelForPlannerItem(product = {}) {
  const productId = product.id !== undefined && product.id !== null ? String(product.id) : "";
  const selectionId = product.selectionId ? String(product.selectionId) : "";
  const option = Array.from(orderProductOptionMap.values()).find((entry) => {
    if (productId && entry.productId && String(entry.productId) === productId) return true;
    if (selectionId && entry.instanceId && String(entry.instanceId) === selectionId) return true;
    return false;
  });
  return option?.markerLabel || option?.productName || product.name || "";
}

function appendPlannerItemsToCurrentOrder(
  storePlan,
  { targetOrderId = "", autoOpenStoreOrder = true } = {}
) {
  if (!storePlan || !Array.isArray(storePlan.items) || !ordersTableBody) return 0;
  const normalizedTargetOrderId = String(targetOrderId || "");
  if (normalizedTargetOrderId) {
    const targetOrder = getOrderById(normalizedTargetOrderId);
    if (!targetOrder) return 0;
    currentOrderId = targetOrder.id || "";
    currentOrderStoreId = targetOrder.storeId || storePlan.storeId || "";
    setOrdersStoreValue(currentOrderStoreId);
    setOrdersSubview("operative");
    renderOrdersSection(true);
  } else if (autoOpenStoreOrder) {
    openOrCreateOrderForStore(storePlan.storeId || "", storePlan.storeName || "");
  }
  const { order, storeId } = getCurrentOrderContext();
  buildOrderProductOptions(storeId, order);
  const existing = readOrderRows();
  const pending = storePlan.items.filter((item) => !item.planned);
  if (!pending.length) return 0;
  removeOrdersPlaceholder();
  let added = 0;
  pending.forEach(({ product }) => {
    if (!product) return;
    const duplicate = existing.some((item) => productMatchesOrderItem(product, item));
    if (duplicate) return;
    const row = createOrderRow({
      productName: resolveOrderLabelForPlannerItem(product) || product.name || "",
      quantity:
        product.quantity === undefined || product.quantity === null ? "" : String(product.quantity).trim(),
      instanceId: product.selectionId || "",
      productId: product.id || "",
      missing: true,
    });
    if (!row || !ordersTableBody) return;
    ordersTableBody.appendChild(row);
    existing.push({
      productName: product.name || "",
      instanceId: product.selectionId || "",
      productId: product.id || "",
      quantity: "",
    });
    added += 1;
  });
  applyOrdersFilters();
  updateOrdersSummaryFromTable();
  return added;
}

function renderOrdersPlanner() {
  if (!ordersPlannerList || !ordersPlannerSummary) return;
  const model = buildOrdersPlannerModel();
  const proposedStores = model.stores
    .filter((store) => Number(store.newCount) > 0)
    .map((store) => {
      const futureOpenOrder = pickFutureOpenOrderForStore(
        store.storeId || "",
        store.storeName || ""
      );
      return {
        ...store,
        futureOpenOrderId: futureOpenOrder?.id || "",
      };
    });
  const totalSuggested = proposedStores.reduce((acc, store) => acc + (Number(store.newCount) || 0), 0);
  ordersPlannerStoreMap = new Map(proposedStores.map((store) => [store.key, store]));
  ordersPlannerSummary.textContent = `${totalSuggested} sugerido(s) · ${proposedStores.length} tienda(s)`;
  ordersPlannerList.innerHTML = "";
  if (!proposedStores.length) {
    const empty = document.createElement("div");
    empty.className = "orders-planner-empty";
    empty.textContent = "No hay propuestas pendientes con productos sugeridos.";
    ordersPlannerList.appendChild(empty);
    return;
  }
  const frag = document.createDocumentFragment();
  proposedStores.forEach((store) => {
    const card = document.createElement("article");
    card.className = "orders-planner-store";
    card.dataset.storeKey = store.key;

    const head = document.createElement("div");
    head.className = "orders-planner-head";
    const name = document.createElement("div");
    name.className = "orders-planner-store-name";
    name.textContent = store.storeName || "Sin tienda";
    const metrics = document.createElement("div");
    metrics.className = "orders-planner-metrics";
    metrics.textContent = `Pendientes: ${store.pendingCount} · Nuevos: ${store.newCount} · En pedido: ${store.plannedCount}`;
    head.appendChild(name);
    head.appendChild(metrics);

    const actions = document.createElement("div");
    actions.className = "orders-planner-actions";
    const createBtn = document.createElement("button");
    createBtn.type = "button";
    createBtn.className = "btn btn-primary btn-small";
    createBtn.dataset.role = "create-store-order";
    createBtn.dataset.storeKey = store.key;
    createBtn.textContent = "Crear pedido";
    actions.appendChild(createBtn);
    if (store.futureOpenOrderId) {
      const appendBtn = document.createElement("button");
      appendBtn.type = "button";
      appendBtn.className = "btn btn-secondary btn-small";
      appendBtn.dataset.role = "append-store-pending";
      appendBtn.dataset.storeKey = store.key;
      appendBtn.dataset.orderId = store.futureOpenOrderId;
      appendBtn.textContent = "Añadir a pedido abierto";
      actions.appendChild(appendBtn);
    }

    const preview = document.createElement("ul");
    preview.className = "orders-planner-preview";
    store.newItems.slice(0, 4).forEach(({ product }) => {
      const li = document.createElement("li");
      const quantity =
        product?.quantity === undefined || product?.quantity === null
          ? ""
          : String(product.quantity).trim();
      const label = quantity ? `${product?.name || ""} — ${quantity}` : product?.name || "";
      li.textContent = label || "Producto sin nombre";
      preview.appendChild(li);
    });
    if (store.newItems.length > 4) {
      const li = document.createElement("li");
      li.className = "orders-planner-preview-muted";
      li.textContent = `+${store.newItems.length - 4} más`;
      preview.appendChild(li);
    }

    card.appendChild(head);
    card.appendChild(actions);
    card.appendChild(preview);
    frag.appendChild(card);
  });
  ordersPlannerList.appendChild(frag);
}

function handleOrdersPlannerClick(e) {
  const button = e.target?.closest("button[data-role]");
  if (!button) return;
  const storeKey = button.dataset.storeKey || "";
  const storePlan = ordersPlannerStoreMap.get(storeKey);
  if (!storePlan) return;
  if (button.dataset.role === "create-store-order") {
    const pending = Array.isArray(storePlan.items)
      ? storePlan.items.filter((item) => !item.planned)
      : [];
    if (!pending.length) {
      showToast("No hay productos sugeridos nuevos para crear este pedido");
      return;
    }
    const created = createNewOrderDraft(storePlan.storeId || "", {
      clearFilters: true,
      switchToOperative: true,
    });
    const added = appendPlannerItemsToCurrentOrder(storePlan, {
      targetOrderId: created?.id || "",
      autoOpenStoreOrder: false,
    });
    saveOrdersForCurrentStore({ silent: true, removeIfEmpty: false });
    showToast(
      `Pedido creado en ${storePlan.storeName || "la tienda"} con ${added} producto(s)`
    );
    return;
  }
  if (button.dataset.role !== "append-store-pending") return;
  const targetOrderId = button.dataset.orderId || storePlan.futureOpenOrderId || "";
  if (!targetOrderId) return;
  const added = appendPlannerItemsToCurrentOrder(storePlan, {
    targetOrderId,
    autoOpenStoreOrder: false,
  });
  if (!added) {
    showToast("No hay productos nuevos para añadir en esta tienda");
    return;
  }
  saveOrdersForCurrentStore({ silent: true, removeIfEmpty: false });
  showToast(`Añadidos ${added} producto(s) al pedido de ${storePlan.storeName || "la tienda"}`);
}

function renderOrdersKpis() {
  if (!ordersKpis) return;
  const planner = buildOrdersPlannerModel();
  const suggestedStores = planner.stores.filter((store) => Number(store.newCount) > 0);
  const activeOrders = getOrdersList().filter((order) => !order.completedAt);
  const metrics = [
    { label: "Productos sin Pedido", value: planner.totalNew },
    { label: "Sugerencias", value: suggestedStores.length },
    { label: "Pedidos activos", value: activeOrders.length },
  ];
  ordersKpis.innerHTML = metrics
    .map((item) => `<span class="orders-kpi"><strong>${item.value}</strong> ${item.label}</span>`)
    .join("");
}

function setOrdersSubview(view = "operative") {
  const normalized = view === "history" ? "history" : "operative";
  currentOrdersSubview = normalized;
  if (ordersViewOperativeButton) ordersViewOperativeButton.classList.toggle("active", normalized === "operative");
  if (ordersViewHistoryButton) ordersViewHistoryButton.classList.toggle("active", normalized === "history");
  if (ordersOperativeView) {
    const active = normalized === "operative";
    ordersOperativeView.hidden = !active;
    ordersOperativeView.classList.toggle("active", active);
  }
  if (ordersHistoryView) {
    const active = normalized === "history";
    ordersHistoryView.hidden = !active;
    ordersHistoryView.classList.toggle("active", active);
  }
  if (normalized === "history") renderSavedOrdersList();
}

function normalizeOrderSearchText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[★☆]/g, "")
    .toLowerCase()
    .trim();
}

function orderMatchesSavedSearch(order = {}, rawSearch = "") {
  const normalizedSearch = normalizeOrderSearchText(rawSearch);
  if (!normalizedSearch) return true;
  const tokens = normalizedSearch.split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const storeLabel = getOrderStoreLabel({
    storeId: order.storeId || "",
    fallback: order.storeName || "Sin tienda",
  });
  const itemText = Array.isArray(order.items)
    ? order.items
        .map((item) =>
          [item?.productName || "", item?.quantity || ""]
            .map((part) => String(part || "").trim())
            .filter(Boolean)
            .join(" ")
        )
        .join(" ")
    : "";
  const haystack = normalizeOrderSearchText(
    [order.name || "", storeLabel, itemText].filter(Boolean).join(" ")
  );
  return tokens.every((token) => haystack.includes(token));
}

function renderOrdersCalendarView() {
  if (!ordersCalendarList) return;
  const storeId = ordersStoreSelect ? ordersStoreSelect.value : "";
  const search = (ordersSavedSearchInput?.value || "").trim();
  const dateFilter = ordersDateFilterSelect?.value || "";
  const list = getOrdersList()
    .filter(
      (order) =>
        !order.completedAt &&
        (!storeId || String(order.storeId || "") === String(storeId)) &&
        orderMatchesDateFilter(order, dateFilter) &&
        orderMatchesSavedSearch(order, search)
    )
    .slice()
    .sort((a, b) => {
      const aDate = dateValue(resolveOrderPlannedDate(a));
      const bDate = dateValue(resolveOrderPlannedDate(b));
      if (Number.isFinite(aDate) && Number.isFinite(bDate) && aDate !== bDate) return aDate - bDate;
      if (Number.isFinite(aDate) && !Number.isFinite(bDate)) return -1;
      if (!Number.isFinite(aDate) && Number.isFinite(bDate)) return 1;
      return (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" });
    });
  const grouped = new Map();
  list.forEach((order) => {
    const key = resolveOrderPlannedDate(order) || "Sin fecha";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(order);
  });
  ordersCalendarList.innerHTML = "";
  if (ordersCalendarSummary) {
    ordersCalendarSummary.textContent = `Calendario · ${list.length} pedido(s) programado(s)`;
  }
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "orders-calendar-empty";
    empty.textContent = "No hay pedidos programados para el filtro actual.";
    ordersCalendarList.appendChild(empty);
    return;
  }
  const frag = document.createDocumentFragment();
  Array.from(grouped.entries()).forEach(([dateLabel, ordersInDate]) => {
    const block = document.createElement("section");
    block.className = "orders-calendar-day";
    const title = document.createElement("h4");
    title.textContent = dateLabel;
    block.appendChild(title);
    const items = document.createElement("div");
    items.className = "orders-calendar-items";
    ordersInDate.forEach((order) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "orders-calendar-item";
      btn.dataset.role = "open-calendar-order";
      btn.dataset.orderId = order.id || "";
      const store = getOrderStoreLabel({
        storeId: order.storeId || "",
        fallback: order.storeName || "Sin tienda",
      });
      const count = Array.isArray(order.items) ? order.items.length : 0;
      const name = order.name || store;
      btn.innerHTML = `<span>${name}</span><small>${store} · ${count} producto(s)</small>`;
      items.appendChild(btn);
    });
    block.appendChild(items);
    frag.appendChild(block);
  });
  ordersCalendarList.appendChild(frag);
}

function handleOrdersViewOperativeClick() {
  setOrdersSubview("operative");
}

function handleOrdersViewCalendarClick() {
  setOrdersSubview("calendar");
}

function handleOrdersViewHistoryClick() {
  setOrdersSubview("history");
}

function handleOrdersCalendarClick(e) {
  const btn = e.target?.closest("button[data-role='open-calendar-order']");
  if (!btn) return;
  const orderId = btn.dataset.orderId || "";
  if (!orderId) return;
  currentOrderId = orderId;
  setOrdersSubview("operative");
  renderOrdersSection(true);
}

function renderOrdersTable(order, storeId) {
  if (!ordersTableBody) return;
  ordersTableBody.innerHTML = "";
  const items = Array.isArray(order?.items) ? order.items : [];
  if (!items.length) {
    addOrdersPlaceholderRow();
  } else {
    const frag = document.createDocumentFragment();
    items.forEach((item) => {
      const row = createOrderRow(item);
      if (row) frag.appendChild(row);
    });
    ordersTableBody.appendChild(frag);
  }
  renderOrdersSummary(order, storeId);
  applyOrdersFilters();
}

function renderOrdersSection(force = false) {
  if (!ordersSection || !ordersTableBody) return;
  const active = isActiveSection(ordersSection);
  if (!force && !active) {
    ordersNeedsRender = true;
    return;
  }
  const { order, storeId } = getCurrentOrderContext();
  applyOrderMetaToInputs(order);
  buildOrderProductOptions(storeId, order);
  renderOrdersKpis();
  renderOrdersPlanner();
  renderOrdersTable(order || { items: [] }, storeId);
  syncOrdersReadOnlyState(order || null);
  renderSavedOrdersList();
  setOrdersSubview(currentOrdersSubview);
  ordersNeedsRender = false;
}

function readOrderRows() {
  if (!ordersTableBody) return [];
  const rows = Array.from(ordersTableBody.querySelectorAll("tr")).filter(
    (row) => row.dataset.empty !== "true"
  );
  const items = [];
  rows.forEach((row) => {
    const payload = getOrderRowPayload(row);
    if (!payload) return;
    if (!payload.productName && !payload.quantity) return;
    const expiryText = getOrderItemExpiryText(payload);
    row.dataset.expiryText = expiryText || "";
    items.push({
      id: payload.id || "",
      productName: payload.productName || "",
      quantity: payload.quantity || "",
      instanceId: payload.instanceId || "",
      productId: payload.productId || "",
      expiryText,
    });
  });
  return items;
}

function clearOrdersHistoryPreviewTable(message = "Selecciona un pedido histórico para ver su detalle.") {
  if (!ordersHistoryPreviewTableBody) return;
  ordersHistoryPreviewTableBody.innerHTML = "";
  const tr = document.createElement("tr");
  tr.dataset.empty = "true";
  const td = document.createElement("td");
  td.colSpan = 4;
  td.textContent = message;
  tr.appendChild(td);
  ordersHistoryPreviewTableBody.appendChild(tr);
}

function createHistoryPreviewRow(item = {}) {
  const row = createOrderRow(item);
  if (!row) return null;
  const productInput = row.querySelector("input[data-field='product']");
  if (productInput) {
    productInput.readOnly = true;
    productInput.setAttribute("aria-readonly", "true");
    productInput.removeAttribute("list");
  }
  const quantityInput = row.querySelector("input[data-field='quantity']");
  if (quantityInput) {
    quantityInput.readOnly = true;
    quantityInput.setAttribute("aria-readonly", "true");
  }
  const deleteButton = row.querySelector("button[data-role='delete']");
  if (deleteButton) deleteButton.remove();
  const actionsCell = row.querySelector(".orders-actions-cell");
  if (actionsCell) actionsCell.textContent = "";
  return row;
}

function setOrdersHistoryMetaState({
  name = "",
  plannedDate = "",
  price = "",
  disabled = true,
} = {}) {
  if (ordersHistoryNameInput) {
    ordersHistoryNameInput.value = name;
    ordersHistoryNameInput.disabled = !!disabled;
  }
  if (ordersHistoryDateInput) {
    ordersHistoryDateInput.value = plannedDate;
    ordersHistoryDateInput.disabled = !!disabled;
  }
  if (ordersHistoryPriceInput) {
    ordersHistoryPriceInput.value = price;
    ordersHistoryPriceInput.disabled = !!disabled;
  }
}

function handleOrdersHistoryMetaChange() {
  if (!ordersHistoryNameInput && !ordersHistoryDateInput && !ordersHistoryPriceInput) return;
  const order = currentOrderId ? getOrderById(currentOrderId) : null;
  if (!order || !order.completedAt) {
    setOrdersHistoryMetaState({ disabled: true });
    return;
  }
  const nextName = (ordersHistoryNameInput?.value || "").trim();
  const nextPlannedDate = (ordersHistoryDateInput?.value || "").trim();
  const nextPrice = (ordersHistoryPriceInput?.value || "").trim();
  const currentName = (order.name || "").trim();
  const currentPlannedDate = (
    order.plannedDate || resolveOrderPlannedDate(order) || ""
  ).trim();
  const currentPrice = (order.price || "").trim();
  if (
    nextName === currentName &&
    nextPlannedDate === currentPlannedDate &&
    nextPrice === currentPrice
  ) {
    return;
  }
  const now = nowIsoString();
  const next = getOrdersList().map((entry) =>
    String(entry.id || "") === String(order.id || "")
      ? {
          ...entry,
          name: nextName,
          plannedDate: nextPlannedDate,
          completedPlannedDate: entry.completedAt ? nextPlannedDate : entry.completedPlannedDate || "",
          price: nextPrice,
          updatedAt: now,
        }
      : entry
  );
  setOrdersList(next);
  renderSavedOrdersList();
  renderOrdersHistoryPreview();
  showToast("Pedido histórico actualizado", 1400);
}

function renderOrdersHistoryPreview() {
  if (!ordersHistoryPreview || !ordersHistoryPreviewSummary || !ordersHistoryPreviewTableBody) return;
  const order = currentOrderId ? getOrderById(currentOrderId) : null;
  if (currentOrdersSubview !== "history") {
    ordersHistoryPreview.hidden = true;
    ordersHistoryPreviewSummary.textContent = "Detalle pedido histórico";
    setOrdersHistoryMetaState({ disabled: true });
    clearOrdersHistoryPreviewTable();
    return;
  }
  if (!order || !order.completedAt) {
    ordersHistoryPreviewSummary.textContent = "Detalle pedido histórico";
    setOrdersHistoryMetaState({ disabled: true });
    clearOrdersHistoryPreviewTable();
    ordersHistoryPreview.hidden = false;
    return;
  }
  const store = getOrderStoreLabel({
    storeId: order.storeId || "",
    fallback: order.storeName || "Sin tienda",
  });
  const done = (order.completedAt || "").slice(0, 10) || "Sin fecha";
  const count = Array.isArray(order.items) ? order.items.length : 0;
  const currentName = (order.name || "").trim();
  const currentPlannedDate = (order.plannedDate || resolveOrderPlannedDate(order) || "").trim();
  const currentPrice = (order.price || "").trim();
  setOrdersHistoryMetaState({
    name: currentName,
    plannedDate: currentPlannedDate,
    price: currentPrice,
    disabled: false,
  });
  if (ordersHistoryNameInput) {
    ordersHistoryNameInput.placeholder = `Ej. ${store}`;
  }
  ordersHistoryPreviewSummary.textContent = `${done} · ${store} · ${count} producto(s)${currentPrice ? ` · €${currentPrice}` : ""}`;
  ordersHistoryPreviewTableBody.innerHTML = "";
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) {
    clearOrdersHistoryPreviewTable("Este pedido no tiene productos.");
    ordersHistoryPreview.hidden = false;
    return;
  }
  const frag = document.createDocumentFragment();
  items.forEach((item) => {
    const row = createHistoryPreviewRow(item);
    if (row) frag.appendChild(row);
  });
  if (!frag.childNodes.length) {
    clearOrdersHistoryPreviewTable("Este pedido no tiene productos.");
    ordersHistoryPreview.hidden = false;
    return;
  }
  ordersHistoryPreviewTableBody.appendChild(frag);
  ordersHistoryPreview.hidden = false;
}

function renderSavedOrdersList() {
  if (!ordersSavedList) return;
  const storeId = ordersStoreSelect ? ordersStoreSelect.value : "";
  const dateFilter = ordersDateFilterSelect?.value || "";
  const search = (ordersSavedSearchInput?.value || "").trim();
  const byStore = getOrdersList().filter((order) =>
    (storeId ? String(order.storeId || "") === String(storeId) : true) &&
    orderMatchesSavedSearch(order, search)
  );
  const activeOrders = byStore.filter(
    (order) => !order.completedAt && orderMatchesDateFilter(order, dateFilter)
  );
  const historyOrders = byStore.filter(
    (order) => !!order.completedAt && orderMatchesDateFilter(order, dateFilter)
  );
  const filterLabel = getOrdersDateFilterLabel(dateFilter);
  const createHistoryCalendarEntry = (order) => {
    const row = document.createElement("div");
    row.className = "orders-calendar-item-row";
    row.dataset.orderId = order.id || "";
    row.dataset.storeId = order.storeId || "";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "orders-calendar-item";
    btn.dataset.orderId = order.id || "";
    btn.dataset.storeId = order.storeId || "";
    btn.dataset.role = "open-history-order";
    btn.dataset.history = "1";
    const store = getOrderStoreLabel({
      storeId: order.storeId || "",
      fallback: order.storeName || "Sin tienda",
    });
    const count = Array.isArray(order.items) ? order.items.length : 0;
    const name = order.name || store;
    if (String(currentOrderId || "") === String(order.id || "")) {
      btn.classList.add("is-active");
    }
    btn.innerHTML = `<span>${name}</span><small>${store} · ${count} producto(s)</small>`;
    btn.title = `Ver pedido del histórico · ${store}`;
    row.appendChild(btn);

    const actions = document.createElement("div");
    actions.className = "orders-calendar-item-actions";
    const actionDefs = [
      { key: "duplicate", icon: "⧉", title: "Duplicar pedido" },
      { key: "delete", icon: "🗑", title: "Eliminar pedido" },
    ];
    actionDefs.forEach((def) => {
      const actionBtn = document.createElement("button");
      actionBtn.type = "button";
      actionBtn.className = "btn btn-small btn-icon orders-calendar-action";
      actionBtn.dataset.orderAction = def.key;
      actionBtn.dataset.orderId = order.id || "";
      actionBtn.dataset.storeId = order.storeId || "";
      actionBtn.dataset.history = "1";
      actionBtn.title = def.title;
      actionBtn.setAttribute("aria-label", def.title);
      actionBtn.textContent = def.icon;
      actions.appendChild(actionBtn);
    });
    row.appendChild(actions);
    return row;
  };
  const sortActive = (a, b) => {
    const aDate = dateValue(resolveOrderPlannedDate(a));
    const bDate = dateValue(resolveOrderPlannedDate(b));
    if (Number.isFinite(aDate) && Number.isFinite(bDate) && aDate !== bDate) return aDate - bDate;
    if (Number.isFinite(aDate) && !Number.isFinite(bDate)) return -1;
    if (!Number.isFinite(aDate) && Number.isFinite(bDate)) return 1;
    return (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" });
  };
  const sortHistory = (a, b) => {
    const aPlanned = dateValue(resolveOrderPlannedDate(a));
    const bPlanned = dateValue(resolveOrderPlannedDate(b));
    if (Number.isFinite(aPlanned) && Number.isFinite(bPlanned) && aPlanned !== bPlanned) return bPlanned - aPlanned;
    if (Number.isFinite(aPlanned) && !Number.isFinite(bPlanned)) return -1;
    if (!Number.isFinite(aPlanned) && Number.isFinite(bPlanned)) return 1;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  };
  ordersSavedList.innerHTML = "";
  if (!activeOrders.length) {
    const empty = document.createElement("div");
    empty.className = "orders-calendar-empty";
    empty.textContent = "No hay pedidos activos para el filtro actual.";
    ordersSavedList.appendChild(empty);
  } else {
    const createActiveCalendarEntry = (order) => {
      const row = document.createElement("div");
      row.className = "orders-calendar-item-row";
      row.dataset.orderId = order.id || "";
      row.dataset.storeId = order.storeId || "";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "orders-calendar-item";
      btn.dataset.orderId = order.id || "";
      btn.dataset.storeId = order.storeId || "";
      btn.dataset.role = "open-active-order";
      const store = getOrderStoreLabel({
        storeId: order.storeId || "",
        fallback: order.storeName || "Sin tienda",
      });
      const count = Array.isArray(order.items) ? order.items.length : 0;
      const name = order.name || store;
      if (String(currentOrderId || "") === String(order.id || "")) {
        btn.classList.add("is-active");
      }
      btn.innerHTML = `<span>${name}</span><small>${store} · ${count} producto(s)</small>`;
      btn.title = `Abrir pedido · ${store}`;
      row.appendChild(btn);

      const actions = document.createElement("div");
      actions.className = "orders-calendar-item-actions";
      const actionDefs = [
        { key: "duplicate", icon: "⧉", title: "Duplicar pedido" },
        { key: "complete", icon: "✓", title: "Marcar como realizado" },
        { key: "delete", icon: "🗑", title: "Eliminar pedido" },
      ];
      actionDefs.forEach((def) => {
        const actionBtn = document.createElement("button");
        actionBtn.type = "button";
        actionBtn.className = "btn btn-small btn-icon orders-calendar-action";
        actionBtn.dataset.orderAction = def.key;
        actionBtn.dataset.orderId = order.id || "";
        actionBtn.dataset.storeId = order.storeId || "";
        actionBtn.title = def.title;
        actionBtn.setAttribute("aria-label", def.title);
        actionBtn.textContent = def.icon;
        actions.appendChild(actionBtn);
      });
      row.appendChild(actions);
      return row;
    };
    const groupedActive = new Map();
    activeOrders
      .slice()
      .sort(sortActive)
      .forEach((order) => {
        const key = resolveOrderPlannedDate(order) || "Sin fecha";
        if (!groupedActive.has(key)) groupedActive.set(key, []);
        groupedActive.get(key).push(order);
      });
    const frag = document.createDocumentFragment();
    Array.from(groupedActive.entries()).forEach(([dateLabel, ordersInDate]) => {
      const block = document.createElement("section");
      block.className = "orders-calendar-day";
      const title = document.createElement("h4");
      title.textContent = dateLabel;
      block.appendChild(title);
      const items = document.createElement("div");
      items.className = "orders-calendar-items";
      ordersInDate.forEach((order) => {
        items.appendChild(createActiveCalendarEntry(order));
      });
      block.appendChild(items);
      frag.appendChild(block);
    });
    ordersSavedList.appendChild(frag);
  }
  if (!ordersHistoryList || !ordersHistorySummary) {
    return;
  }
  const historyCount = historyOrders.length;
  ordersHistorySummary.textContent = dateFilter
    ? `Histórico · ${filterLabel} · ${historyCount} pedido(s)`
    : `Histórico · ${historyCount} pedido(s)`;
  ordersHistoryList.innerHTML = "";
  if (!historyCount) {
    const empty = document.createElement("div");
    empty.className = "orders-calendar-empty";
    empty.textContent = storeId
      ? "No hay pedidos realizados para esta tienda."
      : "No hay pedidos realizados con el filtro actual.";
    ordersHistoryList.appendChild(empty);
    renderOrdersHistoryPreview();
    return;
  }
  const sortedHistory = historyOrders.slice().sort(sortHistory);
  const grouped = new Map();
  sortedHistory.forEach((order) => {
    const key = resolveOrderPlannedDate(order) || (order.completedAt || "").slice(0, 10) || "Sin fecha";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(order);
  });
  const historyFrag = document.createDocumentFragment();
  Array.from(grouped.entries()).forEach(([dateLabel, ordersInDate]) => {
    const block = document.createElement("section");
    block.className = "orders-calendar-day";
    const title = document.createElement("h4");
    title.textContent = dateLabel;
    block.appendChild(title);
    const items = document.createElement("div");
    items.className = "orders-calendar-items";
    ordersInDate.forEach((order) => {
      items.appendChild(createHistoryCalendarEntry(order));
    });
    block.appendChild(items);
    historyFrag.appendChild(block);
  });
  ordersHistoryList.appendChild(historyFrag);
  renderOrdersHistoryPreview();
}

function generateOrderId() {
  return crypto?.randomUUID ? crypto.randomUUID() : `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function saveOrdersForCurrentStore({ silent = false, removeIfEmpty = true } = {}) {
  const storeId = (ordersStoreSelect && ordersStoreSelect.value) || currentOrderStoreId || "";
  const orderName = (ordersNameInput?.value || "").trim();
  const plannedDate = (ordersPlannedDate?.value || "").trim();
  const price = (ordersPriceInput?.value || "").trim();
  const existing = currentOrderId ? getOrderById(currentOrderId) : null;
  if (ordersReadOnly && existing?.completedAt) {
    if (!silent) showToast("El histórico es de solo consulta. Duplica para editar.");
    return;
  }
  const items = readOrderRows();
  let next = getOrdersList().slice();
  const idx = existing ? next.findIndex((o) => String(o.id) === String(existing.id)) : -1;
  if (items.length === 0 && removeIfEmpty && existing) {
    next.splice(idx, 1);
    currentOrderId = "";
  } else {
    const now = nowIsoString();
    const base = existing || {};
    const id = base.id || currentOrderId || generateOrderId();
    const payload = {
      ...base,
      id,
      name: orderName,
      plannedDate,
      price,
      completedAt: base.completedAt || "",
      completedPlannedDate: base.completedPlannedDate || "",
      storeId,
      storeName: getStoreName(storeId) || base.storeName || getOrderStoreLabel({ storeId }),
      items,
      updatedAt: now,
      createdAt: base.createdAt || now,
    };
    if (idx >= 0) next[idx] = payload;
    else next.push(payload);
    currentOrderId = id;
  }
  setOrdersList(next);
  renderOrdersSection(true);
  if (!silent) {
    showToast("Pedidos guardados");
  }
}

function handleOrdersDateFilterChange() {
  renderOrdersSection(true);
}

function handleOrdersSavedSearchInput() {
  renderSavedOrdersList();
}

function handleOrdersStoreChange() {
  currentOrderStoreId = ordersStoreSelect ? ordersStoreSelect.value : "";
  if (!currentOrderStoreId) {
    currentOrderId = "";
    renderOrdersSection(true);
    return;
  }
  const byStore =
    getOrdersList().find((o) => !o.completedAt && sameStoreId(o.storeId, currentOrderStoreId)) ||
    getOrdersList().find((o) => sameStoreId(o.storeId, currentOrderStoreId)) ||
    null;
  // Al cambiar tienda, actualizamos el contexto al pedido de esa tienda (o vacío si no existe).
  currentOrderId = byStore ? byStore.id || "" : "";
  renderOrdersSection(true);
}

function handleAddOrderItem() {
  if (ordersReadOnly) {
    showToast("El histórico es de solo consulta. Duplica para editar.");
    return;
  }
  const { order, storeId } = getCurrentOrderContext();
  buildOrderProductOptions(storeId, order);
  removeOrdersPlaceholder();
  const row = createOrderRow();
  if (!row || !ordersTableBody) return;
  ordersTableBody.appendChild(row);
  const input = row.querySelector("input[data-field='product']");
  if (input) input.focus();
  updateOrdersSummaryFromTable();
}

function handleOrdersTableClick(e) {
  if (ordersReadOnly) return;
  const target = e.target?.closest("[data-role='delete']") || null;
  if (!target) return;
  const row = target.closest("tr");
  if (row && typeof row.remove === "function") {
    row.remove();
  }
  if (!ordersTableBody) return;
  const hasRows = ordersTableBody.querySelector("tr");
  if (!hasRows) {
    addOrdersPlaceholderRow();
  }
  updateOrdersSummaryFromTable();
}

function handleOrdersInputChange(e) {
  if (ordersReadOnly) return;
  const target = e.target;
  if (!target) return;
  const field = target.dataset.field || "";
  const row = target.closest("tr");
  if (!row) return;
  if (field === "product") updateOrderRowExpiry(row);
}

function handleOrdersTableKeydown(e) {
  if (ordersReadOnly) return;
  if (e.key !== "Enter") return;
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.field !== "quantity") return;
  e.preventDefault();
  if (!ordersTableBody) return;
  const rows = Array.from(ordersTableBody.querySelectorAll("tr")).filter(
    (row) => row.dataset.empty !== "true" && row.style.display !== "none"
  );
  const row = target.closest("tr");
  if (!row || !rows.length) return;
  const index = rows.findIndex((candidate) => candidate === row);
  const nextRow = index >= 0 && index < rows.length - 1 ? rows[index + 1] : null;
  if (nextRow) {
    const nextQuantity = nextRow.querySelector("input[data-field='quantity']");
    if (nextQuantity) nextQuantity.focus();
    return;
  }
  handleAddOrderItem();
  const newestRow = Array.from(ordersTableBody.querySelectorAll("tr"))
    .filter((candidate) => candidate.dataset.empty !== "true")
    .pop();
  const newestQuantity = newestRow?.querySelector("input[data-field='quantity']");
  if (newestQuantity) newestQuantity.focus();
}

function handleClearOrder() {
  if (ordersReadOnly) {
    showToast("El histórico es de solo consulta. Duplica para editar.");
    return;
  }
  if (!ordersTableBody) return;
  ordersTableBody.innerHTML = "";
  addOrdersPlaceholderRow();
  saveOrdersForCurrentStore({ silent: true, removeIfEmpty: false });
  renderOrdersSummary({ items: [], name: ordersNameInput?.value || "" }, ordersStoreSelect ? ordersStoreSelect.value : "");
}

function handleDeleteOrder() {
  const current = currentOrderId ? getOrderById(currentOrderId) : null;
  const mode = current?.completedAt ? "histórico" : "activo";
  const confirmed = window.confirm
    ? window.confirm(`¿Eliminar este pedido ${mode}? Esta acción no se puede deshacer.`)
    : true;
  if (!confirmed) return;
  const targetId = currentOrderId || "";
  const next = getOrdersList().filter((o) => String(o.id) !== String(targetId));
  setOrdersList(next);
  const nextActive = next.find((order) => !order.completedAt) || next[0] || null;
  currentOrderId = nextActive ? nextActive.id || "" : "";
  currentOrderStoreId = nextActive ? nextActive.storeId || "" : "";
  renderOrdersSection(true);
  showToast("Pedido eliminado");
  renderSavedOrdersList();
}

function handleSaveOrders() {
  if (ordersReadOnly) {
    showToast("El histórico es de solo consulta. Duplica para editar.");
    return;
  }
  saveOrdersForCurrentStore();
}

function handleOrdersSavedClick(e) {
  const actionBtn = e.target?.closest("button[data-order-action]");
  if (actionBtn) {
    const orderId = actionBtn.dataset.orderId || "";
    if (!orderId) return;
    currentOrderId = orderId;
    const action = actionBtn.dataset.orderAction || "";
    if (action === "duplicate") {
      handleDuplicateOrder();
      return;
    }
    if (action === "complete") {
      handleCompleteOrder();
      return;
    }
    if (action === "delete") {
      handleDeleteOrder();
      return;
    }
    return;
  }
  const btn = e.target?.closest("button[data-role='open-active-order'][data-order-id]");
  if (!btn) return;
  const orderId = btn.dataset.orderId || "";
  if (!orderId) return;
  currentOrderId = orderId;
  renderOrdersSection(true);
}

function handleOrdersHistoryClick(e) {
  const actionBtn = e.target?.closest("button[data-order-action]");
  if (actionBtn) {
    const orderId = actionBtn.dataset.orderId || "";
    if (!orderId) return;
    currentOrderId = orderId;
    const action = actionBtn.dataset.orderAction || "";
    if (action === "duplicate") {
      handleDuplicateOrder();
      return;
    }
    if (action === "delete") {
      handleDeleteOrder();
      return;
    }
    return;
  }
  const btn = e.target?.closest("button[data-role='open-history-order'][data-order-id]");
  if (!btn) return;
  const orderId = btn.dataset.orderId || "";
  if (!orderId) return;
  currentOrderId = orderId;
  renderOrdersSection(true);
}

function promptStoreForNewOrder() {
  const stores = getSuppliersList()
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" }))
    .map((store) => ({
      id: String(store?.id || ""),
      name: (store?.name || "").trim() || "(sin nombre)",
    }));

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "orders-store-picker-overlay";
    overlay.innerHTML = `
      <div class="orders-store-picker-dialog" role="dialog" aria-modal="true" aria-label="Seleccionar tienda">
        <div class="orders-store-picker-title">Nueva orden</div>
        <div class="orders-store-picker-help">Selecciona la tienda para crear el pedido.</div>
        <div class="form-group orders-store-picker-group">
          <label for="ordersStorePickerSelect">Tienda</label>
          <select id="ordersStorePickerSelect"></select>
        </div>
        <div class="orders-store-picker-actions">
          <button type="button" class="btn btn-secondary btn-small" data-role="cancel">Cancelar</button>
          <button type="button" class="btn btn-primary btn-small" data-role="confirm">Crear pedido</button>
        </div>
      </div>
    `;

    const select = overlay.querySelector("#ordersStorePickerSelect");
    const cancelBtn = overlay.querySelector("button[data-role='cancel']");
    const confirmBtn = overlay.querySelector("button[data-role='confirm']");
    if (!select || !cancelBtn || !confirmBtn) {
      resolve(null);
      return;
    }

    const addOption = (value, label) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      select.appendChild(opt);
    };
    addOption("", "Sin tienda");
    stores.forEach((store) => addOption(store.id, store.name));

    const activeStoreId = String(currentOrderStoreId || "");
    if (activeStoreId && stores.some((store) => store.id === activeStoreId)) {
      select.value = activeStoreId;
    } else {
      select.value = "";
    }

    const close = (result = null) => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      resolve(result);
    };

    const confirm = () => {
      const storeId = String(select.value || "");
      const store = stores.find((item) => item.id === storeId) || { id: "", name: "Sin tienda" };
      close(store);
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(null);
        return;
      }
      if (e.key === "Enter") {
        const target = e.target;
        if (target instanceof HTMLButtonElement && target.dataset.role === "cancel") return;
        e.preventDefault();
        confirm();
      }
    };

    cancelBtn.addEventListener("click", () => close(null));
    confirmBtn.addEventListener("click", confirm);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(null);
    });
    document.addEventListener("keydown", onKeyDown, true);
    document.body.appendChild(overlay);
    setTimeout(() => select.focus(), 0);
  });
}

function createNewOrderDraft(storeId = "", { clearFilters = false, switchToOperative = false } = {}) {
  const normalizedStoreId = String(storeId || "");
  const now = nowIsoString();
  const today = todayDateString();
  const payload = {
    id: generateOrderId(),
    name: "",
    plannedDate: today,
    price: "",
    completedAt: "",
    completedPlannedDate: "",
    storeId: normalizedStoreId,
    storeName: getStoreName(normalizedStoreId) || "",
    items: [],
    createdAt: now,
    updatedAt: now,
  };
  const next = getOrdersList().slice();
  next.push(payload);
  currentOrderId = payload.id || "";
  currentOrderStoreId = normalizedStoreId;
  if (clearFilters) {
    if (ordersStoreSelect) ordersStoreSelect.value = "";
    if (ordersDateFilterSelect) ordersDateFilterSelect.value = "";
  }
  if (switchToOperative) setOrdersSubview("operative");
  setOrdersList(next);
  renderOrdersSection(true);
  return payload;
}

function handleNewOrder(e) {
  const triggeredFromTopQuick =
    !!e &&
    typeof e === "object" &&
    e.currentTarget &&
    e.currentTarget.id === "addOrderQuickButton";
  let storeId = ordersStoreSelect ? ordersStoreSelect.value || currentOrderStoreId : currentOrderStoreId;
  if (triggeredFromTopQuick) {
    promptStoreForNewOrder().then((selectedStore) => {
      if (!selectedStore) return;
      const nextStoreId = selectedStore.id || "";
      createNewOrderDraft(nextStoreId, { clearFilters: true, switchToOperative: true });
    });
    return;
  }
  createNewOrderDraft(storeId || "", { clearFilters: false, switchToOperative: false });
}

function handleOrderMetaChange() {
  if (ordersReadOnly) return;
  updateOrdersSummaryFromTable();
}

function handleOrdersFilterChange() {
  const { order, storeId } = getCurrentOrderContext();
  buildOrderProductOptions(storeId, order);
  applyOrdersFilters();
}

function openOrdersBatchPanel() {
  if (!ordersBatchPanel) return;
  updateOrdersBatchToggleLabel();
  ordersBatchPanel.hidden = false;
  ordersBatchPanel.classList.add("open");
  if (toggleOrdersBatchButton) toggleOrdersBatchButton.setAttribute("aria-expanded", "true");
  if (ordersBatchSelect) ordersBatchSelect.focus();
}

function closeOrdersBatchPanel() {
  if (!ordersBatchPanel) return;
  ordersBatchPanel.hidden = true;
  ordersBatchPanel.classList.remove("open");
  if (toggleOrdersBatchButton) toggleOrdersBatchButton.setAttribute("aria-expanded", "false");
  if (toggleOrdersBatchButton) toggleOrdersBatchButton.focus();
}

function handleToggleOrdersBatchPanel() {
  if (!ordersBatchPanel) return;
  const isOpen = !ordersBatchPanel.hidden && ordersBatchPanel.classList.contains("open");
  if (isOpen) closeOrdersBatchPanel();
  else openOrdersBatchPanel();
}

function handleCloseOrdersBatchPanel() {
  closeOrdersBatchPanel();
}

function handleOrdersBatchKeydown(e) {
  if (e.key !== "Escape") return;
  if (!ordersBatchPanel) return;
  const isOpen = !ordersBatchPanel.hidden && ordersBatchPanel.classList.contains("open");
  if (!isOpen) return;
  closeOrdersBatchPanel();
}

function handleAddOrderBatch() {
  if (ordersReadOnly) {
    showToast("El histórico es de solo consulta. Duplica para editar.");
    return;
  }
  if (!ordersBatchSelect) return;
  const selected = Array.from(ordersBatchSelect.selectedOptions || []);
  if (!selected.length) return;
  const { order, storeId } = getCurrentOrderContext();
  buildOrderProductOptions(storeId, order);
  removeOrdersPlaceholder();
  selected.forEach((opt) => {
    const label = opt.value || opt.textContent || "";
    const key = (opt.dataset.key || label).trim().toLowerCase();
    const data = orderProductOptionMap.get(key);
    const row = createOrderRow({
      productName: data?.markerLabel || data?.productName || label,
      missing: data?.missing,
      instanceId: data?.instanceId || "",
      productId: data?.productId || "",
    });
    if (row && ordersTableBody) ordersTableBody.appendChild(row);
    opt.selected = false;
  });
  updateOrdersBatchToggleLabel();
  applyOrdersFilters();
  updateOrdersSummaryFromTable();
}

function duplicateOrderPayload(order) {
  if (!order) return null;
  const now = nowIsoString();
  const newId = generateOrderId();
  const cloneItems = Array.isArray(order.items)
    ? order.items.map((item, idx) => ({
        ...item,
        id:
          (crypto?.randomUUID && crypto.randomUUID()) ||
          `orderItem-${Date.now()}-${idx}-${Math.random().toString(36).slice(2)}`,
        createdAt: now,
        updatedAt: now,
      }))
    : [];
  const name = order.name ? `${order.name} (copia)` : "Pedido copia";
  return {
    ...order,
    id: newId,
    name,
    items: cloneItems,
    completedAt: "",
    completedPlannedDate: "",
    createdAt: now,
    updatedAt: now,
  };
}

function handleDuplicateOrder() {
  const { order } = getCurrentOrderContext();
  if (!order) return;
  const payload = duplicateOrderPayload(order);
  if (!payload) return;
  const next = getOrdersList().slice();
  next.push(payload);
  currentOrderId = payload.id || "";
  currentOrderStoreId = payload.storeId || "";
  setOrdersList(next);
  setOrdersSubview("operative");
  renderOrdersSection(true);
  showToast("Pedido duplicado");
}

function handleCompleteOrder() {
  const { order } = getCurrentOrderContext();
  if (!order) return;
  if (order.completedAt) {
    showToast("Este pedido ya está en histórico");
    return;
  }
  const confirmed = window.confirm
    ? window.confirm("¿Marcar este pedido como realizado y moverlo al histórico?")
    : true;
  if (!confirmed) return;
  const planned = resolveOrderPlannedDate(order) || todayDateString();
  const completedAt = nowIsoString();
  markOrderItemsAsHave(order);
  const next = getOrdersList().map((o) =>
    String(o.id) === String(order.id)
      ? { ...o, completedAt, completedPlannedDate: planned, updatedAt: completedAt }
      : o
  );
  const nextByStore = next.find(
    (candidate) =>
      !candidate.completedAt &&
      String(candidate.id || "") !== String(order.id || "") &&
      String(candidate.storeId || "") === String(order.storeId || "")
  );
  const nextAny = next.find(
    (candidate) =>
      !candidate.completedAt && String(candidate.id || "") !== String(order.id || "")
  );
  currentOrderId = (nextByStore || nextAny || order).id || "";
  currentOrderStoreId = (nextByStore || nextAny || order).storeId || "";
  setOrdersList(next);
  renderOrdersSection(true);
  showToast("Pedido marcado como realizado");
}

function handleReplaceOrderBatch() {
  if (ordersReadOnly) {
    showToast("El histórico es de solo consulta. Duplica para editar.");
    return;
  }
  if (!ordersBatchSelect || !ordersTableBody) return;
  const selected = Array.from(ordersBatchSelect.selectedOptions || []);
  const { order, storeId } = getCurrentOrderContext();
  buildOrderProductOptions(storeId, order);
  const existingItems = readOrderRows();
  const findExistingQty = (candidate = {}) => {
    const norm = (candidate.productName || "").trim().toLowerCase();
    const match =
      existingItems.find((it) => it.instanceId && it.instanceId === candidate.instanceId) ||
      existingItems.find((it) => it.productId && it.productId === candidate.productId) ||
      existingItems.find(
        (it) => norm && (it.productName || "").trim().toLowerCase() === norm
      );
    return match?.quantity || "";
  };
  ordersTableBody.innerHTML = "";
  if (!selected.length) {
    addOrdersPlaceholderRow();
    return;
  }
  selected.forEach((opt) => {
    const label = opt.value || opt.textContent || "";
    const key = (opt.dataset.key || label).trim().toLowerCase();
    const data = orderProductOptionMap.get(key);
    const baseItem = {
      productName: data?.markerLabel || data?.productName || label,
      missing: data?.missing,
      instanceId: data?.instanceId || "",
      productId: data?.productId || "",
    };
    const quantity = findExistingQty(baseItem);
    const row = createOrderRow({
      ...baseItem,
      quantity,
    });
    if (row) ordersTableBody.appendChild(row);
    opt.selected = false;
  });
  updateOrdersBatchToggleLabel();
  applyOrdersFilters();
  updateOrdersSummaryFromTable();
}

const shouldRenderProveedoresPanel = (panel) =>
  isActiveSection(proveedoresSection) && !!(panel && panel.classList && panel.classList.contains("active"));

function renderProducers(force = false) {
  const active = shouldRenderProveedoresPanel(producersPanel);
  if (!force && !active) {
    producersNeedsRender = true;
    return;
  }
  const renderFn =
    window.ProducersFeature && typeof window.ProducersFeature.render === "function"
      ? () => window.ProducersFeature.render()
      : window.ProducersView && typeof window.ProducersView.render === "function"
      ? () => window.ProducersView.render(producersViewContext)
      : null;
  if (!renderFn) return;
  const label =
    window.ProducersFeature && typeof window.ProducersFeature.render === "function"
      ? "ProducersFeature.render"
      : "ProducersView.render";
  runMeasured(label, renderFn);
  producersNeedsRender = false;
}

function renderStores(force = false) {
  const active = shouldRenderProveedoresPanel(storesPanel);
  if (!force && !active) {
    storesNeedsRender = true;
    return;
  }
  const renderFn =
    window.StoresFeature && typeof window.StoresFeature.render === "function"
      ? () => window.StoresFeature.render()
      : window.StoresView && typeof window.StoresView.render === "function"
      ? () => window.StoresView.render(storesViewContext)
      : null;
  if (!renderFn) return;
  const label =
    window.StoresFeature && typeof window.StoresFeature.render === "function"
      ? "StoresFeature.render"
      : "StoresView.render";
  runMeasured(label, renderFn);
  storesNeedsRender = false;
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
  const locationsKey = locations.join("|||");
  const locationsChanged = memoProducerLocations.join("|||") !== locationsKey;
  if (locationsChanged) {
    memoProducerLocations = locations.slice();
  }

  if (producersLocationFilterSelect && locationsChanged) {
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

  const sortedProducers = producersList
    .slice()
    .sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" })
    );
  const key = sortedProducers.map((p) => `${p.id}::${p.name || ""}`).join("|||");
  const producerSelects = [
    instancesProducerFilterSelect,
    filterProducerSelect,
    editFilterProducerSelect,
    extraFilterProducerSelect,
    extraEditFilterProducerSelect,
  ].filter(Boolean);

  if (!producerSelects.length) return;

  const needsHydration =
    memoProducerFilterOptions !== key ||
    producerSelects.some((sel) => (sel.options?.length || 0) === 0);

  const currentValues = producerSelects.map((sel) => String(sel.value || ""));
  if (needsHydration) {
    producerSelects.forEach((sel) => {
      sel.innerHTML = "";
      const optAll = document.createElement("option");
      optAll.value = "";
      optAll.textContent = "Todos";
      sel.appendChild(optAll);
      sortedProducers.forEach((p) => {
        const o = document.createElement("option");
        o.value = p.id;
        o.textContent = p.name || "(sin nombre)";
        sel.appendChild(o);
      });
    });
    memoProducerFilterOptions = key;
  }

  producerSelects.forEach((sel, idx) => {
    const current = currentValues[idx];
    if (current && producersList.some((p) => String(p.id || "") === current)) {
      sel.value = current;
    }
  });
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
    updateInventoryComputedColumns();
    return;
  }
  updateInventoryComputedColumns();
}

function handleInventoryTableClick(e) {
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
    setProductDrafts(productDrafts.filter((d) => d.id !== id));
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
    updateInventoryHaveFlag(id, target.checked);
    return;
  }

  refreshProductsFromUnified();

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
  setProductDrafts(productDrafts.filter((d) => d.originalId !== id && d.id !== id));

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
  const haveFilter = extraFilterHaveSelect?.value || "all";
  const buyFilter = extraFilterBuySelect?.value || "all";
  const defBuy =
    buyFilter === "yes" ||
    buyFilter === "buy_future" ||
    buyFilter === "buy_no_future";
  const defHave = haveFilter === "have" ? true : haveFilter === "missing" ? false : false;
  extraDrafts.unshift({
    id,
    name: "",
    block: defBlock,
    type: defType,
    quantity: "",
    notes: "",
    buy: defBuy,
    have: defHave,
  });
  renderExtraQuickTable();
  highlightTopRow(extraListTableBody);
}

function startEditExtra(id) {
  if (!id) return;
  setSelectionButtonsVisibility(true);
  const list = getOtherProducts();
  const prod = list.find((p) => p.id === id);
  if (!prod) return;
  extraDrafts = extraDrafts.filter((d) => d.originalId !== id && d.id !== id);
  const draftId =
    (crypto.randomUUID ? crypto.randomUUID() : "draft-extra-edit-" + Date.now()) +
    "-" +
    Math.random().toString(36).slice(2);
  extraDrafts.unshift({
    id: draftId,
    originalId: id,
    name: prod.name || "",
    block: prod.block || "",
    type: prod.type || "",
    quantity: prod.quantity || "",
    notes: prod.notes || "",
    buy: !!prod.buy,
    have: !!prod.have,
  });
  const scrollParent =
    (extraListTableBody && extraListTableBody.closest(".table-scroll")) || null;
  const prevScroll = scrollParent ? scrollParent.scrollTop : window.scrollY;
  renderExtraQuickTable();
  if (scrollParent) scrollParent.scrollTop = prevScroll;
  else window.scrollTo({ top: prevScroll, behavior: "auto" });
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
  const nextDrafts = [
    {
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
    },
    ...productDrafts,
  ];
  setProductDrafts(nextDrafts);
  renderProducts();
  highlightTopRow(productTableBody);
}

function startEditProduct(id) {
  if (!id) return;
  setSelectionButtonsVisibility(true);
  const list = getPantryProducts();
  const prod = list.find((p) => p.id === id);
  if (!prod) return;
  const draftId =
    (crypto.randomUUID ? crypto.randomUUID() : "draft-edit-" + Date.now()) +
    "-" +
    Math.random().toString(36).slice(2);
  const filteredDrafts = productDrafts.filter((d) => d.originalId !== id);
  const nextDrafts = [
    {
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
    },
    ...filteredDrafts,
  ];
  setProductDrafts(nextDrafts);
  const scrollParent =
    (productTableBody && productTableBody.closest(".table-scroll")) || null;
  const prevScroll = scrollParent ? scrollParent.scrollTop : window.scrollY;
  renderProducts();
  if (scrollParent) scrollParent.scrollTop = prevScroll;
  else window.scrollTo({ top: prevScroll, behavior: "auto" });
}

function deleteProduct(id) {
  if (!id) return;
  const ok = confirm("¿Eliminar este producto?");
  if (!ok) return;
  setProductDrafts(productDrafts.filter((d) => d.originalId !== id && d.id !== id));
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
  if (res && Array.isArray(res.duplicates) && res.duplicates.length) {
    if (shouldShowDuplicateToast(res.duplicates[0])) {
      showToast(`Ya existe un producto con ese nombre: ${res.duplicates[0]}`);
    }
    return;
  }
  if (!res || !res.unified) return;
  setProductDrafts(res.drafts || []);
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
  if (res && Array.isArray(res.duplicates) && res.duplicates.length) {
    if (shouldShowDuplicateToast(res.duplicates[0])) {
      showToast(`Ya existe un producto con ese nombre: ${res.duplicates[0]}`);
    }
    return;
  }
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
  if (!almacenEditPanel || !almacenEditPanel.classList.contains("active")) return;
  if (gridRenderHandle) {
    if (typeof cancelIdleCallback === "function") {
      cancelIdleCallback(gridRenderHandle);
    } else {
      clearTimeout(gridRenderHandle);
    }
    gridRenderHandle = null;
  }
  const run = () => {
    gridRenderHandle = null;
    if (
      window.InventoryEditView &&
      typeof window.InventoryEditView.render === "function"
    ) {
      window.InventoryEditView.render(inventoryEditViewContext);
    }
  };
  gridRenderHandle = setTimeout(run, 0);
}

function handleSaveGrid() {
  if (window.InventoryEditView && typeof window.InventoryEditView.save === "function") {
    window.InventoryEditView.save(inventoryEditViewContext);
  }
}

// ==============================
//  OTROS PRODUCTOS: VISTA
// ==============================

function renderExtraQuickTable(force = false) {
  const listVisible =
    isActiveSection(otrosSection) &&
    otrosListPanel &&
    otrosListPanel.classList &&
    otrosListPanel.classList.contains("active");
  if (!force && !listVisible) {
    extrasNeedsRender = true;
    return;
  }
  if (window.ExtrasFeature && typeof window.ExtrasFeature.render === "function") {
    window.ExtrasFeature.render();
    renderExtraSummary();
    extrasNeedsRender = false;
    return;
  }
  if (window.ExtrasView && typeof window.ExtrasView.render === "function") {
    window.ExtrasView.render(extrasViewContext);
  }
  extrasNeedsRender = false;
  renderExtraSummary();
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
  const editVisible =
    isActiveSection(otrosSection) &&
    otrosEditPanel &&
    otrosEditPanel.classList &&
    otrosEditPanel.classList.contains("active");
  if (!editVisible) return;
  if (extraEditRenderHandle) {
    if (typeof cancelIdleCallback === "function") {
      cancelIdleCallback(extraEditRenderHandle);
    } else {
      clearTimeout(extraEditRenderHandle);
    }
    extraEditRenderHandle = null;
  }
  const run = () => {
    extraEditRenderHandle = null;
    if (window.ExtraEditView && typeof window.ExtraEditView.render === "function") {
      window.ExtraEditView.render(extraEditViewContext);
    }
  };
  extraEditRenderHandle = setTimeout(run, 0);
}

// ==============================
//  CLASIFICACIÓN (FAMILIA / TIPO)
// ==============================

function renderClassificationTable() {
  if (!classificationInitDone) initClassificationOnDemand();
  if (!classificationSection || !classificationSection.classList.contains("active")) return;
  if (classificationRenderHandle) {
    if (typeof cancelIdleCallback === "function") {
      cancelIdleCallback(classificationRenderHandle);
    } else {
      clearTimeout(classificationRenderHandle);
    }
    classificationRenderHandle = null;
  }
  const run = () => {
    classificationRenderHandle = null;
    if (
      window.ClassificationView &&
      typeof window.ClassificationView.render === "function"
    ) {
      updateClassificationFilterOptions();
      window.ClassificationView.render(classificationViewContext);
    }
  };
  classificationRenderHandle = setTimeout(run, 0);
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
  updateClassificationFilterOptions();
  if (window.ClassificationView && typeof window.ClassificationView.filterRows === "function") {
    window.ClassificationView.filterRows(classificationViewContext);
  }
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
    const productId = match ? match.id : "";
    const productById = productId ? findProductById(productId) : null;
    const resolvedBlock = resolveInstanceFamily({
      ...inst,
      productId,
      productName,
      block: inst.block || (match && match.block) || (productById && productById.block) || "",
    });
    const existing = existingInstances.find((i) => i.id === id) || {};
    const createdAt = existing.createdAt || inst.createdAt || now;
    const priorityVal = Number(inst.priority);
    const priority = Number.isFinite(priorityVal)
      ? priorityVal
      : Number.isFinite(existing.priority)
      ? existing.priority
      : 0;
    updates.set(id, {
      ...inst,
      id,
      productId,
      productName,
      block: resolvedBlock,
      storeIds: Array.isArray(inst.storeIds) ? inst.storeIds.filter(Boolean) : [],
      priority,
      createdAt,
      updatedAt: now,
    });
  });

  const next = Array.from(updates.values());
  const consolidated = consolidateInstances(next, now);
  const { list: sanitized } = pruneInstancesWithoutProducerAndStore(consolidated);
  setInstancesList(sanitized);
  cleanupSelectionsWithInstances();
}

function removeInstanceById(id, options = {}) {
  const list = getInstancesList();
  const filtered = list.filter((i) => i.id !== id);
  if (filtered.length === list.length) return;
  setInstancesList(filtered);
  cleanupSelectionsWithInstances();
  const defer = options.deferRefresh === true;
  refreshInstancesViews({ immediate: !defer });
}

function handleInstancesDependencies() {
  refreshInstancesViews({ immediate: true });
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
  if (
    isActiveSection(proveedoresSection) &&
    instancesPanel &&
    instancesPanel.classList.contains("active")
  ) {
    handleSaveInstances();
    return false;
  }
  if (
    isActiveSection(proveedoresSection) &&
    producersPanel &&
    producersPanel.classList.contains("active")
  ) {
    handleSaveProducers();
    return false;
  }
  if (
    isActiveSection(proveedoresSection) &&
    storesPanel &&
    storesPanel.classList.contains("active")
  ) {
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
    setProductDrafts([]);
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

function renderInstancesTable(force = false, { showLoading = true } = {}) {
  const isActive =
    isActiveSection(proveedoresSection) && instancesPanel?.classList?.contains("active");
  if (!force && !isActive) {
    instancesNeedsRender = true;
    return;
  }

  if (instancesRenderHandle) {
    clearTimeout(instancesRenderHandle);
  }
  const ctx = ensureInstancesViewContext();
  ensureInstancesViewInit({ renderAfterInit: false });
  ensureInstancesFeatureInit({ renderAfterInit: false });
  if (typeof hideProductAutocomplete === "function") {
    hideProductAutocomplete();
  }

  const showLoadingRow = () => {
    if (instancesSummaryInfo) {
      instancesSummaryInfo.textContent = "Cargando selecciones...";
    }
  };

  if (showLoading) {
    showLoadingRow();
  }

  const run = () => {
    const t0 = performance.now();
    try {
      if (ctx && ctx.data) {
        ctx.data.instances = getInstancesList();
        ctx.data.producers = getProducersList();
        ctx.data.stores = getSuppliersList();
      }
      if (window.InstancesFeature && typeof window.InstancesFeature.render === "function") {
        window.InstancesFeature.render();
      } else if (window.InstancesView && typeof window.InstancesView.render === "function") {
        window.InstancesView.render(ctx);
      }
      instancesNeedsRender = false;
    } catch (err) {
      console.error("renderInstancesTable error", err);
      instancesNeedsRender = true;
    } finally {
      instancesRenderHandle = null;
      perfLog("renderInstancesTable", performance.now() - t0);
    }
  };

  // Defer un tick para que la pestaña y el mensaje se pinten antes del cálculo
  instancesRenderHandle = setTimeout(run, 0);
}

function refreshInstancesViews({ immediate = false } = {}) {
  const run = () => {
    instancesRefreshTimer = null;
    producersNeedsRender = true;
    storesNeedsRender = true;
    if (isActiveSection(proveedoresSection)) {
      if (producersPanel && producersPanel.classList.contains("active")) {
        renderProducers(true);
      }
      if (storesPanel && storesPanel.classList.contains("active")) {
        renderStores(true);
      }
    }
    renderInstancesTable();
    renderProducts();
    renderExtraQuickTable();
    renderExtraEditTable();
    renderShoppingList();
  };
  if (immediate) {
    run();
    return;
  }
  if (instancesRefreshTimer) clearTimeout(instancesRefreshTimer);
  instancesRefreshTimer = setTimeout(run, INSTANCES_REFRESH_DELAY);
}

function handleAddInstanceRow() {
  ensureInstancesViewContext();
  if (window.InstancesView && typeof window.InstancesView.addRow === "function") {
    window.InstancesView.addRow(instancesViewContext);
  }
}

function handleSaveInstances() {
  flushInstancesUpdates();
  ensureInstancesViewContext();
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
  const prefillName = (prefill || "").trim();
  if (!prefillName) {
    alert("Escribe un nombre en el campo Producto antes de crearlo.");
    if (nameInput) nameInput.focus();
    return;
  }

  const exists = getUnifiedList().some(
    (p) => (p.name || "").toLowerCase() === prefillName.toLowerCase()
  );
  if (exists) {
    alert("Ya existe un producto con ese nombre en el inventario.");
    return;
  }

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
  let escHandler = null;

  const fgName = document.createElement("div");
  fgName.className = "form-group";
  const lblName = document.createElement("label");
  lblName.textContent = "Nombre producto";
  const nameDisplay = document.createElement("div");
  nameDisplay.className = "inline-product-name-display";
  nameDisplay.textContent = prefillName;
  fgName.appendChild(lblName);
  fgName.appendChild(nameDisplay);

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
  btnSave.className = "btn btn-success btn-small";
  btnSave.textContent = "✓";
  btnSave.title = "Crear producto";
  btnSave.setAttribute("aria-label", "Crear producto");
  const closeCreator = () => {
    tr.remove();
    if (escHandler) {
      window.removeEventListener("keydown", escHandler, true);
      escHandler = null;
    }
  };

  btnSave.addEventListener("click", () => {
    const nameVal = prefillName;
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
    closeCreator();
  });

  const btnCancel = document.createElement("button");
  btnCancel.type = "button";
  btnCancel.className = "btn btn-danger btn-small";
  btnCancel.textContent = "✕";
  btnCancel.title = "Cancelar";
  btnCancel.setAttribute("aria-label", "Cancelar");
  btnCancel.addEventListener("click", closeCreator);
  escHandler = (e) => {
    if (e.key === "Escape") {
      closeCreator();
    }
  };
  window.addEventListener("keydown", escHandler, { capture: true });

  const preventTableRenderBubble = (el) => {
    if (!el) return;
    ["input", "change"].forEach((evt) => {
      el.addEventListener(evt, (e) => {
        e.stopPropagation();
      });
    });
  };
  preventTableRenderBubble(selFam);
  preventTableRenderBubble(selType);
  preventTableRenderBubble(inpQty);
  preventTableRenderBubble(inpNotes);

  actions.appendChild(btnCancel);
  actions.appendChild(btnSave);

  form.appendChild(fgName);
  form.appendChild(fgFam);
  form.appendChild(fgType);
  form.appendChild(fgQty);
  form.appendChild(fgNotes);
  form.appendChild(actions);

  td.appendChild(form);
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

function findStoreByName(name = "") {
  const normalized = (name || "").trim().toLowerCase();
  if (!normalized) return null;
  return (
    getSuppliersList().find((store) => (store.name || "").trim().toLowerCase() === normalized) ||
    null
  );
}

function normalizeStoreGroupingKey(storeId = "", storeName = "") {
  if (storeId) return `id:${storeId}`;
  const safeName = (storeName || "").trim().toLowerCase();
  return `name:${safeName || "sin tienda"}`;
}

function resolveShoppingStoreContext(product, fallbackStoreName = "") {
  const fallback = (fallbackStoreName || "").trim();
  const selectedStoreName = getSelectionMainStoreName(product);
  const hasSelectedStore = selectedStoreName && selectedStoreName !== "Sin tienda seleccionada";
  const resolvedName = hasSelectedStore ? selectedStoreName : fallback || "Sin tienda";
  const instance = getSelectionInstanceForProduct(product);
  const selectedId =
    instance && Array.isArray(instance.storeIds) && instance.storeIds.length
      ? String(instance.storeIds[0] || "").trim()
      : "";
  if (selectedId) {
    return {
      storeId: selectedId,
      storeName: getStoreName(selectedId) || resolvedName || "Sin tienda",
    };
  }
  const matchedStore = findStoreByName(resolvedName);
  return {
    storeId: matchedStore?.id || "",
    storeName: resolvedName || "Sin tienda",
  };
}

function buildShoppingStoreSummary() {
  const pantryProducts = getPantryProducts();
  const otherProducts = getOtherProducts();
  const baseSummary =
    (window.AppStore &&
      window.AppStore.selectors &&
      window.AppStore.selectors.shoppingSummary &&
      window.AppStore.selectors.shoppingSummary({
        products: pantryProducts,
        extraProducts: otherProducts,
      })) || {
      stores: [],
      totalItems: 0,
      totalStores: 0,
    };
  const grouped = new Map();
  baseSummary.stores.forEach(({ store, items }) => {
    items.forEach(({ product, source }) => {
      const storeCtx = resolveShoppingStoreContext(product, store || "");
      const groupKey = normalizeStoreGroupingKey(storeCtx.storeId, storeCtx.storeName);
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          key: groupKey,
          storeId: storeCtx.storeId || "",
          storeName: storeCtx.storeName || "Sin tienda",
          items: [],
        });
      }
      grouped.get(groupKey).items.push({ product, source });
    });
  });
  const stores = Array.from(grouped.values()).map((entry) => ({
    ...entry,
    count: entry.items.length,
  }));
  const totalItems = stores.reduce((acc, entry) => acc + entry.items.length, 0);
  return {
    stores,
    totalItems,
    totalStores: stores.length,
  };
}

function renderShoppingList(force = false) {
  if (!shoppingListContainer || !shoppingSummary) return;
  const main = document.querySelector(".app-main");
  const shoppingHidden = !!(main && main.classList && main.classList.contains("shopping-hidden"));
  const shoppingPanelVisible = !shoppingHidden || isActiveSection(shoppingSection);
  if (!force && !shoppingPanelVisible) {
    shoppingNeedsRender = true;
    return;
  }
  shoppingNeedsRender = false;
  shoppingListContainer.innerHTML = "";

  const summary = buildShoppingStoreSummary();

  if (summary.stores.length === 0) {
    shoppingSummary.textContent = "0 producto(s) · 0 tienda(s)";
    const empty = document.createElement("div");
    empty.className = "shopping-empty";
    empty.textContent = "No hay productos pendientes.";
    shoppingListContainer.appendChild(empty);
    return;
  }

  const createStoreBlock = (storeName, items) => {
    const frag = cloneTemplateContent(shoppingStoreTemplate);
    if (!frag) return null;
    const block = frag.querySelector(".shopping-store-block");
    const title = frag.querySelector(".shopping-store-title");
    const count = frag.querySelector(".shopping-store-count");
    const list = frag.querySelector(".shopping-store-items");
    if (!block || !title || !count || !list) return null;
    block.dataset.store = storeName;
    title.textContent = storeName;
    count.textContent = `${items.length} producto(s)`;

    const grouped = new Map();
    items.forEach(({ product, source }) => {
      const family = (product.block || "").trim();
      const key = family || "Sin familia";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push({ product, source, family });
    });

    const groupEntries = Array.from(grouped.entries()).sort((a, b) =>
      a[0].toLowerCase().localeCompare(b[0].toLowerCase(), "es", { sensitivity: "base" })
    );

    let firstGroup = true;
    groupEntries.forEach(([, group]) => {
      const family = group[0].family || "Sin familia";
      if (!firstGroup) {
        const divider = document.createElement("div");
        divider.className = "shopping-group-divider";
        list.appendChild(divider);
      }
      firstGroup = false;
      const titleEl = document.createElement("div");
      titleEl.className = "shopping-group-title";
      titleEl.textContent = family;
      list.appendChild(titleEl);

      group.forEach(({ product, source }) => {
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
        const inst = getSelectionInstanceForProduct(product);
        const brand = (product.brand || inst?.brand || "").trim();
        const provider =
          (product.producerName || "").trim() ||
          (inst?.producerId ? getProducerName(inst.producerId) : "");
        if (provider) parts.push(provider);
        if (brand) parts.push(brand);
        meta.textContent = parts.join(" · ");
        if (!meta.textContent) {
          meta.style.display = "none";
        }

        if (!li.contains(main)) li.appendChild(main);
        if (!li.contains(meta)) li.appendChild(meta);

        list.appendChild(li);
      });
    });

    return frag;
  };

  summary.stores
    .slice()
    .sort((a, b) => a.storeName.localeCompare(b.storeName, "es", { sensitivity: "base" }))
    .forEach(({ storeName, items }) => {
      const block = createStoreBlock(storeName, items);
      if (block) {
        shoppingListContainer.appendChild(block);
      }
    });

  shoppingSummary.textContent = `${summary.totalItems} producto(s) · ${summary.totalStores} tienda(s)`;
}

function renderExtraSummary() {
  if (!extraSummaryInfo || !extraListTableBody) return;
  const rows = Array.from(extraListTableBody.querySelectorAll("tr[data-id]"));
  const visible = rows.filter((tr) => tr.style.display !== "none");
  const totalAll = getOtherProducts().length;
  const buyVisible = visible.filter((tr) => tr.dataset.buy === "1").length;
  const filtered = areExtraFiltersActive() || visible.length !== totalAll;
  if (filtered) {
    extraSummaryInfo.textContent = `Total: ${totalAll} · Visibles: ${visible.length} · A comprar: ${buyVisible}`;
  } else {
    extraSummaryInfo.textContent = `Total: ${totalAll} · A comprar: ${buyVisible}`;
  }
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
  const snapshot = {
    ...snap,
    products: getPantryProducts(),
    extraProducts: getOtherProducts(),
    unifiedProducts: unified,
    suppliers: getSuppliersList(),
    producers: getProducersList(),
    productInstances: getInstancesList(),
    classifications: getClassificationsList(),
    orders: getOrdersList(),
  };
  if (window.BackupUtils && typeof window.BackupUtils.exportBackup === "function") {
    window.BackupUtils.exportBackup({ snapshot });
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
          unifiedDirty = true;
          suppliers = snap.suppliers;
          producers = snap.producers;
          productInstances = snap.productInstances;
          classifications = snap.classifications;
          orders = snap.orders || [];
          persistUnified(unifiedProducts);
          saveSuppliers();
          saveProducers();
          saveProductInstances();
          saveClassifications();
          setOrdersList(orders);
          refreshProductsFromUnified(true);
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
          renderProducers();
          renderStores();
          renderClassificationTable();
          renderInstancesTable();
          renderShoppingList();
          renderOrdersSection(true);
        };

        if (window.AppStore && typeof window.AppStore.setState === "function") {
          const snapWithOrders = { ...snapshot, orders: Array.isArray(snapshot.orders) ? snapshot.orders : [] };
          window.AppStore.setState(snapWithOrders);
          setOrdersList(snapWithOrders.orders);
          syncFromAppStore();
          renderOrdersSection(true);
        } else {
          applySnapshot({ ...snapshot, orders: Array.isArray(snapshot.orders) ? snapshot.orders : [] });
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
        orders: Array.isArray(data.orders) ? data.orders : [],
      };
      const applySnapshot = (snap) => {
        unifiedProducts = snap.unifiedProducts;
        unifiedDirty = true;
        suppliers = snap.suppliers;
        producers = snap.producers;
        productInstances = snap.productInstances;
        classifications = snap.classifications;
        orders = snap.orders || [];
        persistUnified(unifiedProducts);
        saveSuppliers();
        saveProducers();
        saveProductInstances();
        saveClassifications();
        setOrdersList(orders);
        refreshProductsFromUnified(true);
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
        renderProducers();
        renderStores();
        renderClassificationTable();
        renderInstancesTable();
        renderShoppingList();
        renderOrdersSection(true);
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

function handlePruneSelections() {
  flushInstancesUpdates();
  const current = getInstancesList();
  const { list: cleaned, removed } = pruneInstancesWithoutProducerAndStore(current);
  if (!removed) {
    showToast("No hay selecciones vacías para depurar");
    return;
  }
  const ok =
    typeof window.confirm === "function"
      ? window.confirm(
          `Se eliminarán ${removed} selección(es) sin productor y sin tienda. ¿Continuar?`
        )
      : true;
  if (!ok) return;
  setInstancesList(cleaned);
  cleanupSelectionsWithInstances();
  refreshInstancesViews({ immediate: true });
  showToast(`${removed} selección(es) eliminada(s)`);
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

function handleExportStoresCsv() {
  if (window.BackupUtils && typeof window.BackupUtils.exportStoresCsv === "function") {
    window.BackupUtils.exportStoresCsv({
      stores: getSuppliersList(),
      filename: "tiendas.xlsx",
      sheetName: "Tiendas",
    });
  }
}
