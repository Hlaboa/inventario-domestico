(() => {
  const { nowIsoString, safeLoadList, saveList } = window.AppUtils;

  const STORAGE_KEY_SUPPLIERS = "proveedoresCocina";
  const STORAGE_KEY_SUPPLIERS_BACKUP = "proveedoresCocina_backup";
  const STORAGE_KEY_PRODUCERS = "productoresCocina";
  const STORAGE_KEY_INSTANCES = "instanciasProductosCocina";
  const STORAGE_KEY_CLASSIFICATIONS = "clasificacionesProductosCocina";
  const STORAGE_KEY_UNIFIED = "productosCocinaUnificados";

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
    res.id =
      res.id !== undefined && res.id !== null && String(res.id).trim().length > 0
        ? String(res.id)
        : (crypto.randomUUID
            ? crypto.randomUUID()
            : "prod-" + Math.random().toString(36).slice(2));
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

  function normalizeUnifiedProduct(p) {
    const scope =
      p.scope === "otros" || p.scope === "almacen" ? p.scope : "almacen";
    const base =
      scope === "almacen" ? normalizeProduct(p) : normalizeExtraProduct(p);
    return { ...base, id: base.id ? String(base.id) : base.id, scope };
  }

  function normalizeExtraProduct(p) {
    const res = normalizeMultiFields(p);
    const buy = !!res.buy;
    res.id =
      res.id !== undefined && res.id !== null && String(res.id).trim().length > 0
        ? String(res.id)
        : (crypto.randomUUID
            ? crypto.randomUUID()
            : "extra-" + Math.random().toString(36).slice(2));
    res.selectionId = res.selectionId || "";
    res.buy = buy;
    res.have = res.have !== undefined ? !!res.have : !buy;
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
        s.id !== undefined && s.id !== null && String(s.id).trim().length > 0
          ? String(s.id)
          : (crypto.randomUUID
              ? crypto.randomUUID()
              : "store-" + Math.random().toString(36).slice(2)),
      name: (s.name || "").trim(),
      type: (s.type || "").trim(),
      location: (s.location || s.storesText || "").trim(),
      website: (s.website || "").trim(),
      notes: s.notes || "",
      createdAt: s.createdAt || now,
      updatedAt: s.updatedAt || now,
    };
  }

  function normalizeProducer(p) {
    const now = nowIsoString();
    return {
      id:
        p.id !== undefined && p.id !== null && String(p.id).trim().length > 0
          ? String(p.id)
          : (crypto.randomUUID
              ? crypto.randomUUID()
              : "prod-" + Math.random().toString(36).slice(2)),
      name: (p.name || "").trim(),
      location: (p.location || p.storesText || "").trim(),
      website: (p.website || "").trim(),
      notes: p.notes || "",
      createdAt: p.createdAt || now,
      updatedAt: p.updatedAt || now,
    };
  }

  function normalizeInstance(i) {
    const now = nowIsoString();
    const priorityVal = Number(i.priority);
    const priority = Number.isFinite(priorityVal) ? priorityVal : 0;
    return {
      id:
        i.id !== undefined && i.id !== null && String(i.id).trim().length > 0
          ? String(i.id)
          : (crypto.randomUUID
              ? crypto.randomUUID()
              : "inst-" + Math.random().toString(36).slice(2)),
      productId: i.productId || "",
      productName: (i.productName || "").trim(),
      producerId: i.producerId || "",
      brand: (i.brand || "").trim(),
      storeIds: Array.isArray(i.storeIds) ? i.storeIds.filter(Boolean) : [],
      notes: i.notes || "",
      priority,
      createdAt: i.createdAt || now,
      updatedAt: i.updatedAt || now,
    };
  }

  function normalizeClassification(c) {
    const now = nowIsoString();
    return {
      id:
        c.id !== undefined && c.id !== null && String(c.id).trim().length > 0
          ? String(c.id)
          : (crypto.randomUUID
              ? crypto.randomUUID()
              : "cls-" + Math.random().toString(36).slice(2)),
      block: (c.block || "").trim(),
      type: (c.type || "").trim(),
      notes: c.notes || "",
      createdAt: c.createdAt || now,
      updatedAt: c.updatedAt || now,
    };
  }

  const loadProducts = () => [];
  const loadExtraProducts = () => [];
  const loadSuppliers = () => {
    const list = safeLoadList(STORAGE_KEY_SUPPLIERS, normalizeSupplier);
    if (Array.isArray(list) && list.length > 0) return list;
    const backup = safeLoadList(STORAGE_KEY_SUPPLIERS_BACKUP, normalizeSupplier);
    return Array.isArray(backup) ? backup : [];
  };
  const loadProducers = () => safeLoadList(STORAGE_KEY_PRODUCERS, normalizeProducer);
  const loadClassifications = () => safeLoadList(STORAGE_KEY_CLASSIFICATIONS, normalizeClassification);
  const loadProductInstances = () => safeLoadList(STORAGE_KEY_INSTANCES, normalizeInstance);
  const loadUnifiedProducts = () => {
    const unified = safeLoadList(STORAGE_KEY_UNIFIED, normalizeUnifiedProduct);
    if (Array.isArray(unified) && unified.length > 0) return unified;
    // Si no hay unified, devolver lista vacía; ya no migramos claves antiguas
    return [];
  };

  function saveSuppliers(list) {
    const data = Array.isArray(list) ? list : [];
    saveList(STORAGE_KEY_SUPPLIERS, data);
    if (data.length > 0) {
      // Guardar copia de seguridad para evitar pérdidas accidentales
      saveList(STORAGE_KEY_SUPPLIERS_BACKUP, data);
    }
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

  function saveUnifiedProducts(list) {
    saveList(STORAGE_KEY_UNIFIED, list);
  }

  function loadAllData() {
    const products = loadProducts();
    const extraProducts = loadExtraProducts();
    const suppliers = loadSuppliers();
    const producers = loadProducers();
    const classifications = loadClassifications(products, extraProducts);
    const productInstances = loadProductInstances();
    const unifiedProducts = loadUnifiedProducts();

    return {
      products,
      extraProducts,
      unifiedProducts,
      suppliers,
      producers,
      classifications,
      productInstances,
    };
  }

  window.AppStorage = {
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
    loadUnifiedProducts,
    saveSuppliers,
    saveProducers,
    saveProductInstances,
    saveClassifications,
    saveUnifiedProducts,
    loadAllData,
    normalize: {
      product: normalizeProduct,
      extraProduct: normalizeExtraProduct,
      unifiedProduct: normalizeUnifiedProduct,
      supplier: normalizeSupplier,
      producer: normalizeProducer,
      instance: normalizeInstance,
      classification: normalizeClassification,
    },
    keys: {
      unifiedProducts: STORAGE_KEY_UNIFIED,
      suppliers: STORAGE_KEY_SUPPLIERS,
      producers: STORAGE_KEY_PRODUCERS,
      productInstances: STORAGE_KEY_INSTANCES,
      classifications: STORAGE_KEY_CLASSIFICATIONS,
    },
  };
})();
