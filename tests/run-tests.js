const path = require("path");
const fs = require("fs");
const assert = require("assert");

const modulePath = path.join(__dirname, "..", "appStore.js");
const dataServicePath = path.join(__dirname, "..", "dataService.js");

function loadStore(stubs = {}) {
  delete require.cache[modulePath];

  const previousWindow = global.window;
  global.window = { localStorage: createMemoryStorage() };

  ["AppState", "DataService", "AppStorage", "AppUtils"].forEach((key) => {
    if (stubs[key]) {
      global.window[key] = stubs[key];
    }
  });

  // Execute module (it attaches AppStore to window)
  require(modulePath);
  const store = global.window.AppStore;
  if (!store) {
    throw new Error("AppStore not initialized");
  }

  store.__cleanup = () => {
    global.window = previousWindow;
    delete require.cache[modulePath];
  };

  return store;
}

function createMemoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    clear: () => data.clear(),
    _data: data,
  };
}

function loadDataService(stubs = {}) {
  delete require.cache[dataServicePath];
  const previousWindow = global.window;
  global.window = {
    localStorage: stubs.localStorage || createMemoryStorage(),
    ...stubs,
  };
  global.localStorage = global.window.localStorage;
  require(dataServicePath);
  const ds = global.window.DataService;
  if (!ds) throw new Error("DataService no inicializado");
  ds.__cleanup = () => {
    global.window = previousWindow;
    delete require.cache[dataServicePath];
  };
  return ds;
}

class StubElement {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.className = "";
    this.textContent = "";
    this.value = "";
    this.checked = false;
    this.attributes = {};
    this.classList = {
      add: () => {},
      remove: () => {},
      toggle: () => {},
    };
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
  set innerHTML(val) {
    this.children = [];
    this._innerHTML = val;
  }
  get innerHTML() {
    return this._innerHTML || "";
  }
  addEventListener() {}
  querySelectorAll(selector) {
    if (selector === "tr") {
      return this.children.filter((c) => c.tag === "tr");
    }
    return [];
  }
}

