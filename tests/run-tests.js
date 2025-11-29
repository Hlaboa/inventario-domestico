const path = require("path");
const fs = require("fs");
const assert = require("assert");

const modulePath = path.join(__dirname, "..", "appStore.js");

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
