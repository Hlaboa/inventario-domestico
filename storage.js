(() => {
  const { nowIsoString, safeLoadList, saveList } = window.AppUtils;

  const STORAGE_KEY = "inventarioCocinaAlmacen";
  const STORAGE_KEY_EXTRA = "otrosProductosCompra";
  const STORAGE_KEY_SUPPLIERS = "proveedoresCocina";
  const STORAGE_KEY_PRODUCERS = "productoresCocina";
  const STORAGE_KEY_INSTANCES = "instanciasProductosCocina";
  const STORAGE_KEY_CLASSIFICATIONS = "clasificacionesProductosCocina";

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

  function loadProducts() {
    return safeLoadList(STORAGE_KEY, normalizeProduct);
  }

  function loadExtraProducts() {
    return safeLoadList(STORAGE_KEY_EXTRA, normalizeExtraProduct);
  }

  function loadSuppliers() {
    return safeLoadList(STORAGE_KEY_SUPPLIERS, normalizeSupplier);
  }

  function loadProducers() {
    return safeLoadList(STORAGE_KEY_PRODUCERS, normalizeProducer);
  }

  function loadClassifications(products = [], extraProducts = []) {
    let classifications = safeLoadList(
      STORAGE_KEY_CLASSIFICATIONS,
      normalizeClassification
    );

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

    saveClassifications(classifications);
    return classifications;
  }

  function loadProductInstances() {
    return safeLoadList(STORAGE_KEY_INSTANCES, normalizeInstance);
  }

  function saveProducts(products) {
    saveList(STORAGE_KEY, products);
  }
  function saveExtraProducts(list) {
    saveList(STORAGE_KEY_EXTRA, list);
  }
  function saveSuppliers(list) {
    saveList(STORAGE_KEY_SUPPLIERS, list);
  }
  function saveProducers(list) {
    saveList(STORAGE_KEY_PRODUCERS, list);
  }
  function saveProductInstances(list) {
    saveList(STORAGE_KEY_INSTANCES, list);
  }
  function saveClassifications(list) {
    saveList(STORAGE_KEY_CLASSIFICATIONS, list);
  }

  function loadAllData() {
    const products = loadProducts();
    const extraProducts = loadExtraProducts();
    const suppliers = loadSuppliers();
    const producers = loadProducers();
    const classifications = loadClassifications(products, extraProducts);
    const productInstances = loadProductInstances();
    return {
      products,
      extraProducts,
      suppliers,
      producers,
      classifications,
      productInstances,
    };
  }

  window.AppStorage = {
    STORAGE_KEY,
    STORAGE_KEY_EXTRA,
    STORAGE_KEY_SUPPLIERS,
    STORAGE_KEY_PRODUCERS,
    STORAGE_KEY_INSTANCES,
    STORAGE_KEY_CLASSIFICATIONS,
    loadProducts,
    loadExtraProducts,
    loadSuppliers,
    loadProducers,
    loadClassifications,
    loadProductInstances,
    saveProducts,
    saveExtraProducts,
    saveSuppliers,
    saveProducers,
    saveProductInstances,
    saveClassifications,
    loadAllData,
    normalize: {
      product: normalizeProduct,
      extraProduct: normalizeExtraProduct,
      supplier: normalizeSupplier,
      producer: normalizeProducer,
      instance: normalizeInstance,
      classification: normalizeClassification,
    },
    keys: {
      products: STORAGE_KEY,
      extraProducts: STORAGE_KEY_EXTRA,
      suppliers: STORAGE_KEY_SUPPLIERS,
      producers: STORAGE_KEY_PRODUCERS,
      productInstances: STORAGE_KEY_INSTANCES,
      classifications: STORAGE_KEY_CLASSIFICATIONS,
    },
  };
})();