function createStubDocument() {
  return {
    createElement: (tag) => new StubElement(tag),
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

const tests = [];
const register = (name, fn) => tests.push({ name, fn });

register("bootstrap carga datos desde DataService y los deja en el estado", () => {
  const AppState = {
    state: {},
    hydrateCalls: [],
    hydrate(patch) {
      this.hydrateCalls.push(patch);
      this.state = { ...this.state, ...(patch || {}) };
    },
    getState() {
      return this.state;
    },
    subscribe() {
      return () => {};
    },
  };

  const loaded = {
    products: [{ id: "p1", name: "Arroz", scope: "almacen" }],
    extraProducts: [{ id: "e1", name: "Velas", scope: "otros" }],
    unifiedProducts: [{ id: "u1", name: "Arroz", scope: "almacen" }],
    suppliers: [{ id: "s1", name: "Tienda X" }],
    producers: [{ id: "pr1", name: "Productor Y" }],
    classifications: [{ id: "c1", block: "Granos", type: "Arroz" }],
    productInstances: [{ id: "i1", productId: "p1" }],
  };

  const DataService = {
    hydrateFromStorage() {
      return loaded;
    },
  };

  const store = loadStore({ AppState, DataService });
  const snapshot = store.bootstrap();

  assert.strictEqual(snapshot.products.length, 1, "Debe cargar products");
  assert.strictEqual(snapshot.extraProducts.length, 1, "Debe cargar extraProducts");
  assert.strictEqual(snapshot.unifiedProducts.length, 1, "Debe cargar unifiedProducts");
  assert.strictEqual(snapshot.suppliers[0].name, "Tienda X");

  store.__cleanup();
});

register("actions.setProducts sin DataService actualiza AppState y AppStore", () => {
  const AppState = {
    state: {},
    hydrateCalls: [],
    hydrate(patch) {
      this.hydrateCalls.push(patch);
      this.state = { ...this.state, ...(patch || {}) };
    },
    getState() {
      return this.state;
    },
    subscribe() {
      return () => {};
    },
  };

  const store = loadStore({ AppState });
  const sample = [{ id: "p2", name: "Pasta" }];
  store.actions.setProducts(sample);
  const snapshot = store.getState();

  assert.strictEqual(snapshot.products.length, 1, "Debe guardar el producto");
  assert.strictEqual(
    AppState.hydrateCalls.length,
    1,
    "Debe notificar a AppState.hydrate"
  );
  assert.deepStrictEqual(
    AppState.hydrateCalls[0],
    { products: sample },
    "Debe hidratar con el patch de productos"
  );

  store.__cleanup();
});

register("selectores usan DataService si está disponible", () => {
  const calls = { families: 0, types: 0 };
  const AppState = {
    state: {},
    hydrate() {},
    getState() {
      return this.state;
    },
    subscribe() {
      return () => {};
    },
  };

  const DataService = {
    selectors: {
      families() {
        calls.families += 1;
        return ["Familia DS"];
      },
      types(_, family) {
        calls.types += 1;
        return family ? [`Tipo ${family}`] : ["Tipo DS"];
      },
    },
  };

  const store = loadStore({ AppState, DataService });
  store.setState({ products: [], extraProducts: [] });
  const fams = store.selectors.families();
  const types = store.selectors.types(null, "Familia DS");

  assert.deepStrictEqual(fams, ["Familia DS"], "Debe delegar en DataService.families");
  assert.deepStrictEqual(types, ["Tipo Familia DS"], "Debe delegar en DataService.types");
  assert.strictEqual(calls.families, 1);
  assert.strictEqual(calls.types, 1);

  store.__cleanup();
});

register("AppStorage normaliza productos y extraProducts con scope correcto", () => {
  const AppUtils = {
    nowIsoString: () => "2024-01-01T00:00:00.000Z",
    safeLoadList: () => [],
    saveList: () => {},
  };
  const storageModule = path.join(__dirname, "..", "storage.js");
  delete require.cache[storageModule];
  global.window = { AppUtils, localStorage: createMemoryStorage() };
  require(storageModule);
  const normalize = global.window.AppStorage.normalize;
  const prod = normalize.product({ id: "1", name: "A", have: "on", block: "B" });
  const extra = normalize.extraProduct({ id: "2", name: "E", buy: "on", scope: "otros" });
  assert.strictEqual(prod.scope, undefined, "Productos no fijan scope (solo unified)");
  assert.strictEqual(extra.buy, true, "Extra marca buy en booleano");
  const unified = normalize.unifiedProduct({ id: "3", name: "U", have: "on", scope: "otros" });
  assert.strictEqual(unified.scope, "otros", "Unified respeta scope 'otros'");
});

register("AppStorage migrates unifiedProducts if vacío", () => {
  const AppUtils = {
    nowIsoString: () => "2024-01-01T00:00:00.000Z",
    safeLoadList: (key) => {
      if (key === "inventarioCocinaAlmacen") return [{ id: "p1", name: "Prod" }];
      if (key === "otrosProductosCompra") return [{ id: "e1", name: "Extra" }];
      return [];
    },
    saveList: (key, list) => {
      global.__saved = global.__saved || {};
      global.__saved[key] = list;
    },
  };
  const storageModule = path.join(__dirname, "..", "storage.js");
  delete require.cache[storageModule];
  global.window = { AppUtils, localStorage: createMemoryStorage() };
  require(storageModule);
  const storage = global.window.AppStorage;
  const unified = storage.loadUnifiedProducts();
  assert.strictEqual(unified.length, 2, "Debe migrar productos y extras");
  assert.strictEqual(unified[0].scope, "almacen");
  assert.strictEqual(unified[1].scope, "otros");
});

register("DataService.persistState guarda unifiedProducts y listas separadas", () => {
  const AppState = {
    state: {},
    hydrate(patch) {
      this.state = { ...this.state, ...(patch || {}) };
    },
    getState() {
      return this.state;
    },
    subscribe() {
      return () => {};
    },
  };

  const storageKeys = {
    products: "inventarioCocinaAlmacen",
    extraProducts: "otrosProductosCompra",
    unifiedProducts: "productosCocinaUnificados",
    suppliers: "proveedoresCocina",
    producers: "productoresCocina",
    productInstances: "instanciasProductosCocina",
    classifications: "clasificacionesProductosCocina",
  };

  const AppStorage = {
    keys: storageKeys,
    normalize: {},
  };

  const localStorage = createMemoryStorage();

  global.window = { AppState, AppStorage, localStorage };
  global.localStorage = localStorage;
  const dsPath = path.join(__dirname, "..", "dataService.js");
  delete require.cache[dsPath];
  require(dsPath);

  const state = {
    products: [{ id: "p1", name: "Prod" }],
    extraProducts: [{ id: "e1", name: "Extra" }],
    unifiedProducts: [],
    suppliers: [{ id: "s1" }],
    producers: [{ id: "pr1" }],
    classifications: [{ id: "c1", block: "F", type: "T" }],
    productInstances: [{ id: "i1", productId: "p1" }],
  };

  global.window.DataService.persistState(state);

  const unified = JSON.parse(localStorage.getItem(storageKeys.unifiedProducts));
  const prods = JSON.parse(localStorage.getItem(storageKeys.products));
  const extras = JSON.parse(localStorage.getItem(storageKeys.extraProducts));
  assert.strictEqual(unified.length, 2, "Unificados incluye productos y extras");
  assert.strictEqual(prods.length, 1, "Guarda lista de productos");
  assert.strictEqual(extras.length, 1, "Guarda lista de extras");
});

register("DataService.setUnifiedProducts persiste y actualiza AppState", () => {
  const AppState = {
    state: {},
    hydrate(patch) {
      this.state = { ...this.state, ...(patch || {}) };
    },
    getState() {
      return this.state;
    },
    subscribe() {
      return () => {};
    },
  };
  const localStorage = createMemoryStorage();
  const ds = loadDataService({ AppState, localStorage });

  const unified = [{ id: "u1", scope: "almacen", name: "Prod" }];
  ds.setUnifiedProducts(unified);

  const stored = JSON.parse(localStorage.getItem("productosCocinaUnificados"));
  assert.strictEqual(stored.length, 1, "Guarda unifiedProducts");
  assert.strictEqual(AppState.state.unifiedProducts.length, 1, "Actualiza AppState");

  ds.__cleanup();
});

register("InventoryView.render crea filas para productos", () => {
  delete require.cache[path.join(__dirname, "..", "inventoryView.js")];
  const productTableBody = new StubElement("tbody");
  const refs = {
    productTableBody,
    filterSearchInput: { value: "" },
    filterShelfSelect: { value: "" },
    filterBlockSelect: { value: "" },
    filterTypeSelect: { value: "" },
    filterStoreSelect: { value: "" },
    filterStatusSelect: { value: "all" },
    summaryInfo: { textContent: "" },
  };
  const stubDocument = createStubDocument();
  global.window = { document: stubDocument };
  global.document = stubDocument;
  require(path.join(__dirname, "..", "inventoryView.js"));

  const products = [{ id: "p1", name: "Arroz", block: "Granos", type: "Blanco", shelf: "A", quantity: "1", have: true }];
  const productDrafts = [{ id: "d1", name: "Draft" }];
  const helpers = {
    compareShelfBlockTypeName: () => 0,
    buildFamilyStripeMap: () => ({}),
    createFamilySelect: () => new StubElement("select"),
    createTypeSelect: () => new StubElement("select"),
    createTableInput: () => new StubElement("input"),
    createTableTextarea: () => new StubElement("textarea"),
    linkFamilyTypeSelects: () => {},
    productMatchesStore: () => true,
    getSelectionLabelForProduct: () => "",
    getSelectionStoresForProduct: () => "",
    createSelectionButton: () => new StubElement("button"),
    handleInventoryTableClick: () => {},
  };

  global.window.InventoryView.render({ refs, state: { products, productDrafts }, helpers });

  const rows = productTableBody.querySelectorAll("tr");
  if (rows.length !== 2) {
    throw new Error(`Se esperaban 2 filas (1 draft + 1 producto), hay ${rows.length}`);
  }
});

register("InstancesView.render crea filas para instancias", () => {
  delete require.cache[path.join(__dirname, "..", "instancesView.js")];
  const tableBody = new StubElement("tbody");
  const refs = {
    tableBody,
    searchInput: { value: "" },
    familyFilter: { value: "" },
    producerFilter: { value: "" },
    storeFilter: { value: "" },
  };
  const stubDocument = createStubDocument();
  global.window = { document: stubDocument };
  global.document = stubDocument;
  require(path.join(__dirname, "..", "instancesView.js"));

  const inst = {
    id: "i1",
    productName: "Arroz",
    producerId: "",
    brand: "Marca",
    storeIds: [],
    notes: "",
  };
  const context = {
    refs,
    data: { instances: [inst], producers: [], stores: [] },
    getFamilyForInstance: () => "Granos",
    getProducerName: () => "",
    getStoreNames: () => "",
    buildFamilyStripeMap: () => ({}),
  };

  global.window.InstancesView.render(context);
  const rows = tableBody.querySelectorAll("tr");
  if (rows.length !== 1) {
    throw new Error(`Se esperaba 1 fila de instancia, hay ${rows.length}`);
  }
});

(function run() {
  const results = [];
  tests.forEach(({ name, fn }) => {
    try {
      fn();
      results.push({ name, status: "passed" });
      console.log(`✅  ${name}`);
    } catch (err) {
      results.push({ name, status: "failed", error: err });
      console.error(`❌  ${name}: ${err.message}`);
    }
  });

  const failed = results.filter((r) => r.status === "failed");
  console.log(`\n${results.length - failed.length}/${results.length} tests ok`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
})();
